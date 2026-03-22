export const spectrogram = {
  id: 'spectrogram',
  name: 'Spectrogram',
  description: 'Scrolling frequency waterfall — see harmonics, overtones and resonances',

  getDefaultParams() {
    return {
      scrollSpeed: { value: 2, min: 1, max: 6, step: 1, label: 'Scroll Speed' },
      brightness: { value: 1.2, min: 0.5, max: 3, step: 0.1, label: 'Brightness' },
      logScale: { value: 1, min: 0, max: 1, step: 1, label: 'Log Scale (0/1)' },
      colorMode: { value: 0, min: 0, max: 2, step: 1, label: 'Color (0=Heat 1=Cool 2=Mono)' },
      freqRange: { value: 0.7, min: 0.2, max: 1, step: 0.05, label: 'Freq Range' },
      smoothing: { value: 0.5, min: 0, max: 0.95, step: 0.05, label: 'Smoothing' },
    }
  },

  createState(width, height) {
    return {
      imageData: null,
      canvasWidth: width,
      canvasHeight: height,
    }
  },

  draw(ctx, width, height, bands, params, state, rawData) {
    const scrollSpeed = params.scrollSpeed.value
    const brightness = params.brightness.value
    const useLog = params.logScale.value > 0.5
    const colorMode = Math.round(params.colorMode.value)
    const freqRange = params.freqRange.value
    const smoothing = params.smoothing.value

    // Re-init if size changed
    if (state.canvasWidth !== width || state.canvasHeight !== height) {
      state.imageData = null
      state.canvasWidth = width
      state.canvasHeight = height
    }

    // Scroll existing content up
    if (state.imageData) {
      ctx.putImageData(state.imageData, 0, -scrollSpeed)
    }

    // Save current canvas for next scroll
    state.imageData = ctx.getImageData(0, 0, width, height)

    if (!rawData) {
      // Draw empty row
      ctx.fillStyle = '#000'
      ctx.fillRect(0, height - scrollSpeed, width, scrollSpeed)
      return
    }

    const dataLen = Math.floor(rawData.length * freqRange)

    // Draw new row at the bottom
    const rowData = ctx.createImageData(width, scrollSpeed)

    for (let x = 0; x < width; x++) {
      let dataIndex
      if (useLog) {
        // Logarithmic frequency scale
        const t = x / width
        const minLog = Math.log(1)
        const maxLog = Math.log(dataLen)
        dataIndex = Math.min(Math.floor(Math.exp(minLog + t * (maxLog - minLog))), dataLen - 1)
      } else {
        dataIndex = Math.floor((x / width) * dataLen)
      }

      let value = rawData[dataIndex] * brightness

      // Apply smoothing with neighbors
      if (smoothing > 0 && dataIndex > 0 && dataIndex < rawData.length - 1) {
        value = value * (1 - smoothing) + (rawData[dataIndex - 1] + rawData[dataIndex + 1]) * 0.5 * brightness * smoothing
      }

      const norm = Math.min(value / 255, 1)
      const [r, g, b] = getColor(norm, colorMode)

      for (let row = 0; row < scrollSpeed; row++) {
        const idx = (row * width + x) * 4
        rowData.data[idx] = r
        rowData.data[idx + 1] = g
        rowData.data[idx + 2] = b
        rowData.data[idx + 3] = 255
      }
    }

    ctx.putImageData(rowData, 0, height - scrollSpeed)

    // Frequency labels
    drawLabels(ctx, width, height, dataLen, useLog)
  },
}

function getColor(norm, mode) {
  if (mode === 0) {
    // Heat: black -> blue -> red -> yellow -> white
    if (norm < 0.2) return [0, 0, Math.floor(norm * 5 * 180)]
    if (norm < 0.5) return [Math.floor((norm - 0.2) / 0.3 * 255), 0, 180 - Math.floor((norm - 0.2) / 0.3 * 180)]
    if (norm < 0.8) return [255, Math.floor((norm - 0.5) / 0.3 * 255), 0]
    return [255, 255, Math.floor((norm - 0.8) / 0.2 * 255)]
  }
  if (mode === 1) {
    // Cool: black -> deep blue -> cyan -> white
    if (norm < 0.33) return [0, 0, Math.floor(norm * 3 * 200)]
    if (norm < 0.66) return [0, Math.floor((norm - 0.33) * 3 * 255), 200 + Math.floor((norm - 0.33) * 3 * 55)]
    return [Math.floor((norm - 0.66) * 3 * 255), 255, 255]
  }
  // Mono: black -> green
  const v = Math.floor(norm * 255)
  return [Math.floor(v * 0.2), v, Math.floor(v * 0.3)]
}

function drawLabels(ctx, width, height, dataLen, useLog) {
  // Subtle frequency markers on right edge
  ctx.font = '10px monospace'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.textAlign = 'right'

  // Assume 44100 sample rate, 2048 fft -> each bin ≈ 21.5Hz
  const binHz = 22050 / 1024
  const freqs = [100, 500, 1000, 2000, 5000, 10000]

  for (const freq of freqs) {
    const bin = freq / binHz
    if (bin >= dataLen) continue

    let x
    if (useLog) {
      const minLog = Math.log(1)
      const maxLog = Math.log(dataLen)
      x = ((Math.log(bin) - minLog) / (maxLog - minLog)) * width
    } else {
      x = (bin / dataLen) * width
    }

    if (x > 20 && x < width - 5) {
      // Vertical tick at bottom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.fillRect(x, height - 14, 1, 14)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`
      ctx.fillText(label, x - 2, height - 16)
    }
  }
}
