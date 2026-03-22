export function createNoise() {
  const permutation = new Uint8Array(512)
  let seed = 0

  function reseed(s) {
    seed = s
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      seed = (seed * 16807 + 0) % 2147483647
      const j = seed % (i + 1)
      ;[p[i], p[j]] = [p[j], p[i]]
    }
    for (let i = 0; i < 512; i++) permutation[i] = p[i & 255]
  }

  reseed(Date.now())

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
  function lerp(a, b, t) { return a + t * (b - a) }
  function grad(hash, x, y, z) {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }

  function noise3d(x, y, z) {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const Z = Math.floor(z) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    z -= Math.floor(z)
    const u = fade(x), v = fade(y), w = fade(z)
    const A = permutation[X] + Y, AA = permutation[A] + Z, AB = permutation[A + 1] + Z
    const B = permutation[X + 1] + Y, BA = permutation[B] + Z, BB = permutation[B + 1] + Z
    return lerp(
      lerp(
        lerp(grad(permutation[AA], x, y, z), grad(permutation[BA], x - 1, y, z), u),
        lerp(grad(permutation[AB], x, y - 1, z), grad(permutation[BB], x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(grad(permutation[AA + 1], x, y, z - 1), grad(permutation[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(permutation[AB + 1], x, y - 1, z - 1), grad(permutation[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    )
  }

  function noise(x, y, z = 0) {
    return (noise3d(x, y, z) + 1) / 2
  }

  return { noise, reseed }
}
