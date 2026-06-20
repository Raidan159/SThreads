import React, { useState } from 'react';
import { HelpCircle, Eye, Check } from 'lucide-react';
import GraphView from './GraphView';

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

const ReviewModal = ({
  dueCards,
  subgraph,
  onSubmitReview,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  if (!dueCards || dueCards.length === 0) {
    return (
      <div className="review-overlay">
        <div className="modal-dialog modal-dialog-center" style={{ height: '300px' }}>
          <Check size={48} color="#10B981" />
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'var(--font-size-xxl)' }}>All caught up!</h2>
          <p style={{ color: '#6B6664', textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>No flashcards due for review today.</p>
          <button className="btn-primary" onClick={onClose} style={{ flex: 'none', padding: '10px 24px' }}>
            Back to Timeline
          </button>
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];

  // Compile sub-graph highlighted nodes
  // We highlight the focal node (current card node) and its neighbors
  const focalNodeId = currentCard.node_id;
  const connectedNodeIds = new Set([focalNodeId]);
  
  if (subgraph && subgraph.edges) {
    subgraph.edges.forEach(edge => {
      if (edge.source_id === focalNodeId) {
        connectedNodeIds.add(edge.target_id);
      } else if (edge.target_id === focalNodeId) {
        connectedNodeIds.add(edge.source_id);
      }
    });
  }

  const handleRatingSubmit = async (rating) => {
    await onSubmitReview(currentCard.id, rating);
    
    // Reset view
    setShowAnswer(false);
    
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Completed reviews!
      onClose();
    }
  };

  return (
    <div className="review-overlay">
      <div className="review-container">
        
        {/* Flashcard Pane */}
        <div className="review-card-pane">
          <div>
            <div className="review-title">
              <HelpCircle size={22} color="#2563EB" />
              <span>Contextual Memory Review</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-size-xs)', color: '#6B6664', fontWeight: 600, textTransform: 'uppercase', marginBottom: '20px' }}>
              <span>Progress:</span>
              <span style={{ color: '#2C2A29' }}>{currentIndex + 1} / {dueCards.length} Cards</span>
            </div>
          </div>

          <div className="flashcard-content" key={currentIndex}>
            <div className="flashcard-side" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>{renderHighlightedText(currentCard.front)}</div>
              {currentCard.synonyms && (
                <div className="flashcard-synonyms-hint" style={{ fontSize: 'var(--font-size-sm-sub)', color: '#6B6664', borderTop: '1px dashed rgba(44,42,41,0.1)', paddingTop: '6px', marginTop: '4px' }}>
                  <span style={{ fontWeight: 600 }}>Synonym:</span> {currentCard.synonyms}
                </div>
              )}
            </div>

            {showAnswer ? (
              <div className="flashcard-side flashcard-answer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>{renderHighlightedText(currentCard.back)}</div>
                {currentCard.image_url && (
                  <div className="flashcard-image-wrapper" style={{ marginTop: '8px', maxWidth: '100%', maxHeight: '180px', overflow: 'hidden', borderRadius: '8px' }}>
                    <img 
                      src={`http://localhost:8000${currentCard.image_url}`} 
                      alt="Reference Visual" 
                      style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: '6px' }} 
                    />
                  </div>
                )}
                {currentCard.audio_url && (
                  <div className="flashcard-audio-wrapper" style={{ marginTop: '8px', width: '100%' }}>
                    <audio 
                      controls 
                      src={`http://localhost:8000${currentCard.audio_url}`} 
                      style={{ width: '100%', height: '36px' }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <button 
                className="btn-secondary" 
                style={{ flex: 'none', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}
                onClick={() => setShowAnswer(true)}
              >
                <Eye size={16} />
                <span>Show Answer</span>
              </button>
            )}
          </div>

          {/* FSRS rating buttons */}
          <div>
            {showAnswer ? (
              <div className="fsrs-buttons">
                <button className="fsrs-btn fsrs-btn-again" onClick={() => handleRatingSubmit(1)}>
                  Again {currentCard.predicted_intervals ? `(${currentCard.predicted_intervals["1"] || '1d'})` : ''}
                </button>
                <button className="fsrs-btn fsrs-btn-hard" onClick={() => handleRatingSubmit(2)}>
                  Hard {currentCard.predicted_intervals ? `(${currentCard.predicted_intervals["2"] || '1d'})` : ''}
                </button>
                <button className="fsrs-btn fsrs-btn-good" onClick={() => handleRatingSubmit(3)}>
                  Good {currentCard.predicted_intervals ? `(${currentCard.predicted_intervals["3"] || '1d'})` : ''}
                </button>
                <button className="fsrs-btn fsrs-btn-easy" onClick={() => handleRatingSubmit(4)}>
                  Easy {currentCard.predicted_intervals ? `(${currentCard.predicted_intervals["4"] || '1d'})` : ''}
                </button>
              </div>
            ) : (
              <div style={{ height: '54px' }} /> // Spacer to avoid layout jump
            )}
            
            <button 
              className="btn-secondary" 
              style={{ width: '100%', marginTop: '16px' }}
              onClick={onClose}
            >
              Skip / Exit Review
            </button>
          </div>
        </div>

        {/* Knowledge Graph Neighbor Pane */}
        <div className="review-graph-pane">
          <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
            <span style={{ fontSize: 'var(--font-size-xxs)', textTransform: 'uppercase', color: '#6B6664', fontWeight: 700 }}>
              Neighbor Context Mesh
            </span>
            <h4 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 'var(--font-size-base)' }}>
              {currentCard.node_title}
            </h4>
          </div>
          {subgraph ? (
            <GraphView
              nodes={subgraph.nodes}
              edges={subgraph.edges}
              selectedNodeId={focalNodeId}
              onSelectNode={() => {}}
              highlightedNodeIds={Array.from(connectedNodeIds)}
              width={450}
              height={600}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B6664' }}>
              No context graph available
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReviewModal;
