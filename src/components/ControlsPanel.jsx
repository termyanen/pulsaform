import { useState, useEffect, useRef } from 'react'
import { TEMPLATE_LIST } from '../templates'
import './ControlsPanel.css'

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function ControlsPanel({
  source,
  fileName,
  activeTemplateId,
  params,
  micDevices,
  selectedMicId,
  onMicToggle,
  onMicDeviceChange,
  onFileSelect,
  onTemplateChange,
  onParamChange,
  onResetParams,
  defaultOpen,
  uiVisible,
  playerState,
  onTogglePlayPause,
  onSeek,
  onReplay,
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [seekValue, setSeekValue] = useState(0)
  const seekingRef = useRef(false)

  useEffect(() => {
    if (!seekingRef.current && playerState) {
      setSeekValue(playerState.currentTime)
    }
  }, [playerState])

  const handleSeekStart = () => { seekingRef.current = true }
  const handleSeekChange = (e) => { setSeekValue(parseFloat(e.target.value)) }
  const handleSeekEnd = (e) => {
    seekingRef.current = false
    onSeek(parseFloat(e.target.value))
  }

  return (
    <>
      {!open && (
        <button
          className={`controls-toggle ${uiVisible ? '' : 'ui-hidden'}`}
          onClick={() => setOpen(true)}
          title="Open controls"
        >
          ⚙
        </button>
      )}

      <div className={`controls-panel ${open ? 'open' : ''}`}>
        <button
          className="controls-close"
          onClick={() => setOpen(false)}
          title="Close controls"
        >
          ✕
        </button>

        {/* Source selection */}
        <div className="controls-section">
          <div className="controls-section-title">Audio Source</div>
          <div className="source-buttons">
            <button
              className={`source-btn ${source === 'mic' ? 'active' : ''}`}
              onClick={onMicToggle}
            >
              🎤 {source === 'mic' ? 'Stop Mic' : 'Microphone'}
            </button>
            {micDevices.length > 1 && (
              <select
                className="mic-select"
                value={selectedMicId}
                onChange={(e) => onMicDeviceChange(e.target.value)}
              >
                {micDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
            <button className={`source-btn ${source === 'file' ? 'active' : ''}`}>
              <label>
                🎵 Upload MP3
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) onFileSelect(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </button>
            {fileName && <span className="source-file-name">{fileName}</span>}
          </div>
        </div>

        {/* Player */}
        {source === 'file' && playerState && (
          <div className="controls-section">
            <div className="controls-section-title">Player</div>
            <div className="player-bar">
              <button className="player-btn" onClick={onTogglePlayPause} title={playerState.paused ? 'Play' : 'Pause'}>
                {playerState.paused ? '▶' : '⏸'}
              </button>
              <button className="player-btn" onClick={onReplay} title="Replay">
                ↺
              </button>
              <input
                type="range"
                className="player-seek"
                min={0}
                max={playerState.duration || 0}
                step={0.1}
                value={seekValue}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
              />
              <span className="player-time">
                {formatTime(seekValue)} / {formatTime(playerState.duration)}
              </span>
            </div>
          </div>
        )}

        {/* Template selector */}
        <div className="controls-section">
          <div className="controls-section-title">Visualization</div>
          <div className="template-cards">
            {TEMPLATE_LIST.map((t) => (
              <div
                key={t.id}
                className={`template-card ${activeTemplateId === t.id ? 'active' : ''}`}
                onClick={() => onTemplateChange(t.id)}
              >
                <div className="template-card-name">{t.name}</div>
                <div className="template-card-desc">{t.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Parameters */}
        <div className="controls-section">
          <div className="controls-section-title">
            Parameters
            <button className="reset-btn" onClick={onResetParams}>Reset</button>
          </div>
          <div className="params-grid">
            {Object.entries(params).map(([key, p]) => (
              <div key={key} className="param-slider">
                <div className="param-slider-header">
                  <span className="param-slider-label">{p.label}</span>
                  <span className="param-slider-value">{p.value}</span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={p.value}
                  onChange={(e) => onParamChange(key, parseFloat(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
