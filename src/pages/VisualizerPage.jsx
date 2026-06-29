import { useRef, useState, useEffect, useCallback } from 'react'
import useAudioEngine from '../hooks/useAudioEngine'
import { TEMPLATES } from '../templates'
import ControlsPanel from '../components/ControlsPanel'
import './VisualizerPage.css'

const STORAGE_KEY = 'audioViz'
const DEFAULT_TEMPLATE = 'flowField'

const ASPECT_RATIOS = {
  full:  null,
  '9:16': { w: 9,  h: 16 },
  '4:5':  { w: 4,  h: 5  },
  '1:1':  { w: 1,  h: 1  },
  '16:9': { w: 16, h: 9  },
}

function computeCanvasBounds(ratioKey) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const ratio = ASPECT_RATIOS[ratioKey]
  if (!ratio) return { width: vw, height: vh, left: 0, top: 0 }
  const scale  = Math.min(vw / ratio.w, vh / ratio.h)
  const width  = Math.floor(ratio.w * scale)
  const height = Math.floor(ratio.h * scale)
  const left   = Math.floor((vw - width)  / 2)
  const top    = Math.floor((vh - height) / 2)
  return { width, height, left, top }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadParamsForTemplate(templateId) {
  const saved = loadSaved()
  const defaults = TEMPLATES[templateId].getDefaultParams()
  const savedParams = saved?.params?.[templateId]
  if (!savedParams) return defaults
  // Merge saved values into defaults (keeps structure, only overrides .value)
  const merged = {}
  for (const key in defaults) {
    merged[key] = { ...defaults[key] }
    if (savedParams[key] != null) {
      merged[key].value = savedParams[key]
    }
  }
  return merged
}

function saveToStorage(templateId, params) {
  const saved = loadSaved() || {}
  if (!saved.params) saved.params = {}
  // Save only values, not the full param descriptors
  const values = {}
  for (const key in params) {
    values[key] = params[key].value
  }
  saved.params[templateId] = values
  saved.activeTemplate = templateId
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch { /* storage full, ignore */ }
}

function saveAspectRatio(ratio) {
  const saved = loadSaved() || {}
  saved.aspectRatio = ratio
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch { /* ignore */ }
}

function saveDelayedStart(val) {
  const saved = loadSaved() || {}
  saved.delayedStart = val
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch { /* ignore */ }
}

export default function VisualizerPage({ onBack }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const animRef = useRef(null)
  const paramsRef = useRef(null)
  const templateIdRef = useRef(null)
  const aspectRatioRef = useRef('full')
  const audioRef = useRef(null)

  const [source, setSource] = useState(null)
  const [fileName, setFileName] = useState('')
  const [activeTemplateId, setActiveTemplateId] = useState(() => {
    const saved = loadSaved()
    return saved?.activeTemplate && TEMPLATES[saved.activeTemplate] ? saved.activeTemplate : DEFAULT_TEMPLATE
  })
  const [params, setParams] = useState(() => loadParamsForTemplate(
    loadSaved()?.activeTemplate && TEMPLATES[loadSaved()?.activeTemplate] ? loadSaved().activeTemplate : DEFAULT_TEMPLATE
  ))
  const [aspectRatio, setAspectRatio] = useState(() => {
    const saved = loadSaved()
    return saved?.aspectRatio && ASPECT_RATIOS[saved.aspectRatio] !== undefined ? saved.aspectRatio : 'full'
  })
  const [micDevices, setMicDevices] = useState([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [uiVisible, setUiVisible] = useState(true)
  const [playerState, setPlayerState] = useState(null)
  const [delayedStart, setDelayedStart] = useState(() => loadSaved()?.delayedStart ?? false)
  const [countdown, setCountdown] = useState(null)
  const countdownRef = useRef(null)
  const hideTimerRef = useRef(null)

  const audio = useAudioEngine()

  useEffect(() => {
    audioRef.current = audio
  }, [audio])

  // Auto-hide UI after mouse idle
  useEffect(() => {
    const showUI = () => {
      setUiVisible(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => setUiVisible(false), 2500)
    }
    // Show initially, then start idle timer
    showUI()
    window.addEventListener('mousemove', showUI)
    window.addEventListener('mousedown', showUI)
    window.addEventListener('touchstart', showUI)
    return () => {
      window.removeEventListener('mousemove', showUI)
      window.removeEventListener('mousedown', showUI)
      window.removeEventListener('touchstart', showUI)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // Keep paramsRef in sync
  useEffect(() => {
    paramsRef.current = params
  }, [params])

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height, left, top } = computeCanvasBounds(aspectRatioRef.current)
    canvas.width        = width
    canvas.height       = height
    canvas.style.left   = left + 'px'
    canvas.style.top    = top  + 'px'
    const hasRatio = aspectRatioRef.current !== 'full'
    canvas.classList.toggle('ratio-frame', hasRatio)
  }, [])

  const initTemplateState = useCallback((templateId, currentParams) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const template = TEMPLATES[templateId]
    stateRef.current = template.createState(canvas.width, canvas.height, currentParams)
  }, [])

  // Animation loop — reads everything from refs to avoid stale closures
  useEffect(() => {
    templateIdRef.current = activeTemplateId
    initCanvas()
    initTemplateState(activeTemplateId, paramsRef.current || params)

    if (animRef.current) cancelAnimationFrame(animRef.current)

    let running = true
    let playerPollCounter = 0
    function loop() {
      if (!running) return
      animRef.current = requestAnimationFrame(loop)
      const canvas = canvasRef.current
      if (!canvas || !stateRef.current) return

      const ctx = canvas.getContext('2d')
      const a = audioRef.current
      const bands = a ? a.getBands() : { bass: 0, mid: 0, treble: 0, volume: 0 }
      const rawData = a ? a.getRawData() : null
      const timeDomain = a ? a.getTimeDomainData() : null
      const template = TEMPLATES[templateIdRef.current]

      if (template && paramsRef.current) {
        template.draw(ctx, canvas.width, canvas.height, bands, paramsRef.current, stateRef.current, rawData, timeDomain)
      }

      // Poll player state every ~10 frames to avoid excessive re-renders
      if (a && ++playerPollCounter % 10 === 0) {
        const ps = a.getPlayerState()
        setPlayerState(ps)
      }
    }
    loop()

    const handleResize = () => {
      initCanvas()
      initTemplateState(templateIdRef.current, paramsRef.current)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      running = false
      window.removeEventListener('resize', handleResize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [activeTemplateId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reinit canvas + template state when aspect ratio changes
  useEffect(() => {
    aspectRatioRef.current = aspectRatio
    initCanvas()
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    initTemplateState(templateIdRef.current, paramsRef.current)
  }, [aspectRatio]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMicDevices = useCallback(async () => {
    try {
      const devices = await audio.enumerateAudioInputs()
      setMicDevices(devices)
      if (devices.length > 0 && !selectedMicId) {
        setSelectedMicId(devices[0].deviceId)
      }
      return devices
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
      return []
    }
  }, [audio, selectedMicId])

  const cancelCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setCountdown(null)
  }

  const startWithDelay = (startFn) => {
    if (!delayedStart) { startFn(); return }
    cancelCountdown()
    setCountdown(10)
    let count = 10
    countdownRef.current = setInterval(() => {
      count--
      if (count <= 0) {
        cancelCountdown()
        startFn()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  const handleMicToggle = async () => {
    if (source === 'mic') {
      cancelCountdown()
      audio.stop()
      setSource(null)
      return
    }
    try {
      let deviceId = selectedMicId
      if (micDevices.length === 0) {
        const devices = await loadMicDevices()
        if (devices.length > 0) {
          deviceId = devices[0].deviceId
          setSelectedMicId(deviceId)
        }
      }
      startWithDelay(async () => {
        await audio.startFromMicrophone(deviceId)
        setSource('mic')
        setFileName('')
      })
    } catch (err) {
      console.error('Microphone error:', err)
    }
  }

  const handleMicDeviceChange = async (deviceId) => {
    setSelectedMicId(deviceId)
    if (source === 'mic') {
      try {
        await audio.startFromMicrophone(deviceId)
      } catch (err) {
        console.error('Microphone switch error:', err)
      }
    }
  }

  const handleFileSelect = async (file) => {
    try {
      startWithDelay(async () => {
        await audio.startFromFile(file)
        setSource('file')
        setFileName(file.name)
      })
    } catch (err) {
      console.error('File error:', err)
    }
  }

  const handleTemplateChange = (id) => {
    const newParams = loadParamsForTemplate(id)
    setActiveTemplateId(id)
    setParams(newParams)
    saveToStorage(id, newParams)
    // Clear canvas on template switch
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    initTemplateState(id, newParams)
  }

  const handleResetParams = () => {
    const defaults = TEMPLATES[activeTemplateId].getDefaultParams()
    setParams(defaults)
    saveToStorage(activeTemplateId, defaults)
  }

  const handleParamChange = (key, value) => {
    setParams(prev => {
      const next = { ...prev, [key]: { ...prev[key], value } }
      saveToStorage(activeTemplateId, next)
      return next
    })
  }

  const handleAspectRatioChange = (ratio) => {
    setAspectRatio(ratio)
    saveAspectRatio(ratio)
  }

  const handleBack = () => {
    audio.stop()
    if (animRef.current) cancelAnimationFrame(animRef.current)
    onBack()
  }

  return (
    <div className={`visualizer ${aspectRatio !== 'full' ? 'has-ratio' : ''}`}>
      <canvas ref={canvasRef} />

      {countdown !== null && (
        <div className="countdown-overlay" style={{ display: 'none' }} />
      )}

      <button className={`back-btn ${uiVisible ? '' : 'ui-hidden'}`} onClick={handleBack} title="Back to home">
        ←
      </button>

      <ControlsPanel
        source={source}
        fileName={fileName}
        activeTemplateId={activeTemplateId}
        params={params}
        micDevices={micDevices}
        selectedMicId={selectedMicId}
        aspectRatio={aspectRatio}
        delayedStart={delayedStart}
        onMicToggle={handleMicToggle}
        onMicDeviceChange={handleMicDeviceChange}
        onFileSelect={handleFileSelect}
        onTemplateChange={handleTemplateChange}
        onParamChange={handleParamChange}
        onResetParams={handleResetParams}
        onAspectRatioChange={handleAspectRatioChange}
        onDelayedStartChange={(val) => { setDelayedStart(val); saveDelayedStart(val) }}
        defaultOpen
        uiVisible={uiVisible}
        playerState={playerState}
        onTogglePlayPause={audio.togglePlayPause}
        onSeek={audio.seek}
        onReplay={audio.replay}
      />
    </div>
  )
}
