import { clamp } from '../utils/audioUtils'

export const colorWaves = {
  id: 'colorWaves',
  name: 'Color Waves',
  description: 'Smooth flowing waves of color driven by audio frequencies',

  getDefaultParams() {
    return {
      waveCount: { value: 7, min: 2, max: 14, step: 1, label: 'Waves' },
      amplitude: { value: 1.2, min: 0.2, max: 3, step: 0.1, label: 'Amplitude' },
      speed: { value: 1, min: 0.1, max: 3, step: 0.1, label: 'Speed' },
      thickness: { value: 3, min: 0.5, max: 6, step: 0.5, label: 'Thickness' },
      smoothing: { value: 0.02, min: 0.02, max: 0.3, step: 0.02, label: 'Smoothing' },
      glow: { value: 1, min: 0, max: 1, step: 0.1, label: 'Glow' },
      complexity: { value: 1, min: 1, max: 6, step: 1, label: 'Complexity' },
      spread: { value: 0.4, min: 0.1, max: 1.5, step: 0.1, label: 'Spread' },
    }
  },

  createState() {
    return {
      phase: 0,
      sBass: 0,
      sMid: 0,
      sTreble: 0,
      sVolume: 0,
    }
  },

  draw(ctx, width, height, bands, params, state) {
    const waveCount = params.waveCount.value
    const amplitude = params.amplitude.value
    const speed = params.speed.value
    const thickness = params.thickness.value
    const smoothing = params.smoothing.value
    const glow = params.glow.value
    const complexity = params.complexity.value
    const spread = params.spread.value

    // Fade background
    ctx.fillStyle = 'rgba(8, 10, 28, 0.12)'
    ctx.fillRect(0, 0, width, height)

    // Smooth bands
    state.sBass += (bands.bass - state.sBass) * smoothing
    state.sMid += (bands.mid - state.sMid) * smoothing
    state.sTreble += (bands.treble - state.sTreble) * smoothing
    state.sVolume += (bands.volume - state.sVolume) * smoothing

    const bassNorm = clamp(state.sBass / 255, 0, 1)
    const midNorm = clamp(state.sMid / 255, 0, 1)
    const trebleNorm = clamp(state.sTreble / 255, 0, 1)
    const volumeNorm = clamp(state.sVolume / 255, 0, 1)

    state.phase += 0.015 * speed * (1 + volumeNorm * 0.5)

    const centerY = height / 2
    const maxAmp = height * 0.2 * amplitude
    const step = 3 // pixel step for smoothness

    const colors = [
      [0, 180, 255],    // cyan
      [255, 100, 50],   // orange
      [180, 60, 255],   // purple
      [255, 60, 130],   // pink
      [50, 220, 180],   // teal
      [255, 180, 30],   // amber
      [100, 130, 255],  // blue
      [255, 50, 80],    // red
      [0, 255, 160],    // mint
      [220, 80, 255],   // magenta
      [80, 200, 255],   // sky
      [255, 140, 80],   // coral
      [140, 255, 100],  // lime
      [255, 100, 200],  // hot pink
    ]

    for (let w = 0; w < waveCount; w++) {
      const wt = w / waveCount
      const [cr, cg, cb] = colors[w % colors.length]

      // Each wave responds differently to frequency bands
      const bandMix = w % 3 === 0 ? bassNorm : w % 3 === 1 ? midNorm : trebleNorm
      const waveAmp = maxAmp * (0.3 + bandMix * 0.7) * (0.6 + wt * 0.4)

      // Vertical offset — waves spread from center
      const offsetY = (wt - 0.5) * height * spread

      // Phase offset per wave
      const phaseOffset = w * 0.9

      // Alpha based on volume
      const alpha = 0.3 + volumeNorm * 0.5

      // Glow
      if (glow > 0) {
        ctx.shadowBlur = 15 * glow * (0.5 + bandMix * 0.5)
        ctx.shadowColor = `rgba(${cr}, ${cg}, ${cb}, ${0.5 * glow})`
      } else {
        ctx.shadowBlur = 0
      }

      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`
      ctx.lineWidth = thickness * (0.7 + bandMix * 0.6)
      ctx.beginPath()

      for (let x = 0; x <= width; x += step) {
        const xt = x / width
        // Edge fade — amplitude tapers at left and right edges
        const edgeFade = Math.sin(xt * Math.PI)

        // Build wave from multiple sine harmonics
        let y = 0
        for (let h = 1; h <= complexity; h++) {
          const freq = h * (0.8 + wt * 0.4)
          const amp = 1 / h
          y += Math.sin(xt * freq * Math.PI * 2 + state.phase * (0.7 + h * 0.3) + phaseOffset) * amp
        }

        // Add bass-driven low-frequency sway
        y += Math.sin(xt * Math.PI + state.phase * 0.3 + w) * bassNorm * 0.4

        const finalY = centerY + offsetY + y * waveAmp * edgeFade

        if (x === 0) ctx.moveTo(x, finalY)
        else ctx.lineTo(x, finalY)
      }

      ctx.stroke()
    }

    ctx.shadowBlur = 0
  },
}
