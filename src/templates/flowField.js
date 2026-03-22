import { createNoise } from '../utils/noise'
import { lerpColor, map, clamp } from '../utils/audioUtils'

// Extended gradient: deep blue → cyan → teal → green → lime → yellow → orange → red → magenta → violet → deep blue
const COLORS = [
  [10, 20, 80],     // deep navy
  [20, 60, 180],    // royal blue
  [30, 120, 255],   // bright blue
  [0, 200, 255],    // cyan
  [0, 230, 200],    // teal
  [0, 255, 120],    // mint green
  [80, 255, 50],    // lime
  [180, 255, 0],    // yellow-green
  [255, 230, 0],    // yellow
  [255, 170, 0],    // orange
  [255, 80, 20],    // red-orange
  [255, 20, 60],    // red
  [255, 0, 150],    // hot pink
  [200, 30, 255],   // magenta
  [130, 50, 255],   // violet
  [60, 30, 200],    // deep purple
]

// Bass colors (warm), mid colors (green/yellow), treble colors (cool)
const BASS_COLORS = [[255, 20, 60], [255, 80, 20], [255, 170, 0], [255, 0, 150], [200, 30, 255]]
const MID_COLORS = [[0, 255, 120], [80, 255, 50], [180, 255, 0], [255, 230, 0], [0, 230, 200]]
const TREBLE_COLORS = [[30, 120, 255], [0, 200, 255], [130, 50, 255], [0, 230, 200], [60, 30, 200]]

function pickFromPalette(palette, t) {
  const pos = clamp(t, 0, 0.999) * (palette.length - 1)
  const idx = Math.floor(pos)
  return lerpColor(palette[idx], palette[Math.min(idx + 1, palette.length - 1)], pos - idx)
}

export const flowField = {
  id: 'flowField',
  name: 'Flow Field',
  description: 'Particles flowing through noise fields, shaped by the music',

  getDefaultParams() {
    return {
      particleCount: { value: 4800, min: 500, max: 8000, step: 100, label: 'Particles' },
      speed: { value: 1.5, min: 0.5, max: 5, step: 0.1, label: 'Speed' },
      noiseScale: { value: 0.003, min: 0.001, max: 0.02, step: 0.001, label: 'Noise Scale' },
      trailLength: { value: 0.12, min: 0.01, max: 0.2, step: 0.01, label: 'Trail Length' },
      sensitivity: { value: 1.5, min: 0.2, max: 4, step: 0.1, label: 'Sensitivity' },
      particleSize: { value: 3, min: 1, max: 8, step: 0.5, label: 'Particle Size' },
      beatCooldown: { value: 300, min: 200, max: 2000, step: 50, label: 'Beat Cooldown (ms)' },
      noiseEvolution: { value: 3, min: 0.1, max: 5, step: 0.1, label: 'Noise Evolution' },
      turbulence: { value: 0.8, min: 0, max: 1, step: 0.05, label: 'Turbulence' },
      burstForce: { value: 1.2, min: 0, max: 1.5, step: 0.05, label: 'Beat Burst' },
      freqSteer: { value: 0.85, min: 0, max: 1, step: 0.05, label: 'Freq Steering' },
      gravity: { value: 0.6, min: 0, max: 1, step: 0.05, label: 'Bass Gravity' },
      colorMode: { value: 1, min: 0, max: 1, step: 1, label: 'Color (0=Uni 1=Multi)' },
      bassKick: { value: 1, min: 0, max: 8, step: 0.1, label: 'Bass Kick Speed' },
      diffusion: { value: 1.5, min: 0, max: 15, step: 0.1, label: 'Diffusion' },
      smoothing: { value: 0.12, min: 0.01, max: 0.5, step: 0.01, label: 'Band Smoothing' },
      colorSpeed: { value: 0.08, min: 0.01, max: 0.3, step: 0.01, label: 'Color Speed' },
      burstDecay: { value: 0.92, min: 0.8, max: 0.99, step: 0.01, label: 'Burst Decay' },
      inertia: { value: 0.1, min: 0.05, max: 0.8, step: 0.05, label: 'Inertia' },
      centerPull: { value: 0.5, min: 0, max: 2, step: 0.1, label: 'Center Pull' },
    }
  },

  createState(width, height, params) {
    const particles = []
    const count = params.particleCount.value
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
      })
    }
    return {
      particles,
      noise: createNoise(),
      frameCount: 0,
      lastNoiseSeedTime: 0,
      currentColor: [30, 120, 255],
      targetColor: [30, 120, 255],
      // Per-band colors for multi mode
      bassColor: [255, 80, 20],
      midColor: [0, 255, 120],
      trebleColor: [30, 120, 255],
      targetBassColor: [255, 80, 20],
      targetMidColor: [0, 255, 120],
      targetTrebleColor: [30, 120, 255],
      // Smoothed energy bands
      sBass: 0,
      sMid: 0,
      sTreble: 0,
      sVolume: 0,
      // Beat burst state
      burstActive: 0,
      burstX: 0,
      burstY: 0,
      // Flow angle offset
      flowAngle: 0,
      // Onset detection — raw (unsmoothed) for punch detection
      prevRawBass: 0,
      rawBassFast: 0, // fast-decay tracker to catch each individual hit
    }
  },

  draw(ctx, width, height, bands, params, state) {
    state.frameCount++
    const noiseScale = params.noiseScale.value
    const baseSpeed = params.speed.value
    const trailAlpha = params.trailLength.value
    const sensitivity = params.sensitivity.value
    const particleSize = params.particleSize.value
    const beatCooldown = params.beatCooldown.value
    const noiseEvolution = params.noiseEvolution.value
    const turbulenceAmount = params.turbulence.value
    const burstForce = params.burstForce.value
    const freqSteer = params.freqSteer.value
    const gravityAmount = params.gravity.value
    const multiColor = params.colorMode.value > 0.5
    const bassKick = params.bassKick.value
    const diffusion = params.diffusion.value
    const smoothing = params.smoothing.value
    const colorSpeed = params.colorSpeed.value
    const burstDecay = params.burstDecay.value
    const inertia = params.inertia.value
    const centerPull = params.centerPull.value

    // Trail effect — fade slower in silence so particles stay visible
    const effectiveTrail = state.sVolume < 0.2
      ? trailAlpha * 0.3
      : trailAlpha
    ctx.fillStyle = `rgba(0, 0, 0, ${effectiveTrail})`
    ctx.fillRect(0, 0, width, height)

    const { bass, mid, treble, volume } = bands

    // Smooth the bands
    state.sBass += (bass * sensitivity - state.sBass) * smoothing
    state.sMid += (mid * sensitivity - state.sMid) * smoothing
    state.sTreble += (treble * sensitivity - state.sTreble) * smoothing
    state.sVolume += (volume * sensitivity - state.sVolume) * smoothing

    const adjBass = state.sBass
    const adjMid = state.sMid
    const adjTreble = state.sTreble
    const adjVolume = state.sVolume
    const currentTime = performance.now()

    // --- Normalized frequency bands ---
    const bassNorm = clamp(adjBass / 255, 0, 1)
    const midNorm = clamp(adjMid / 255, 0, 1)
    const trebleNorm = clamp(adjTreble / 255, 0, 1)

    // --- Beat / onset detection using RAW (unsmoothed) values ---
    // Raw bass for punch detection — each kick is a spike even if sustained
    const rawBass = bass * sensitivity
    // Fast-decay tracker: rises instantly, decays fast — so each new hit is a fresh onset
    state.rawBassFast = Math.max(rawBass, state.rawBassFast * 0.7)
    const bassOnset = rawBass - state.prevRawBass
    const bassHit = rawBass > 120 && rawBass > state.rawBassFast * 0.85
    state.prevRawBass = rawBass

    const isBeat =
      currentTime - state.lastNoiseSeedTime >= beatCooldown &&
      (adjMid > 100 || adjBass > 200 || adjTreble > 50)

    if (isBeat) {
      state.noise.reseed(currentTime)

      // Unified color: driven by frequency balance
      const total = bassNorm + midNorm + trebleNorm + 0.001
      const bassWeight = bassNorm / total
      const trebleWeight = trebleNorm / total
      const colorPos = clamp(
        bassWeight * 0.75 + (1 - trebleWeight) * 0.25 + midNorm * 0.1 * Math.sin(currentTime * 0.001),
        0, 0.999
      )
      const colorIndex = Math.floor(colorPos * (COLORS.length - 1))
      const c1 = COLORS[colorIndex]
      const c2 = COLORS[Math.min(colorIndex + 1, COLORS.length - 1)]
      const t = (colorPos * (COLORS.length - 1)) % 1
      state.targetColor = lerpColor(c1, c2, t)

      // Per-band colors for multi mode: pick from sub-palettes based on energy
      state.targetBassColor = pickFromPalette(BASS_COLORS, bassNorm)
      state.targetMidColor = pickFromPalette(MID_COLORS, midNorm)
      state.targetTrebleColor = pickFromPalette(TREBLE_COLORS, trebleNorm)

      state.lastNoiseSeedTime = currentTime

      // Trigger burst on any strong bass hit
      if (burstForce > 0 && (bassOnset > 30 || bassHit)) {
        state.burstActive = 1
        state.burstX = width * (0.25 + Math.random() * 0.5)
        state.burstY = height * (0.25 + Math.random() * 0.5)
      }
    }

    // Decay burst
    state.burstActive *= burstDecay

    // Smooth all colors every frame
    const colorLerp = colorSpeed
    state.currentColor = lerpColor(state.currentColor, state.targetColor, colorLerp)
    state.bassColor = lerpColor(state.bassColor, state.targetBassColor, colorLerp)
    state.midColor = lerpColor(state.midColor, state.targetMidColor, colorLerp)
    state.trebleColor = lerpColor(state.trebleColor, state.targetTrebleColor, colorLerp)

    // --- Frequency-based flow steering ---
    // Detect kick strength from both onset delta AND absolute hit
    const onsetKick = clamp(Math.max(bassOnset / 50, bassHit ? rawBass / 150 : 0), 0, 1)
    const targetAngle = (bassNorm - trebleNorm) * Math.PI * 0.6
      + midNorm * Math.sin(state.frameCount * 0.02) * Math.PI * 0.4
      + onsetKick * Math.PI * 0.8 * (Math.random() > 0.5 ? 1 : -1)
    // Faster lerp when onset detected — snap vs drift
    const steerSpeed = onsetKick > 0.3 ? 0.25 : 0.05
    state.flowAngle += (targetAngle - state.flowAngle) * steerSpeed

    const turbulence = turbulenceAmount * clamp(adjVolume * 1.5, 0.1, 1)

    const amp = adjVolume * 250
    // Speed reacts to both volume and bass onset, minimum idle drift
    const idleSpeed = baseSpeed * 0.25
    let speed = adjVolume > 0.5
      ? Math.max(baseSpeed, map(clamp(amp, 20, 250), 20, 250, 0.5, 5))
      : Math.max(idleSpeed, baseSpeed * adjVolume)
    // Burst of speed on bass onset
    speed += onsetKick * baseSpeed * bassKick

    const cx = width / 2
    const cy = height / 2

    // --- Multi-color: compute band proportions for particle assignment ---
    const totalEnergy = bassNorm + midNorm + trebleNorm + 0.001
    const bassFraction = bassNorm / totalEnergy
    const midFraction = midNorm / totalEnergy
    // trebleFraction = 1 - bassFraction - midFraction (the rest)

    const particleCount = state.particles.length
    const bassEnd = Math.floor(bassFraction * particleCount)
    const midEnd = bassEnd + Math.floor(midFraction * particleCount)

    // Pre-build color strings for multi mode
    let bassFill, midFill, trebleFill, uniFill
    if (multiColor) {
      const [br, bg, bb] = state.bassColor
      const [mr, mg, mb] = state.midColor
      const [tr, tg, tb] = state.trebleColor
      bassFill = `rgb(${br},${bg},${bb})`
      midFill = `rgb(${mr},${mg},${mb})`
      trebleFill = `rgb(${tr},${tg},${tb})`
    } else {
      const [r, g, b] = state.currentColor
      uniFill = `rgb(${r},${g},${b})`
      ctx.fillStyle = uniFill
    }

    for (let i = 0; i < particleCount; i++) {
      const p = state.particles[i]

      // Set color per particle in multi mode
      if (multiColor) {
        if (i < bassEnd) {
          ctx.fillStyle = bassFill
        } else if (i < midEnd) {
          ctx.fillStyle = midFill
        } else {
          ctx.fillStyle = trebleFill
        }
      }

      // Base noise direction
      const n = state.noise.noise(
        p.x * noiseScale,
        p.y * noiseScale,
        state.frameCount * noiseScale * noiseScale * noiseEvolution
      )
      let angle = Math.PI * 2 * n

      // Frequency steering
      angle += state.flowAngle * freqSteer

      // Turbulence
      if (turbulence > 0) {
        angle += (Math.random() - 0.5) * turbulence * 1.5
      }

      // Velocity from angle
      let vx = Math.cos(angle) * speed
      let vy = Math.sin(angle) * speed

      // Bass gravity
      if (gravityAmount > 0) {
        vy += bassNorm * gravityAmount * 3
      }

      // Beat burst
      if (state.burstActive > 0.05 && burstForce > 0) {
        const dx = p.x - state.burstX
        const dy = p.y - state.burstY
        const dist = Math.sqrt(dx * dx + dy * dy) + 1
        const force = (state.burstActive * burstForce * 800) / (dist + 50)
        vx += (dx / dist) * force
        vy += (dy / dist) * force
      }

      // Quiet moments: gentle pull toward center
      if (centerPull > 0 && adjVolume < 0.5) {
        const dx = cx - p.x
        const dy = cy - p.y
        const pullStrength = (0.5 - adjVolume) * centerPull * 0.02
        vx += dx * pullStrength
        vy += dy * pullStrength
      }

      // Diffusion — random displacement to break up stream lines
      if (diffusion > 0) {
        vx += (Math.random() - 0.5) * diffusion * 2
        vy += (Math.random() - 0.5) * diffusion * 2
      }

      // Apply velocity with inertia
      p.vx += (vx - p.vx) * inertia
      p.vy += (vy - p.vy) * inertia
      p.x += p.vx
      p.y += p.vy

      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        p.x = Math.random() * width
        p.y = Math.random() * height
        p.vx = 0
        p.vy = 0
      }

      ctx.fillRect(p.x, p.y, particleSize, particleSize)
    }
  },
}
