export function getEnergyRange(data, lowFreq, highFreq, sampleRate, binCount) {
  const nyquist = sampleRate / 2
  const lowBin = Math.round((lowFreq / nyquist) * binCount)
  const highBin = Math.round((highFreq / nyquist) * binCount)
  let sum = 0
  let count = 0
  for (let i = lowBin; i <= highBin && i < data.length; i++) {
    sum += data[i]
    count++
  }
  return count > 0 ? sum / count : 0
}

export function getEnergyBands(data, sampleRate, binCount) {
  const bass = getEnergyRange(data, 20, 140, sampleRate, binCount)
  const mid = getEnergyRange(data, 400, 2600, sampleRate, binCount)
  const treble = getEnergyRange(data, 5200, 14000, sampleRate, binCount)
  const volume = getEnergyRange(data, 20, 250, sampleRate, binCount) / 250
  return { bass, mid, treble, volume }
}

export function map(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

export function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ]
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max)
}
