import type { HqDepartmentOffice } from '../types/hqLayoutPresentation'

export const DEPARTMENT_OFFICE_WIDTH = 6.2
export const DEPARTMENT_OFFICE_DEPTH = 5.2
export const OFFICE_WALKWAY_WIDTH = 0.95
const FIRST_RING_RADIUS = 8.5
const RING_SPACING = 10.2
const FOOTPRINT_RADIUS = Math.hypot(DEPARTMENT_OFFICE_WIDTH, DEPARTMENT_OFFICE_DEPTH) / 2
// Circumcircle spacing protects complete room footprints, including rotated
// corners. The remaining gap fits the broad path with 0.325 on either side.
const MINIMUM_CENTER_DISTANCE = FOOTPRINT_RADIUS * 2 + OFFICE_WALKWAY_WIDTH + 0.65
const ROAD_START_RADIUS = 2.1
const FULL_TURN = Math.PI * 2
const RING_START_ANGLE = -Math.PI / 2

export interface DepartmentRoadPoint { x: number; z: number }
export interface OfficePlacement {
  x: number
  z: number
  yaw: number
  width: number
  depth: number
  /** One-based concentric office ring. */
  ring: number
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
}

/** Shared finite-floor sizing; invalid manual counts mean zero, with a 64-layer bound. */
export function departmentOfficeFloorRadius(value?: number): number {
  const layers = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(64, Math.floor(value))) : 0
  return layers === 0 ? 4.8 : ringRadius(layers) + FOOTPRINT_RADIUS + 0.8
}
function ringRadius(ring: number): number { return FIRST_RING_RADIUS + (ring - 1) * RING_SPACING }
function corridorRadius(innerRing: number): number {
  if (innerRing === 0) return (ROAD_START_RADIUS + FIRST_RING_RADIUS - FOOTPRINT_RADIUS) / 2
  return (ringRadius(innerRing) + ringRadius(innerRing + 1)) / 2
}
function ringCapacity(ring: number): number {
  return Math.max(1, Math.floor(Math.PI / Math.asin(MINIMUM_CENTER_DISTANCE / (ringRadius(ring) * 2))))
}
function ringSlotAngle(ring: number, slot: number): number {
  // Start at the top, then fill clockwise/counterclockwise pairs. Keep the
  // capacity-based spacing so appending an office does not move earlier slots.
  const offset = slot % 2 === 0 ? -slot / 2 : (slot + 1) / 2
  return RING_START_ANGLE + offset * FULL_TURN / ringCapacity(ring)
}
function point(radius: number, angle: number): DepartmentRoadPoint { return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius } }
function nearestGap(ring: number, target: number): number {
  const step = FULL_TURN / ringCapacity(ring), phase = RING_START_ANGLE
  return phase + (Math.round((target - phase) / step - 0.5) + 0.5) * step
}
function arc(path: DepartmentRoadPoint[], radius: number, start: number, end: number): void {
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start))
  if (Math.abs(delta) < 0.00001) return
  // Bound chord inset as the HQ grows so a sampled arc remains within its
  // empty corridor, rather than cutting closer to an inner room corner.
  const step = Math.min(0.08, 2 * Math.acos(Math.max(-1, 1 - 0.08 / radius)))
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / step))
  for (let index = 1; index <= steps; index++) path.push(point(radius, start + delta * index / steps))
}
function roadToOffice(ring: number, targetAngle: number): readonly DepartmentRoadPoint[] {
  let angle = ring === 1 ? targetAngle : nearestGap(1, targetAngle)
  let corridor = corridorRadius(0)
  const path = [point(ROAD_START_RADIUS, angle), point(corridor, angle)]
  // Cross each occupied inner ring at a gap midpoint, then turn within the
  // empty band between rooms. Roads can share corridors, never room footprints.
  for (let inner = 1; inner < ring; inner++) {
    const exitAngle = nearestGap(inner, targetAngle)
    arc(path, corridor, angle, exitAngle)
    angle = exitAngle
    corridor = corridorRadius(inner)
    path.push(point(corridor, angle))
  }
  arc(path, corridor, angle, targetAngle)
  path.push(point(ringRadius(ring) - DEPARTMENT_OFFICE_DEPTH / 2 + 0.06, targetAngle))
  return path
}

/** Pure presentation layout; departments come from approved whole-company plans. */
export function layoutDepartmentOffices(departments: readonly HqDepartmentOffice[]): DepartmentOfficeLayout {
  const oldestFirst = [...departments].sort((left, right) => {
    const leftTime = Date.parse(left.approvedAt), rightTime = Date.parse(right.approvedAt)
    const timeDifference = (Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER)
    return timeDifference || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  })
  const executiveAngle = ringSlotAngle(1, 0)
  const executive: ExecutiveWorkspacePlacement = {
    id: 'executive-workspace', ...point(ringRadius(1), executiveAngle), yaw: Math.PI / 2 - executiveAngle,
    width: DEPARTMENT_OFFICE_WIDTH, depth: DEPARTMENT_OFFICE_DEPTH, ring: 1,
    roadPoints: roadToOffice(1, executiveAngle),
  }
  const offices: DepartmentOfficePlacement[] = []
  // Slot zero belongs to the existing CEO workspace, including before any plan
  // is approved. It consumes space without creating a department/roster record.
  let ring = 1, slot = 1, capacity = ringCapacity(ring)
  for (const department of oldestFirst) {
    if (slot >= capacity) { ring += 1; slot = 0; capacity = ringCapacity(ring) }
    const angle = ringSlotAngle(ring, slot), radius = ringRadius(ring)
    offices.push({
      ...department, ...point(radius, angle), yaw: Math.PI / 2 - angle,
      width: DEPARTMENT_OFFICE_WIDTH, depth: DEPARTMENT_OFFICE_DEPTH, ring,
      roadPoints: roadToOffice(ring, angle),
    })
    slot += 1
  }
  const layerCount = ring
  const outerFootprint = ringRadius(layerCount) + FOOTPRINT_RADIUS + 0.8
  return { executive, offices, layerCount, floorRadius: Math.max(departmentOfficeFloorRadius(layerCount), outerFootprint) }
}
