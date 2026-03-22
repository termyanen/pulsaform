import { clamp } from '../utils/audioUtils'

export const starfield = {
  id: 'starfield',
  name: 'Starfield',
  description: 'Stars flying through space, driven by the music',

  getDefaultParams() {
    return {
      starCount: { value: 1500, min: 300, max: 4000, step: 100, label: 'Stars' },
      baseSpeed: { value: 3, min: 0.5, max: 10, step: 0.5, label: 'Base Speed' },
      depth: { value: 1000, min: 300, max: 2000, step: 50, label: 'Depth' },
      trailLength: { value: 0.6, min: 0, max: 1, step: 0.05, label: 'Trail Length' },
      sensitivity: { value: 1.2, min: 0.2, max: 3, step: 0.1, label: 'Sensitivity' },
      spread: { value: 1, min: 0.3, max: 2, step: 0.1, label: 'Spread' },
    }
  },

  createState(width, height, params) {
    const stars = []
    const count = params.starCount.value
    const depth = params.depth.value
    const spread = params.spread.value
    for (let i = 0; i < count; i++) {
      stars.push(createStar(width, height, depth, spread))
    }
    return {
      stars,
      prevPositions: new Array(count).fill(null),
      hueShift: 0,
    }
  },

  draw(ctx, width, height, bands, params, state) {
    const baseSpeed = params.baseSpeed.value
    const depth = params.depth.value
    const trailLength = params.trailLength.value
    const sensitivity = params.sensitivity.value
    const spread = params.spread.value
    const starCount = params.starCount.value

    // Fade background
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + (1 - trailLength) * 0.3})`
    ctx.fillRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2
    const bass = bands.bass * sensitivity
    const treble = bands.treble * sensitivity
    const volume = bands.volume * sensitivity

    // Speed influenced by bass
    const speed = baseSpeed + clamp(bass / 30, 0, 20)

    // Hue shifts with music
    state.hueShift += volume * 0.5

    // Adjust star count if param changed
    while (state.stars.length < starCount) {
      state.stars.push(createStar(width, height, depth, spread))
      state.prevPositions.push(null)
    }
    while (state.stars.length > starCount) {
      state.stars.pop()
      state.prevPositions.pop()
    }

    for (let i = 0; i < state.stars.length; i++) {
      const star = state.stars[i]

      // Project to 2D
      const factor = depth / (depth + star.z)
      const sx = cx + star.x * factor
      const sy = cy + star.y * factor
      const prevFactor = depth / (depth + star.z + speed)
      const psx = cx + star.x * prevFactor
      const psy = cy + star.y * prevFactor

      // Size based on proximity
      const size = clamp((1 - star.z / depth) * 3, 0.5, 4)

      // Color: white to colored based on treble
      const hue = (star.hue + state.hueShift) % 360
      const saturation = clamp(treble * 1.5, 0, 100)
      const brightness = clamp(70 + volume * 40, 60, 100)
      const alpha = clamp((1 - star.z / depth) * 1.2, 0.1, 1)

      // Draw trail line
      if (trailLength > 0 && state.prevPositions[i]) {
        const prev = state.prevPositions[i]
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(sx, sy)
        ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${brightness}%, ${alpha * trailLength * 0.6})`
        ctx.lineWidth = size * 0.6
        ctx.stroke()
      }

      // Draw star
      ctx.beginPath()
      ctx.arc(sx, sy, size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${brightness}%, ${alpha})`
      ctx.fill()

      // Glow for bright stars
      if (size > 2 && bass > 150) {
        ctx.beginPath()
        ctx.arc(sx, sy, size * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${brightness}%, ${alpha * 0.1})`
        ctx.fill()
      }

      state.prevPositions[i] = { x: psx, y: psy }

      // Move star toward camera
      star.z -= speed

      // Reset star if it passes the camera
      if (star.z <= 0 || sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) {
        const newStar = createStar(width, height, depth, spread)
        state.stars[i] = newStar
        state.prevPositions[i] = null
      }
    }
  },
}

function createStar(width, height, depth, spread) {
  return {
    x: (Math.random() - 0.5) * width * spread * 2,
    y: (Math.random() - 0.5) * height * spread * 2,
    z: Math.random() * depth,
    hue: Math.random() * 360,
  }
}
