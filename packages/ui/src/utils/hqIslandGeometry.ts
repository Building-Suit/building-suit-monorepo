import { OFFICE_WALKWAY_WIDTH, departmentOfficeFloorRadius } from './departmentOfficeLayout.ts'
import type { DepartmentOfficeLayout, DepartmentRoadPoint, OfficePlacement } from './departmentOfficeLayout.ts'

export interface HqIslandFootprint {
  /** Counter-clockwise world X/Z coast, without a repeated closing vertex. */
  outline: readonly DepartmentRoadPoint[]
  /** Radius at each fixed world-angle sample; shared by the mesh and minimap. */
  radii: readonly number[]
  /** Circular camera envelope only; the visible island is the actual outline. */
  radius: number
  depth: number
}

const SAMPLES = 256
const FULL_TURN = Math.PI * 2
const COAST_CLEARANCE = 0.90
const INITIAL_RADIUS = departmentOfficeFloorRadius(1)

function turn(a: DepartmentRoadPoint, b: DepartmentRoadPoint, c: DepartmentRoadPoint): number {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
}
function convexHull(points: readonly DepartmentRoadPoint[]): readonly DepartmentRoadPoint[] {
  const ordered = [...points].sort((a, b) => a.x - b.x || a.z - b.z)
  const lower: DepartmentRoadPoint[] = [], upper: DepartmentRoadPoint[] = []
  for (const point of ordered) {
    while (lower.length > 1 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop()
    lower.push(point)
  }
  for (let index = ordered.length - 1; index >= 0; index--) {
    const point = ordered[index]!
    while (upper.length > 1 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop()
    upper.push(point)
  }
  lower.pop(); upper.pop()
  return [...lower, ...upper]
}
function circle(points: DepartmentRoadPoint[], x: number, z: number, radius: number, samples = 12) {
  for (let index = 0; index < samples; index++) {
    const angle = index / samples * FULL_TURN
    points.push({ x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius })
  }
}
function workspaceEnvelope(office: OfficePlacement): readonly DepartmentRoadPoint[] {
  const points: DepartmentRoadPoint[] = []
  // Connect this workspace to a fixed inner island, rather than to a larger
  // global circle. Every later extension is confined to this local sector.
  circle(points, 0, 0, INITIAL_RADIUS - 0.95, 64)
  const cosine = Math.cos(office.yaw), sine = Math.sin(office.yaw)
  for (const x of [-office.width / 2, office.width / 2]) for (const z of [-office.depth / 2, office.depth / 2]) {
    circle(points, office.x + cosine * x + sine * z, office.z - sine * x + cosine * z, COAST_CLEARANCE)
  }
  // The hull also contains buffered road capsules, including turns through
  // empty inner-ring corridors. No room or route needs to move for new land.
  for (const point of office.roadPoints) circle(points, point.x, point.z, OFFICE_WALKWAY_WIDTH / 2 + COAST_CLEARANCE, 8)
  return convexHull(points)
}
function rayBoundary(polygon: readonly DepartmentRoadPoint[], x: number, z: number): number {
  let boundary = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index]!, b = polygon[(index + 1) % polygon.length]!
    const normalX = b.z - a.z, normalZ = a.x - b.x
    const denominator = normalX * x + normalZ * z
    if (denominator > 0.000001) boundary = Math.min(boundary, (normalX * a.x + normalZ * a.z) / denominator)
  }
  return Number.isFinite(boundary) ? boundary : INITIAL_RADIUS
}

/**
 * A fixed initial island plus independent buffered workspace/road sectors.
 * Ordinary appended approvals add land only near their own footprints; no
 * radius-dependent noise or global scaling moves the existing coastline.
 */
export function createHqIslandFootprint(layout: DepartmentOfficeLayout): HqIslandFootprint {
  const envelopes = [layout.executive, ...layout.offices].map(workspaceEnvelope)
  const required = Array.from({ length: SAMPLES }, (_value, index) => {
    const angle = index / SAMPLES * FULL_TURN, x = Math.cos(angle), z = Math.sin(angle)
    const wave = 0.5 + 0.5 * (Math.sin(angle * 3 + 0.4) * 0.50 + Math.sin(angle * 7 - 0.7) * 0.32 + Math.sin(angle * 11 + 1.1) * 0.18)
    let radius = INITIAL_RADIUS - 0.28 - wave * 0.42
    for (const envelope of envelopes) radius = Math.max(radius, rayBoundary(envelope, x, z))
    return radius
  })
  let radii = [...required]
  // Conservative local smoothing never cuts into the buffered footprints.
  // Two finite kernels affect only four neighbouring samples, so adding an
  // outer office cannot inflate the opposite side of the island.
  for (let pass = 0; pass < 2; pass++) {
    const previous = radii
    radii = previous.map((radius, index) => Math.max(radius,
      (previous[(index + SAMPLES - 2) % SAMPLES]! + previous[(index + SAMPLES - 1) % SAMPLES]! * 4 + radius * 6 + previous[(index + 1) % SAMPLES]! * 4 + previous[(index + 2) % SAMPLES]!) / 16))
  }
  const outline = radii.map((radius, index) => {
    const angle = index / SAMPLES * FULL_TURN
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  })
  return { outline, radii, radius: Math.max(...radii), depth: 2.25 }
}

/** Interpolated coastal radius for sparse decorative geometry, not authority. */
export function hqIslandRadiusAt(footprint: HqIslandFootprint, angle: number): number {
  const sample = ((angle % FULL_TURN + FULL_TURN) % FULL_TURN) / FULL_TURN * footprint.radii.length
  const index = Math.floor(sample), amount = sample - index
  return footprint.radii[index]! * (1 - amount) + footprint.radii[(index + 1) % footprint.radii.length]! * amount
}
