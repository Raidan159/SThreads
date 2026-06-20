import React from 'react';
import { Play, Pause, Calendar, Share2, Award, RefreshCw, ZoomIn, TrendingUp } from 'lucide-react';

const ControlDock = ({
  tCurrent,
  setTCurrent,
  isPlaying,
  setIsPlaying,
  viewMode,
  setViewMode,
  dueReviewsCount,
  onStartReview
}) => {
  const minDate = new Date("2026-10-20T00:00:00").getTime();
  const maxDate = new Date("2026-10-26T00:00:00").getTime();
  const currentDateMs = new Date(tCurrent).getTime();

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value);
    setTCurrent(new Date(val));
  };

  const formatDateStr = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) + " " + date.toLocaleTimeString("en-US", {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="control-dock">
      <div className="dock-controls">
        {/* Play/Pause machine simulation */}
        <button 
          className="dock-btn-main" 
          onClick={handleTogglePlay}
          title={isPlaying ? "Pause Time Machine" : "Play Time Machine"}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        {/* Date Display */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 'var(--font-size-xxs)', textTransform: 'uppercase', color: '#6B6664', fontWeight: 700 }}>
            Global Time Machine Target
          </span>
          <span style={{ fontFamily: 'Outfit', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            {formatDateStr(new Date(tCurrent))}
          </span>
        </div>

        <div className="action-buttons">
          {/* Timeline / Graph mode toggle */}
          <button 
            className={`dock-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
            title="Switch to Timeline View"
          >
            <Calendar size={18} />
          </button>
          
          <button 
            className={`dock-btn ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
            title="Switch to Full Knowledge Graph"
          >
            <Share2 size={18} />
          </button>

          <button 
            className={`dock-btn ${viewMode === 'simulator' ? 'active' : ''}`}
            onClick={() => setViewMode('simulator')}
            title="Switch to Scheduler Simulator"
          >
            <TrendingUp size={18} />
          </button>

          {/* Trigger reviews */}
          <button 
            className="dock-btn"
            style={{ 
              position: 'relative', 
              backgroundColor: dueReviewsCount > 0 ? 'rgba(234, 88, 12, 0.1)' : 'transparent',
              color: dueReviewsCount > 0 ? '#EA580C' : 'inherit'
            }}
            onClick={onStartReview}
            title={`${dueReviewsCount} Cards due for Spaced Repetition`}
            disabled={dueReviewsCount === 0}
          >
            <Award size={18} />
            {dueReviewsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#EA580C',
                color: '#fff',
                fontSize: 'var(--font-size-xxs)',
                fontWeight: 700,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {dueReviewsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Timeline time-machine slider */}
      <div className="slider-container">
        <input
          type="range"
          min={minDate}
          max={maxDate}
          step={60 * 60 * 1000} // 1 hour step
          value={currentDateMs}
          onChange={handleSliderChange}
          className="time-slider"
        />
        <div className="slider-labels">
          <span>20 OCT 2026</span>
          <span>22 OCT</span>
          <span>24 OCT</span>
          <span>26 OCT 2026</span>
        </div>
      </div>
    </div>
  );
};

export default ControlDock;
