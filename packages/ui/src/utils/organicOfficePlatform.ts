import type { OfficeArchitectureBounds, OfficeArchitectureGeometry } from './officeArchitecture.ts'

export interface OrganicPoint { x: number; z: number }
export interface OrganicOfficeFootprint {
  key: string
  center: OrganicPoint
  outline: readonly OrganicPoint[]
  radius: number
  executive: boolean
}
export const ORGANIC_PLATFORM_CONFIG = Object.freeze({ padding: 0.25, samples: 128, curveNodes: 16, height: 0.14 })

function hash(seed: string): number {
  let value = 2166136261
  for (let index = 0; index < seed.length; index++) value = Math.imul(value ^ seed.charCodeAt(index), 16777619)
  return value >>> 0
}
/** Periodic cubic Hermite spline: broad, flowing shoulders rather than polygon corners. */
function spline(nodes: readonly number[], position: number): number {
  const index = Math.floor(position), t = position - index, n = nodes.length
  const a = nodes[(index + n - 1) % n]!, b = nodes[index % n]!, c = nodes[(index + 1) % n]!, d = nodes[(index + 2) % n]!
  return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)))
}

/** Furniture-derived rounded support hull plus seeded spline shoulders. Broad
 * asymmetric lobes expand the hull; they never subtract space from a chair or
 * perimeter fixture. Geometry is generated only on layout changes. */
export function createOrganicOfficeFootprint(options: {
  furnitureBounds: readonly OfficeArchitectureBounds[]
  deskCenters: readonly OrganicPoint[]
  deskCount: number
  seed: string
  basePadding?: number
  uniqueStyle?: 'department' | 'executive'
}): OrganicOfficeFootprint {
  const padding = options.basePadding ?? ORGANIC_PLATFORM_CONFIG.padding
  const bounds = options.furnitureBounds
  const minX = Math.min(...bounds.map(b => b.min[0])), maxX = Math.max(...bounds.map(b => b.max[0]))
  const minZ = Math.min(...bounds.map(b => b.min[2])), maxZ = Math.max(...bounds.map(b => b.max[2]))
  const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }
  const a = Math.max(1, (maxX - minX) / 2), b = Math.max(1, (maxZ - minZ) / 2)
  const corners = bounds.flatMap(box => [box.min[0], box.max[0]].flatMap(x => [box.min[2], box.max[2]].map(z => ({ x: x - center.x, z: z - center.z }))))
  // Intersect tangent half-planes of the furniture hull expanded by a disk.
  // This gives round fixture clearances without the wasted corners of a large
  // enclosing ellipse. The small guard protects sampled chords at all scales.
  const guard = Math.max(0.04, Math.hypot(maxX - minX, maxZ - minZ) * 0.001)
  const ellipseA = a + padding + guard, ellipseB = b + padding + guard
  let ellipseScale = 1
  for (const box of bounds) for (const x of [box.min[0] - padding - guard, box.max[0] + padding + guard]) for (const z of [box.min[2] - padding - guard, box.max[2] + padding + guard]) {
    ellipseScale = Math.max(ellipseScale, Math.hypot((x - center.x) / ellipseA, (z - center.z) / ellipseB))
  }
  const planes = Array.from({ length: 256 }, (_, index) => {
    const angle = index / 256 * Math.PI * 2, x = Math.cos(angle), z = Math.sin(angle)
    return { x, z, distance: Math.max(...corners.map(p => p.x * x + p.z * z)) + padding + guard }
  })
  const executive = options.uniqueStyle === 'executive', seed = hash(options.seed)
  const phase = seed / 0xffffffff * Math.PI * 2, lobes = seed % 2 ? 3 : 5
  // The founder restored the original layout/scene scale. Existing desk rows
  // still determine depth, but there is no extra count-based floor inflation.
  const nodes = Array.from({ length: ORGANIC_PLATFORM_CONFIG.curveNodes }, (_, index) => {
    const theta = index / ORGANIC_PLATFORM_CONFIG.curveNodes * Math.PI * 2
    let furnitureShoulder = 0
    for (const desk of options.deskCenters) {
      const direction = Math.atan2((desk.z - center.z) / b, (desk.x - center.x) / a)
      furnitureShoulder += Math.pow(Math.max(0, Math.cos(theta - direction)), 4) * 0.025 / Math.max(1, options.deskCenters.length)
    }
    return 1.065 + 0.028 * Math.cos(lobes * theta + phase) + 0.016 * Math.sin(2 * theta - phase * 0.7)
      + 0.012 * Math.cos(theta + phase * 1.3) + furnitureShoulder
      + (executive ? 0.012 * (1 + Math.cos(3 * theta - 0.6)) : 0)
  })
  // Keep spline overshoot outside the support hull, including sampled chords.
  const minimum = 1 / Math.cos(Math.PI / ORGANIC_PLATFORM_CONFIG.samples) + 0.003
  const outline = Array.from({ length: ORGANIC_PLATFORM_CONFIG.samples }, (_, index) => {
    const parameter = index / ORGANIC_PLATFORM_CONFIG.samples * Math.PI * 2
    const theta = (Math.atan2(ellipseB * Math.sin(parameter), ellipseA * Math.cos(parameter)) + Math.PI * 2) % (Math.PI * 2)
    const x = Math.cos(theta), z = Math.sin(theta)
    let support = Infinity
    for (const plane of planes) {
      const projection = plane.x * x + plane.z * z
      if (projection > 1e-8) support = Math.min(support, plane.distance / projection)
    }
    // Blend two containing envelopes: the round ellipse removes the box-like
    // shoulders of four corner fixtures, while the hull retains layout bias.
    const ellipseRadius = ellipseScale / Math.hypot(x / ellipseA, z / ellipseB)
    const radius = (support * 0.8 + ellipseRadius * 0.2) * Math.max(minimum, spline(nodes, theta / (Math.PI * 2) * nodes.length))
    return { x: center.x + x * radius * (executive ? 1.025 : 1), z: center.z + z * radius }
  })
  return { key: JSON.stringify([options.seed, options.deskCount, executive, padding, bounds, options.deskCenters]), center, outline, executive, radius: Math.max(...outline.map(p => Math.hypot(p.x, p.z))) }
}

export function organicContains(outline: readonly OrganicPoint[], point: OrganicPoint): boolean {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!, b = outline[j]!
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/** Fit only the floor into its existing radial allocation. No office, terrain,
 * camera or furniture transform is changed. Soft limiting avoids cut corners. */
export function fitOrganicOfficeFootprint(footprint: OrganicOfficeFootprint, radius: number, halfAngle: number, outerRadius: number): OrganicOfficeFootprint {
  const center = footprint.center, tangent = Math.tan(halfAngle)
  const outline = footprint.outline.map(p => {
    const dx = p.x - center.x, dz = p.z - center.z, length = Math.hypot(dx, dz), x = dx / length, z = dz / length
    const projection = center.x * x + (radius + center.z) * z
    let limit = -projection + Math.sqrt(projection * projection + outerRadius * outerRadius - center.x * center.x - (radius + center.z) ** 2)
    if (halfAngle < Math.PI / 2) for (const side of [-1, 1]) {
      const denominator = side * x - tangent * z
      if (denominator > 1e-8) limit = Math.min(limit, (radius * tangent - side * center.x + tangent * center.z) / denominator)
    }
    const softness = 0.12
    const fitted = Math.min(length, limit) - softness * Math.log1p(Math.exp(-Math.abs(length - limit) / softness))
    return { x: center.x + x * fitted, z: center.z + z * fitted }
  })
  return { ...footprint, key: `${footprint.key}:${radius}:${halfAngle}:${outerRadius}`, outline, radius: Math.max(...outline.map(p => Math.hypot(p.x, p.z))) }
}
/** Exact sampled boundary crossing for existing front/rear walking portals. */
export function organicBoundaryAtX(footprint: OrganicOfficeFootprint, x: number, end: 'front' | 'rear'): number {
  const crossings: number[] = []
  footprint.outline.forEach((a, i) => {
    const b = footprint.outline[(i + 1) % footprint.outline.length]!
    if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) crossings.push(a.z + (b.z - a.z) * (x - a.x) / (b.x - a.x))
  })
  return end === 'front' ? Math.min(...crossings) : Math.max(...crossings)
}
const cross = (a: OrganicPoint, b: OrganicPoint) => a.x * b.z - a.z * b.x
const minus = (a: OrganicPoint, b: OrganicPoint): OrganicPoint => ({ x: a.x - b.x, z: a.z - b.z })
export function pointSegmentDistance(p: OrganicPoint, a: OrganicPoint, b: OrganicPoint): number {
  const d = minus(b, a), relative = minus(p, a), length = d.x * d.x + d.z * d.z
  const t = length ? Math.max(0, Math.min(1, (relative.x * d.x + relative.z * d.z) / length)) : 0
  return Math.hypot(relative.x - d.x * t, relative.z - d.z * t)
}
export function organicFootprintGap(a: readonly OrganicPoint[], b: readonly OrganicPoint[]): number {
  if (organicContains(a, b[0]!) || organicContains(b, a[0]!)) return 0
  let gap = Infinity
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i]!, q = a[(i + 1) % a.length]!, r = b[j]!, s = b[(j + 1) % b.length]!
    const d = minus(q, p), e = minus(s, r), offset = minus(r, p), denominator = cross(d, e)
    if (Math.abs(denominator) > 1e-9) {
      const t = cross(offset, e) / denominator, u = cross(offset, d) / denominator
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0
    }
    gap = Math.min(gap, pointSegmentDistance(p, r, s), pointSegmentDistance(q, r, s), pointSegmentDistance(r, p, q), pointSegmentDistance(s, p, q))
  }
  return gap
}

/** Intersect the actual organic prism, including cap and curved side volume. */
export function organicPrismIntersection(footprint: OrganicOfficeFootprint, origin: readonly number[], direction: readonly number[], low: number, high: number): number {
  const p = { x: origin[0]!, z: origin[2]! }, d = { x: direction[0]!, z: direction[2]! }
  let nearest = Infinity
  if (origin[1]! >= low && origin[1]! <= high && organicContains(footprint.outline, p)) return 0.05
  if (Math.abs(direction[1]!) > 1e-8) for (const y of [low, high]) {
    const t = (y - origin[1]!) / direction[1]!
    if (t >= 0.05 && organicContains(footprint.outline, { x: p.x + d.x * t, z: p.z + d.z * t })) nearest = Math.min(nearest, t)
  }
  footprint.outline.forEach((a, i) => {
    const e = minus(footprint.outline[(i + 1) % footprint.outline.length]!, a), offset = minus(a, p), denominator = cross(d, e)
    if (Math.abs(denominator) < 1e-9) return
    const t = cross(offset, e) / denominator, u = cross(offset, d) / denominator, y = origin[1]! + direction[1]! * t
    if (t >= 0.05 && u >= 0 && u <= 1 && y >= low && y <= high) nearest = Math.min(nearest, t)
  })
  return nearest
}

/** Native WebGL batches: spline-sampled floor, shallow extrusion and exact rim.
 * The rim's Y is relative to the existing finished-floor transform. */
export function createOrganicOfficePlatform(footprint: OrganicOfficeFootprint): { foundation: OfficeArchitectureGeometry; rim: OfficeArchitectureGeometry } {
  const foundation: OfficeArchitectureGeometry = { positions: [], normals: [] }, rim: OfficeArchitectureGeometry = { positions: [], normals: [] }
  type V = [number, number, number]
  function triangle(mesh: OfficeArchitectureGeometry, a: V, b: V, c: V, normal: V) {
    mesh.positions.push(...a, ...b, ...c); mesh.normals.push(...normal, ...normal, ...normal)
  }
  const outline = footprint.outline, height = ORGANIC_PLATFORM_CONFIG.height
  const normals = outline.map((_, i) => {
    const before = outline[(i + outline.length - 1) % outline.length]!, after = outline[(i + 1) % outline.length]!
    const length = Math.hypot(after.x - before.x, after.z - before.z)
    return { x: (after.z - before.z) / length, z: -(after.x - before.x) / length }
  })
  function band(offset: number, width: number) {
    outline.forEach((a, i) => {
      const j = (i + 1) % outline.length, b = outline[j]!, na = normals[i]!, nb = normals[j]!
      const outerA: V = [a.x - na.x * offset, 0.018, a.z - na.z * offset], outerB: V = [b.x - nb.x * offset, 0.018, b.z - nb.z * offset]
      const innerA: V = [a.x - na.x * (offset + width), 0.018, a.z - na.z * (offset + width)], innerB: V = [b.x - nb.x * (offset + width), 0.018, b.z - nb.z * (offset + width)]
      triangle(rim, outerA, innerB, outerB, [0, 1, 0]); triangle(rim, outerA, innerA, innerB, [0, 1, 0])
    })
  }
  outline.forEach((a, i) => {
    const j = (i + 1) % outline.length, b = outline[j]!, n = normals[i]!, m = normals[j]!
    triangle(foundation, [footprint.center.x, height, footprint.center.z], [b.x, height, b.z], [a.x, height, a.z], [0, 1, 0])
    // Smooth per-vertex outward normals along the shallow extruded wall.
    foundation.positions.push(a.x, 0, a.z, b.x, height, b.z, b.x, 0, b.z, a.x, 0, a.z, a.x, height, a.z, b.x, height, b.z)
    foundation.normals.push(n.x, 0, n.z, m.x, 0, m.z, m.x, 0, m.z, n.x, 0, n.z, n.x, 0, n.z, m.x, 0, m.z)
  })
  band(0.022, 0.023)
  return { foundation, rim }
}
