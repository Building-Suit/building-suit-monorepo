import type { HqIslandFootprint } from './hqIslandGeometry.ts'
import { hqIslandRadiusAt } from './hqIslandGeometry.ts'

type Vector = [number, number, number]
export interface NaturalIslandGeometry { positions: number[]; normals: number[] }
export interface NaturalIslandMeshes {
  top: NaturalIslandGeometry
  cliffs: NaturalIslandGeometry
  topGold: NaturalIslandGeometry
  middleGold: NaturalIslandGeometry
  rocks: NaturalIslandGeometry
  grass: NaturalIslandGeometry
}

const FULL_TURN = Math.PI * 2
const COAST_SAMPLES = 320

function empty(): NaturalIslandGeometry { return { positions: [], normals: [] } }
function clamp(value: number, low: number, high: number): number { return Math.max(low, Math.min(high, value)) }
function mix(a: number, b: number, amount: number): number { return a + (b - a) * amount }
function smooth(value: number): number { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t) }
function normalize(value: Vector): Vector {
  const length = Math.hypot(...value) || 1
  return [value[0] / length, value[1] / length, value[2] / length]
}
function cross(a: Vector, b: Vector): Vector { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
function subtract(a: Vector, b: Vector): Vector { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
function hash(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123
  return value - Math.floor(value)
}
function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(x - ix), v = smooth(z - iz)
  return mix(mix(hash(ix, iz), hash(ix + 1, iz), u), mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v)
}
function field(x: number, z: number): number {
  // Different rotations and offsets keep the erosion field from reading as a
  // series of concentric bands, while remaining deterministic between rebuilds.
  return noise(x, z) * 0.56 + noise(z * 2.17 + 13.4, -x * 2.17 - 7.2) * 0.29
    + noise(x * 5.13 - 31.8, z * 5.13 + 9.7) * 0.15
}
function periodicField(angle: number, frequency: number, seed: number): number {
  return field(Math.cos(angle) * frequency + seed, Math.sin(angle) * frequency - seed * 0.73)
}
function bay(angle: number, center: number, width: number): number {
  const distance = Math.atan2(Math.sin(angle - center), Math.cos(angle - center)) / width
  return Math.exp(-distance * distance * 2)
}
function flatTriangle(geometry: NaturalIslandGeometry, a: Vector, b: Vector, c: Vector): void {
  const normal = normalize(cross(subtract(b, a), subtract(c, a)))
  geometry.positions.push(...a, ...b, ...c)
  for (let vertex = 0; vertex < 3; vertex++) geometry.normals.push(...normal)
}
function tube(path: readonly Vector[], radius: number): NaturalIslandGeometry {
  const geometry = empty(), count = path.length
  function vertex(index: number, side: number): void {
    const point = path[index % count]!, before = path[(index + count - 1) % count]!, after = path[(index + 1) % count]!
    const tangent = normalize(subtract(after, before)), across = normalize(cross(tangent, [0, 1, 0])), up = cross(tangent, across)
    const angle = side / 6 * FULL_TURN
    const normal: Vector = [0, 1, 2].map(axis => across[axis]! * Math.cos(angle) + up[axis]! * Math.sin(angle)) as Vector
    geometry.positions.push(point[0] + normal[0] * radius, point[1] + normal[1] * radius, point[2] + normal[2] * radius)
    geometry.normals.push(...normal)
  }
  for (let index = 0; index < count; index++) for (let side = 0; side < 6; side++) {
    vertex(index, side); vertex(index + 1, side); vertex(index, side + 1)
    vertex(index + 1, side); vertex(index + 1, side + 1); vertex(index, side + 1)
  }
  return geometry
}

/**
 * Land-only geometry. The existing footprint continues to own water, camera
 * bounds and page geometry. Every point inside protectedRadius stays precisely
 * on groundY; erosion and relief are restricted to the unoccupied coastal rim.
 */
export function createNaturalIslandGeometry(footprint: HqIslandFootprint, protectedRadius: number, groundY: number): NaturalIslandMeshes {
  const top = empty(), cliffs = empty(), rocks = empty(), grass = empty()
  const protectedEdge = Math.max(0, protectedRadius)
  function erodedRadius(angle: number): number {
    const original = hqIslandRadiusAt(footprint, angle)
    const broadErosion = 0.18 + periodicField(angle, 1.9, 6.8) * 0.65
      + bay(angle, 0.38, 0.62) * 0.76 + bay(angle, 2.72, 0.47) * 0.97 + bay(angle, 4.63, 0.70) * 0.62
    const brokenEdge = (periodicField(angle, 11.3, 19.2) - 0.5) * 0.31
      + (periodicField(angle, 28.1, -12.7) - 0.5) * 0.12
    return clamp(original - broadErosion + brokenEdge, protectedEdge + 0.38, footprint.radius)
  }
  const coastalRadii = Array.from({ length: COAST_SAMPLES }, (_, index) => erodedRadius(index / COAST_SAMPLES * FULL_TURN))
  function coast(angle: number): number {
    const sample = ((angle % FULL_TURN + FULL_TURN) % FULL_TURN) / FULL_TURN * COAST_SAMPLES
    const index = Math.floor(sample)
    return mix(coastalRadii[index]!, coastalRadii[(index + 1) % COAST_SAMPLES]!, sample - index)
  }
  function height(x: number, z: number): number {
    const radius = Math.hypot(x, z)
    if (radius <= protectedEdge) return groundY
    const rimWidth = Math.max(0.25, coast(Math.atan2(z, x)) - protectedEdge)
    const rim = clamp((radius - protectedEdge) / rimWidth, 0, 1)
    const erosion = (field(x * 0.72 + 18.3, z * 0.72 - 12.8) - 0.5) * 0.18
    const gravel = (noise(x * 3.7 - 4.3, z * 3.7 + 8.2) - 0.5) * 0.027
    const coastalFall = smooth((rim - 0.58) / 0.42) * 0.055
    return groundY + clamp(smooth(rim / 0.60) * (erosion + gravel - coastalFall), -0.14, 0.16)
  }
  function surfaceNormal(x: number, z: number): Vector {
    if (Math.hypot(x, z) <= protectedEdge) return [0, 1, 0]
    const step = 0.035
    return normalize([height(x - step, z) - height(x + step, z), step * 2, height(x, z - step) - height(x, z + step)])
  }
  const topSamples: ({ point: Vector; normal: Vector } | undefined)[][] = Array.from({ length: 10 }, () => [])
  function topVertex(index: number, band: number): void {
    const sample = index % COAST_SAMPLES
    let cached = topSamples[band]![sample]
    if (!cached) {
      const angle = sample / COAST_SAMPLES * FULL_TURN, edge = coastalRadii[sample]!
      // The first four rings are perfectly flat. Extra rings resolve the narrow
      // exposed rim without adding displacement beneath any workplace or road.
      const radii = [0, protectedEdge * 0.30, protectedEdge * 0.62, protectedEdge,
        mix(protectedEdge, edge, 0.17), mix(protectedEdge, edge, 0.35), mix(protectedEdge, edge, 0.55),
        mix(protectedEdge, edge, 0.74), mix(protectedEdge, edge, 0.90), edge]
      const radius = radii[band]!, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
      cached = { point: [x, band <= 3 ? groundY : height(x, z), z], normal: band <= 3 ? [0, 1, 0] : surfaceNormal(x, z) }
      topSamples[band]![sample] = cached
    }
    top.positions.push(...cached.point)
    top.normals.push(...cached.normal)
  }
  for (let index = 0; index < COAST_SAMPLES; index++) {
    topVertex(index, 0); topVertex(index + 1, 1); topVertex(index, 1)
  }
  for (let band = 1; band < 9; band++) for (let index = 0; index < COAST_SAMPLES; index++) {
    topVertex(index, band); topVertex(index + 1, band); topVertex(index, band + 1)
    topVertex(index + 1, band); topVertex(index + 1, band + 1); topVertex(index, band + 1)
  }

  const cliffSamples: (Vector | undefined)[][] = Array.from({ length: 7 }, () => [])
  function cliffPoint(index: number, layer: number): Vector {
    const sample = index % COAST_SAMPLES, cached = cliffSamples[layer]![sample]
    if (cached) return cached
    const angle = sample / COAST_SAMPLES * FULL_TURN, original = hqIslandRadiusAt(footprint, angle), upper = coastalRadii[sample]!
    const weather = periodicField(angle, 5.1, 4.2 + layer * 3.1) - 0.5
    const fractures = periodicField(angle, 17.7, -8.3 + layer * 1.7) - 0.5
    // This shelf deliberately overlaps the ORIGINAL water's inner edge at its
    // unchanged sea level. Recessed bays therefore cannot expose a black gap.
    const waterShelf = Math.min(footprint.radius, Math.max(upper - 0.11, original * 0.99 - 0.39))
    let radius = upper, y = height(Math.cos(angle) * upper, Math.sin(angle) * upper)
    if (layer === 1) { radius = mix(upper, waterShelf, 0.33) + weather * 0.14; y = groundY - 0.29 + weather * 0.065 }
    else if (layer === 2) { radius = waterShelf; y = groundY - 0.50 }
    else if (layer === 3) { radius = waterShelf - 0.15 + weather * 0.33 + fractures * 0.10; y = groundY - 0.81 + weather * 0.16 }
    else if (layer === 4) { radius = waterShelf - 0.48 + weather * 0.48 + fractures * 0.15; y = groundY - 1.20 + weather * 0.22 }
    else if (layer === 5) { radius = waterShelf - 0.92 + weather * 0.53 + fractures * 0.18; y = groundY - footprint.depth * 0.77 + weather * 0.23 }
    else if (layer === 6) { radius = waterShelf - 1.48 + weather * 0.55 + fractures * 0.13; y = groundY - footprint.depth + weather * 0.12 }
    radius = Math.min(footprint.radius, radius)
    const point: Vector = [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
    cliffSamples[layer]![sample] = point
    return point
  }
  for (let layer = 0; layer < 6; layer++) for (let index = 0; index < COAST_SAMPLES; index++) {
    const a = cliffPoint(index, layer), b = cliffPoint(index + 1, layer), c = cliffPoint(index, layer + 1), d = cliffPoint(index + 1, layer + 1)
    // Alternate diagonals break long repeated facets along eroded strata.
    if ((index + layer) % 2 === 0) { flatTriangle(cliffs, a, b, c); flatTriangle(cliffs, b, d, c) }
    else { flatTriangle(cliffs, a, b, d); flatTriangle(cliffs, a, d, c) }
  }
  const underside: Vector = [0, groundY - footprint.depth * 1.06, 0]
  for (let index = 0; index < COAST_SAMPLES; index++) flatTriangle(cliffs, underside, cliffPoint(index, 6), cliffPoint(index + 1, 6))
  const upperSeam: Vector[] = [], middleSeam: Vector[] = []
  for (let index = 0; index < COAST_SAMPLES; index++) {
    const angle = index / COAST_SAMPLES * FULL_TURN, upper = cliffPoint(index, 0), middle = cliffPoint(index, 4)
    upperSeam.push([upper[0] - Math.cos(angle) * 0.035, upper[1] + 0.014, upper[2] - Math.sin(angle) * 0.035])
    middleSeam.push([middle[0] + Math.cos(angle) * 0.014, middle[1], middle[2] + Math.sin(angle) * 0.014])
  }

  function rock(x: number, z: number, size: number, seed: number): void {
    const radius = Math.hypot(x, z)
    if (radius - size * 1.12 < protectedEdge + 0.22 || radius + size * 1.12 > coast(Math.atan2(z, x)) - 0.08) return
    const baseY = height(x, z) - 0.018, points: Vector[][] = []
    const turn = seed * 1.73
    for (let ring = 0; ring < 3; ring++) {
      points.push(Array.from({ length: 7 }, (_, index): Vector => {
        const angle = index / 7 * FULL_TURN + turn + (ring === 1 ? 0.10 : 0)
        const rough = 0.82 + hash(index + seed * 7, ring + 1) * 0.28
        const spread = [0.80, 1, 0.54][ring]!
        return [x + Math.cos(angle) * size * spread * rough,
          baseY + [0, size * 0.32, size * 0.68][ring]! + (ring > 0 ? (hash(index + 9, seed + ring) - 0.5) * size * 0.12 : 0),
          z + Math.sin(angle) * size * spread * rough * 0.73]
      }))
    }
    for (let ring = 0; ring < 2; ring++) for (let index = 0; index < 7; index++) {
      const a = points[ring]![index]!, b = points[ring]![(index + 1) % 7]!, c = points[ring + 1]![index]!, d = points[ring + 1]![(index + 1) % 7]!
      flatTriangle(rocks, a, c, b); flatTriangle(rocks, b, c, d)
    }
    const center: Vector = [x + size * 0.06, baseY + size * 0.70, z - size * 0.03]
    for (let index = 0; index < 7; index++) flatTriangle(rocks, center, points[2]![(index + 1) % 7]!, points[2]![index]!)
  }
  const placed: { x: number; z: number }[] = []
  for (let candidate = 0; candidate < 48 && placed.length < 10; candidate++) {
    const angle = candidate * Math.PI * (3 - Math.sqrt(5)) + 0.54, edge = coast(angle), rimWidth = edge - protectedEdge
    if (rimWidth < 0.95) continue
    const size = Math.min(0.36, rimWidth * 0.20) * (0.72 + hash(candidate, 4) * 0.28)
    const radius = protectedEdge + Math.max(0.48, rimWidth * (0.36 + hash(candidate, 7) * 0.14))
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
    if (radius - size < protectedEdge + 0.25 || radius + size * 1.8 > edge - 0.12
      || placed.some(point => Math.hypot(point.x - x, point.z - z) < 2.4)) continue
    placed.push({ x, z })
    rock(x, z, size, candidate + 1)
    rock(x + Math.cos(angle + 0.9) * size * 1.30, z + Math.sin(angle + 0.9) * size * 1.30, size * 0.46, candidate + 11)
    for (let tuft = 0; tuft < 2; tuft++) for (let blade = 0; blade < 4; blade++) {
      const turn = angle + tuft * 1.7 + blade * 0.73, baseX = x + Math.cos(angle + tuft) * size * 1.45, baseZ = z + Math.sin(angle + tuft) * size * 1.45
      const tuftRadius = Math.hypot(baseX, baseZ)
      if (tuftRadius <= protectedEdge + 0.22 || tuftRadius + 0.08 >= coast(Math.atan2(baseZ, baseX))) continue
      const baseY = height(baseX, baseZ) + 0.005, bladeHeight = 0.10 + hash(blade + candidate, tuft) * 0.09
      const sideX = Math.cos(turn + Math.PI / 2) * 0.012, sideZ = Math.sin(turn + Math.PI / 2) * 0.012
      flatTriangle(grass, [baseX - sideX, baseY, baseZ - sideZ], [baseX + sideX, baseY, baseZ + sideZ],
        [baseX + Math.cos(turn) * 0.065, baseY + bladeHeight, baseZ + Math.sin(turn) * 0.065])
    }
  }
  return { top, cliffs, topGold: tube(upperSeam, 0.014), middleGold: tube(middleSeam, 0.011), rocks, grass }
}
