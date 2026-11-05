import type { HqDepartmentOffice } from '../types/hqLayoutPresentation'

export const DEPARTMENT_OFFICE_WIDTH = 6.2
export const DEPARTMENT_OFFICE_DEPTH = 5.2
export const OFFICE_WALKWAY_WIDTH = 0.95
const FIRST_RING_INNER_RADIUS = 7.5
const RING_DEPTH = 9
const FURNITURE_SIDE_CLEARANCE = 0.35
const SHARED_FLOOR_INNER_RADIUS = 2.2
const FULL_TURN = Math.PI * 2
const RING_START_ANGLE = -Math.PI / 2

export interface DepartmentRoadPoint { x: number; z: number }
export interface WorkplaceSector {
  startAngle: number
  endAngle: number
  innerRadius: number
  outerRadius: number
}
export interface WorkplaceRing {
  ring: number
  innerRadius: number
  outerRadius: number
  capacity: number
}
export interface OfficePlacement {
  x: number
  z: number
  yaw: number
  width: number
  depth: number
  /** One-based concentric office ring. */
  ring: number
  /** Shared annular floor ownership, including the room's walking space. */
  sector: WorkplaceSector
  /** Retained for existing presentation consumers; the shared floor has no spokes. */
  roadPoints: readonly DepartmentRoadPoint[]
}
export interface DepartmentOfficePlacement extends HqDepartmentOffice, OfficePlacement {}
/** Existing executive role; this reserved presentation space is never a department. */
export interface ExecutiveWorkspacePlacement extends OfficePlacement { id: 'executive-workspace' }
export interface DepartmentOfficeLayout {
  executive: ExecutiveWorkspacePlacement
  offices: readonly DepartmentOfficePlacement[]
  layerCount: number
  floorRadius: number
  rings: readonly WorkplaceRing[]
  sharedFloorInnerRadius: number
}

/** Shared finite-floor sizing; invalid manual counts mean zero, with a 64-layer bound. */
export function departmentOfficeFloorRadius(value?: number): number {
  const layers = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(64, Math.floor(value))) : 0
  return layers === 0 ? 4.8 : ringBounds(layers).outerRadius + 0.8
}
function ringBounds(ring: number): { innerRadius: number; outerRadius: number } {
  const innerRadius = FIRST_RING_INNER_RADIUS + (ring - 1) * RING_DEPTH
  return { innerRadius, outerRadius: innerRadius + RING_DEPTH }
}
function ringRadius(ring: number): number {
  return ringBounds(ring).innerRadius + RING_DEPTH / 2
}
function ringCapacity(ring: number): number {
  // The nearest furniture corners need the most angular clearance. Capacity
  // remains a furniture-fit limit; occupied sectors divide the whole band.
  const nearestFurnitureEdge = ringRadius(ring) - DEPARTMENT_OFFICE_DEPTH / 2
  const halfAngle = Math.atan2(DEPARTMENT_OFFICE_WIDTH / 2 + FURNITURE_SIDE_CLEARANCE, nearestFurnitureEdge)
  return Math.max(8, Math.floor(Math.PI / halfAngle))
}
function point(radius: number, angle: number): DepartmentRoadPoint { return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius } }
function placement(ring: number, slot: number, occupied: number): OfficePlacement {
  const step = FULL_TURN / occupied
  const angle = RING_START_ANGLE + slot * step
  return {
    ...point(ringRadius(ring), angle), yaw: Math.PI / 2 - angle,
    width: DEPARTMENT_OFFICE_WIDTH, depth: DEPARTMENT_OFFICE_DEPTH, ring,
    sector: { ...ringBounds(ring), startAngle: angle - step / 2, endAngle: angle + step / 2 },
    roadPoints: [],
  }
}

/** World-space curved room boundary shared by map, picking and island sizing. */
export function workplaceFootprint(office: OfficePlacement): readonly DepartmentRoadPoint[] {
  const { startAngle, endAngle, innerRadius, outerRadius } = office.sector
  const span = endAngle - startAngle
  const segments = Math.max(12, Math.ceil(span / 0.04))
  const boundary: DepartmentRoadPoint[] = []
  for (let index = 0; index <= segments; index++) boundary.push(point(outerRadius, startAngle + span * index / segments))
  for (let index = segments; index >= 0; index--) boundary.push(point(innerRadius, startAngle + span * index / segments))
  return boundary
}

/** Pure presentation layout; departments come from approved whole-company plans. */
export function layoutDepartmentOffices(departments: readonly HqDepartmentOffice[]): DepartmentOfficeLayout {
  const oldestFirst = [...departments].sort((left, right) => {
    const leftTime = Date.parse(left.approvedAt), rightTime = Date.parse(right.approvedAt)
    const timeDifference = (Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER)
    return timeDifference || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  })
  // Fill safe-capacity bands first, then divide each occupied band equally.
  // Adding a workplace intentionally reflows that band's existing sectors.
  const rings: WorkplaceRing[] = []
  const occupantsPerRing: number[] = []
  let remaining = oldestFirst.length + 1
  while (remaining > 0) {
    const ring = rings.length + 1
    const capacity = ringCapacity(ring)
    const occupied = Math.min(capacity, remaining)
    rings.push({ ring, ...ringBounds(ring), capacity })
    occupantsPerRing.push(occupied)
    remaining -= occupied
  }
  const executive: ExecutiveWorkspacePlacement = {
    id: 'executive-workspace', ...placement(1, 0, occupantsPerRing[0] ?? 1),
  }
  const offices: DepartmentOfficePlacement[] = []
  // Slot zero belongs to the existing CEO workspace, including before any plan
  // is approved. It consumes space without creating a department/roster record.
  let ring = 1, slot = 1
  for (const department of oldestFirst) {
    if (slot >= (occupantsPerRing[ring - 1] ?? 1)) { ring += 1; slot = 0 }
    offices.push({ ...department, ...placement(ring, slot, occupantsPerRing[ring - 1] ?? 1) })
    slot += 1
  }
  const layerCount = rings.length
  return {
    executive, offices, layerCount, rings,
    floorRadius: departmentOfficeFloorRadius(layerCount),
    sharedFloorInnerRadius: SHARED_FLOOR_INNER_RADIUS,
  }
}
