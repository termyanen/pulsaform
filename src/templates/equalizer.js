import { clamp } from '../utils/audioUtils'

export const equalizer = {
  id: 'equalizer',
  name: 'Equalizer',
  description: 'Classic equalizer bars with peak indicators',

  getDefaultParams() {
    return {
      barCount: { value: 48, min: 8, max: 128, step: 4, label: 'Bars' },
      gap: { value: 3, min: 0, max: 10, step: 1, label: 'Gap' },
      sensitivity: { value: 0.4, min: 0.2, max: 3, step: 0.1, label: 'Sensitivity' },
      smoothing: { value: 0.1, min: 0.05, max: 0.6, step: 0.05, label: 'Smoothing' },
      peakDecay: { value: 0.015, min: 0.005, max: 0.05, step: 0.005, label: 'Peak Decay' },
      mirror: { value: 1, min: 0, max: 1, step: 1, label: 'Mirror (0/1)' },
      colorMode: { value: 1, min: 0, max: 2, step: 1, label: 'Color (0=Green 1=Rainbow 2=Blue)' },
      glow: { value: 0, min: 0, max: 1, step: 0.1, label: 'Glow' },
    }
  },

  createState(width, height, params) {
    const count = params.barCount.value
    return {
      smoothed: new Float32Array(count),
      peaks: new Float32Array(count),
      peakVel: new Float32Array(count),
    }
  },

  draw(ctx, width, height, bands, params, state, rawData) {
    const barCount = params.barCount.value
    const gap = params.gap.value
    const sensitivity = params.sensitivity.value
    const smoothing = params.smoothing.value
    const peakDecay = params.peakDecay.value
    const mirror = params.mirror.value > 0.5
    const colorMode = Math.round(params.colorMode.value)
    const glow = params.glow.value

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.fillRect(0, 0, width, height)

    // Ensure state arrays match bar count
    if (state.smoothed.length !== barCount) {
      state.smoothed = new Float32Array(barCount)
      state.peaks = new Float32Array(barCount)
      state.peakVel = new Float32Array(barCount)
    }

    const dataLen = rawData ? rawData.length : 1
    const barWidth = (width - gap * (barCount - 1)) / barCount
    const maxHeight = mirror ? height / 2 : height
    const baseY = mirror ? height / 2 : height

    // Log frequency mapping
    const minLog = Math.log(1)
    const maxLog = Math.log(dataLen * 0.75)

    for (let i = 0; i < barCount; i++) {
      const t = i / barCount
      const dataIndex = rawData
        ? Math.min(Math.floor(Math.exp(minLog + t * (maxLog - minLog))), dataLen - 1)
        : 0
      const value = rawData ? rawData[dataIndex] * sensitivity : 0

      // Smooth
      state.smoothed[i] += (value - state.smoothed[i]) * smoothing
      const norm = clamp(state.smoothed[i] / 255, 0, 1)
      const barHeight = norm * maxHeight

      // Peak tracking — smooth rise, gravity fall
      if (norm > state.peaks[i]) {
        state.peaks[i] += (norm - state.peaks[i]) * 0.4
        state.peakVel[i] = 0
      } else {
        state.peakVel[i] += peakDecay * 0.5
        state.peaks[i] -= state.peakVel[i]
        if (state.peaks[i] < 0) state.peaks[i] = 0
      }

      const x = i * (barWidth + gap)

      // Color
      let color
      if (colorMode === 0) {
        // Classic green → yellow → red
        const r = norm < 0.6 ? Math.floor(norm / 0.6 * 255) : 255
        const g = norm < 0.8 ? 255 : Math.floor((1 - (norm - 0.8) / 0.2) * 255)
        color = `rgb(${r},${g},0)`
      } else if (colorMode === 1) {
        // Rainbow
        const hue = t * 360
        color = `hsl(${hue}, 85%, ${40 + norm * 25}%)`
      } else {
        // Blue-cyan
        const hue = 200 + t * 40
        color = `hsl(${hue}, 80%, ${35 + norm * 35}%)`
      }

      // Glow
      if (glow > 0 && norm > 0.3) {
        ctx.shadowBlur = 12 * glow * norm
        ctx.shadowColor = color
      } else {
        ctx.shadowBlur = 0
      }

      // Draw bar
      ctx.fillStyle = color
      ctx.fillRect(x, baseY - barHeight, barWidth, barHeight)

      // Mirror
      if (mirror) {
        ctx.globalAlpha = 0.5
        ctx.fillRect(x, baseY, barWidth, barHeight)
        ctx.globalAlpha = 1
      }

      // Peak indicator — only show when above bar
      const peakY = state.peaks[i] * maxHeight
      if (peakY > barHeight + 3) {
        ctx.shadowBlur = 0
        const peakAlpha = clamp((peakY - barHeight) / 20, 0.3, 0.9)
        ctx.fillStyle = `rgba(255, 255, 255, ${peakAlpha})`
        ctx.fillRect(x, baseY - peakY - 2, barWidth, 2)
        if (mirror) {
          ctx.globalAlpha = peakAlpha * 0.5
          ctx.fillRect(x, baseY + peakY, barWidth, 2)
          ctx.globalAlpha = 1
        }
      }
    }

    ctx.shadowBlur = 0
  },
}
