import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

const CanvasTimeline = ({
  nodes,
  edges,
  spaces,
  tCurrent,
  selectedNodeId,
  onSelectNode,
  reviews,
  highlightedNodeIds, // Neighbors to highlight during review mode
  onHoverSpace,
  onHoverNode
}) => {
  const containerRef = useRef(null);
  const pixiAppRef = useRef(null);
  console.log("CanvasTimeline render nodes length:", nodes ? nodes.length : "null");
  
  // Viewport transformation states
  const [viewport, setViewport] = useState({
    zoom: 1.0,
    offsetX: 150,
    offsetY: 50
  });
  
  // Dragging state
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewportStart = useRef({ offsetX: 0, offsetY: 0 });

  // Sync references synchronously to avoid Pixi recreate on state changes and prevent race conditions
  const stateRef = useRef({
    nodes,
    edges,
    spaces,
    tCurrent,
    viewport,
    selectedNodeId,
    reviews,
    highlightedNodeIds,
    onHoverSpace,
    onHoverNode
  });

  stateRef.current = {
    nodes,
    edges,
    spaces,
    tCurrent,
    viewport,
    selectedNodeId,
    reviews,
    highlightedNodeIds,
    onHoverSpace,
    onHoverNode
  };

  // Pixi setup
  useEffect(() => {
    if (!containerRef.current) return;

    let isDestroyed = false;
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;

    // Create Pixi application (compatible with v7 and v8)
    const app = new PIXI.Application();
    
    // Initialize asynchronously to handle PIXI v8 style, fallback to sync for v7
    const initApp = async () => {
      try {
        if (typeof app.init === 'function') {
          await app.init({
            width,
            height,
            backgroundColor: 0xFAF9F5,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
          });
        } else {
          // PixiJS v7 sync constructor
          app.renderer.resize(width, height);
        }
        
        if (isDestroyed) {
          app.destroy(true, { children: true });
          return;
        }

        // Clear any existing children from the container to ensure no duplicate canvases
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(app.canvas || app.view);
        }
        pixiAppRef.current = app;
        
        // Draw initial loop
        draw(app);
      } catch (err) {
        console.error("PixiJS initialization failed", err);
      }
    };
    
    initApp();

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      if (!pixiAppRef.current) return;
      const w = containerRef.current?.clientWidth || width;
      const h = containerRef.current?.clientHeight || height;
      
      if (pixiAppRef.current.renderer) {
        pixiAppRef.current.renderer.resize(w, h);
      }
      triggerRedraw();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isDestroyed = true;
      resizeObserver.disconnect();
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true });
        pixiAppRef.current = null;
      } else {
        // Fallback to destroy app if it was in the process of initializing
        try {
          app.destroy(true, { children: true });
        } catch (e) {
          // ignore if app wasn't initialized yet
        }
      }
    };
  }, []);

  // Simple Redraw trigger
  const triggerRedraw = () => {
    if (pixiAppRef.current) {
      draw(pixiAppRef.current);
    }
  };

  // Redraw when states change
  useEffect(() => {
    triggerRedraw();
  }, [nodes, edges, spaces, tCurrent, viewport, selectedNodeId, reviews, highlightedNodeIds]);

  // Coordinate mappings
  // Base date is fixed: 2026-10-20
  const BASE_DATE_TIME = new Date("2026-10-20T12:00:00").getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const PIXELS_PER_DAY = 350;

  const timeToX = (dateStrOrObj, currentViewport) => {
    const time = new Date(dateStrOrObj).getTime();
    const days = (time - BASE_DATE_TIME) / DAY_MS;
    return days * PIXELS_PER_DAY * currentViewport.zoom + currentViewport.offsetX;
  };

  const xToTime = (x, currentViewport) => {
    const days = (x - currentViewport.offsetX) / (PIXELS_PER_DAY * currentViewport.zoom);
    return new Date(BASE_DATE_TIME + days * DAY_MS);
  };

  const spaceToY = (spaceId, currentViewport, allSpaces) => {
    const idx = allSpaces.findIndex(s => s.id === spaceId);
    const row = idx !== -1 ? idx : 0;
    return row * 180 * currentViewport.zoom + currentViewport.offsetY + 120;
  };

  // Helper: calculate local FSRS retrievability
  const calculateMemoryHealth = (nodeId) => {
    const { reviews, tCurrent } = stateRef.current;
    
    // Find due cards for this node
    const nodeReviews = reviews.filter(r => r.node_id === nodeId);
    if (nodeReviews.length === 0) return null; // Gray / default

    // Find latest review strictly before or equal to tCurrent
    const validReviews = nodeReviews.filter(r => new Date(r.review_date) <= new Date(tCurrent));
    if (validReviews.length === 0) return 1.0; // Haven't reviewed yet, assume healthy

    // Sort by review_date desc
    validReviews.sort((a, b) => new Date(b.review_date).getTime() - new Date(a.review_date).getTime());
    const latest = validReviews[0];
    
    // Elapsed time from review to tCurrent
    const elapsedMs = new Date(tCurrent).getTime() - new Date(latest.review_date).getTime();
    const elapsedDays = Math.max(0, elapsedMs / (24 * 60 * 60 * 1000));
    
    // R = (1 + t / (9 * S))^-0.5
    const r = Math.pow(1 + elapsedDays / (9.0 * latest.stability), -0.5);
    return r;
  };

  // Drawing loop
  const draw = (app) => {
    if (!app.stage) return;
    
    // Clear Stage children
    while (app.stage.children.length > 0) {
      app.stage.removeChildAt(0);
    }

    const {
      nodes: allNodes,
      edges: allEdges,
      spaces: allSpaces,
      tCurrent,
      viewport: currentViewport,
      selectedNodeId,
      highlightedNodeIds,
      onHoverSpace,
      onHoverNode
    } = stateRef.current;

    console.log("draw called! allNodes length:", allNodes ? allNodes.length : "null", "allSpaces length:", allSpaces ? allSpaces.length : "null");

    const width = app.renderer.width;
    const height = app.renderer.height;
    const axisY = height / 2 + currentViewport.offsetY;

    // 0. Draw background hit area to clear hovers on empty space
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0xFAF9F5 });
    bg.eventMode = 'static';
    bg.on('pointerover', () => {
      onHoverSpace(null);
      onHoverNode(null);
    });
    bg.on('pointermove', () => {
      onHoverSpace(null);
      onHoverNode(null);
    });
    app.stage.addChild(bg);

    // Filter nodes by time for active memory health calculation, but render all nodes on timeline
    const activeNodes = allNodes.filter(n => new Date(n.created_at) <= new Date(tCurrent));
    const activeNodeIds = new Set(activeNodes.map(n => n.id));
    const activeEdges = allEdges.filter(e => activeNodeIds.has(e.source_id) && activeNodeIds.has(e.target_id));

    // Dynamic tick calculation
    const BASE_DATE_TIME = new Date("2026-10-20T12:00:00").getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const PIXELS_PER_DAY = 260;

    const nodeTimes = allNodes.map(n => new Date(n.created_at).getTime());
    const minTime = nodeTimes.length > 0 ? Math.min(...nodeTimes) : BASE_DATE_TIME;
    const maxTime = nodeTimes.length > 0 ? Math.max(...nodeTimes) : BASE_DATE_TIME + 5 * DAY_MS;

    const minDay = Math.min(0, Math.round((minTime - BASE_DATE_TIME) / DAY_MS));
    const maxDay = Math.max(5, Math.round((maxTime - BASE_DATE_TIME) / DAY_MS));

    const dayTicks = [];
    for (let d = minDay; d <= maxDay; d++) {
      dayTicks.push(d);
    }

    // Pass 1: Pre-calculate coordinates for all nodes and spaces to draw edges first
    const nodeCoords = {};
    const spaceCoords = {}; // dayOffset -> Array of { space, x, y }

    dayTicks.forEach(dayOffset => {
      const tickX = dayOffset * PIXELS_PER_DAY * currentViewport.zoom + currentViewport.offsetX;
      
      // Nodes created on this day
      const dayNodes = allNodes.filter(n => {
        const nodeDayOffset = Math.round((new Date(n.created_at).getTime() - BASE_DATE_TIME) / DAY_MS);
        return nodeDayOffset === dayOffset;
      });
      // Sort dayNodes for stable render order
      dayNodes.sort((a, b) => a.title.localeCompare(b.title));

      // Calculate node positions
      dayNodes.forEach((node, j) => {
        const nodeY = axisY + 45 * currentViewport.zoom + j * 32 * currentViewport.zoom;
        nodeCoords[node.id] = { x: tickX, y: nodeY };
      });

      // Find unique spaces of nodes on this day
      const daySpaceIds = Array.from(new Set(dayNodes.map(n => n.space_id).filter(Boolean)));
      const daySpaces = daySpaceIds.map(id => allSpaces.find(s => s.id === id)).filter(Boolean);
      // Sort daySpaces alphabetically for consistent layout
      daySpaces.sort((a, b) => a.title.localeCompare(b.title));

      const listCoords = [];
      const N = daySpaces.length;
      
      // Calculate dynamic tab widths and X offsets from front (0) to back (N-1)
      const wTabs = [];
      const xOffsets = [];
      let currentXOffset = 0;
      
      for (let j = 0; j < N; j++) {
        const space = daySpaces[j];
        // Estimate text width: ~8.5px per character under Outfit font
        const textWidth = space.title.length * 8.5 * currentViewport.zoom;
        const wTab = Math.max(50 * currentViewport.zoom, textWidth + 18 * currentViewport.zoom);
        wTabs.push(wTab);
        xOffsets.push(currentXOffset);
        currentXOffset += wTab - 12 * currentViewport.zoom; // Shift for next tab with small overlap
      }
      
      // Now construct the list in back-to-front order (index N-1 down to 0) so Topic C renders behind Topic A
      for (let j = N - 1; j >= 0; j--) {
        const space = daySpaces[j];
        // Shift folders horizontally and vertically like a real filing cabinet drawer
        const folderX = tickX + xOffsets[j];
        const folderY = axisY - 60 * currentViewport.zoom - j * 16 * currentViewport.zoom;
        listCoords.push({ 
          space, 
          x: folderX, 
          y: folderY, 
          wTab: wTabs[j] 
        });
      }
      spaceCoords[dayOffset] = listCoords;
    });

    // Graphics container for grid lines and timeline axis
    const gridGraphics = new PIXI.Graphics();
    app.stage.addChild(gridGraphics);

    // Render Timeline horizontal line
    gridGraphics.moveTo(0, axisY);
    gridGraphics.lineTo(width, axisY);
    gridGraphics.stroke({ width: 4, color: 0x1E3A8A }); // Deep blue line

    // --- DRAW EDGES (underneath nodes) ---
    const edgeGraphics = new PIXI.Graphics();
    app.stage.addChild(edgeGraphics);

    activeEdges.forEach(e => {
      const srcCoord = nodeCoords[e.source_id];
      const tgtCoord = nodeCoords[e.target_id];
      if (!srcCoord || !tgtCoord) return;

      let isHighlighted = false;
      let opacity = 0.35;
      
      if (highlightedNodeIds && highlightedNodeIds.length > 0) {
        if (highlightedNodeIds.includes(e.source_id) && highlightedNodeIds.includes(e.target_id)) {
          isHighlighted = true;
          opacity = 1.0;
        } else {
          opacity = 0.05;
        }
      } else if (selectedNodeId) {
        if (selectedNodeId === e.source_id || selectedNodeId === e.target_id) {
          isHighlighted = true;
          opacity = 0.9;
        }
      }

      const color = isHighlighted ? 0x2563EB : 0x9CA3AF;
      const thickness = isHighlighted ? 3 : 1.5;

      edgeGraphics.moveTo(srcCoord.x, srcCoord.y);
      const midX = (srcCoord.x + tgtCoord.x) / 2;
      edgeGraphics.bezierCurveTo(midX, srcCoord.y, midX, tgtCoord.y, tgtCoord.x, tgtCoord.y);
      edgeGraphics.stroke({ width: thickness, color, alpha: opacity });
    });

    // --- DRAW DAY TICKS, STACKS, CONNECTIONS, AND LABELS ---
    dayTicks.forEach(dayOffset => {
      const tickX = dayOffset * PIXELS_PER_DAY * currentViewport.zoom + currentViewport.offsetX;

      // Culling check (skip if out of screen width bounds)
      if (tickX < -150 || tickX > width + 150) return;

      // 1. Draw connecting lines from the axis tick to the stacks
      const daySpacesList = spaceCoords[dayOffset] || [];
      const dayNodesList = allNodes.filter(n => {
        const nodeDayOffset = Math.round((new Date(n.created_at).getTime() - BASE_DATE_TIME) / DAY_MS);
        return nodeDayOffset === dayOffset;
      });

      console.log("Tick:", dayOffset, "spaces:", daySpacesList.length, "nodes:", dayNodesList.length);

      // Vertical line to folder tabs above
      if (daySpacesList.length > 0) {
        const topY = daySpacesList[daySpacesList.length - 1].y;
        gridGraphics.moveTo(tickX, axisY);
        gridGraphics.lineTo(tickX, topY);
        gridGraphics.stroke({ width: 1.5, color: 0x1E3A8A });
      }

      // Vertical line to node badges below
      if (dayNodesList.length > 0) {
        const bottomY = axisY + 45 * currentViewport.zoom + (dayNodesList.length - 1) * 32 * currentViewport.zoom;
        gridGraphics.moveTo(tickX, axisY);
        gridGraphics.lineTo(tickX, bottomY);
        gridGraphics.stroke({ width: 1.5, color: 0x1E3A8A });
      }

      // 2. Draw axis node circle
      gridGraphics.circle(tickX, axisY, 8);
      gridGraphics.fill({ color: 0x1E3A8A });
      gridGraphics.stroke({ width: 3, color: 0xFFFFFF });

      // 3. Draw date label (under the circle)
      const dateObj = new Date(BASE_DATE_TIME + dayOffset * DAY_MS);
      const dayNum = dateObj.getDate();
      const monthStr = dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase();
      const dateTextStr = `${dayNum} ${monthStr}`;
      
      const dateStyle = new PIXI.TextStyle({
        fontFamily: 'Outfit',
        fontSize: Math.max(10, Math.min(14, 12 * currentViewport.zoom)),
        fontWeight: 'bold',
        fill: '#1E3A8A'
      });
      const dateText = new PIXI.Text({ text: dateTextStr, style: dateStyle });
      dateText.anchor.set(0.5, 0.0);
      dateText.x = tickX;
      dateText.y = axisY + 12;
      app.stage.addChild(dateText);

      // 4. Draw Space folder tabs (above axis)
      daySpacesList.forEach(({ space, x, y, wTab }) => {
        const spaceColorHex = parseHSL(space.color);
        const folderGraphics = new PIXI.Graphics();
        folderGraphics.x = x;
        folderGraphics.y = y;
        app.stage.addChild(folderGraphics);

        const tabWidth = 114 * currentViewport.zoom;
        const tabHeight = 38 * currentViewport.zoom;

        const r = 6 * currentViewport.zoom;
        const xL = -tabWidth / 2;
        const xR = tabWidth / 2;
        const yB = tabHeight / 2;
        const yT = -tabHeight / 2;
        
        const wSlope = 18 * currentViewport.zoom;
        const yTab = yT - 16 * currentViewport.zoom; // Taller tab to fit the text label

        // Draw custom folder tab shape using single continuous path with bezier curve slope
        folderGraphics.moveTo(xL + r, yB);
        folderGraphics.lineTo(xR - r, yB);
        folderGraphics.quadraticCurveTo(xR, yB, xR, yB - r);
        folderGraphics.lineTo(xR, yT + r);
        folderGraphics.quadraticCurveTo(xR, yT, xR - r, yT);
        folderGraphics.lineTo(xL + wTab + wSlope, yT);
        
        // Slope curve to tab top
        folderGraphics.bezierCurveTo(
          xL + wTab + wSlope * 0.6, yT,
          xL + wTab + wSlope * 0.4, yTab,
          xL + wTab, yTab
        );
        
        folderGraphics.lineTo(xL + r + 4 * currentViewport.zoom, yTab);
        folderGraphics.quadraticCurveTo(xL, yTab, xL, yTab + r);
        folderGraphics.lineTo(xL, yB - r);
        folderGraphics.quadraticCurveTo(xL, yB, xL + r, yB);
        folderGraphics.fill({ color: spaceColorHex });

        // Draw Space Title text centered inside the tab (tag portion)
        const titleStyle = new PIXI.TextStyle({
          fontFamily: 'UVF Hera Big Black, Outfit, Georgia, serif',
          fontSize: Math.max(7.5, Math.min(12, 10 * currentViewport.zoom)),
          fontWeight: '900', // Heavy black weight
          fill: '#FFFFFF'
        });

        const titleText = new PIXI.Text({ text: space.title, style: titleStyle });
        titleText.anchor.set(0.5);
        // Center text on the tab width
        titleText.x = x + xL + wTab / 2;
        titleText.y = y + yT - 8 * currentViewport.zoom;
        app.stage.addChild(titleText);

        // Interactions on folderGraphics
        folderGraphics.eventMode = 'static';
        folderGraphics.cursor = 'pointer';

        folderGraphics.on('pointerover', (event) => {
          if (isDragging.current) return;
          onHoverSpace({ space, x, y: y - tabHeight / 2 });
        });
        folderGraphics.on('pointerout', () => {
          onHoverSpace(null);
        });
      });

      // 5. Draw Node Badges (below axis)
      dayNodesList.forEach((node, j) => {
        const nodeX = tickX;
        const nodeY = axisY + 45 * currentViewport.zoom + j * 32 * currentViewport.zoom;

        const badgeGraphics = new PIXI.Graphics();
        badgeGraphics.x = nodeX;
        badgeGraphics.y = nodeY;
        app.stage.addChild(badgeGraphics);

        const badgeWidth = 130 * currentViewport.zoom;
        const badgeHeight = 26 * currentViewport.zoom;

        // Calculate FSRS Memory Health color
        const memoryHealth = calculateMemoryHealth(node.id);
        const space = allSpaces.find(s => s.id === node.space_id);
        let badgeColorHex = space ? parseHSL(space.color) : 0x3B82F6; // Default to space color
        
        if (memoryHealth !== null) {
          // Color based on memory health
          if (memoryHealth >= 0.9) badgeColorHex = 0x2563EB; // Excellent (Vibrant Blue)
          else if (memoryHealth >= 0.7) badgeColorHex = 0xD97706; // Medium (Orange-Brown)
          else badgeColorHex = 0xEF4444; // Poor (Red)
        }

        // Dim node in review mode if it's not part of the active focus subgraph
        let opacity = 1.0;
        if (highlightedNodeIds && highlightedNodeIds.length > 0) {
          if (!highlightedNodeIds.includes(node.id)) {
            opacity = 0.15;
          }
        }

        badgeGraphics.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 13 * currentViewport.zoom);
        badgeGraphics.fill({ color: badgeColorHex, alpha: opacity });

        // White border highlight if selected
        const isSelected = selectedNodeId === node.id;
        if (isSelected) {
          badgeGraphics.stroke({ width: 2, color: 0xFFFFFF, alpha: opacity });
        }

        // Node Title text
        const titleStyle = new PIXI.TextStyle({
          fontFamily: 'Inter',
          fontSize: Math.max(8, Math.min(11, 10 * currentViewport.zoom)),
          fontWeight: 'bold',
          fill: '#FFFFFF'
        });

        let titleStr = node.title;
        if (titleStr.length > 18) {
          titleStr = titleStr.substring(0, 16) + "...";
        }

        const nodeText = new PIXI.Text({ text: titleStr, style: titleStyle });
        nodeText.anchor.set(0.5);
        nodeText.x = nodeX;
        nodeText.y = nodeY;
        app.stage.addChild(nodeText);

        // Interactions on badgeGraphics
        badgeGraphics.eventMode = 'static';
        badgeGraphics.cursor = 'pointer';
        badgeGraphics.on('pointerdown', (event) => {
          event.stopPropagation();
          onSelectNode(node.id);
        });
        badgeGraphics.on('pointerover', () => {
          if (isDragging.current) return;
          onHoverNode({ node, x: nodeX, y: nodeY, memoryHealth });
        });
        badgeGraphics.on('pointerout', () => {
          onHoverNode(null);
        });
      });
    });
  };

  // Helper HSL parser
  const parseHSL = (hslStr) => {
    if (!hslStr) return 0x3B82F6;
    // Format: "h, s%, l%"
    const matches = hslStr.match(/\d+/g);
    if (!matches || matches.length < 3) return 0x3B82F6;
    
    const h = parseInt(matches[0]);
    const s = parseInt(matches[1]);
    const l = parseInt(matches[2]);
    
    return hslToHex(h, s, l);
  };

  const hslToHex = (h, s, l) => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
  };

  // --- EVENTS PAN/ZOOM ---
  const handleMouseDown = (e) => {
    isDragging.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    dragStart.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    viewportStart.current = {
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    
    // Clear hover states immediately when panning starts
    onHoverSpace(null);
    onHoverNode(null);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - dragStart.current.x;
    const dy = mouseY - dragStart.current.y;

    setViewport(prev => ({
      ...prev,
      offsetX: viewportStart.current.offsetX + dx,
      offsetY: viewportStart.current.offsetY + dy
    }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    onHoverSpace(null);
    onHoverNode(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();

    // Clear hover states immediately when zooming starts
    onHoverSpace(null);
    onHoverNode(null);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom speed
    const zoomFactor = 1.1;
    let newZoom = viewport.zoom;
    
    if (e.deltaY < 0) {
      newZoom = Math.min(2.0, viewport.zoom * zoomFactor);
    } else {
      newZoom = Math.max(0.15, viewport.zoom / zoomFactor);
    }

    // Zoom on cursor position
    const ratio = newZoom / viewport.zoom;
    const newOffsetX = mouseX - (mouseX - viewport.offsetX) * ratio;
    const newOffsetY = mouseY - (mouseY - viewport.offsetY) * ratio;

    setViewport({
      zoom: newZoom,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    });
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', cursor: isDragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  );
};

export default CanvasTimeline;
