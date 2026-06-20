import React, { useState, useEffect } from 'react';
import { ArrowRight, RefreshCw, X, HelpCircle, Activity } from 'lucide-react';

const API_BASE = "http://localhost:8000/api";

const AnkiSimulator = () => {
  const [reviews, setReviews] = useState(["Good", "Good", "Again", "Good", "Easy", "Good"]);
  const [simulationData, setSimulationData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSimulation = async (reviewsList) => {
    if (reviewsList.length === 0) {
      setSimulationData([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: reviewsList })
      });
      if (res.ok) {
        const data = await res.json();
        setSimulationData(data);
      }
    } catch (err) {
      console.error("Simulation request failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulation(reviews);
  }, [reviews]);

  const handleAddReview = (rating) => {
    if (reviews.length >= 12) return; // Cap at 12 steps for readable charts
    setReviews(prev => [...prev, rating]);
  };

  const handleRemoveLast = () => {
    setReviews(prev => prev.slice(0, -1));
  };

  const handleReset = () => {
    setReviews([]);
  };

  // SVG Chart Dimensions
  const paddingX = 45;
  const paddingY = 25;
  const chartHeight = 260;
  const chartWidth = 550;

  // Calculate coordinates for SVG paths
  const getCoordinates = (type) => {
    if (simulationData.length === 0) return [];
    
    // Find max interval to scale Y axis
    let maxInterval = 5;
    simulationData.forEach(d => {
      const val = d[type]?.interval || 0;
      if (val > maxInterval) maxInterval = val;
    });
    
    // Add 10% breathing room at the top
    maxInterval = Math.ceil(maxInterval * 1.15);

    const points = [];
    const stepCount = simulationData.length;
    
    simulationData.forEach((d, idx) => {
      const x = paddingX + (idx / Math.max(1, stepCount - 1)) * (chartWidth - paddingX * 2);
      const val = d[type]?.interval || 0;
      // Invert Y coordinate since SVG (0,0) is top-left
      const y = chartHeight - paddingY - (val / maxInterval) * (chartHeight - paddingY * 2);
      points.push({ x, y, value: val });
    });

    return { points, maxInterval };
  };

  const fsrsCoords = getCoordinates('fsrs');
  const sm2Coords = getCoordinates('sm2');
  const leitnerCoords = getCoordinates('leitner');

  const maxValY = Math.max(
    fsrsCoords.maxInterval || 10,
    sm2Coords.maxInterval || 10,
    leitnerCoords.maxInterval || 10
  );

  const formatPointsPath = (points) => {
    if (!points || points.length === 0) return "";
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
  };

  return (
    <div className="simulator-view">
      <div className="simulator-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={24} color="#2563EB" />
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '22px' }}>
            Multi-Scheduler Interval Simulator
          </h2>
        </div>
        <p style={{ color: '#6B6664', fontSize: '13px', marginTop: '4px' }}>
          Compare the mathematical interval growth of FSRS, SM-2, and Leitner scheduling algorithms side-by-side.
        </p>
      </div>

      <div className="simulator-grid">
        {/* Controls Card */}
        <div className="simulator-card glass-panel">
          <h3 className="card-subtitle">1. Build Review Sequence</h3>
          <p style={{ fontSize: '12px', color: '#6B6664', marginBottom: '16px' }}>
            Click rating buttons to build a sequence of reviews and see how intervals adapt.
          </p>

          <div className="simulator-rating-buttons">
            <button className="fsrs-btn fsrs-btn-again" onClick={() => handleAddReview("Again")}>Again</button>
            <button className="fsrs-btn fsrs-btn-hard" onClick={() => handleAddReview("Hard")}>Hard</button>
            <button className="fsrs-btn fsrs-btn-good" onClick={() => handleAddReview("Good")}>Good</button>
            <button className="fsrs-btn fsrs-btn-easy" onClick={() => handleAddReview("Easy")}>Easy</button>
          </div>

          <div className="reviews-timeline-container">
            <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#6B6664', margin: '15px 0 8px 0' }}>
              Current Sequence ({reviews.length} / 12)
            </h4>

            {reviews.length === 0 ? (
              <div className="empty-reviews-state">
                No reviews added. Click buttons above to start.
              </div>
            ) : (
              <div className="reviews-badge-list">
                {reviews.map((r, idx) => (
                  <div key={idx} className={`review-badge-item badge-${r.toLowerCase()}`}>
                    <span>{idx + 1}. {r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button 
              className="btn-secondary" 
              style={{ flex: 1, padding: '8px', fontSize: '12px' }}
              onClick={handleRemoveLast}
              disabled={reviews.length === 0}
            >
              Undo Last
            </button>
            <button 
              className="btn-secondary" 
              style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={handleReset}
              disabled={reviews.length === 0}
            >
              <RefreshCw size={12} />
              <span>Clear Sequence</span>
            </button>
          </div>
        </div>

        {/* SVG Chart Card */}
        <div className="simulator-card glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="card-subtitle">2. Interval Growth Curve</h3>
          
          <div className="chart-legend" style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: 600, margin: '8px 0 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '3px', backgroundColor: '#6366F1', borderRadius: '2px' }} />
              <span>FSRS (v4)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '3px', backgroundColor: '#0D9488', borderRadius: '2px' }} />
              <span>SM-2 (Classic)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '3px', backgroundColor: '#D97706', borderRadius: '2px' }} />
              <span>Leitner (5-Box)</span>
            </div>
          </div>

          <div className="chart-svg-wrapper" style={{ flex: 1, position: 'relative', minHeight: '260px' }}>
            {simulationData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B6664', fontSize: '13px' }}>
                Build a review sequence to draw the graph
              </div>
            ) : (
              <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
                {/* Horizontal Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = paddingY + ratio * (chartHeight - paddingY * 2);
                  const labelVal = Math.round(maxValY - ratio * maxValY);
                  return (
                    <g key={index}>
                      <line 
                        x1={paddingX} 
                        y1={y} 
                        x2={chartWidth - paddingX} 
                        y2={y} 
                        stroke="#EBEAE9" 
                        strokeWidth="1" 
                        strokeDasharray="4 4" 
                      />
                      <text 
                        x={paddingX - 8} 
                        y={y + 4} 
                        fontSize="10" 
                        fill="#8C8886" 
                        textAnchor="end"
                        fontWeight="600"
                      >
                        {labelVal}d
                      </text>
                    </g>
                  );
                })}

                {/* Vertical Step Gridlines */}
                {simulationData.map((d, idx) => {
                  const x = paddingX + (idx / Math.max(1, simulationData.length - 1)) * (chartWidth - paddingX * 2);
                  return (
                    <g key={idx}>
                      <line 
                        x1={x} 
                        y1={paddingY} 
                        x2={x} 
                        y2={chartHeight - paddingY} 
                        stroke="#EBEAE9" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={x} 
                        y={chartHeight - paddingY + 14} 
                        fontSize="9" 
                        fill="#8C8886" 
                        textAnchor="middle"
                        fontWeight="700"
                      >
                        S{idx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Paths */}
                <path 
                  d={formatPointsPath(fsrsCoords.points)} 
                  fill="none" 
                  stroke="#6366F1" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path 
                  d={formatPointsPath(sm2Coords.points)} 
                  fill="none" 
                  stroke="#0D9488" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path 
                  d={formatPointsPath(leitnerCoords.points)} 
                  fill="none" 
                  stroke="#D97706" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots & Values */}
                {/* FSRS */}
                {fsrsCoords.points.map((p, i) => (
                  <g key={`fsrs-${i}`}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#6366F1" stroke="#FFF" strokeWidth="1.5" />
                    {simulationData.length <= 8 && (
                      <text x={p.x} y={p.y - 8} fontSize="9" fontWeight="700" fill="#6366F1" textAnchor="middle">
                        {p.value}d
                      </text>
                    )}
                  </g>
                ))}

                {/* SM-2 */}
                {sm2Coords.points.map((p, i) => (
                  <g key={`sm2-${i}`}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#0D9488" stroke="#FFF" strokeWidth="1.5" />
                    {simulationData.length <= 8 && (
                      <text x={p.x} y={p.y - 8} fontSize="9" fontWeight="700" fill="#0D9488" textAnchor="middle">
                        {p.value}d
                      </text>
                    )}
                  </g>
                ))}

                {/* Leitner */}
                {leitnerCoords.points.map((p, i) => (
                  <g key={`leitner-${i}`}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#D97706" stroke="#FFF" strokeWidth="1.5" />
                    {simulationData.length <= 8 && (
                      <text x={p.x} y={p.y - 8} fontSize="9" fontWeight="700" fill="#D97706" textAnchor="middle">
                        {p.value}d
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Grid Details */}
      <div className="simulator-comparison-section glass-panel" style={{ marginTop: '24px' }}>
        <h3 className="card-subtitle" style={{ marginBottom: '16px' }}>3. Detailed Parameters Comparison</h3>
        
        {simulationData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#6B6664', fontSize: '13px' }}>
            No comparison data available. Build a sequence first.
          </div>
        ) : (
          <div className="comparison-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th rowSpan="2" style={{ borderRight: '1px solid rgba(44, 42, 41, 0.08)' }}>Step</th>
                  <th rowSpan="2" style={{ borderRight: '1px solid rgba(44, 42, 41, 0.08)' }}>Rating</th>
                  <th colSpan="2" style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', color: '#4F46E5', borderBottom: '1px solid rgba(99, 102, 241, 0.1)', borderRight: '1px solid rgba(44, 42, 41, 0.08)' }}>FSRS v4</th>
                  <th colSpan="3" style={{ backgroundColor: 'rgba(13, 148, 136, 0.05)', color: '#0F766E', borderBottom: '1px solid rgba(13, 148, 136, 0.1)', borderRight: '1px solid rgba(44, 42, 41, 0.08)' }}>SM-2 (Anki)</th>
                  <th colSpan="2" style={{ backgroundColor: 'rgba(217, 119, 6, 0.05)', color: '#B45309', borderBottom: '1px solid rgba(217, 119, 6, 0.1)' }}>Leitner Box</th>
                </tr>
                <tr>
                  <th style={{ backgroundColor: 'rgba(99, 102, 241, 0.02)', fontSize: '10px' }}>Stability</th>
                  <th style={{ backgroundColor: 'rgba(99, 102, 241, 0.02)', fontSize: '10px', borderRight: '1px solid rgba(44, 42, 41, 0.08)' }}>Interval</th>
                  <th style={{ backgroundColor: 'rgba(13, 148, 136, 0.02)', fontSize: '10px' }}>Ease F.</th>
                  <th style={{ backgroundColor: 'rgba(13, 148, 136, 0.02)', fontSize: '10px' }}>Reps</th>
                  <th style={{ backgroundColor: 'rgba(13, 148, 136, 0.02)', fontSize: '10px', borderRight: '1px solid rgba(44, 42, 41, 0.08)' }}>Interval</th>
                  <th style={{ backgroundColor: 'rgba(217, 119, 6, 0.02)', fontSize: '10px' }}>Box</th>
                  <th style={{ backgroundColor: 'rgba(217, 119, 6, 0.02)', fontSize: '10px' }}>Interval</th>
                </tr>
              </thead>
              <tbody>
                {simulationData.map((d, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 700, textAlign: 'center', borderRight: '1px solid rgba(44, 42, 41, 0.05)' }}>{d.step}</td>
                    <td style={{ borderRight: '1px solid rgba(44, 42, 41, 0.05)', textAlign: 'center' }}>
                      <span className={`review-table-badge badge-${d.review.toLowerCase()}`}>
                        {d.review}
                      </span>
                    </td>
                    
                    {/* FSRS */}
                    <td style={{ color: '#4F46E5', fontFamily: 'monospace' }}>{d.fsrs.stability.toFixed(2)}</td>
                    <td style={{ color: '#4F46E5', fontWeight: 600, borderRight: '1px solid rgba(44, 42, 41, 0.05)', fontFamily: 'monospace' }}>{d.fsrs.interval}d</td>
                    
                    {/* SM-2 */}
                    <td style={{ color: '#0F766E', fontFamily: 'monospace' }}>{d.sm2.ease_factor.toFixed(2)}</td>
                    <td style={{ color: '#0F766E', fontFamily: 'monospace' }}>{d.sm2.repetitions}</td>
                    <td style={{ color: '#0F766E', fontWeight: 600, borderRight: '1px solid rgba(44, 42, 41, 0.05)', fontFamily: 'monospace' }}>{d.sm2.interval}d</td>
                    
                    {/* Leitner */}
                    <td style={{ color: '#B45309', fontFamily: 'monospace' }}>Box {d.leitner.box}</td>
                    <td style={{ color: '#B45309', fontWeight: 600, fontFamily: 'monospace' }}>{d.leitner.interval}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnkiSimulator;
