import { createNoise } from '../utils/noise'
import { clamp } from '../utils/audioUtils'

export const contourWaves = {
  id: 'contourWaves',
  name: 'Contour Waves',
  description: 'Flowing noise-field lines that shift and evolve with the music',

  getDefaultParams() {
    return {
      particleCount: { value: 1400, min: 200,   max: 3000,  step: 100,   label: 'Particles' },
      stepSize:      { value: 2.5,  min: 0.5,   max: 8,     step: 0.1,   label: 'Step Size' },
      maxAge:        { value: 220,  min: 50,    max: 600,   step: 10,    label: 'Particle Life' },
      noiseScale:    { value: 0.003,min: 0.001, max: 0.015, step: 0.001, label: 'Noise Scale' },
      lineAlpha:     { value: 0.12, min: 0.02,  max: 0.5,   step: 0.01,  label: 'Line Alpha' },
      fadeSpeed:     { value: 0.013,min: 0.005, max: 0.08,  step: 0.005, label: 'Fade Speed' },
      evolution:     { value: 0.6,  min: 0,     max: 3,     step: 0.1,   label: 'Evolution Speed' },
      sensitivity:   { value: 1.5,  min: 0.5,   max: 4,     step: 0.1,   label: 'Sensitivity' },
      colorHue:      { value: 210,  min: 0,     max: 360,   step: 5,     label: 'Base Hue' },
      saturation:    { value: 40,   min: 0,     max: 100,   step: 5,     label: 'Saturation' },
    }
  },

  createState(width, height, params) {
    const count = params.particleCount.value
    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      age: Math.floor(Math.random() * params.maxAge.value),
    }))
    return {
      pts,
      noise: createNoise(),
      frameCount: 0,
      lastBeatTime: 0,
      sBass: 0,
      sMid: 0,
      sTreble: 0,
      sVolume: 0,
    }
  },

  draw(ctx, width, height, bands, params, state) {
    const { bass, mid, treble, volume } = bands
    const sensitivity = params.sensitivity.value
    const SMOOTH = 0.1

    state.sBass   += (bass   * sensitivity - state.sBass)   * SMOOTH
    state.sMid    += (mid    * sensitivity - state.sMid)    * SMOOTH
    state.sTreble += (treble * sensitivity - state.sTreble) * SMOOTH
    state.sVolume += (volume * sensitivity - state.sVolume) * SMOOTH

    const bassNorm   = clamp(state.sBass   / 255, 0, 1)
    const midNorm    = clamp(state.sMid    / 255, 0, 1)
    const trebleNorm = clamp(state.sTreble / 255, 0, 1)
    const volNorm    = clamp(state.sVolume, 0, 1)

    // Beat: reseed noise field for a pattern shift
    const now = performance.now()
    const isBeat = state.sBass > 140 && now - state.lastBeatTime > 320
    if (isBeat) {
      state.noise.reseed(now)
      state.lastBeatTime = now
    }

    // Fade trail
    ctx.fillStyle = `rgba(0, 0, 0, ${params.fadeSpeed.value})`
    ctx.fillRect(0, 0, width, height)

    const step  = params.stepSize.value * (1 + volNorm * 1.8)
    const ns    = params.noiseScale.value * (1 + trebleNorm * 0.4)
    const evo   = params.evolution.value * 0.0008
    const alpha = params.lineAlpha.value * (0.4 + volNorm * 0.8)
    const lw    = 1.2 + bassNorm * 1.8

    const hue = (params.colorHue.value + midNorm * 50 + state.frameCount * 0.06) % 360
    const sat = params.saturation.value + volNorm * 30
    const lit = 65 + trebleNorm * 20

    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${alpha})`
    ctx.lineWidth   = lw
    ctx.lineCap     = 'round'

    const maxAge = params.maxAge.value
    const pts    = state.pts
    const fc     = state.frameCount

    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) {
      const p     = pts[i]
      const angle = state.noise.noise(p.x * ns, p.y * ns, fc * evo) * Math.PI * 4
      const nx    = p.x + Math.cos(angle) * step
      const ny    = p.y + Math.sin(angle) * step

      ctx.moveTo(p.x, p.y)
      ctx.lineTo(nx, ny)

      p.x = nx
      p.y = ny
      p.age++

      if (p.age >= maxAge || nx < 0 || nx > width || ny < 0 || ny > height) {
        p.x   = Math.random() * width
        p.y   = Math.random() * height
        p.age = 0
      }
    }
    ctx.stroke()

    state.frameCount++
  },
}
