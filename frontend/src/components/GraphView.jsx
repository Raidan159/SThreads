import React, { useEffect, useRef, useState } from 'react';

const GraphView = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  highlightedNodeIds,
  width = 450,
  height = 500
}) => {
  const [positions, setPositions] = useState({});
  const draggingNodeIdRef = useRef(null);
  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Initialize node positions randomly near the center
  useEffect(() => {
    const initialPositions = {};
    nodes.forEach((node) => {
      // Keep old positions if already present to prevent graph jumps
      if (positions[node.id]) {
        initialPositions[node.id] = positions[node.id];
      } else {
        initialPositions[node.id] = {
          x: width / 2 + (Math.random() - 0.5) * 150,
          y: height / 2 + (Math.random() - 0.5) * 150,
          vx: 0,
          vy: 0
        };
      }
    });
    setPositions(initialPositions);
  }, [nodes]);

  // Force-directed simulation loop
  useEffect(() => {
    const runSimulation = () => {
      setPositions((prevPositions) => {
        const next = {};
        Object.keys(prevPositions).forEach((id) => {
          next[id] = { ...prevPositions[id] };
        });
        const keys = Object.keys(next);
        if (keys.length === 0) return prevPositions;

        // Apply forces
        const kCenter = 0.03;      // Force pulling towards center
        const kRepulsion = 1500;   // Force pushing nodes apart
        const kSpring = 0.05;      // Link force pulling connected nodes
        const desiredLength = 80;  // Preferred spring length
        const damping = 0.85;

        // 1. Center force
        keys.forEach((id) => {
          const pos = next[id];
          if (draggingNodeIdRef.current === id) {
            // Dragged node follows mouse
            pos.x = mousePosRef.current.x;
            pos.y = mousePosRef.current.y;
            pos.vx = 0;
            pos.vy = 0;
            return;
          }

          pos.vx += (width / 2 - pos.x) * kCenter;
          pos.vy += (height / 2 - pos.y) * kCenter;
        });

        // 2. Repulsion force between node pairs
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            const idA = keys[i];
            const idB = keys[j];
            const posA = next[idA];
            const posB = next[idB];

            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);

            if (dist < 250) {
              const force = kRepulsion / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (draggingNodeIdRef.current !== idA) {
                posA.vx -= fx;
                posA.vy -= fy;
              }
              if (draggingNodeIdRef.current !== idB) {
                posB.vx += fx;
                posB.vy += fy;
              }
            }
          }
        }

        // 3. Link spring force
        edges.forEach((edge) => {
          const posA = next[edge.source_id];
          const posB = next[edge.target_id];
          if (!posA || !posB) return;

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          const delta = dist - desiredLength;
          const force = delta * kSpring;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (draggingNodeIdRef.current !== edge.source_id) {
            posA.vx += fx;
            posA.vy += fy;
          }
          if (draggingNodeIdRef.current !== edge.target_id) {
            posB.vx -= fx;
            posB.vy -= fy;
          }
        });

        // 4. Update coordinates & check wall collisions
        keys.forEach((id) => {
          const pos = next[id];
          if (draggingNodeIdRef.current === id) return;

          pos.x += pos.vx;
          pos.y += pos.vy;
          pos.vx *= damping;
          pos.vy *= damping;

          // Wall constraint checks
          const margin = 20;
          pos.x = Math.max(margin, Math.min(width - margin, pos.x));
          pos.y = Math.max(margin, Math.min(height - margin, pos.y));
        });

        return next;
      });

      animationFrameRef.current = requestAnimationFrame(runSimulation);
    };

    animationFrameRef.current = requestAnimationFrame(runSimulation);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [nodes, edges, width, height]);

  // Dragging event callbacks
  const handleMouseDown = (nodeId) => (e) => {
    draggingNodeIdRef.current = nodeId;
    updateMousePosition(e);
  };

  const handleMouseMove = (e) => {
    if (!draggingNodeIdRef.current) return;
    updateMousePosition(e);
  };

  const handleMouseUp = () => {
    draggingNodeIdRef.current = null;
  };

  const updateMousePosition = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = width / (rect.width || width);
    const scaleY = height / (rect.height || height);
    mousePosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`}>
        {/* Draw Link lines */}
        {edges.map((edge) => {
          const posA = positions[edge.source_id];
          const posB = positions[edge.target_id];
          if (!posA || !posB) return null;

          // Compute highlight state
          let opacity = 0.4;
          let isHighlighted = false;
          
          if (highlightedNodeIds && highlightedNodeIds.length > 0) {
            if (highlightedNodeIds.includes(edge.source_id) && highlightedNodeIds.includes(edge.target_id)) {
              isHighlighted = true;
              opacity = 1.0;
            } else {
              opacity = 0.08;
            }
          } else if (selectedNodeId === edge.source_id || selectedNodeId === edge.target_id) {
            isHighlighted = true;
            opacity = 0.95;
          }

          return (
            <line
              key={edge.id}
              x1={posA.x}
              y1={posA.y}
              x2={posB.x}
              y2={posB.y}
              className="graph-link"
              stroke={isHighlighted ? "#2563EB" : "#9CA3AF"}
              strokeWidth={isHighlighted ? 3 : 1.5}
              strokeDasharray={edge.relation_type === 'prerequisite' ? "4 4" : undefined}
              opacity={opacity}
            />
          );
        })}

        {/* Draw Node circles */}
        {nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;

          const isSelected = selectedNodeId === node.id;
          
          let opacity = 1.0;
          if (highlightedNodeIds && highlightedNodeIds.length > 0) {
            if (!highlightedNodeIds.includes(node.id)) {
              opacity = 0.15;
            }
          }

          const strokeColor = isSelected ? "#2563EB" : "#FFFFFF";
          const radius = isSelected ? 16 : 12;

          return (
            <g
              key={node.id}
              className="graph-node"
              transform={`translate(${pos.x}, ${pos.y})`}
              onMouseDown={handleMouseDown(node.id)}
              onClick={() => onSelectNode(node.id)}
              opacity={opacity}
            >
              <circle
                r={radius}
                fill={isSelected ? "#3B82F6" : "#4B5563"}
                stroke={strokeColor}
                strokeWidth={isSelected ? 3 : 2}
              />
              <text
                y={22}
                textAnchor="middle"
                opacity={0.9}
              >
                {node.title.length > 15 ? node.title.substring(0, 12) + "..." : node.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default GraphView;
