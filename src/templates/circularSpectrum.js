import { map, clamp } from '../utils/audioUtils'

export const circularSpectrum = {
  id: 'circularSpectrum',
  name: 'Circular Spectrum',
  description: 'Radial frequency bars emanating from the center',

  getDefaultParams() {
    return {
      barCount: { value: 180, min: 32, max: 360, step: 8, label: 'Bar Count' },
      innerRadius: { value: 170, min: 40, max: 300, step: 10, label: 'Inner Radius' },
      barWidth: { value: 2.5, min: 1, max: 8, step: 0.5, label: 'Bar Width' },
      sensitivity: { value: 0.5, min: 0.2, max: 3, step: 0.1, label: 'Sensitivity' },
      glow: { value: 0.1, min: 0, max: 1, step: 0.1, label: 'Glow' },
      rotation: { value: 0.8, min: 0, max: 3, step: 0.1, label: 'Rotation Speed' },
    }
  },

  createState() {
    return {
      angle: 0,
      smoothedData: null,
    }
  },

  draw(ctx, width, height, bands, params, state, rawData) {
    const barCount = params.barCount.value
    const minDim = Math.min(width, height)
    const innerRadius = Math.min(params.innerRadius.value, minDim * 0.25)
    const barWidth = params.barWidth.value
    const sensitivity = params.sensitivity.value
    const glow = params.glow.value
    const rotSpeed = params.rotation.value

    // Clear with slight trail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    ctx.fillRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2

    // Smooth the data
    if (!state.smoothedData || state.smoothedData.length !== barCount) {
      state.smoothedData = new Float32Array(barCount)
    }

    // Rotate based on bass
    state.angle += (0.002 + bands.bass * 0.00005) * rotSpeed

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(state.angle)

    // Draw bars
    const angleStep = (Math.PI * 2) / barCount
    const maxBarHeight = Math.min(width, height) * 0.35

    // Precompute logarithmic frequency mapping
    const dataLen = rawData ? rawData.length : 1
    const minLog = Math.log(1)
    const maxLog = Math.log(dataLen * 0.75)

    for (let i = 0; i < barCount; i++) {
      // Logarithmic mapping so low freqs don't dominate
      const t = i / barCount
      const dataIndex = rawData
        ? Math.min(Math.floor(Math.exp(minLog + t * (maxLog - minLog))), dataLen - 1)
        : 0
      const value = rawData ? rawData[dataIndex] * sensitivity : 0

      // Smooth
      state.smoothedData[i] += (value - state.smoothedData[i]) * 0.3

      const barHeight = map(state.smoothedData[i], 0, 255, 2, maxBarHeight)
      const angle = angleStep * i

      // Color based on frequency position
      const hue = (i / barCount) * 360 + state.angle * 20
      const saturation = 70 + bands.volume * 30
      const lightness = 40 + clamp(state.smoothedData[i] / 255, 0, 1) * 35

      ctx.save()
      ctx.rotate(angle)

      // Glow effect
      if (glow > 0 && state.smoothedData[i] > 80) {
        ctx.shadowBlur = 15 * glow
        ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`
      } else {
        ctx.shadowBlur = 0
      }

      // Draw bar
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
      ctx.fillRect(-barWidth / 2, innerRadius, barWidth, barHeight)

      // Mirror bar (inner)
      const innerBarHeight = barHeight * 0.3
      ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.4)`
      ctx.fillRect(-barWidth / 2, innerRadius - innerBarHeight, barWidth, innerBarHeight)

      ctx.restore()
    }

    ctx.restore()

    // Solid dark circle to cover inner bar portions
    ctx.save()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
    ctx.fill()

    // Center glow on top
    const bassGlow = clamp(bands.bass / 255, 0, 1)
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius * 0.9)
    gradient.addColorStop(0, `rgba(120, 100, 255, ${0.15 + bassGlow * 0.2})`)
    gradient.addColorStop(0.5, `rgba(80, 60, 200, ${0.05 + bassGlow * 0.1})`)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(cx, cy, innerRadius * 0.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },
}
