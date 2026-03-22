import { useRef, useCallback, useEffect, useMemo } from 'react'
import { getEnergyBands } from '../utils/audioUtils'

export default function useAudioEngine() {
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const micStreamRef = useRef(null)
  const dataArrayRef = useRef(null)
  const timeDomainRef = useRef(null)
  const activeRef = useRef(false)
  const audioElRef = useRef(null)
  const objectUrlRef = useRef(null)

  const cleanup = useCallback(() => {
    activeRef.current = false
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch { /* already disconnected */ }
      sourceRef.current = null
    }
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.src = ''
      audioElRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close() } catch { /* already closed */ }
    }
    audioContextRef.current = null
    analyserRef.current = null
    dataArrayRef.current = null
    timeDomainRef.current = null
  }, [])

  const initAnalyser = useCallback(() => {
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.8
    audioContextRef.current = ctx
    analyserRef.current = analyser
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
    timeDomainRef.current = new Uint8Array(analyser.fftSize)
    activeRef.current = true
    return { ctx, analyser }
  }, [])

  const startFromFile = useCallback((file) => {
    cleanup()
    return new Promise((resolve) => {
      const { ctx, analyser } = initAnalyser()
      const audioEl = new Audio()
      audioEl.crossOrigin = 'anonymous'
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      audioEl.src = url
      audioElRef.current = audioEl

      const source = ctx.createMediaElementSource(audioEl)
      source.connect(analyser)
      analyser.connect(ctx.destination)
      sourceRef.current = source

      audioEl.addEventListener('ended', () => {
        activeRef.current = false
      })

      audioEl.play().then(resolve)
    })
  }, [cleanup, initAnalyser])

  const enumerateAudioInputs = useCallback(async () => {
    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const devices = await navigator.mediaDevices.enumerateDevices()
    tempStream.getTracks().forEach(t => t.stop())
    return devices
      .filter(d => d.kind === 'audioinput')
      .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 5)}` }))
  }, [])

  const startFromMicrophone = useCallback(async (deviceId) => {
    cleanup()
    const constraints = deviceId
      ? { audio: { deviceId: { exact: deviceId } } }
      : { audio: true }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    const { ctx, analyser } = initAnalyser()
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    sourceRef.current = source
    micStreamRef.current = stream
  }, [cleanup, initAnalyser])

  const stop = useCallback(() => {
    cleanup()
  }, [cleanup])

  // Player controls
  const togglePlayPause = useCallback(() => {
    const el = audioElRef.current
    if (!el) return
    const ctx = audioContextRef.current
    if (ctx && ctx.state === 'suspended') ctx.resume()
    if (el.paused) {
      if (el.ended) el.currentTime = 0
      el.play()
      activeRef.current = true
    } else {
      el.pause()
    }
  }, [])

  const seek = useCallback((time) => {
    const el = audioElRef.current
    if (!el) return
    el.currentTime = time
    if (el.paused && !el.ended) {
      el.play()
      activeRef.current = true
    }
  }, [])

  const replay = useCallback(() => {
    const el = audioElRef.current
    if (!el) return
    const ctx = audioContextRef.current
    if (ctx && ctx.state === 'suspended') ctx.resume()
    el.currentTime = 0
    el.play()
    activeRef.current = true
  }, [])

  const getPlayerState = useCallback(() => {
    const el = audioElRef.current
    if (!el) return null
    return {
      currentTime: el.currentTime,
      duration: el.duration || 0,
      paused: el.paused,
      ended: el.ended,
    }
  }, [])

  const getFrequencyData = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return null
    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    return dataArrayRef.current
  }, [])

  const getBands = useCallback(() => {
    const data = getFrequencyData()
    if (!data) return { bass: 0, mid: 0, treble: 0, volume: 0 }
    const ctx = audioContextRef.current
    return getEnergyBands(data, ctx.sampleRate, analyserRef.current.frequencyBinCount)
  }, [getFrequencyData])

  const getRawData = useCallback(() => {
    return getFrequencyData()
  }, [getFrequencyData])

  const getTimeDomainData = useCallback(() => {
    if (!analyserRef.current || !timeDomainRef.current) return null
    analyserRef.current.getByteTimeDomainData(timeDomainRef.current)
    return timeDomainRef.current
  }, [])

  const isActive = useCallback(() => activeRef.current, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  return useMemo(() => ({
    startFromFile,
    startFromMicrophone,
    enumerateAudioInputs,
    stop,
    getBands,
    getRawData,
    getTimeDomainData,
    isActive,
    analyserRef,
    audioContextRef,
    togglePlayPause,
    seek,
    replay,
    getPlayerState,
  }), [startFromFile, startFromMicrophone, enumerateAudioInputs, stop, getBands, getRawData, getTimeDomainData, isActive, togglePlayPause, seek, replay, getPlayerState])
}
