import { useRef, useState, useEffect, useCallback } from 'react'
import useAudioEngine from '../hooks/useAudioEngine'
import { TEMPLATES } from '../templates'
import ControlsPanel from '../components/ControlsPanel'
import './VisualizerPage.css'

const STORAGE_KEY = 'audioViz'
const DEFAULT_TEMPLATE = 'flowField'

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

export default function VisualizerPage({ onBack }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const animRef = useRef(null)
  const paramsRef = useRef(null)
  const templateIdRef = useRef(null)
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
  const [micDevices, setMicDevices] = useState([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [uiVisible, setUiVisible] = useState(true)
  const [playerState, setPlayerState] = useState(null)
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
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
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

  const handleMicToggle = async () => {
    if (source === 'mic') {
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
      await audio.startFromMicrophone(deviceId)
      setSource('mic')
      setFileName('')
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
      await audio.startFromFile(file)
      setSource('file')
      setFileName(file.name)
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

  const handleBack = () => {
    audio.stop()
    if (animRef.current) cancelAnimationFrame(animRef.current)
    onBack()
  }

  return (
    <div className="visualizer">
      <canvas ref={canvasRef} />

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
        onMicToggle={handleMicToggle}
        onMicDeviceChange={handleMicDeviceChange}
        onFileSelect={handleFileSelect}
        onTemplateChange={handleTemplateChange}
        onParamChange={handleParamChange}
        onResetParams={handleResetParams}
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
