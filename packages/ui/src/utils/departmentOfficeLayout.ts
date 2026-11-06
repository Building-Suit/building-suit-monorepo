import { createOfficeArchitecture, departmentDeskLayout, officeFurnitureFootprints } from './officeArchitecture.ts'
import { createOrganicOfficeFootprint, fitOrganicOfficeFootprint } from './organicOfficePlatform.ts'
import type { OrganicOfficeFootprint } from './organicOfficePlatform.ts'
import type { HqDepartmentOffice } from '../types/hqLayoutPresentation'

export const DEPARTMENT_OFFICE_WIDTH = 6.2
export const DEPARTMENT_OFFICE_DEPTH = 5.2
export const OFFICE_WALKWAY_WIDTH = 0.95
const FIRST_RING_INNER_RADIUS = 7
const RING_DEPTH = 7
const FURNITURE_SIDE_CLEARANCE = 0.15
// Retained radial support metadata; independent platforms leave the court open.
const SHARED_FLOOR_INNER_RADIUS = FIRST_RING_INNER_RADIUS
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
  /** Independent curved floor; width/depth retain the original furniture frame. */
  platform: OrganicOfficeFootprint
  /** One-based concentric office ring. */
  ring: number
  /** Radial allocation for spacing only; platforms and picking are independent. */
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
function ringBounds(ring: number, bandDepth = RING_DEPTH): { innerRadius: number; outerRadius: number } {
  const innerRadius = FIRST_RING_INNER_RADIUS + (ring - 1) * bandDepth
  return { innerRadius, outerRadius: innerRadius + bandDepth }
}
function ringRadius(ring: number, bandDepth = RING_DEPTH): number {
  return ringBounds(ring, bandDepth).innerRadius + bandDepth / 2
}
function ringCapacity(ring: number, bandDepth = RING_DEPTH, workDepth = DEPARTMENT_OFFICE_DEPTH): number {
  // The nearest furniture corners need the most angular clearance. Capacity
  // remains a furniture-fit limit; occupied sectors divide the whole band.
  const nearestFurnitureEdge = ringRadius(ring, bandDepth) - workDepth / 2
  const halfAngle = Math.atan2(DEPARTMENT_OFFICE_WIDTH / 2 + FURNITURE_SIDE_CLEARANCE, nearestFurnitureEdge)
  return Math.max(1, Math.floor(Math.PI / halfAngle))
}
function point(radius: number, angle: number): DepartmentRoadPoint { return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius } }
const footprintCache = new Map<string, OrganicOfficeFootprint>()
function platformFor(id: string, count: number, depth: number): OrganicOfficeFootprint {
  const key = `${id}:${count}:${depth}`
  const cached = footprintCache.get(key)
  if (cached) return cached
  const architecture = createOfficeArchitecture(DEPARTMENT_OFFICE_WIDTH, depth)
  const platform = createOrganicOfficeFootprint({
    seed: id, deskCount: count, furnitureBounds: officeFurnitureFootprints(architecture, count, id === 'executive-workspace'),
    deskCenters: departmentDeskLayout(count).desks, uniqueStyle: id === 'executive-workspace' ? 'executive' : 'department',
  })
  if (footprintCache.size >= 128) footprintCache.delete(footprintCache.keys().next().value!)
  footprintCache.set(key, platform)
  return platform
}
function placement(ring: number, slot: number, occupied: number, id: string, count: number, bandDepth = RING_DEPTH, workDepth = DEPARTMENT_OFFICE_DEPTH): OfficePlacement {
  const step = FULL_TURN / occupied
  const angle = RING_START_ANGLE + slot * step
  return {
    ...point(ringRadius(ring, bandDepth), angle), yaw: Math.PI / 2 - angle,
    width: DEPARTMENT_OFFICE_WIDTH, depth: workDepth, ring,
    platform: fitOrganicOfficeFootprint(platformFor(id, count, workDepth), ringRadius(ring, bandDepth), step / 2 - 0.012, ringBounds(ring, bandDepth).outerRadius),
    sector: { ...ringBounds(ring, bandDepth), startAngle: angle - step / 2, endAngle: angle + step / 2 },
    roadPoints: [],
  }
}

/** Independent platform footprint shared by the minimap and focus. */
export function workplaceFootprint(office: OfficePlacement): readonly DepartmentRoadPoint[] {
  const c = Math.cos(office.yaw), s = Math.sin(office.yaw)
  return office.platform.outline.map(({ x, z }) => {
    return { x: office.x + c * x + s * z, z: office.z - s * x + c * z }
  })
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
  const workDepth = Math.max(DEPARTMENT_OFFICE_DEPTH, ...oldestFirst.map(office => departmentDeskLayout(office.agents?.length ?? 0).depth))
  const bandDepth = Math.max(RING_DEPTH, workDepth + 1.8)
  const rings: WorkplaceRing[] = []
  const occupantsPerRing: number[] = []
  let remaining = oldestFirst.length + 1
  while (remaining > 0) {
    const ring = rings.length + 1
    const capacity = ringCapacity(ring, bandDepth, workDepth)
    const occupied = Math.min(capacity, remaining)
    rings.push({ ring, ...ringBounds(ring, bandDepth), capacity })
    occupantsPerRing.push(occupied)
    remaining -= occupied
  }
  const executive: ExecutiveWorkspacePlacement = {
    id: 'executive-workspace', ...placement(1, 0, occupantsPerRing[0] ?? 1, 'executive-workspace', 1, bandDepth),
  }
  const offices: DepartmentOfficePlacement[] = []
  // Slot zero belongs to the existing CEO workspace, including before any plan
  // is approved. It consumes space without creating a department/roster record.
  let ring = 1, slot = 1
  for (const department of oldestFirst) {
    if (slot >= (occupantsPerRing[ring - 1] ?? 1)) { ring += 1; slot = 0 }
    offices.push({ ...department, ...placement(ring, slot, occupantsPerRing[ring - 1] ?? 1, department.id, department.agents?.length ?? 0, bandDepth, departmentDeskLayout(department.agents?.length ?? 0).depth) })
    slot += 1
  }
  // Office anchors, band radii and the island/camera envelope stay exactly at
  // their pre-organic values. Only each local floor silhouette changes.
  const layerCount = rings.length
  return {
    executive, offices, layerCount, rings,
    floorRadius: rings[rings.length - 1]!.outerRadius + 0.8,
    sharedFloorInnerRadius: SHARED_FLOOR_INNER_RADIUS,
  }
}
