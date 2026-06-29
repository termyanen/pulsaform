import { clamp } from '../utils/audioUtils'

export const constellation = {
  id: 'constellation',
  name: 'Constellation',
  description: 'Stars scatter on every beat and drift back to orbit',

  getDefaultParams() {
    return {
      particleCount: { value: 120,  min: 30,   max: 280,  step: 10,   label: 'Stars' },
      maxDist:       { value: 140,  min: 40,   max: 350,  step: 5,    label: 'Connection Range' },
      orbitSpeed:    { value: 1.0,  min: 0.1,  max: 4,    step: 0.1,  label: 'Orbit Speed' },
      sensitivity:   { value: 1.5,  min: 0.5,  max: 4,    step: 0.1,  label: 'Sensitivity' },
      particleSize:  { value: 2.2,  min: 0.5,  max: 6,    step: 0.5,  label: 'Star Size' },
      lineAlpha:     { value: 0.25, min: 0.02, max: 0.7,  step: 0.02, label: 'Line Alpha' },
      colorHue:      { value: 210,  min: 0,    max: 360,  step: 5,    label: 'Base Hue' },
      kickStrength:  { value: 12,   min: 1,    max: 40,   step: 1,    label: 'Beat Kick' },
      scatter:       { value: 0.5,  min: 0,    max: 1,    step: 0.05, label: 'Scatter (0=radial 1=random)' },
      returnSpeed:   { value: 0.04, min: 0.01, max: 0.15, step: 0.01, label: 'Return Speed' },
      glowSize:      { value: 10,   min: 0,    max: 30,   step: 1,    label: 'Glow' },
    }
  },

  createState(width, height, params) {
    const N    = params.particleCount.value
    const maxR = Math.min(width, height) * 0.44

    const particles = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2
      const baseR = (0.06 + Math.random() * 0.94) * maxR
      const speed = (0.0012 + Math.random() * 0.002) * (Math.random() > 0.5 ? 1 : -1)
      const ox    = width  / 2 + Math.cos(angle) * baseR
      const oy    = height / 2 + Math.sin(angle) * baseR
      return {
        angle,
        baseR,
        vAngle: speed,
        x:      ox,
        y:      oy,
        vx:     0,
        vy:     0,
        size:   1.0 + Math.random() * 0.6,
        phase:  Math.random() * Math.PI * 2,
      }
    })

    return {
      particles,
      frameCount: 0,
      lastBeatTime: 0,
      sBass: 0,
      sMid: 0,
      maxR,
    }
  },

  draw(ctx, width, height, bands, params, state) {
    const { bass, mid } = bands
    const sensitivity = params.sensitivity.value

    state.sBass += (bass * sensitivity - state.sBass) * 0.15
    state.sMid  += (mid  * sensitivity - state.sMid)  * 0.03

    const bassNorm = clamp(state.sBass / 255, 0, 1)
    const midNorm  = clamp(state.sMid  / 255, 0, 1)

    // Beat: kick each star in a random direction
    const now = performance.now()
    if (state.sBass > 110 && now - state.lastBeatTime > 220) {
      const kick    = params.kickStrength.value
      const scatter = params.scatter.value
      const cx_ = width / 2, cy_ = height / 2
      for (const p of state.particles) {
        // 0 = radial outward, 1 = random
        const radial = Math.atan2(p.y - cy_, p.x - cx_)
        const random = Math.random() * Math.PI * 2
        const a = radial + (random - radial) * scatter
        p.vx += Math.cos(a) * kick
        p.vy += Math.sin(a) * kick
      }
      state.lastBeatTime = now
    }

    ctx.clearRect(0, 0, width, height)

    const hue       = (params.colorHue.value + midNorm * 50 + state.frameCount * 0.03) % 360
    const orbitStep = params.orbitSpeed.value
    const returnK   = params.returnSpeed.value
    const particles = state.particles
    const N         = particles.length
    const cx        = width  / 2
    const cy        = height / 2

    // Rescale when canvas size changes
    const newMaxR = Math.min(width, height) * 0.44
    if (Math.abs(state.maxR - newMaxR) > 1) {
      const scale = newMaxR / state.maxR
      for (const p of particles) p.baseR *= scale
      state.maxR = newMaxR
    }

    // Update positions
    for (const p of particles) {
      // Advance orbit angle
      p.angle += p.vAngle * orbitStep

      // Orbit target position
      const tx = cx + Math.cos(p.angle) * p.baseR
      const ty = cy + Math.sin(p.angle) * p.baseR

      // Spring toward orbit target
      p.vx += (tx - p.x) * returnK
      p.vy += (ty - p.y) * returnK

      // Drag
      p.vx *= 0.88
      p.vy *= 0.88

      p.x += p.vx
      p.y += p.vy
    }

    // Draw connections — single batched path
    const maxDistSq = params.maxDist.value * params.maxDist.value
    ctx.strokeStyle = `hsla(${hue}, 75%, 65%, ${params.lineAlpha.value})`
    ctx.lineWidth   = 0.8 + bassNorm * 1.5
    ctx.beginPath()
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        if (dx * dx + dy * dy >= maxDistSq) continue
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
      }
    }
    ctx.stroke()

    // Draw stars
    ctx.shadowBlur  = params.glowSize.value
    ctx.shadowColor = `hsl(${hue}, 80%, 70%)`

    const baseSize = params.particleSize.value
    const fc       = state.frameCount

    for (let i = 0; i < N; i++) {
      const p     = particles[i]
      const pulse = Math.sin(fc * 0.022 + p.phase) * 0.25 + 0.75
      const size  = Math.max(baseSize * p.size * pulse, 0.5)
      const pHue  = (hue + (i % 50) * 0.8) % 360
      ctx.fillStyle = `hsla(${pHue}, 85%, 80%, ${0.5 + pulse * 0.5})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.shadowBlur = 0
    state.frameCount++
  },
}
