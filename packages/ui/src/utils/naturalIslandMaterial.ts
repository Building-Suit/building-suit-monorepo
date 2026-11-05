export interface NaturalIslandMaterial {
  texture: WebGLTexture
  worldSize: number
  dispose: () => void
}

const SIZE = 1024
const WORLD_SIZE = 64
let materialPixels: Uint8Array | null = null

interface NoiseGrid {
  size: number
  values: Float32Array
}

function clamp(value: number): number { return Math.max(0, Math.min(1, value)) }
function smooth(value: number): number { return value * value * value * (value * (value * 6 - 15) + 10) }
function transition(low: number, high: number, value: number): number { return smooth(clamp((value - low) / (high - low))) }

function noiseGrid(size: number, seed: number): NoiseGrid {
  const values = new Float32Array(size * size)
  let state = seed
  for (let index = 0; index < values.length; index++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    values[index] = (state >>> 0) / 4_294_967_295
  }
  return { size, values }
}

/** Integer-period grids and periodic domain warps keep both values and slopes tileable. */
function sample(grid: NoiseGrid, u: number, v: number): number {
  const x = (u - Math.floor(u)) * grid.size, z = (v - Math.floor(v)) * grid.size
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz)
  const nextX = (ix + 1) % grid.size, nextZ = (iz + 1) % grid.size
  const a = grid.values[iz * grid.size + ix]!, b = grid.values[iz * grid.size + nextX]!
  const c = grid.values[nextZ * grid.size + ix]!, d = grid.values[nextZ * grid.size + nextX]!
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz
}

/**
 * Cached, palette-neutral data for the island landmass only:
 * R/G: shallow X/Z normal slopes, with 0.5 neutral;
 * B: low-contrast granular stone value with very fine pores;
 * A: bounded soil/moisture field for sparse, softly blended ground cover.
 * The shader owns colour and roughness. No contour terraces or directional striping
 * are baked in, and the fields never displace office or road support geometry.
 */
function pixels(): Uint8Array {
  if (materialPixels) return materialPixels
  const macro = noiseGrid(3, 0x42415341), warp = noiseGrid(7, 0x4c544943)
  const soil = noiseGrid(13, 0x534f494c), rock = noiseGrid(31, 0x4c415641)
  const broken = noiseGrid(59, 0x4641554c), gravel = noiseGrid(127, 0x47524156)
  const grit = noiseGrid(263, 0x47524954), pore = noiseGrid(509, 0x504f5245)
  const heights = new Float32Array(SIZE * SIZE)
  const result = new Uint8Array(SIZE * SIZE * 4)

  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = z / SIZE
    const warpX = (sample(warp, u + 0.17, v + 0.63) - 0.5) * 0.16
      + (sample(soil, u + 0.37, v + 0.11) - 0.5) * 0.025
    const warpZ = (sample(warp, u + 0.71, v + 0.23) - 0.5) * 0.16
      + (sample(soil, u + 0.13, v + 0.79) - 0.5) * 0.025
    const wu = u + warpX, wv = v + warpZ
    const broad = sample(macro, wu, wv), earth = sample(soil, wu, wv)
    const mineral = sample(rock, wu, wv), debris = sample(gravel, wu, wv)
    const grain = sample(grit, wu, wv), pockmarks = sample(pore, wu, wv)
    // Quiet granular stone, without thresholded contour-like fracture ribbons.
    const cavities = transition(0.72, 0.94, pockmarks) * sample(broken, wu + 0.61, wv + 0.07)
    const index = z * SIZE + x, offset = index * 4
    heights[index] = earth * 0.035 + mineral * 0.035 + debris * 0.012
      + (grain - 0.5) * 0.003 + (pockmarks - 0.5) * 0.002 - cavities * 0.003
    result[offset + 2] = Math.round(clamp(0.50 + (broad - 0.5) * 0.07 + (earth - 0.5) * 0.08
      + (mineral - 0.5) * 0.10 + (debris - 0.5) * 0.04 + (grain - 0.5) * 0.02 - cavities * 0.025) * 255)
    const moisture = broad * 0.25 + earth * 0.35
      + sample(macro, wu + 0.41, wv + 0.67) * 0.20 + mineral * 0.20
    result[offset + 3] = Math.round(clamp(0.35 + moisture * 0.42 + (grain - 0.5) * 0.01) * 255)
  }

  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    const offset = (z * SIZE + x) * 4
    const dx = heights[z * SIZE + (x + 1) % SIZE]! - heights[z * SIZE + (x + SIZE - 1) % SIZE]!
    const dz = heights[((z + 1) % SIZE) * SIZE + x]! - heights[((z + SIZE - 1) % SIZE) * SIZE + x]!
    result[offset] = Math.round(clamp(0.5 - dx * 1.8) * 255)
    result[offset + 1] = Math.round(clamp(0.5 - dz * 1.8) * 255)
  }
  materialPixels = result
  return result
}

/** One 1024² data texture (~5.33 MiB with mipmaps), reused on context restoration. */
export function createNaturalIslandMaterial(gl: WebGLRenderingContext): NaturalIslandMaterial {
  const texture = gl.createTexture()
  if (!texture) throw new Error('HQ natural island material unavailable')
  try {
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.activeTexture(gl.TEXTURE0)
    return { texture, worldSize: WORLD_SIZE, dispose: () => gl.deleteTexture(texture) }
  }
  catch (error) {
    gl.deleteTexture(texture)
    gl.activeTexture(gl.TEXTURE0)
    throw error
  }
}
