import { clamp } from '../utils/audioUtils'

const MAX_ROWS = 80

export const terrain = {
  id: 'terrain',
  name: 'Terrain',
  description: 'Frequency data as a 3D landscape — mountains born from your music',

  getDefaultParams() {
    return {
      rows: { value: 50, min: 20, max: 80, step: 5, label: 'Depth Rows' },
      lineWidth: { value: 1.5, min: 0.5, max: 4, step: 0.5, label: 'Line Width' },
      heightScale: { value: 1.2, min: 0.3, max: 3, step: 0.1, label: 'Height Scale' },
      perspective: { value: 0.6, min: 0.2, max: 1, step: 0.05, label: 'Perspective' },
      sensitivity: { value: 1.5, min: 0.3, max: 3, step: 0.1, label: 'Sensitivity' },
      colorShift: { value: 200, min: 0, max: 360, step: 10, label: 'Hue' },
      fillOpacity: { value: 0.15, min: 0, max: 0.5, step: 0.05, label: 'Fill Opacity' },
    }
  },

  createState() {
    return {
      rowBuffer: [],
    }
  },

  draw(ctx, width, height, bands, params, state, rawData) {
    const rowCount = params.rows.value
    const lineWidth = params.lineWidth.value
    const heightScale = params.heightScale.value
    const perspective = params.perspective.value
    const sensitivity = params.sensitivity.value
    const hue = params.colorShift.value
    const fillOpacity = params.fillOpacity.value

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    // Push new frequency row
    if (rawData) {
      // Downsample to reasonable resolution
      const cols = Math.min(rawData.length, Math.floor(width / 3))
      const row = new Float32Array(cols)
      const dataLen = Math.floor(rawData.length * 0.65)
      const minLog = Math.log(1)
      const maxLog = Math.log(dataLen)

      for (let i = 0; i < cols; i++) {
        const t = i / cols
        const dataIndex = Math.min(
          Math.floor(Math.exp(minLog + t * (maxLog - minLog))),
          dataLen - 1
        )
        row[i] = rawData[dataIndex] * sensitivity
      }
      state.rowBuffer.push(row)
    }

    while (state.rowBuffer.length > MAX_ROWS) {
      state.rowBuffer.shift()
    }

    // Draw terrain from back to front
    const buffer = state.rowBuffer
    const displayRows = Math.min(buffer.length, rowCount)
    const baseY = height * 0.85
    const rowSpacing = (height * 0.6) / rowCount

    for (let r = 0; r < displayRows; r++) {
      const rowIdx = buffer.length - displayRows + r
      const row = buffer[rowIdx]
      if (!row) continue

      const depth = 1 - r / displayRows // 1 = far, 0 = near
      const yOffset = baseY - r * rowSpacing * perspective
      const xShrink = 0.5 + (1 - depth) * 0.5 // perspective X narrowing for far rows
      const xMargin = (width * (1 - xShrink)) / 2

      const rowAlpha = clamp(0.2 + (1 - depth) * 0.8, 0, 1)
      const rowLightness = 35 + (1 - depth) * 30

      ctx.beginPath()
      const cols = row.length

      // Start from bottom-left
      const startX = xMargin
      ctx.moveTo(startX, yOffset)

      for (let c = 0; c < cols; c++) {
        const x = xMargin + (c / cols) * width * xShrink
        const h = (row[c] / 255) * heightScale * rowSpacing * 5 * (0.3 + (1 - depth) * 0.7)
        const y = yOffset - h
        ctx.lineTo(x, y)
      }

      // Close path along the bottom
      ctx.lineTo(xMargin + width * xShrink, yOffset)

      // Fill (dark, for occlusion)
      if (fillOpacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.7 + fillOpacity})`
        ctx.fill()
      } else {
        // Even without fill, need occlusion
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.fill()
      }

      // Stroke the line
      const rowHue = (hue + depth * 40) % 360
      ctx.strokeStyle = `hsla(${rowHue}, 70%, ${rowLightness}%, ${rowAlpha})`
      ctx.lineWidth = lineWidth * (0.5 + (1 - depth) * 0.5)
      ctx.stroke()

      // Top glow for near rows with high energy
      if (fillOpacity > 0 && depth < 0.5) {
        ctx.beginPath()
        for (let c = 0; c < cols; c++) {
          const x = xMargin + (c / cols) * width * xShrink
          const h = (row[c] / 255) * heightScale * rowSpacing * 5 * (0.3 + (1 - depth) * 0.7)
          const y = yOffset - h
          if (c === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `hsla(${rowHue}, 80%, 60%, ${fillOpacity * rowAlpha * 0.5})`
        ctx.lineWidth = lineWidth * 3
        ctx.shadowBlur = 10
        ctx.shadowColor = `hsl(${rowHue}, 80%, 50%)`
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }
  },
}
