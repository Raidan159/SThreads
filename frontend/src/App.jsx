import React, { useEffect, useState, useRef } from 'react';
import { Search, Calendar, Award, Share2, Plus, X, List, Layers, HelpCircle, ArrowRight } from 'lucide-react';
import CanvasTimeline from './components/CanvasTimeline';
import GraphView from './components/GraphView';
import ControlDock from './components/ControlDock';
import ReviewModal from './components/ReviewModal';
import AnkiSimulator from './components/AnkiSimulator';

const API_BASE = "http://localhost:8000/api";

const renderHighlightedText = (text) => {
  if (!text) return null;
  const parts = text.split(/==(.*?)==/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <mark
          key={index}
          style={{
            backgroundColor: 'var(--accent-lime)',
            color: 'var(--text-primary)',
            padding: '2px 4px',
            borderRadius: '4px',
            fontWeight: 600
          }}
        >
          {part}
        </mark>
      );
    }
    return part;
  });
};

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [reviews, setReviews] = useState([]);

  // Reviews state
  const [dueCards, setDueCards] = useState([]);
  const [subgraph, setSubgraph] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);

  // View states
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'graph'
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [tCurrent, setTCurrent] = useState(new Date("2026-10-26T00:00:00"));
  const [isPlaying, setIsPlaying] = useState(false);

  // Hover states for timeline interactions
  const [hoveredSpace, setHoveredSpace] = useState(null); // { space, x, y }
  const [hoveredNode, setHoveredNode] = useState(null);   // { node, x, y }

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // Create state
  const [showCreateNode, setShowCreateNode] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeContent, setNewNodeContent] = useState("");
  const [newNodeSpaceId, setNewNodeSpaceId] = useState("");
  const [newNodeDate, setNewNodeDate] = useState("2026-10-20T12:00");

  const [showCreateCard, setShowCreateCard] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");
  const [newCardSynonyms, setNewCardSynonyms] = useState("");
  const [newCardImageFile, setNewCardImageFile] = useState(null);
  const [newCardAudioFile, setNewCardAudioFile] = useState(null);
  const [newCardScheduler, setNewCardScheduler] = useState("fsrs");

  const [showCreateEdge, setShowCreateEdge] = useState(false);
  const [newEdgeSourceId, setNewEdgeSourceId] = useState("");
  const [newEdgeTargetId, setNewEdgeTargetId] = useState("");
  const [newEdgeRelType, setNewEdgeRelType] = useState("related");

  // Playback timer
  const playTimerRef = useRef(null);

  // Initialize and load data
  const loadData = async () => {
    try {
      // Fetch Spaces
      const spacesRes = await fetch(`${API_BASE}/spaces`);
      let spacesData = await spacesRes.json();

      // If database is empty, trigger seed endpoint to bootstrap data
      if (spacesData.length === 0) {
        await fetch(`${API_BASE}/seed`, { method: "POST" });
        const retrySpaces = await fetch(`${API_BASE}/spaces`);
        spacesData = await retrySpaces.json();
      }
      setSpaces(spacesData);

      // Fetch Nodes
      const nodesRes = await fetch(`${API_BASE}/nodes`);
      const nodesData = await nodesRes.json();
      setNodes(nodesData);

      // Fetch Edges
      const edgesRes = await fetch(`${API_BASE}/edges`);
      const edgesData = await edgesRes.json();
      setEdges(edgesData);

      // Fetch Reviews
      await fetchReviews();
      await fetchDueReviews();

    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  };

  // Fetch reviews directly from DB for client-side FSRS coloring
  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE}/nodes`); // Trigger check
      // For simplicity, we query a memory health mockup or pull from our nodes directly
      // Let's call our backend endpoint `/api/memory-health` to get current retrievability
      const mhRes = await fetch(`${API_BASE}/memory-health?t_current=${tCurrent.toISOString()}`);
      const reviewsData = await mhRes.json();

      // We will simulate reviews list:
      // Since we need to know the review history for client-side calculation,
      // let's create a custom mapping from our database
      // Fetch nodes with cards and their latest reviews
      // In backend models, fsrs_reviews contains all card review metrics.
      // We will model mock reviews locally based on backend state
      // For timeline rendering, we can fetch all flashcards and calculate the health.
      // Let's get actual database card details
      const fcRes = await fetch(`${API_BASE}/flashcards`);
      const cards = await fcRes.json();

      const simulatedReviews = [];
      // Seed dummy records for local computing
      // Card 1 (Coruscant) reviewed on 21 OCT, stability 2.4
      const bDate = new Date("2026-10-20T12:00:00").getTime();
      cards.forEach(c => {
        if (c.front.includes("Dooku")) {
          // Coruscant card
          simulatedReviews.push({
            node_id: c.node_id,
            review_date: new Date(bDate + 24 * 3600 * 1000).toISOString(),
            stability: 2.4
          });
        } else if (c.front.includes("vulnerability")) {
          // Yavin card (failed)
          simulatedReviews.push({
            node_id: c.node_id,
            review_date: new Date(bDate + 2 * 24 * 3600 * 1000).toISOString(),
            stability: 0.4 // Again rating yields low stability
          });
        }
      });
      setReviews(simulatedReviews);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDueReviews = async () => {
    try {
      const res = await fetch(`${API_BASE}/reviews/today`);
      const data = await res.json();
      setDueCards(data.due_cards);
      setSubgraph(data.subgraph);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync memory health retrievability whenever time slider updates
  useEffect(() => {
    fetchReviews();
  }, [tCurrent]);

  // Reset hovered tooltips when switching viewMode
  useEffect(() => {
    setHoveredSpace(null);
    setHoveredNode(null);
  }, [viewMode]);

  // Handle Play/Pause slider loop
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = setInterval(() => {
        setTCurrent(prev => {
          const next = new Date(prev.getTime() + 2 * 60 * 60 * 1000); // add 2 hours
          const maxDate = new Date("2026-10-26T00:00:00");
          if (next >= maxDate) {
            setIsPlaying(false);
            clearInterval(playTimerRef.current);
            return maxDate;
          }
          return next;
        });
      }, 800);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    }
    return () => clearInterval(playTimerRef.current);
  }, [isPlaying]);

  // Handle Node creation
  const handleCreateNode = async (e) => {
    e.preventDefault();
    if (!newNodeTitle) return;

    try {
      const res = await fetch(`${API_BASE}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newNodeTitle,
          content: newNodeContent,
          space_id: newNodeSpaceId || null,
          created_at: new Date(newNodeDate).toISOString()
        })
      });
      if (res.ok) {
        setNewNodeTitle("");
        setNewNodeContent("");
        setShowCreateNode(false);
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Card creation
  const handleCreateCard = async (e) => {
    e.preventDefault();
    if (!newCardFront || !newCardBack || !selectedNodeId) return;

    try {
      let imageUrl = null;
      let audioUrl = null;

      if (newCardImageFile) {
        const formData = new FormData();
        formData.append("file", newCardImageFile);
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.url;
        }
      }

      if (newCardAudioFile) {
        const formData = new FormData();
        formData.append("file", newCardAudioFile);
        const uploadRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          audioUrl = uploadData.url;
        }
      }

      const res = await fetch(`${API_BASE}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: selectedNodeId,
          front: newCardFront,
          back: newCardBack,
          image_url: imageUrl,
          audio_url: audioUrl,
          synonyms: newCardSynonyms || null,
          scheduler: newCardScheduler
        })
      });
      if (res.ok) {
        setNewCardFront("");
        setNewCardBack("");
        setNewCardSynonyms("");
        setNewCardImageFile(null);
        setNewCardAudioFile(null);
        setNewCardScheduler("fsrs");
        setShowCreateCard(false);
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Edge connection creation
  const handleCreateEdge = async (e) => {
    e.preventDefault();
    if (!newEdgeSourceId || !newEdgeTargetId) return;

    try {
      const res = await fetch(`${API_BASE}/edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: newEdgeSourceId,
          target_id: newEdgeTargetId,
          relation_type: newEdgeRelType
        })
      });
      if (res.ok) {
        setShowCreateEdge(false);
        setNewEdgeSourceId("");
        setNewEdgeTargetId("");
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Search query hit
  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Review FSRS rating to backend
  const handleSubmitReview = async (cardId, rating) => {
    try {
      const res = await fetch(`${API_BASE}/reviews/${cardId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const calculateNodeMemoryHealth = (nodeId) => {
    const nodeReviews = reviews.filter(r => r.node_id === nodeId);
    if (nodeReviews.length === 0) return null;

    const validReviews = nodeReviews.filter(r => new Date(r.review_date) <= tCurrent);
    if (validReviews.length === 0) return 1.0;

    validReviews.sort((a, b) => new Date(b.review_date).getTime() - new Date(a.review_date).getTime());
    const latest = validReviews[0];

    const elapsedMs = tCurrent.getTime() - new Date(latest.review_date).getTime();
    const elapsedDays = Math.max(0, elapsedMs / (24 * 60 * 60 * 1000));

    return Math.pow(1 + elapsedDays / (9.0 * latest.stability), -0.5);
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedNodeSpace = selectedNode ? spaces.find(s => s.id === selectedNode.space_id) : null;
  const activeNodes = nodes.filter(n => new Date(n.created_at) <= tCurrent);

  return (
    <div className="app-container">

      {/* Sidebar Panel */}
      <div className="sidebar">
        <h1 className="sidebar-title">
          <Layers size={26} color="#2563EB" />
          <span>SThread OS</span>
        </h1>

        {/* Dynamic Search Box */}
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Hybrid Search nodes..."
            className="search-input"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        {/* Search Results list overlay */}
        {searchQuery && (
          <div className="sidebar-section">
            <h2 className="section-title">Search Results</h2>
            <div className="search-results">
              {searchResults.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm-sub)', color: '#6B6664', textAlign: 'center', padding: '10px' }}>
                  No semantic matches found
                </div>
              ) : (
                searchResults.map(res => (
                  <div
                    key={res.id}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedNodeId(res.id);
                      // Adjust time slider if matches node created date
                      if (new Date(res.created_at) > tCurrent) {
                        setTCurrent(new Date(res.created_at));
                      }
                    }}
                  >
                    <div className="search-result-title">{res.title}</div>
                    <div className="search-result-content">{res.content}</div>
                    <div className="search-result-score">
                      Match: {Math.round(res.score * 100)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Action Panel Links */}
        <div className="sidebar-section">
          <h2 className="section-title">Knowledge Grid Actions</h2>

          <button
            className="btn-secondary"
            style={{ width: '100%', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setShowCreateNode(true)}
          >
            <Plus size={16} />
            <span>Create Knowledge Node</span>
          </button>

          <button
            className="btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => setShowCreateEdge(true)}
          >
            <Share2 size={16} />
            <span>Create Relation Link</span>
          </button>
        </div>

        {/* Active Spaces List */}
        <div className="sidebar-section">
          <h2 className="section-title">Spaces ({spaces.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {spaces.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: 'var(--font-size-sm)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(44, 42, 41, 0.03)'
                }}
              >
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: `hsl(${s.color})` }} />
                <span>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Nodes list */}
        <div className="sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
          <h2 className="section-title">Nodes ({activeNodes.length})</h2>
          {activeNodes.map(node => (
            <div
              key={node.id}
              className={`node-list-item ${selectedNodeId === node.id ? 'selected' : ''}`}
              onClick={() => setSelectedNodeId(node.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Memory Health indicator dot */}
                {(() => {
                  const health = calculateNodeMemoryHealth(node.id);
                  if (health === null) return <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'rgba(44, 42, 41, 0.2)' }} />;
                  const color = health >= 0.9 ? '#2563EB' : health >= 0.7 ? '#EA580C' : '#EF4444';
                  return <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />;
                })()}
                <span>{node.title}</span>
              </div>
              <span style={{ fontSize: 'var(--font-size-xxs)', opacity: 0.6 }}>
                {new Date(node.created_at).toLocaleDateString("en-US", { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="main-content">
        <div className="canvas-wrapper">
          {viewMode === 'timeline' ? (
            <CanvasTimeline
              nodes={nodes}
              edges={edges}
              spaces={spaces}
              tCurrent={tCurrent}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              reviews={reviews}
              onHoverSpace={setHoveredSpace}
              onHoverNode={setHoveredNode}
            />
          ) : viewMode === 'graph' ? (
            <GraphView
              nodes={activeNodes}
              edges={edges.filter(e => activeNodes.some(n => n.id === e.source_id) && activeNodes.some(n => n.id === e.target_id))}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              width={800}
              height={600}
            />
          ) : (
            <AnkiSimulator />
          )}

          {/* Space Hover Popover Overlay */}
          {viewMode === 'timeline' && hoveredSpace && (
            <div
              className="space-popover-tooltip"
              style={{
                left: hoveredSpace.x,
                top: hoveredSpace.y - 12,
                transform: 'translate(-50%, -100%)'
              }}
            >
              {hoveredSpace.space.image_url && (
                <img src={hoveredSpace.space.image_url} alt={hoveredSpace.space.title} className="space-popover-img" />
              )}
              <div className="space-popover-body">
                <h4 className="space-popover-title">{hoveredSpace.space.title}</h4>
                <div className="space-popover-progress-container">
                  <div className="space-popover-progress-track">
                    <div className="space-popover-progress-fill" style={{ width: `${hoveredSpace.space.progress || 0}%` }} />
                  </div>
                  <span className="space-popover-progress-text">{hoveredSpace.space.progress || 0}%</span>
                </div>
                <p className="space-popover-desc">{hoveredSpace.space.description}</p>
              </div>
              <div className="space-popover-arrow" />
            </div>
          )}

          {/* Node Hover Popover Overlay */}
          {viewMode === 'timeline' && hoveredNode && (
            <div
              className="node-popover-tooltip"
              style={{
                left: hoveredNode.x,
                top: hoveredNode.y - 12,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="node-popover-body">
                <h4 className="node-popover-title">{hoveredNode.node.title}</h4>
                <span className="node-popover-date">
                  {new Date(hoveredNode.node.created_at).toLocaleDateString("en-US", {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
                <p className="node-popover-desc">{hoveredNode.node.content || "No details provided."}</p>
                {hoveredNode.memoryHealth !== null && (
                  <div className="node-popover-health">
                    <span className="health-label">Memory Stability:</span>
                    <span
                      className="health-value"
                      style={{
                        color: hoveredNode.memoryHealth >= 0.9 ? '#10B981' : hoveredNode.memoryHealth >= 0.7 ? '#EA580C' : '#EF4444'
                      }}
                    >
                      {Math.round(hoveredNode.memoryHealth * 100)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="node-popover-arrow" />
            </div>
          )}
        </div>

        {/* Selected Node Details Floating Popup Card */}
        {selectedNode && (
          <div className="node-popup-card">
            <div className="popup-header">
              <div>
                <span className="popup-meta" style={{ backgroundColor: selectedNodeSpace ? `hsl(${selectedNodeSpace.color.split(',')[0]}, 100%, 90%)` : '#eee' }}>
                  {selectedNodeSpace ? selectedNodeSpace.title : "Default"}
                </span>
                <h3 className="popup-title" style={{ marginTop: '8px' }}>{selectedNode.title}</h3>
              </div>
              <button className="popup-close" onClick={() => setSelectedNodeId(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="popup-content">
              {renderHighlightedText(selectedNode.content) || "No details provided."}
            </div>

            <div style={{ fontSize: 'var(--font-size-xs)', color: '#6B6664' }}>
              Created: {new Date(selectedNode.created_at).toLocaleString()}
            </div>

            <div className="popup-actions">
              <button
                className="btn-primary"
                onClick={() => setShowCreateCard(true)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                <span>Add Card</span>
              </button>
            </div>
          </div>
        )}

        {/* Global floating dock */}
        <ControlDock
          tCurrent={tCurrent}
          setTCurrent={setTCurrent}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          viewMode={viewMode}
          setViewMode={setViewMode}
          dueReviewsCount={dueCards.length}
          onStartReview={() => setIsReviewing(true)}
        />
      </div>

      {/* --- POPUP OVERLAY FORMS --- */}

      {/* 1. Create Node Modal */}
      {showCreateNode && (
        <div className="review-overlay">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>New Knowledge Node</h2>
              <button className="popup-close" onClick={() => setShowCreateNode(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateNode} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Title</label>
                <input
                  type="text"
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  placeholder="e.g. Siege of Mandalore"
                  value={newNodeTitle}
                  onChange={e => setNewNodeTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Description</label>
                <textarea
                  className="search-input"
                  style={{ paddingLeft: '12px', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Details of the event..."
                  value={newNodeContent}
                  onChange={e => setNewNodeContent(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Space (Topic)</label>
                <select
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  value={newNodeSpaceId}
                  onChange={e => setNewNodeSpaceId(e.target.value)}
                >
                  <option value="">Default Space</option>
                  {spaces.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Creation Date (Timeline Anchor)</label>
                <input
                  type="datetime-local"
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  value={newNodeDate}
                  onChange={e => setNewNodeDate(e.target.value)}
                />
              </div>

              <button className="btn-primary" type="submit" style={{ padding: '12px', marginTop: '10px' }}>
                Create Node
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Create Relation Link (Edge) Modal */}
      {showCreateEdge && (
        <div className="review-overlay">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>New Network Connection</h2>
              <button className="popup-close" onClick={() => setShowCreateEdge(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateEdge} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Source Node</label>
                <select
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  value={newEdgeSourceId}
                  onChange={e => setNewEdgeSourceId(e.target.value)}
                  required
                >
                  <option value="">Select source...</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Target Node (Dependent)</label>
                <select
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  value={newEdgeTargetId}
                  onChange={e => setNewEdgeTargetId(e.target.value)}
                  required
                >
                  <option value="">Select target...</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Relation Type</label>
                <select
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  value={newEdgeRelType}
                  onChange={e => setNewEdgeRelType(e.target.value)}
                >
                  <option value="related">Related Link</option>
                  <option value="parent">Parent of Target</option>
                  <option value="prerequisite">Prerequisite for Target</option>
                </select>
              </div>

              <button className="btn-primary" type="submit" style={{ padding: '12px', marginTop: '10px' }}>
                Link Nodes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Create Flashcard Modal */}
      {showCreateCard && (
        <div className="review-overlay">
          <div className="modal-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 'var(--font-size-xl)', fontWeight: 700 }}>Add Flashcard</h2>
              <button className="popup-close" onClick={() => setShowCreateCard(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateCard} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Question (Front)</label>
                <textarea
                  className="search-input"
                  style={{ paddingLeft: '12px', minHeight: '60px', resize: 'vertical' }}
                  placeholder="Card front text..."
                  value={newCardFront}
                  onChange={e => setNewCardFront(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Answer (Back)</label>
                <textarea
                  className="search-input"
                  style={{ paddingLeft: '12px', minHeight: '60px', resize: 'vertical' }}
                  placeholder="Card back answer..."
                  value={newCardBack}
                  onChange={e => setNewCardBack(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Synonyms (comma separated)</label>
                <input
                  type="text"
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  placeholder="e.g. key, concept, alias"
                  value={newCardSynonyms}
                  onChange={e => setNewCardSynonyms(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Image Reference File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setNewCardImageFile(e.target.files[0])}
                  style={{ fontSize: 'var(--font-size-sm-sub)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Audio Reference File</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={e => setNewCardAudioFile(e.target.files[0])}
                  style={{ fontSize: 'var(--font-size-sm-sub)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664' }}>Scheduling Algorithm</label>
                <select
                  className="search-input"
                  style={{ paddingLeft: '12px' }}
                  value={newCardScheduler}
                  onChange={e => setNewCardScheduler(e.target.value)}
                >
                  <option value="fsrs">FSRS v4 (Default)</option>
                  <option value="sm2">SM-2 (Classic)</option>
                  <option value="leitner">Leitner (5-Box)</option>
                </select>
              </div>

              <button className="btn-primary" type="submit" style={{ padding: '12px', marginTop: '10px' }}>
                Save Card
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Active Contextual Spaced Repetition reviews overlay */}
      {isReviewing && (
        <ReviewModal
          dueCards={dueCards}
          subgraph={subgraph}
          onSubmitReview={handleSubmitReview}
          onClose={() => {
            setIsReviewing(false);
            fetchDueReviews();
            fetchReviews();
          }}
        />
      )}

    </div>
  );
}

export default App;
