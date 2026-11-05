/** Local office geometry only: X/Z horizontal, Y up, entrance toward -Z. */
export interface OfficeArchitectureGeometry { positions: number[]; normals: number[] }
export type OfficeArchitectureVector = [number, number, number]
export interface OfficeArchitectureBounds { min: OfficeArchitectureVector; max: OfficeArchitectureVector }
export interface OfficeExecutiveHitRegions { desk: OfficeArchitectureBounds; board: OfficeArchitectureBounds }
export interface OfficeFurnitureGeometry {
  body: OfficeArchitectureGeometry
  top: OfficeArchitectureGeometry
  metal: OfficeArchitectureGeometry
  screen: OfficeArchitectureGeometry
  light: OfficeArchitectureGeometry
  details: OfficeArchitectureGeometry
}
export interface OfficeArchitecture {
  foundation: OfficeArchitectureGeometry
  rim: OfficeArchitectureGeometry
  walls: OfficeArchitectureGeometry
  wallTrim: OfficeArchitectureGeometry
  floorInset: OfficeArchitectureGeometry
  executive: OfficeFurnitureGeometry
  department: OfficeFurnitureGeometry
  furnishings: { body: OfficeArchitectureGeometry; metal: OfficeArchitectureGeometry; leaves: OfficeArchitectureGeometry; light: OfficeArchitectureGeometry; shade: OfficeArchitectureGeometry }
  /** Local bulb center, shared by the visible fixture and analytic room light. */
  standingLightPosition: OfficeArchitectureVector
  executiveHitRegions: OfficeExecutiveHitRegions
}

const DEFAULT_WIDTH = 6.2
const DEFAULT_DEPTH = 5.2
const EXECUTIVE_DESK_WIDTH = 2.35
const EXECUTIVE_DESK_DEPTH = 0.92
const EXECUTIVE_DESK_TOP = 0.76
const EXECUTIVE_BOARD_WIDTH = 2.32
const EXECUTIVE_BOARD_BOTTOM = 0.78
const EXECUTIVE_BOARD_HEIGHT = 1.04
const materialKeys = ['body', 'top', 'metal', 'screen', 'light', 'details'] as const
type Vector = OfficeArchitectureVector
type Geometry = OfficeArchitectureGeometry

function empty(): Geometry { return { positions: [], normals: [] } }
function furniture(): OfficeFurnitureGeometry { return { body: empty(), top: empty(), metal: empty(), screen: empty(), light: empty(), details: empty() } }
function append(target: Geometry, ...parts: Geometry[]) {
  for (const part of parts) {
    for (const value of part.positions) target.positions.push(value)
    for (const value of part.normals) target.normals.push(value)
  }
}
function normalized(vector: Vector): Vector {
  const length = Math.hypot(...vector) || 1
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}
function vertex(target: Geometry, point: Vector, normal: Vector) { target.positions.push(...point); target.normals.push(...normal) }
function triangle(target: Geometry, a: Vector, b: Vector, c: Vector, normal?: Vector) {
  const ab: Vector = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac: Vector = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const face = normal ?? normalized([ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]])
  vertex(target, a, face); vertex(target, b, face); vertex(target, c, face)
}
function quad(target: Geometry, a: Vector, b: Vector, c: Vector, d: Vector, normal?: Vector) {
  triangle(target, a, b, c, normal); triangle(target, a, c, d, normal)
}
function box(width: number, height: number, depth: number, x = 0, bottom = 0, z = 0): Geometry {
  const result = empty(), left = x - width / 2, right = x + width / 2, front = z - depth / 2, back = z + depth / 2, top = bottom + height
  quad(result, [left, bottom, back], [right, bottom, back], [right, top, back], [left, top, back], [0, 0, 1])
  quad(result, [right, bottom, front], [left, bottom, front], [left, top, front], [right, top, front], [0, 0, -1])
  quad(result, [right, bottom, back], [right, bottom, front], [right, top, front], [right, top, back], [1, 0, 0])
  quad(result, [left, bottom, front], [left, bottom, back], [left, top, back], [left, top, front], [-1, 0, 0])
  quad(result, [left, top, front], [left, top, back], [right, top, back], [right, top, front], [0, 1, 0])
  quad(result, [left, bottom, back], [left, bottom, front], [right, bottom, front], [right, bottom, back], [0, -1, 0])
  return result
}
function roundedLoop(width: number, depth: number, radius: number, segments: number): [number, number][] {
  const halfWidth = width / 2, halfDepth = depth / 2, r = Math.min(radius, halfWidth, halfDepth)
  const corners = [[halfWidth - r, halfDepth - r], [-halfWidth + r, halfDepth - r], [-halfWidth + r, -halfDepth + r], [halfWidth - r, -halfDepth + r]] as const
  const points: [number, number][] = []
  for (let corner = 0; corner < 4; corner++) for (let step = 0; step <= segments; step++) {
    const angle = (corner + step / segments) * Math.PI / 2, center = corners[corner]!
    points.push([center[0] + Math.cos(angle) * r, center[1] + Math.sin(angle) * r])
  }
  return points
}
function roundedBox(width: number, depth: number, bottom: number, top: number, radius: number, bevel: number, x = 0, z = 0, segments = 5): Geometry {
  const result = empty(), edge = Math.min(bevel, (top - bottom) * 0.35, radius * 0.7)
  const layers = [
    { y: bottom, inset: edge }, { y: bottom + edge, inset: 0 },
    { y: top - edge, inset: 0 }, { y: top, inset: edge },
  ].map(layer => ({ y: layer.y, points: roundedLoop(width - layer.inset * 2, depth - layer.inset * 2, Math.max(0.001, radius - layer.inset), segments) }))
  for (let layer = 0; layer < layers.length - 1; layer++) {
    const low = layers[layer]!, high = layers[layer + 1]!
    for (let index = 0; index < low.points.length; index++) {
      const next = (index + 1) % low.points.length, a = low.points[index]!, b = high.points[index]!, c = high.points[next]!, d = low.points[next]!
      quad(result, [a[0] + x, low.y, a[1] + z], [b[0] + x, high.y, b[1] + z], [c[0] + x, high.y, c[1] + z], [d[0] + x, low.y, d[1] + z])
    }
  }
  for (const [layer, up] of [[layers[0]!, false], [layers[layers.length - 1]!, true]] as const) {
    for (let index = 0; index < layer.points.length; index++) {
      const a = layer.points[index]!, b = layer.points[(index + 1) % layer.points.length]!
      const first: Vector = [a[0] + x, layer.y, a[1] + z], second: Vector = [b[0] + x, layer.y, b[1] + z]
      triangle(result, [x, layer.y, z], up ? second : first, up ? first : second, up ? [0, 1, 0] : [0, -1, 0])
    }
  }
  return result
}
function border(width: number, depth: number, radius: number, thickness: number, bottom: number, height: number): Geometry {
  const result = empty(), outer = roundedLoop(width, depth, radius, 6), inner = roundedLoop(width - thickness * 2, depth - thickness * 2, radius - thickness, 6)
  for (let index = 0; index < outer.length; index++) {
    const next = (index + 1) % outer.length, a = outer[index]!, b = outer[next]!, c = inner[next]!, d = inner[index]!
    quad(result, [a[0], bottom + height, a[1]], [d[0], bottom + height, d[1]], [c[0], bottom + height, c[1]], [b[0], bottom + height, b[1]], [0, 1, 0])
    quad(result, [a[0], bottom, a[1]], [a[0], bottom + height, a[1]], [b[0], bottom + height, b[1]], [b[0], bottom, b[1]])
    quad(result, [d[0], bottom, d[1]], [c[0], bottom, c[1]], [c[0], bottom + height, c[1]], [d[0], bottom + height, d[1]])
  }
  return result
}
function cylinder(bottomRadius: number, topRadius: number, bottom: number, top: number, x = 0, z = 0, segments = 16): Geometry {
  const result = empty(), slope = (bottomRadius - topRadius) / (top - bottom)
  for (let index = 0; index < segments; index++) {
    const a = index * Math.PI * 2 / segments, b = (index + 1) * Math.PI * 2 / segments
    const lowA: Vector = [x + Math.cos(a) * bottomRadius, bottom, z + Math.sin(a) * bottomRadius], lowB: Vector = [x + Math.cos(b) * bottomRadius, bottom, z + Math.sin(b) * bottomRadius]
    const highA: Vector = [x + Math.cos(a) * topRadius, top, z + Math.sin(a) * topRadius], highB: Vector = [x + Math.cos(b) * topRadius, top, z + Math.sin(b) * topRadius]
    const normalA = normalized([Math.cos(a), slope, Math.sin(a)]), normalB = normalized([Math.cos(b), slope, Math.sin(b)])
    vertex(result, lowA, normalA); vertex(result, highA, normalA); vertex(result, lowB, normalB)
    vertex(result, highA, normalA); vertex(result, highB, normalB); vertex(result, lowB, normalB)
    triangle(result, [x, top, z], highB, highA, [0, 1, 0]); triangle(result, [x, bottom, z], lowA, lowB, [0, -1, 0])
  }
  return result
}
function ellipsoid(rx: number, ry: number, rz: number, columns = 12, rows = 8): Geometry {
  const result = empty()
  function point(column: number, row: number) {
    const longitude = column / columns * Math.PI * 2, latitude = row / rows * Math.PI
    const direction: Vector = [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)]
    vertex(result, [direction[0] * rx, direction[1] * ry, direction[2] * rz], normalized([direction[0] / rx, direction[1] / ry, direction[2] / rz]))
  }
  for (let column = 0; column < columns; column++) for (let row = 0; row < rows; row++) {
    point(column, row); point(column + 1, row); point(column, row + 1)
    point(column + 1, row); point(column + 1, row + 1); point(column, row + 1)
  }
  return result
}
function transformed(source: Geometry, x = 0, y = 0, z = 0, yaw = 0, tilt = 0): Geometry {
  const result = empty(), cosine = Math.cos(yaw), sine = Math.sin(yaw), verticalCosine = Math.cos(tilt), verticalSine = Math.sin(tilt)
  for (let index = 0; index < source.positions.length; index += 3) {
    const px = source.positions[index]!, py = source.positions[index + 1]!, pz = source.positions[index + 2]!
    const tiltedY = verticalCosine * py - verticalSine * pz, tiltedZ = verticalSine * py + verticalCosine * pz
    result.positions.push(x + cosine * px + sine * tiltedZ, y + tiltedY, z - sine * px + cosine * tiltedZ)
    const nx = source.normals[index]!, ny = source.normals[index + 1]!, nz = source.normals[index + 2]!
    const normalY = verticalCosine * ny - verticalSine * nz, normalZ = verticalSine * ny + verticalCosine * nz
    result.normals.push(cosine * nx + sine * normalZ, normalY, -sine * nx + cosine * normalZ)
  }
  return result
}
function uprightPanel(width: number, height: number, thickness: number, x: number, bottom: number, z: number, radius = 0.06): Geometry {
  return transformed(roundedBox(width, height, -thickness / 2, thickness / 2, radius, Math.min(0.012, thickness / 4), 0, 0, 3), x, bottom + height / 2, z, 0, Math.PI / 2)
}
function addFurniture(target: OfficeFurnitureGeometry, source: OfficeFurnitureGeometry, x: number, z: number, yaw = 0) {
  for (const key of materialKeys) append(target[key], transformed(source[key], x, 0, z, yaw))
}
function chair(target: OfficeFurnitureGeometry, z: number, executive: boolean) {
  const width = executive ? 0.68 : 0.58, depth = executive ? 0.60 : 0.54
  append(target.body, roundedBox(width, depth, 0.43, 0.53, 0.085, 0.025, 0, z, 3), uprightPanel(width - 0.04, executive ? 0.70 : 0.59, 0.11, 0, 0.56, z + depth / 2 - 0.06, 0.09))
  append(target.metal, cylinder(0.035, 0.035, 0.10, 0.44, 0, z, 12))
  for (let spoke = 0; spoke < 5; spoke++) {
    const angle = spoke * Math.PI * 2 / 5
    append(target.metal, transformed(box(0.045, 0.035, 0.31, 0, 0.085, 0.13), 0, 0, z, angle))
    append(target.body, transformed(box(0.08, 0.055, 0.07, 0, 0.025), Math.sin(angle) * 0.28, 0, z + Math.cos(angle) * 0.28))
  }
  for (const side of [-1, 1]) {
    append(target.metal, box(0.035, 0.22, 0.045, side * (width / 2 + 0.015), 0.49, z + 0.025))
    append(target.body, roundedBox(0.085, 0.36, 0.70, 0.75, 0.035, 0.012, side * (width / 2 + 0.015), z + 0.025, 2))
  }
}
function workstation(executive = false): OfficeFurnitureGeometry {
  const result = furniture(), width = executive ? EXECUTIVE_DESK_WIDTH : 1.45, depth = executive ? EXECUTIVE_DESK_DEPTH : 0.65, top = executive ? EXECUTIVE_DESK_TOP : 0.72
  append(result.top, roundedBox(width, depth, top - 0.065, top, 0.075, 0.018))
  append(result.body, box(width - 0.24, 0.22, 0.045, 0, top - 0.29, -depth / 2 + 0.06))
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) append(result.metal, box(0.045, top - 0.08, 0.045, side * (width / 2 - 0.12), 0.015, end * (depth / 2 - 0.10)))
    append(result.metal, box(0.065, 0.035, depth - 0.09, side * (width / 2 - 0.12), 0.015), box(0.065, 0.025, depth - 0.09, side * (width / 2 - 0.12), top - 0.09))
  }
  const screenWidth = executive ? 0.82 : 0.67, screenHeight = executive ? 0.48 : 0.40, screenZ = -depth * 0.16, screenBottom = top + 0.13
  append(result.metal, roundedBox(0.30, 0.18, top, top + 0.02, 0.035, 0.005, 0, screenZ), box(0.045, 0.15, 0.04, 0, top + 0.015, screenZ))
  append(result.body, uprightPanel(screenWidth, screenHeight, 0.055, 0, screenBottom, screenZ, 0.035))
  append(result.screen, uprightPanel(screenWidth - 0.065, screenHeight - 0.065, 0.008, 0, screenBottom + 0.032, screenZ + 0.032, 0.022))
  append(result.light, box(0.11, 0.008, 0.008, 0.0, screenBottom + 0.014, screenZ + 0.033))
  const keyboardZ = depth * 0.28
  append(result.body, roundedBox(0.44, 0.15, top + 0.005, top + 0.025, 0.025, 0.005, -0.045, keyboardZ, 2))
  for (let row = 0; row < 3; row++) append(result.details, box(0.34, 0.004, 0.008, -0.045, top + 0.026, keyboardZ - 0.045 + row * 0.035))
  append(result.body, transformed(ellipsoid(0.032, 0.018, 0.05, 8, 4), 0.29, top + 0.019, keyboardZ))
  if (executive) {
    append(result.body, roundedBox(0.30, 0.57, 0.03, top - 0.10, 0.04, 0.012, -width / 2 + 0.31, 0.04))
    append(result.details, roundedBox(0.30, 0.35, top + 0.004, top + 0.012, 0.018, 0.002, 0.71, 0.04))
    append(result.light, box(1.65, 0.012, 0.018, 0.15, top - 0.080, -depth / 2 + 0.02))
  }
  chair(result, executive ? 0.94 : 0.81, executive)
  return result
}
function roomDimensions(width: number, depth: number): [number, number] {
  // The shared layout supplies finite dimensions. Invalid numerical inputs use
  // the documented default, rather than generating nonfinite vertex buffers.
  return [Number.isFinite(width) && width > 0 ? width : DEFAULT_WIDTH, Number.isFinite(depth) && depth > 0 ? depth : DEFAULT_DEPTH]
}
function executivePlacement(depth: number) {
  return { deskZ: Math.min(0.35, depth / 2 - 1.86), boardZ: depth / 2 - 0.255 }
}

/** Same local finished-floor bounds used by the generated executive furniture. */
export function officeExecutiveHitRegions(width = DEFAULT_WIDTH, depth = DEFAULT_DEPTH): OfficeExecutiveHitRegions {
  const [, roomDepth] = roomDimensions(width, depth), { deskZ, boardZ } = executivePlacement(roomDepth)
  return {
    desk: { min: [-EXECUTIVE_DESK_WIDTH / 2, EXECUTIVE_DESK_TOP - 0.065, deskZ - EXECUTIVE_DESK_DEPTH / 2], max: [EXECUTIVE_DESK_WIDTH / 2, EXECUTIVE_DESK_TOP, deskZ + EXECUTIVE_DESK_DEPTH / 2] },
    board: { min: [-EXECUTIVE_BOARD_WIDTH / 2, EXECUTIVE_BOARD_BOTTOM, boardZ - 0.061], max: [EXECUTIVE_BOARD_WIDTH / 2, EXECUTIVE_BOARD_BOTTOM + EXECUTIVE_BOARD_HEIGHT, boardZ + 0.04] },
  }
}

/**
 * Material batches are intentionally color-free. The renderer assigns canonical
 * charcoal/graphite, silver, navy and restrained Gold roles and meshes each
 * batch once. Width 6.2/depth 5.2 provide a 1.45-unit central approach aisle
 * and room to pass behind the outer chairs instead of widening the benches.
 * fixed furniture needs width >=5.1 to retain at least 0.95 units of clearance.
 */
export function createOfficeArchitecture(width = DEFAULT_WIDTH, depth = DEFAULT_DEPTH): OfficeArchitecture {
  const [roomWidth, roomDepth] = roomDimensions(width, depth), halfWidth = roomWidth / 2, halfDepth = roomDepth / 2
  const foundation = roundedBox(roomWidth, roomDepth, 0, 0.14, 0.22, 0.035)
  const rim = border(roomWidth - 0.12, roomDepth - 0.12, 0.18, 0.023, 0.008, 0.018)
  const floorInset = roundedBox(roomWidth - 0.38, roomDepth - 0.34, 0.002, 0.012, 0.15, 0.003)
  const walls = empty(), wallTrim = empty(), executive = furniture(), department = furniture()
  const furnishings = { body: empty(), metal: empty(), leaves: empty(), light: empty(), shade: empty() }
  // Enclosing room walls are deliberately empty. Neighbouring workplaces share
  // only the radial concrete/glass dividers generated for the circular floor.

  const executivePose = executivePlacement(roomDepth)
  addFurniture(executive, workstation(true), 0, executivePose.deskZ)
  append(executive.body, uprightPanel(EXECUTIVE_BOARD_WIDTH, EXECUTIVE_BOARD_HEIGHT, 0.08, 0, EXECUTIVE_BOARD_BOTTOM, executivePose.boardZ, 0.05))
  // The CEO's plan board stands on its own instead of relying on a rear wall.
  for (const side of [-1, 1]) append(executive.metal,
    box(0.05, EXECUTIVE_BOARD_BOTTOM + 0.035, 0.065, side * 0.91, 0.035, executivePose.boardZ),
    roundedBox(0.28, 0.36, 0.015, 0.055, 0.04, 0.01, side * 0.91, executivePose.boardZ, 3))
  append(executive.screen, uprightPanel(2.20, 0.92, 0.012, 0, 0.84, executivePose.boardZ - 0.047, 0.035))
  // A quiet plan-board diagram is geometric presentation, never an invented
  // task, approval, employee, document text or operational state.
  append(executive.details, box(1.62, 0.025, 0.008, -0.10, 1.58, executivePose.boardZ - 0.057), box(0.84, 0.018, 0.008, -0.49, 1.43, executivePose.boardZ - 0.057))
  for (const x of [-0.69, 0, 0.69]) append(executive.details, uprightPanel(0.48, 0.30, 0.008, x, 0.96, executivePose.boardZ - 0.057, 0.018))
  append(executive.light, box(2.18, 0.016, 0.012, 0, 1.79, executivePose.boardZ - 0.045))
  for (const side of [-1, 1]) append(executive.light, box(0.016, 0.93, 0.012, side * 1.13, 0.835, executivePose.boardZ - 0.045))

  const station = workstation(), bayX = Math.min(1.05, halfWidth - 1.75), seatZ = Math.min(0.82, halfDepth - 1.45)
  // Inner desk edges are X=±0.725 (1.45 clear). Fixed bench centers leave
  // about 0.9 behind chairs at the default width, plus a wide front cross aisle.
  for (const side of [-1, 1]) for (const row of [-1, 1]) addFurniture(department, station, side * bayX, row * seatZ, side * Math.PI / 2)
  for (const side of [-1, 1]) append(department.metal, box(0.045, 0.04, seatZ * 2 + 1.20, side * bayX, 0.61))

  const cabinetX = -(halfWidth - 0.83), cabinetZ = halfDepth - 0.46
  append(furnishings.body, roundedBox(1.12, 0.38, 0.025, 0.59, 0.045, 0.015, cabinetX, cabinetZ))
  append(furnishings.metal, box(1.05, 0.022, 0.36, cabinetX, 0.59, cabinetZ), box(0.012, 0.45, 0.012, cabinetX, 0.075, cabinetZ - 0.196))
  for (const side of [-1, 1]) append(furnishings.metal, box(0.12, 0.018, 0.018, cabinetX + side * 0.24, 0.39, cabinetZ - 0.201))
  // Cabinet remains freestanding; the former wall-mounted shelves are removed.
  // Rear-right perimeter fixture leaves the middle/front/outer-chair aisles
  // untouched. Its 1.815 height stays inside the existing 1.9 room hit volume.
  const lampX = halfWidth - 0.55, lampZ = halfDepth - 0.66
  const standingLightPosition: Vector = [lampX, 1.50, lampZ]
  append(furnishings.metal,
    cylinder(0.23, 0.21, 0.016, 0.065, lampX, lampZ, 24),
    cylinder(0.024, 0.024, 0.055, 1.55, lampX, lampZ, 12),
    cylinder(0.19, 0.19, 1.795, 1.815, lampX, lampZ, 24))
  append(furnishings.shade, cylinder(0.30, 0.19, 1.535, 1.80, lampX, lampZ, 24))
  append(furnishings.light,
    cylinder(0.304, 0.304, 1.513, 1.535, lampX, lampZ, 24),
    transformed(ellipsoid(0.095, 0.075, 0.095, 12, 8), lampX, standingLightPosition[1], lampZ))
  const leaf = ellipsoid(0.09, 0.29, 0.13, 10, 6)
  for (const side of [-1, 1]) {
    const plantX = side * (halfWidth - 0.55), plantZ = -halfDepth + 0.55
    append(furnishings.body, cylinder(0.17, 0.22, 0.015, 0.33, plantX, plantZ), cylinder(0.018, 0.018, 0.32, 0.68, plantX, plantZ, 10))
    append(furnishings.metal, cylinder(0.225, 0.225, 0.30, 0.325, plantX, plantZ))
    for (let petal = 0; petal < 5; petal++) {
      const angle = petal * Math.PI * 2 / 5
      append(furnishings.leaves, transformed(leaf, plantX + Math.sin(angle) * 0.12, 0.64 + (petal % 2) * 0.05, plantZ + Math.cos(angle) * 0.12, angle, 0.43))
    }
  }
  return { foundation, rim, walls, wallTrim, floorInset, executive, department, furnishings, standingLightPosition, executiveHitRegions: officeExecutiveHitRegions(roomWidth, roomDepth) }
}
