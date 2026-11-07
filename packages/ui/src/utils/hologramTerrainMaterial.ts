export interface HologramTerrainMaterial {
  texture: WebGLTexture
  worldSize: number
  dispose: () => void
}

const SIZE = 512
let materialPixels: Uint8Array | null = null

function clamp(value: number): number { return Math.max(0, Math.min(1, value)) }
function smooth(value: number): number { return value * value * (3 - 2 * value) }
function noiseGrid(size: number, seed: number): { size: number; values: Float32Array } {
  const values = new Float32Array(size * size)
  let state = seed
  for (let index = 0; index < values.length; index++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    values[index] = (state >>> 0) / 4_294_967_295
  }
  return { size, values }
}
function sample(grid: ReturnType<typeof noiseGrid>, u: number, v: number): number {
  const x = (u - Math.floor(u)) * grid.size, z = (v - Math.floor(v)) * grid.size
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz)
  const nextX = (ix + 1) % grid.size, nextZ = (iz + 1) % grid.size
  const a = grid.values[iz * grid.size + ix]!, b = grid.values[iz * grid.size + nextX]!
  const c = grid.values[nextZ * grid.size + ix]!, d = grid.values[nextZ * grid.size + nextX]!
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz
}

/** Palette-neutral material data, generated once and reused after context loss. */
function pixels(): Uint8Array {
  if (materialPixels) return materialPixels
  const broad = noiseGrid(4, 0x4e415659), medium = noiseGrid(11, 0x434f414c)
  const detail = noiseGrid(29, 0x53544f4e), fine = noiseGrid(67, 0x47524149), dust = noiseGrid(139, 0x524f434b)
  const heights = new Float32Array(SIZE * SIZE), field = new Float32Array(SIZE * SIZE), grain = new Float32Array(SIZE * SIZE)
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = z / SIZE
    const warpX = (sample(broad, u + 0.17, v + 0.63) - 0.5) * 0.075
    const warpZ = (sample(broad, u + 0.71, v + 0.23) - 0.5) * 0.075
    const wu = u + warpX, wv = v + warpZ
    const height = sample(broad, wu, wv) * 0.48 + sample(medium, wu, wv) * 0.29 + sample(detail, wu, wv) * 0.15 + sample(fine, wu, wv) * 0.08
    const layer = height * 7, fraction = layer - Math.floor(layer)
    const terrace = (Math.floor(layer) + smooth(clamp((fraction - 0.18) / 0.64))) / 7
    const index = z * SIZE + x
    field[index] = height
    heights[index] = height * 0.70 + terrace * 0.30
    grain[index] = sample(fine, u, v) * 0.45 + sample(dust, u, v) * 0.55
  }
  const result = new Uint8Array(SIZE * SIZE * 4)
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    const index = z * SIZE + x, offset = index * 4
    const dx = heights[z * SIZE + (x + 1) % SIZE]! - heights[z * SIZE + (x + SIZE - 1) % SIZE]!
    const dz = heights[((z + 1) % SIZE) * SIZE + x]! - heights[((z + SIZE - 1) % SIZE) * SIZE + x]!
    // R/G encode shallow normal slopes, B broad organic stone/terrace field,
    // A fine rough grain. Colour remains the supplied canonical palette.
    result[offset] = Math.round(clamp(0.5 - dx * 8) * 255)
    result[offset + 1] = Math.round(clamp(0.5 - dz * 8) * 255)
    result[offset + 2] = Math.round(clamp(field[index]!) * 255)
    result[offset + 3] = Math.round(clamp(grain[index]!) * 255)
  }
  materialPixels = result
  return result
}

/** One 512² data texture (~1.33 MiB with mipmaps), without external assets. */
export function createHologramTerrainMaterial(gl: WebGLRenderingContext): HologramTerrainMaterial {
  const texture = gl.createTexture()
  if (!texture) throw new Error('HQ terrain material unavailable')
  try {
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.activeTexture(gl.TEXTURE0)
    return { texture, worldSize: 32, dispose: () => gl.deleteTexture(texture) }
  }
  catch (error) {
    gl.deleteTexture(texture)
    gl.activeTexture(gl.TEXTURE0)
    throw error
  }
}
