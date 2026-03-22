import { clamp } from '../utils/audioUtils'

export const waveform = {
  id: 'waveform',
  name: 'Oscilloscope',
  description: 'Classic waveform display — see the shape of your sound in real time',

  getDefaultParams() {
    return {
      lineWidth: { value: 2.5, min: 1, max: 6, step: 0.5, label: 'Line Width' },
      zoom: { value: 1, min: 0.3, max: 4, step: 0.1, label: 'Zoom' },
      glow: { value: 0.8, min: 0, max: 1, step: 0.1, label: 'Glow' },
      trail: { value: 0.25, min: 0.05, max: 0.6, step: 0.05, label: 'Trail' },
      sensitivity: { value: 1.2, min: 0.3, max: 3, step: 0.1, label: 'Sensitivity' },
      color: { value: 160, min: 0, max: 360, step: 5, label: 'Hue' },
      grid: { value: 0.4, min: 0, max: 1, step: 0.1, label: 'Grid Opacity' },
    }
  },

  createState() {
    return {
      history: [],
    }
  },

  draw(ctx, width, height, bands, params, state, rawData, timeDomain) {
    const lineWidth = params.lineWidth.value
    const zoom = params.zoom.value
    const glowAmount = params.glow.value
    const trail = params.trail.value
    const sensitivity = params.sensitivity.value
    const hue = params.color.value
    const gridOpacity = params.grid.value

    // Trail fade
    ctx.fillStyle = `rgba(0, 0, 0, ${trail})`
    ctx.fillRect(0, 0, width, height)

    const cy = height / 2

    // Draw grid
    if (gridOpacity > 0) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${gridOpacity * 0.06})`
      ctx.lineWidth = 1

      // Horizontal lines
      const hLines = 8
      for (let i = 0; i <= hLines; i++) {
        const y = (height / hLines) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Vertical lines
      const vLines = 16
      for (let i = 0; i <= vLines; i++) {
        const x = (width / vLines) * i
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      // Center line (brighter)
      ctx.strokeStyle = `rgba(255, 255, 255, ${gridOpacity * 0.15})`
      ctx.beginPath()
      ctx.moveTo(0, cy)
      ctx.lineTo(width, cy)
      ctx.stroke()
    }

    if (!timeDomain) return

    // Store history for trailing effect
    const currentWave = new Uint8Array(timeDomain)
    state.history.push(currentWave)
    if (state.history.length > 4) state.history.shift()

    // Draw history lines (dimmer)
    for (let h = 0; h < state.history.length - 1; h++) {
      const wave = state.history[h]
      const alpha = (h + 1) / state.history.length * 0.2
      drawWave(ctx, wave, width, height, cy, zoom, sensitivity, {
        hue,
        alpha,
        lineWidth: lineWidth * 0.6,
        glow: 0,
      })
    }

    // Draw current waveform
    const bassBoost = clamp(bands.bass / 200, 0, 1)
    const lightness = 55 + bassBoost * 15

    drawWave(ctx, timeDomain, width, height, cy, zoom, sensitivity, {
      hue,
      alpha: 1,
      lineWidth,
      glow: glowAmount,
      lightness,
    })
  },
}

function drawWave(ctx, data, width, height, cy, zoom, sensitivity, style) {
  const len = data.length
  const step = len / width

  ctx.beginPath()
  ctx.lineWidth = style.lineWidth
  ctx.strokeStyle = `hsla(${style.hue}, 80%, ${style.lightness || 55}%, ${style.alpha})`

  if (style.glow > 0) {
    ctx.shadowBlur = 20 * style.glow
    ctx.shadowColor = `hsl(${style.hue}, 90%, 60%)`
  } else {
    ctx.shadowBlur = 0
  }

  for (let x = 0; x < width; x++) {
    const i = Math.floor(x * step)
    // data is 0-255 centered at 128
    const v = ((data[i] - 128) / 128) * sensitivity
    const y = cy + v * (height / 2) * zoom * 0.5

    if (x === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()
  ctx.shadowBlur = 0
}
