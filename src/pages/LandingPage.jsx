import { useState } from 'react'
import './LandingPage.css'

export default function LandingPage({ onEnter }) {
  const [exiting, setExiting] = useState(false)

  const handleEnter = () => {
    setExiting(true)
    setTimeout(() => onEnter(), 500)
  }

  return (
    <div className={`landing ${exiting ? 'exiting' : ''}`}>
      <div className="landing-content">
        <div className="landing-icon">
          <span /><span /><span /><span /><span /><span /><span />
        </div>

        <h1 className="landing-title">Pulsaform</h1>
        <p className="landing-subtitle">
          Real-time audio visualization powered by Web Audio API.
          Use your microphone or upload a track to see the sound come alive.
        </p>

        <button className="landing-enter" onClick={handleEnter}>
          Start Experience
        </button>

        <div className="landing-features">
          <div className="landing-feature">
            <div className="landing-feature-icon">🎤</div>
            <span>Microphone</span>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon">🎵</div>
            <span>MP3 Upload</span>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon">🎨</div>
            <span>8 Templates</span>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon">⚙️</div>
            <span>Real-time Controls</span>
          </div>
        </div>
      </div>
    </div>
  )
}
