import { departmentOfficeFloorRadius } from './departmentOfficeLayout.ts'
import type { DepartmentOfficeLayout, DepartmentRoadPoint } from './departmentOfficeLayout.ts'

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
const COAST_CLEARANCE = 2.4
const INITIAL_RADIUS = departmentOfficeFloorRadius(1)

/**
 * Support the complete circular workplace floor, leaving a natural shoreline
 * outside it. A new occupied band extends the floor and its supporting island;
 * the rocky relief and water still share this same finite coastal boundary.
 */
export function createHqIslandFootprint(layout: DepartmentOfficeLayout): HqIslandFootprint {
  const floorOuterRadius = Math.max(...layout.rings.map(ring => ring.outerRadius))
  const supportRadius = Math.max(INITIAL_RADIUS, floorOuterRadius + COAST_CLEARANCE)
  const radii = Array.from({ length: SAMPLES }, (_value, index) => {
    const angle = index / SAMPLES * FULL_TURN
    const wave = 0.5 + 0.5 * (Math.sin(angle * 3 + 0.4) * 0.50 + Math.sin(angle * 7 - 0.7) * 0.32 + Math.sin(angle * 11 + 1.1) * 0.18)
    return supportRadius + wave * 0.7
  })
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
