import type { DepartmentOfficeLayout, OfficePlacement } from './departmentOfficeLayout.ts'
import type { OfficeArchitectureGeometry, OfficeArchitectureVector } from './officeArchitecture.ts'

/** World-space material batches for the shared workplace floor and dividers. */
export interface CircularWorkplaceGeometry {
  floor: OfficeArchitectureGeometry
  edge: OfficeArchitectureGeometry
  concrete: OfficeArchitectureGeometry
  glass: OfficeArchitectureGeometry
  frames: OfficeArchitectureGeometry
}

type Geometry = OfficeArchitectureGeometry
type Vector = OfficeArchitectureVector
const FULL_TURN = Math.PI * 2
const FLOOR_THICKNESS = 0.14
const DIVIDER_HEIGHT = 1.9
const CONCRETE_HEIGHT = DIVIDER_HEIGHT / 2
const ANGLE_EPSILON = 0.000001

function empty(): Geometry { return { positions: [], normals: [] } }
function vertex(target: Geometry, point: Vector, normal: Vector) {
  target.positions.push(...point); target.normals.push(...normal)
}
function quad(target: Geometry, a: Vector, b: Vector, c: Vector, d: Vector, normal: Vector) {
  for (const point of [a, b, c, a, c, d]) vertex(target, point, normal)
}
function radialPoint(radius: number, angle: number, y: number): Vector {
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
}

/** Smooth annular floor with real inner/outer edges and a closed underside. */
function annulus(target: Geometry, inner: number, outer: number, bottom: number, top: number, segments = 384) {
  if (!(outer > inner && inner >= 0 && top >= bottom)) return
  for (let index = 0; index < segments; index++) {
    const a = index * FULL_TURN / segments, b = (index + 1) * FULL_TURN / segments
    const innerA = radialPoint(inner, a, top), innerB = radialPoint(inner, b, top)
    const outerA = radialPoint(outer, a, top), outerB = radialPoint(outer, b, top)
    quad(target, innerA, innerB, outerB, outerA, [0, 1, 0])
    quad(target, radialPoint(inner, a, bottom), radialPoint(outer, a, bottom), radialPoint(outer, b, bottom), radialPoint(inner, b, bottom), [0, -1, 0])
    // Smooth normals prevent a faceted outline when viewing the floor close up.
    const outsideA: Vector = [Math.cos(a), 0, Math.sin(a)], outsideB: Vector = [Math.cos(b), 0, Math.sin(b)]
    for (const [radius, direction] of [[outer, 1], [inner, -1]] as const) {
      const lowA = radialPoint(radius, a, bottom), lowB = radialPoint(radius, b, bottom)
      const highA = radialPoint(radius, a, top), highB = radialPoint(radius, b, top)
      const normalA: Vector = [outsideA[0] * direction, 0, outsideA[2] * direction]
      const normalB: Vector = [outsideB[0] * direction, 0, outsideB[2] * direction]
      const vertices = direction === 1
        ? [[lowA, normalA], [highA, normalA], [lowB, normalB], [highA, normalA], [highB, normalB], [lowB, normalB]] as const
        : [[lowA, normalA], [lowB, normalB], [highA, normalA], [highA, normalA], [lowB, normalB], [highB, normalB]] as const
      for (const [point, normal] of vertices) vertex(target, point, normal)
    }
  }
}

/** Radial rectangular prism; along-radius is X and across-divider is Z. */
function radialBox(target: Geometry, angle: number, inner: number, outer: number, bottom: number, height: number, thickness: number) {
  const c = Math.cos(angle), s = Math.sin(angle), half = thickness / 2, top = bottom + height
  const point = (radius: number, y: number, lateral: number): Vector => [c * radius - s * lateral, y, s * radius + c * lateral]
  quad(target, point(inner, bottom, half), point(outer, bottom, half), point(outer, top, half), point(inner, top, half), [-s, 0, c])
  quad(target, point(outer, bottom, -half), point(inner, bottom, -half), point(inner, top, -half), point(outer, top, -half), [s, 0, -c])
  quad(target, point(outer, bottom, half), point(outer, bottom, -half), point(outer, top, -half), point(outer, top, half), [c, 0, s])
  quad(target, point(inner, bottom, -half), point(inner, bottom, half), point(inner, top, half), point(inner, top, -half), [-c, 0, -s])
  quad(target, point(inner, top, -half), point(inner, top, half), point(outer, top, half), point(outer, top, -half), [0, 1, 0])
  quad(target, point(inner, bottom, half), point(inner, bottom, -half), point(outer, bottom, -half), point(outer, bottom, half), [0, -1, 0])
}
function sameAngle(a: number, b: number): boolean {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < ANGLE_EPSILON
}

/**
 * One continuous annular floor, with a divider only at a boundary shared by
 * two occupied sectors. Empty slots never acquire an enclosing wall. floorY
 * is the finished floor elevation; furniture uses this same Y as its origin.
 * The transparent glass batch must be drawn after opaque room furniture.
 */
export function createCircularWorkplaceGeometry(layout: DepartmentOfficeLayout, floorY = 0): CircularWorkplaceGeometry {
  const result: CircularWorkplaceGeometry = { floor: empty(), edge: empty(), concrete: empty(), glass: empty(), frames: empty() }
  const outerRadius = Math.max(layout.sharedFloorInnerRadius, ...layout.rings.map(ring => ring.outerRadius))
  const innerRadius = layout.sharedFloorInnerRadius
  annulus(result.floor, innerRadius, outerRadius, floorY - FLOOR_THICKNESS, floorY)
  // Thin integrated edge inlays keep the shared circular floor legible without
  // recreating a separate platform or four-sided enclosure for every office.
  annulus(result.edge, innerRadius, innerRadius + 0.025, floorY + 0.001, floorY + 0.009)
  annulus(result.edge, outerRadius - 0.025, outerRadius, floorY + 0.001, floorY + 0.009)

  const offices: readonly OfficePlacement[] = [layout.executive, ...layout.offices]
  for (const ring of layout.rings) {
    const occupied = offices.filter(office => office.ring === ring.ring)
    const emitted: number[] = []
    for (const office of occupied) {
      const angle = office.sector.endAngle
      const neighbour = occupied.find(other => other !== office && sameAngle(angle, other.sector.startAngle))
      if (!neighbour || emitted.some(previous => sameAngle(previous, angle))) continue
      const inner = Math.max(office.sector.innerRadius, neighbour.sector.innerRadius)
      const outer = Math.min(office.sector.outerRadius, neighbour.sector.outerRadius)
      if (!(outer > inner)) continue
      emitted.push(angle)
      radialBox(result.concrete, angle, inner, outer, floorY, CONCRETE_HEIGHT, 0.14)
      radialBox(result.glass, angle, inner + 0.025, outer - 0.025, floorY + CONCRETE_HEIGHT, DIVIDER_HEIGHT - CONCRETE_HEIGHT, 0.035)
      radialBox(result.frames, angle, inner, outer, floorY + CONCRETE_HEIGHT - 0.012, 0.024, 0.15)
      radialBox(result.frames, angle, inner, outer, floorY + DIVIDER_HEIGHT - 0.018, 0.028, 0.055)
      for (const radius of [inner + 0.025, outer - 0.025]) radialBox(result.frames, angle, radius - 0.025, radius + 0.025, floorY + CONCRETE_HEIGHT, DIVIDER_HEIGHT - CONCRETE_HEIGHT, 0.055)
    }
  }
  return result
}
