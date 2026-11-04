import { SPATIAL_VIEWPORT_GROUND_Y, SPATIAL_VIEWPORT_VERTICAL_FOV, spatialViewportFrame } from '@building-suit/ux'
import type { SpatialViewportCamera } from '@building-suit/ux'
import type { HqDepartmentOffice } from '../types/hqLayoutPresentation'
import { DEPARTMENT_OFFICE_DEPTH, DEPARTMENT_OFFICE_WIDTH, departmentOfficeFloorRadius, layoutDepartmentOffices } from './departmentOfficeLayout'
import type { DepartmentRoadPoint, OfficePlacement } from './departmentOfficeLayout'

type Vector = [number, number, number]
type Matrix = Float32Array
const SCENE_FAR = 150
const BASE_RADIUS_SCALE = 1.12
const OFFICE_BUILD_SECONDS = 2.4
const OFFICE_FOUNDATION_HEIGHT = 0.14
const OFFICE_WALL_HEIGHT = 1.15
const EMPTY_DEPARTMENTS: readonly HqDepartmentOffice[] = []
interface Geometry { positions: number[]; normals: number[] }
interface Mesh { position: WebGLBuffer; normal: WebGLBuffer; indices: WebGLBuffer; count: number }
interface OrbProjection { eye: Vector; right: Vector; up: Vector; forward: Vector; center: Vector; radius: number; aspect: number }
interface OfficeRenderEntry {
  placement: OfficePlacement & { id: string }
  roadKey: string
  road: Mesh
  trace: Mesh
  foundationModel: Matrix
  wallModel: Matrix
  completedHeight: number
}

export interface HologramPalette { coal: Vector; charcoal: Vector; graphite: Vector; gold: Vector; steelGray: Vector; silver: Vector; pearl: Vector }
export interface HologramInteraction { open: number; excited: number; opened?: boolean }
export interface HologramLayout { officeLayerCount?: number; departments?: readonly HqDepartmentOffice[]; reducedMotion?: boolean }
export interface HologramOfficeAnchor { x: number; y: number; visible: boolean }
export interface HologramRenderer {
  draw: (camera: Readonly<SpatialViewportCamera>, seconds: number, interaction?: Readonly<HologramInteraction>, layout?: Readonly<HologramLayout>) => void
  hitTestOrb: (clientX: number, clientY: number) => boolean
  hitTestExecutive: (clientX: number, clientY: number) => boolean
  projectOfficeAnchor: (id: string) => HologramOfficeAnchor | null
  projectExecutiveAnchor: () => HologramOfficeAnchor | null
  dispose: () => void
}

const vertexShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProjection * uView * world;
}`

const fragmentShader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uEye;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uMaterial;
uniform vec3 uAccent;
uniform float uSweepY;
uniform float uConstruction;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  if (uMaterial > 5.5 && uMaterial < 6.5) {
    float contact = 1.0 - smoothstep(1.45, 2.45, length(vWorld.xz));
    float distanceShade = clamp(length(vWorld.xz - uEye.xz) / 120.0, 0.0, 1.0);
    gl_FragColor = vec4(uColor * (0.86 - contact * 0.13 + distanceShade * 0.07), 1.0);
    return;
  }
  vec3 normal = normalize(vNormal);
  vec3 view = normalize(uEye - vWorld);
  float facing = abs(dot(normal, view));
  float rim = pow(1.0 - facing, 2.8);
  float diffuse = max(dot(normal, normalize(vec3(-1.5, 3.0, 2.0))), 0.0);
  float specular = pow(max(dot(reflect(-normalize(vec3(-1.5, 3.0, 2.0)), normal), view), 0.0), 42.0);
  vec3 color = uColor * (0.65 + 0.55 * diffuse) + vec3(specular * 0.15 + rim * 0.025);
  float alpha = uOpacity;
  if (uMaterial > 0.5 && uMaterial < 1.5) {
    color = uColor * 0.85 + vec3(specular * 0.18);
    alpha *= 0.06 + rim * 0.4;
  } else if (uMaterial > 1.5 && uMaterial < 2.5) {
    color = uColor;
  } else if (uMaterial > 2.5 && uMaterial < 3.5) {
    float impulse = pow(max(0.0, sin(uTime * 2.6 - vWorld.y * 8.0 - abs(vWorld.x) * 7.0)), 5.0);
    color = uColor * (0.8 + impulse * 0.35);
    alpha *= 0.5 + impulse * 0.5;
  } else if (uMaterial > 3.5 && uMaterial < 4.5) {
    color = uColor * (0.55 + diffuse * 0.4) + rim * uColor * 0.12;
  } else if (uMaterial > 4.5 && uMaterial < 5.5) {
    float orbit = atan(vWorld.z, vWorld.x);
    float ribbon = pow(0.5 + 0.5 * sin(orbit * 3.0 - uTime * 0.9), 5.0);
    color = uColor;
    alpha *= 0.28 + ribbon * 0.72;
  } else if (uMaterial > 6.5) {
    float sweep = 1.0 - smoothstep(0.015, 0.065, abs(vWorld.y - uSweepY));
    color = mix(color, uAccent, sweep * uConstruction * 0.72);
  }
  gl_FragColor = vec4(color, alpha);
}`

function identity(): Matrix { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) }
function model(x = 0, y = 0, z = 0, tilt = 0, turn = 0, spin = 0, scale = 1, result = identity()): Matrix {
  const cx = Math.cos(tilt), sx = Math.sin(tilt), cy = Math.cos(spin), sy = Math.sin(spin), cz = Math.cos(turn), sz = Math.sin(turn)
  result[0] = (cy * cz + sy * sx * sz) * scale; result[1] = cx * sz * scale; result[2] = (-sy * cz + cy * sx * sz) * scale; result[3] = 0
  result[4] = (-cy * sz + sy * sx * cz) * scale; result[5] = cx * cz * scale; result[6] = (sy * sz + cy * sx * cz) * scale; result[7] = 0
  result[8] = sy * cx * scale; result[9] = -sx * scale; result[10] = cy * cx * scale; result[11] = 0
  result[12] = x; result[13] = y; result[14] = z; result[15] = 1
  return result
}
function dot(a: Vector, b: Vector): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function normalize(a: Vector): Vector { const length = Math.hypot(...a) || 1; return [a[0] / length, a[1] / length, a[2] / length] }
function cross(a: Vector, b: Vector): Vector { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
function lookAt(eye: Vector, target: Vector): Matrix {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]])
  const x = normalize(cross([0, 1, 0], z)), y = cross(z, x)
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1])
}
function perspective(aspect: number, far = SCENE_FAR, near = 0.05): Matrix {
  const f = 1 / Math.tan(SPATIAL_VIEWPORT_VERTICAL_FOV / 2)
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0])
}

function parametric(rows: number, columns: number, point: (u: number, v: number) => Vector, normal: (u: number, v: number) => Vector): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  function vertex(i: number, j: number) {
    const u = i / rows, v = j / columns
    geometry.positions.push(...point(u, v)); geometry.normals.push(...normal(u, v))
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    vertex(i, j); vertex(i + 1, j); vertex(i, j + 1)
    vertex(i + 1, j); vertex(i + 1, j + 1); vertex(i, j + 1)
  }
  return geometry
}
function sphere(radius: number, rows = 64, columns = 40): Geometry {
  const normal = (u: number, v: number): Vector => [Math.sin(v * Math.PI) * Math.cos(u * Math.PI * 2), Math.cos(v * Math.PI), Math.sin(v * Math.PI) * Math.sin(u * Math.PI * 2)]
  return parametric(rows, columns, (u, v) => normal(u, v).map(value => value * radius) as Vector, normal)
}
function torus(radius: number, tube: number, segments = 128, sides = 8): Geometry {
  return parametric(segments, sides, (u, v) => {
    const angle = u * Math.PI * 2, side = v * Math.PI * 2
    return [(radius + tube * Math.cos(side)) * Math.cos(angle), tube * Math.sin(side), (radius + tube * Math.cos(side)) * Math.sin(angle)]
  }, (u, v) => [Math.cos(v * Math.PI * 2) * Math.cos(u * Math.PI * 2), Math.sin(v * Math.PI * 2), Math.cos(v * Math.PI * 2) * Math.sin(u * Math.PI * 2)])
}
function cylinder(bottomRadius: number, topRadius: number, bottom: number, top: number): Geometry {
  const segments = 96
  const geometry = parametric(segments, 1, (u, v) => {
    const radius = bottomRadius + (topRadius - bottomRadius) * v
    return [radius * Math.cos(u * Math.PI * 2), bottom + (top - bottom) * v, radius * Math.sin(u * Math.PI * 2)]
  }, u => normalize([Math.cos(u * Math.PI * 2), (bottomRadius - topRadius) / (top - bottom), Math.sin(u * Math.PI * 2)]))
  for (let i = 0; i < segments; i++) for (const [height, radius, direction] of [[bottom, bottomRadius, -1], [top, topRadius, 1]]) {
    const angle = i * Math.PI * 2 / segments, next = (i + 1) * Math.PI * 2 / segments
    geometry.positions.push(0, height!, 0, radius! * Math.cos(angle), height!, radius! * Math.sin(angle), radius! * Math.cos(next), height!, radius! * Math.sin(next))
    for (let j = 0; j < 3; j++) geometry.normals.push(0, direction!, 0)
  }
  return geometry
}
function groundDisc(): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  const y = SPATIAL_VIEWPORT_GROUND_Y, segments = 160
  for (let index = 0; index < segments; index++) {
    const angle = index / segments * Math.PI * 2, next = (index + 1) / segments * Math.PI * 2
    geometry.positions.push(0, y, 0, Math.cos(next), y, Math.sin(next), Math.cos(angle), y, Math.sin(angle))
    for (let vertex = 0; vertex < 3; vertex++) geometry.normals.push(0, 1, 0)
  }
  return geometry
}
function groundEdge(): Geometry {
  return parametric(160, 1, (u, v) => {
    const angle = u * Math.PI * 2
    return [Math.cos(angle), SPATIAL_VIEWPORT_GROUND_Y - v * 0.10, Math.sin(angle)]
  }, u => [Math.cos(u * Math.PI * 2), 0, Math.sin(u * Math.PI * 2)])
}
/** Finite HQ radius: 4.8 units plus one six-unit band per clamped office layer. */
export function hologramFloorRadius(layers?: number): number {
  return departmentOfficeFloorRadius(layers)
}
function merge(...parts: Geometry[]): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  for (const part of parts) {
    // Avoid spreading entire meshes onto the call stack.
    for (const value of part.positions) geometry.positions.push(value)
    for (const value of part.normals) geometry.normals.push(value)
  }
  return geometry
}
function box(width: number, height: number, depth: number, x = 0, y = 0, z = 0): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  const left = x - width / 2, right = x + width / 2, front = z - depth / 2, back = z + depth / 2, top = y + height
  const faces: { normal: Vector; corners: Vector[] }[] = [
    { normal: [0, 0, 1], corners: [[left, y, back], [right, y, back], [right, top, back], [left, top, back]] },
    { normal: [0, 0, -1], corners: [[right, y, front], [left, y, front], [left, top, front], [right, top, front]] },
    { normal: [1, 0, 0], corners: [[right, y, back], [right, y, front], [right, top, front], [right, top, back]] },
    { normal: [-1, 0, 0], corners: [[left, y, front], [left, y, back], [left, top, back], [left, top, front]] },
    { normal: [0, 1, 0], corners: [[left, top, front], [left, top, back], [right, top, back], [right, top, front]] },
    { normal: [0, -1, 0], corners: [[left, y, back], [left, y, front], [right, y, front], [right, y, back]] },
  ]
  for (const face of faces) for (const index of [0, 1, 2, 0, 2, 3]) {
    geometry.positions.push(...face.corners[index]!); geometry.normals.push(...face.normal)
  }
  return geometry
}
function roadGeometry(points: readonly DepartmentRoadPoint[], width: number, height: number): Geometry {
  const sampled: DepartmentRoadPoint[] = []
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!, end = points[index + 1]!, distance = Math.hypot(end.x - start.x, end.z - start.z)
    if (distance < 0.00001) continue
    const steps = Math.max(1, Math.ceil(distance / 0.22))
    if (!sampled.length) sampled.push(start)
    for (let step = 1; step <= steps; step++) sampled.push({ x: start.x + (end.x - start.x) * step / steps, z: start.z + (end.z - start.z) * step / steps })
  }
  const geometry: Geometry = { positions: [], normals: [] }
  const sides = sampled.map((_point, index): Vector => {
    const before = sampled[Math.max(0, index - 1)]!, after = sampled[Math.min(sampled.length - 1, index + 1)]!
    const tangent = normalize([after.x - before.x, 0, after.z - before.z])
    return [-tangent[2] * width / 2, 0, tangent[0] * width / 2]
  })
  function vertex(index: number, side: number) {
    const point = sampled[index]!, offset = sides[index]!
    geometry.positions.push(point.x + offset[0] * side, height, point.z + offset[2] * side)
    geometry.normals.push(0, 1, 0)
  }
  for (let index = 0; index < sampled.length - 1; index++) {
    vertex(index, -1); vertex(index, 1); vertex(index + 1, -1)
    vertex(index, 1); vertex(index + 1, 1); vertex(index + 1, -1)
  }
  return geometry
}
function constructionStage(age: number, start: number, end: number): number {
  const progress = Math.max(0, Math.min(1, (age - start) / (end - start)))
  return progress * progress * (3 - 2 * progress)
}
function matrixProduct(first: Matrix, second: Matrix): Matrix {
  const result = new Float32Array(16)
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    let value = 0
    for (let index = 0; index < 4; index++) value += first[index * 4 + row]! * second[column * 4 + index]!
    result[column * 4 + row] = value
  }
  return result
}
function tube(path: Vector[], radius: number, sides = 6): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  function vertex(index: number, edge: number) {
    const point = path[index]!, before = path[Math.max(0, index - 1)]!, after = path[Math.min(path.length - 1, index + 1)]!
    const tangent = normalize([after[0] - before[0], after[1] - before[1], after[2] - before[2]])
    const side = normalize(cross(tangent, Math.abs(tangent[1]) > 0.85 ? [1, 0, 0] : [0, 1, 0]))
    const up = cross(tangent, side), angle = edge / sides * Math.PI * 2
    const normal: Vector = [0, 1, 2].map(axis => side[axis]! * Math.cos(angle) + up[axis]! * Math.sin(angle)) as Vector
    geometry.positions.push(point[0] + normal[0] * radius, point[1] + normal[1] * radius, point[2] + normal[2] * radius)
    geometry.normals.push(...normal)
  }
  for (let index = 0; index < path.length - 1; index++) for (let edge = 0; edge < sides; edge++) {
    vertex(index, edge); vertex(index + 1, edge); vertex(index, edge + 1)
    vertex(index + 1, edge); vertex(index + 1, edge + 1); vertex(index, edge + 1)
  }
  return geometry
}
function curve(points: [Vector, Vector, Vector, Vector], steps = 28): Vector[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps, rest = 1 - t
    return [0, 1, 2].map(axis => rest ** 3 * points[0][axis]! + 3 * rest ** 2 * t * points[1][axis]!
      + 3 * rest * t ** 2 * points[2][axis]! + t ** 3 * points[3][axis]!) as Vector
  })
}
interface ShieldFracture {
  body: Geometry
  seam: Geometry
  center: Vector
  direction: Vector
  travel: Vector
  rotation: Vector
  phase: number
}

/** Seeded spherical Voronoi cells give each fragment its own curved polygon. */
function shieldFractures(): ShieldFracture[] {
  let seed = 0x48b712ef
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    return (seed >>> 0) / 4294967296
  }
  const seeds: Vector[] = Array.from({ length: 11 }, (_, index) => {
    const vertical = 1 - 2 * (index + 0.5) / 11
    const angle = index * 2.399963 + (random() - 0.5) * 0.6
    const ring = Math.sqrt(1 - vertical * vertical)
    return normalize([Math.cos(angle) * ring, vertical + (random() - 0.5) * 0.13, Math.sin(angle) * ring])
  })
  return seeds.map((direction, index): ShieldFracture => {
    const corners: Vector[] = []
    const differences = seeds.map(other => [direction[0] - other[0], direction[1] - other[1], direction[2] - other[2]] as Vector)
    for (let first = 0; first < seeds.length; first++) for (let second = first + 1; second < seeds.length; second++) {
      if (first === index || second === index) continue
      const intersection = cross(differences[first]!, differences[second]!)
      if (Math.hypot(...intersection) < 0.00001) continue
      const unit = normalize(intersection)
      for (const sign of [-1, 1]) {
        const candidate = unit.map(value => value * sign) as Vector
        if (differences.some(difference => dot(candidate, difference) < -0.00001)
          || corners.some(corner => dot(corner, candidate) > 0.99999)) continue
        corners.push(candidate)
      }
    }
    const tangent = normalize(cross(Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], direction))
    const upright = cross(direction, tangent)
    corners.sort((left, right) => Math.atan2(dot(left, upright), dot(left, tangent)) - Math.atan2(dot(right, upright), dot(right, tangent)))
    const polygon = corners.map(corner => normalize(corner.map((value, axis) => value * 0.962 + direction[axis]! * 0.038) as Vector))
    const center = direction.map(value => value * 0.69) as Vector
    const body: Geometry = { positions: [], normals: [] }
    const seams: Geometry[] = []
    function vertex(unit: Vector, radius: number, normal: Vector) {
      body.positions.push(unit[0] * radius - center[0], unit[1] * radius - center[1], unit[2] * radius - center[2])
      body.normals.push(...normal)
    }
    function surfaceTriangle(first: Vector, second: Vector, third: Vector) {
      for (const point of [first, second, third]) vertex(point, 0.83, point)
      for (const point of [third, second, first]) vertex(point, 0.797, point.map(value => -value) as Vector)
    }
    const subdivisions = 4
    for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex++) {
      const edgeStart = polygon[edgeIndex]!, edgeEnd = polygon[(edgeIndex + 1) % polygon.length]!
      const point = (u: number, v: number): Vector => normalize([0, 1, 2].map(axis => direction[axis]! * (1 - u - v)
        + edgeStart[axis]! * u + edgeEnd[axis]! * v) as Vector)
      for (let row = 0; row < subdivisions; row++) for (let column = 0; column < subdivisions - row; column++) {
        surfaceTriangle(point(row / subdivisions, column / subdivisions), point((row + 1) / subdivisions, column / subdivisions), point(row / subdivisions, (column + 1) / subdivisions))
        if (row + column < subdivisions - 1) surfaceTriangle(point((row + 1) / subdivisions, column / subdivisions), point((row + 1) / subdivisions, (column + 1) / subdivisions), point(row / subdivisions, (column + 1) / subdivisions))
      }
      const edgePath: Vector[] = []
      for (let step = 0; step <= subdivisions; step++) {
        const amount = step / subdivisions
        edgePath.push(normalize(edgeStart.map((value, axis) => value * (1 - amount) + edgeEnd[axis]! * amount) as Vector))
      }
      for (let step = 0; step < subdivisions; step++) {
        const first = edgePath[step]!, second = edgePath[step + 1]!
        const edgeNormal = normalize(cross([second[0] - first[0], second[1] - first[1], second[2] - first[2]], first))
        vertex(first, 0.83, edgeNormal); vertex(second, 0.83, edgeNormal); vertex(first, 0.797, edgeNormal)
        vertex(second, 0.83, edgeNormal); vertex(second, 0.797, edgeNormal); vertex(first, 0.797, edgeNormal)
      }
      // Selected short seams keep gold scarce and reduce draw geometry.
      if (edgeIndex === index % polygon.length) {
        const seamPath = Array.from({ length: 17 }, (_, step) => {
          const amount = step / 16
          const unit = normalize(edgeStart.map((value, axis) => value * (1 - amount) + edgeEnd[axis]! * amount) as Vector)
          return [unit[0] * 0.834 - center[0], unit[1] * 0.834 - center[1], unit[2] * 0.834 - center[2]] as Vector
        })
        seams.push(tube(seamPath, 0.004))
      }
    }
    return {
      body, seam: merge(...seams), center, direction,
      travel: [direction[0] * (0.77 + random() * 0.25), direction[1] * 0.72 + (direction[1] >= 0 ? 0.45 : -0.45), direction[2] * (0.77 + random() * 0.25)],
      rotation: [(random() - 0.5) * 0.75, (random() - 0.5) * 0.75, (random() - 0.5) * 0.65],
      phase: random() * Math.PI * 2,
    }
  })
}
function brainPoint(side: number, u: number, v: number): Vector {
  const azimuth = u * Math.PI * 2, polar = v * Math.PI
  const fold = 1 + Math.sin(azimuth * 8 + Math.sin(polar * 6) * 0.8) * Math.sin(polar) ** 1.3 * 0.045
    + Math.sin(polar * 15 + azimuth * 2) * Math.sin(polar) * 0.018
  return [side * 0.22 + Math.sin(polar) * Math.cos(azimuth) * 0.20 * fold,
    Math.cos(polar) * 0.33 * fold, Math.sin(polar) * Math.sin(azimuth) * 0.40 * fold]
}
function brainLobe(side: number): Geometry {
  return parametric(28, 20, (u, v) => brainPoint(side, u, v), (u, v) => {
    const safeV = Math.max(0.0001, Math.min(0.9998, v)), point = brainPoint(side, u, safeV)
    const nextU = brainPoint(side, u + 0.0001, safeV), nextV = brainPoint(side, u, safeV + 0.0001)
    return normalize(cross([nextU[0] - point[0], nextU[1] - point[1], nextU[2] - point[2]], [nextV[0] - point[0], nextV[1] - point[1], nextV[2] - point[2]]))
  })
}
function brainFolds(): Geometry {
  const folds: Geometry[] = []
  for (const side of [-1, 1]) for (let index = 0; index < 5; index++) {
    const path = Array.from({ length: 32 }, (_, step) => {
      const v = 0.09 + step / 31 * 0.80, u = index / 5 + Math.sin(v * 14 + index * 1.7) * 0.025
      const point = brainPoint(side, u, v)
      return [point[0] + (point[0] - side * 0.22) * 0.015, point[1] * 1.015, point[2] * 1.015] as Vector
    })
    folds.push(tube(path, 0.005))
  }
  return merge(...folds)
}
function brainNerves(): Geometry {
  const paths: [Vector, Vector, Vector, Vector][] = [
    [[0.025, -0.28, 0.12], [0.08, -0.16, 0.30], [0.18, -0.04, 0.39], [0.25, 0.08, 0.37]],
    [[0.16, -0.065, 0.37], [0.14, 0.05, 0.40], [0.13, 0.16, 0.35], [0.18, 0.27, 0.22]],
    [[0.24, 0.055, 0.37], [0.31, 0.11, 0.33], [0.35, 0.17, 0.25], [0.34, 0.24, 0.12]],
    [[0.10, -0.14, 0.31], [0.21, -0.17, 0.36], [0.32, -0.12, 0.31], [0.39, -0.06, 0.18]],
    [[0.31, -0.12, 0.31], [0.34, -0.04, 0.28], [0.39, 0.02, 0.19], [0.41, 0.08, 0.04]],
  ]
  const nerves: Geometry[] = []
  for (const side of [-1, 1]) for (const facing of [-1, 1]) for (const points of paths) {
    const mirrored = points.map(point => [point[0] * side, point[1], point[2] * facing] as Vector) as [Vector, Vector, Vector, Vector]
    nerves.push(tube(curve(mirrored), 0.004))
  }
  return merge(...nerves)
}

/** Pure presentation renderer: local geometry, no network, assets or product state. */
export function createHologramRenderer(canvas: HTMLCanvasElement, palette: HologramPalette): HologramRenderer | null {
  let context: WebGLRenderingContext | null
  try { context = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'low-power' }) }
  catch { return null }
  const gl = context
  if (!gl) return null
  const shaders: WebGLShader[] = [], buffers: WebGLBuffer[] = []
  let program: WebGLProgram | null = null
  try {
    function compile(kind: number, source: string) {
      const shader = gl!.createShader(kind)
      if (!shader) throw new Error('Hologram shader unavailable')
      shaders.push(shader); gl!.shaderSource(shader, source); gl!.compileShader(shader)
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw new Error('Hologram shader unavailable')
      return shader
    }
    program = gl.createProgram()
    if (!program) throw new Error('Hologram renderer unavailable')
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Hologram renderer unavailable')
    gl.useProgram(program)
    const position = gl.getAttribLocation(program, 'aPosition'), normal = gl.getAttribLocation(program, 'aNormal')
    const uniforms = Object.fromEntries(['uProjection', 'uView', 'uModel', 'uEye', 'uColor', 'uOpacity', 'uTime', 'uMaterial', 'uAccent', 'uSweepY', 'uConstruction'].map(name => [name, gl.getUniformLocation(program!, name)]))
    const mesh = (data: Geometry): Mesh => {
      const vertices: number[] = [], directions: number[] = [], indices: number[] = []
      const unique = new Map<string, number>()
      for (let offset = 0; offset < data.positions.length; offset += 3) {
        const values = [data.positions[offset]!, data.positions[offset + 1]!, data.positions[offset + 2]!, data.normals[offset]!, data.normals[offset + 1]!, data.normals[offset + 2]!]
        const key = values.map(value => value.toFixed(5)).join(',')
        let index = unique.get(key)
        if (index === undefined) {
          index = vertices.length / 3
          if (index >= 65_536) throw new Error('Hologram geometry budget exceeded')
          unique.set(key, index)
          vertices.push(values[0]!, values[1]!, values[2]!); directions.push(values[3]!, values[4]!, values[5]!)
        }
        indices.push(index)
      }
      function buffer(values: number[], target: number, indexed = false) {
        const result = gl!.createBuffer()
        if (!result) throw new Error('Hologram geometry unavailable')
        buffers.push(result); gl!.bindBuffer(target, result)
        gl!.bufferData(target, indexed ? new Uint16Array(values) : new Float32Array(values), gl!.STATIC_DRAW)
        return result
      }
      return { position: buffer(vertices, gl.ARRAY_BUFFER), normal: buffer(directions, gl.ARRAY_BUFFER), indices: buffer(indices, gl.ELEMENT_ARRAY_BUFFER, true), count: indices.length }
    }
    const plates = shieldFractures().map(plate => ({ ...plate, body: mesh(plate.body), seam: mesh(plate.seam), transform: identity() }))
    const geometry = {
      ground: mesh(groundDisc()),
      groundEdge: mesh(groundEdge()),
      base: mesh(cylinder(1.53 * BASE_RADIUS_SCALE, 1.53 * BASE_RADIUS_SCALE, -0.65, -0.47)),
      bevel: mesh(cylinder(1.53 * BASE_RADIUS_SCALE, 1.39 * BASE_RADIUS_SCALE, -0.47, -0.39)),
      deck: mesh(cylinder(1.32 * BASE_RADIUS_SCALE, 1.32 * BASE_RADIUS_SCALE, -0.39, -0.31)),
      inset: mesh(cylinder(0.94 * BASE_RADIUS_SCALE, 0.94 * BASE_RADIUS_SCALE, -0.31, -0.25)),
      emitter: mesh(cylinder(0.43 * BASE_RADIUS_SCALE, 0.43 * BASE_RADIUS_SCALE, -0.25, -0.15)),
      outerRing: mesh(torus(1.535 * BASE_RADIUS_SCALE, 0.010)),
      innerRing: mesh(torus(1.27 * BASE_RADIUS_SCALE, 0.009)),
      emitterRing: mesh(torus(0.42 * BASE_RADIUS_SCALE, 0.008)),
      shell: mesh(sphere(0.69)),
      auraShell: mesh(sphere(0.91, 48, 32)),
      auraRing: mesh(torus(0.94, 0.010, 96, 6)),
      lobes: mesh(merge(brainLobe(-1), brainLobe(1))),
      folds: mesh(brainFolds()),
      nerves: mesh(brainNerves()),
      stem: mesh(tube(curve([[0, -0.23, 0.04], [0, -0.31, 0.08], [0.015, -0.38, 0.10], [0, -0.43, 0.08]]), 0.025, 8)),
      officeFoundation: mesh(box(DEPARTMENT_OFFICE_WIDTH, OFFICE_FOUNDATION_HEIGHT, DEPARTMENT_OFFICE_DEPTH)),
      officeBack: mesh(box(DEPARTMENT_OFFICE_WIDTH, OFFICE_WALL_HEIGHT, 0.10, 0, 0, DEPARTMENT_OFFICE_DEPTH / 2 - 0.05)),
      officeSides: mesh(merge(...[-1, 1].map(side => box(0.10, OFFICE_WALL_HEIGHT, DEPARTMENT_OFFICE_DEPTH, side * (DEPARTMENT_OFFICE_WIDTH / 2 - 0.05))))),
      officePortal: mesh(merge(box(0.08, 1.03, 0.08, -0.55, 0, -DEPARTMENT_OFFICE_DEPTH / 2 + 0.04), box(0.08, 1.03, 0.08, 0.55, 0, -DEPARTMENT_OFFICE_DEPTH / 2 + 0.04), box(1.18, 0.08, 0.08, 0, 1.03, -DEPARTMENT_OFFICE_DEPTH / 2 + 0.04))),
      executiveDesk: mesh(merge(box(1.05, 0.06, 0.56, 0, 0.55, -0.18), ...[-1, 1].flatMap(side => [-1, 1].map(end => box(0.06, 0.55, 0.06, side * 0.43, 0, -0.18 + end * 0.20))))),
      executiveBoard: mesh(box(1.28, 0.63, 0.07, 0, 0.40, 1.005)),
      executiveBoardInset: mesh(box(1.14, 0.49, 0.026, 0, 0.47, 0.958)),
      executivePlanLines: mesh(merge(box(0.78, 0.018, 0.01, -0.08, 0.82, 0.938), box(0.57, 0.015, 0.01, -0.18, 0.70, 0.938), box(0.64, 0.015, 0.01, -0.14, 0.58, 0.938))),
    }
    const maximumRenderDimension = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number)
    let disposed = false
    let orbProjection: OrbProjection | null = null
    const staticModel = identity(), brainModel = identity(), auraFirst = identity(), auraSecond = identity(), groundModel = identity()
    const outerRingModel = model(0, -0.48), innerRingModel = model(0, -0.30), emitterRingModel = model(0, -0.145)
    let lastCamera: number[] = [], lastWidth = 0, lastHeight = 0, lastFloorRadius = -1
    let viewProjection: Matrix | null = null
    let officeLayout = layoutDepartmentOffices(EMPTY_DEPARTMENTS)
    let previousDepartments: readonly HqDepartmentOffice[] | null = null, departmentSignature = ''
    let officeEntries = new Map<string, OfficeRenderEntry>()
    const firstSeen = new Map<string, number>()
    let constructionClock = 0, previousSeconds: number | null = null
    function makeEntry(placement: OfficePlacement & { id: string }): OfficeRenderEntry {
      return {
        placement, roadKey: JSON.stringify(placement.roadPoints),
        road: mesh(roadGeometry(placement.roadPoints, 0.30, SPATIAL_VIEWPORT_GROUND_Y + 0.008)),
        trace: mesh(roadGeometry(placement.roadPoints, 0.026, SPATIAL_VIEWPORT_GROUND_Y + 0.012)),
        foundationModel: model(placement.x, SPATIAL_VIEWPORT_GROUND_Y, placement.z, 0, 0, placement.yaw),
        wallModel: model(placement.x, SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT, placement.z, 0, 0, placement.yaw),
        completedHeight: 0,
      }
    }
    const executiveEntry = makeEntry(officeLayout.executive)
    executiveEntry.completedHeight = 1
    function releaseMesh(shape: Mesh) {
      for (const buffer of [shape.position, shape.normal, shape.indices]) {
        gl!.deleteBuffer(buffer)
        const index = buffers.indexOf(buffer)
        if (index >= 0) buffers.splice(index, 1)
      }
    }
    function updateOffices(departments: readonly HqDepartmentOffice[], reduced: boolean) {
      if (departments !== previousDepartments) {
        previousDepartments = departments
        const signature = JSON.stringify(departments.map(department => [department.id, department.approvedAt]).sort((left, right) => left[0]! < right[0]! ? -1 : left[0]! > right[0]! ? 1 : 0))
        if (signature !== departmentSignature) {
          departmentSignature = signature
          officeLayout = layoutDepartmentOffices(departments)
          const nextEntries = new Map<string, OfficeRenderEntry>()
          for (const placement of officeLayout.offices) {
            let entry = officeEntries.get(placement.id)
            if (entry && entry.roadKey !== JSON.stringify(placement.roadPoints)) {
              releaseMesh(entry.road); releaseMesh(entry.trace); entry = undefined
            }
            if (!entry) entry = makeEntry(placement)
            nextEntries.set(placement.id, entry)
            if (!firstSeen.has(placement.id)) firstSeen.set(placement.id, constructionClock)
          }
          for (const [id, entry] of officeEntries) if (!nextEntries.has(id)) { releaseMesh(entry.road); releaseMesh(entry.trace) }
          officeEntries = nextEntries
        }
      }
      if (reduced) for (const id of officeEntries.keys()) firstSeen.set(id, Math.min(firstSeen.get(id) ?? constructionClock, constructionClock - OFFICE_BUILD_SECONDS))
    }
    function projectAnchor(entry: OfficeRenderEntry): HologramOfficeAnchor | null {
      if (disposed || !viewProjection) return null
      const { x, z } = entry.placement, y = SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT + OFFICE_WALL_HEIGHT * entry.completedHeight + 0.18
      const matrix = viewProjection
      const clipX = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!
      const clipY = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!
      const clipZ = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!
      const clipW = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!
      if (clipW <= 0.05) return { x: 0, y: 0, visible: false }
      const ndcX = clipX / clipW, ndcY = clipY / clipW, ndcZ = clipZ / clipW
      return { x: (ndcX + 1) * lastWidth / 2, y: (1 - ndcY) * lastHeight / 2, visible: Math.abs(ndcX) < 0.98 && Math.abs(ndcY) < 0.96 && Math.abs(ndcZ) <= 1 }
    }
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    function drawMesh(shape: Mesh, color: Vector, material: number, opacity = 1, transform = staticModel, singleSided = false, count = shape.count) {
      if (!gl || count <= 0) return
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(position)
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.normal); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(normal)
      gl.uniformMatrix4fv(uniforms.uModel!, false, transform)
      gl.uniform3fv(uniforms.uColor!, color); gl.uniform1f(uniforms.uMaterial!, material); gl.uniform1f(uniforms.uOpacity!, opacity)
      gl.depthMask((opacity >= 1 && (material === 0 || material === 6 || material === 7)) || (material === 4 && opacity > 0.5))
      if (singleSided) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK) }
      else gl.disable(gl.CULL_FACE)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape.indices)
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)
    }
    function drawOffice(entry: OfficeRenderEntry, age: number, executive = false) {
      const complete = age >= OFFICE_BUILD_SECONDS
      const roadProgress = constructionStage(age, 0, 0.5)
      const roadCount = Math.floor(entry.road.count * roadProgress / 6) * 6
      drawMesh(entry.road, palette.graphite, 0, 1, staticModel, false, roadCount)
      if (!complete) drawMesh(entry.trace, palette.gold, 2, 0.60 * (1 - constructionStage(age, 1.6, OFFICE_BUILD_SECONDS)), staticModel, false, Math.floor(entry.trace.count * roadProgress / 6) * 6)
      const foundation = constructionStage(age, 0.25, 0.85)
      entry.foundationModel[5] = Math.max(0.001, foundation)
      if (foundation > 0) drawMesh(geometry.officeFoundation, executive ? palette.graphite : palette.charcoal, 0, 1, entry.foundationModel)
      const wallRise = constructionStage(age, 0.65, 1.45)
      entry.completedHeight = wallRise
      const material = complete ? 0 : 7
      gl!.uniform1f(uniforms.uConstruction!, complete ? 0 : 1 - constructionStage(age, 1.7, OFFICE_BUILD_SECONDS))
      gl!.uniform1f(uniforms.uSweepY!, SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT + OFFICE_WALL_HEIGHT * constructionStage(age, 0.65, 2.2))
      entry.wallModel[5] = Math.max(0.001, wallRise)
      if (wallRise > 0) drawMesh(geometry.officeBack, palette.charcoal, material, 1, entry.wallModel)
      const sideRise = constructionStage(age, 0.85, 1.65)
      entry.wallModel[5] = Math.max(0.001, sideRise)
      if (sideRise > 0) drawMesh(geometry.officeSides, palette.graphite, material, 1, entry.wallModel)
      const portalRise = constructionStage(age, 1.05, 1.85)
      entry.wallModel[5] = Math.max(0.001, portalRise)
      if (portalRise > 0) drawMesh(geometry.officePortal, executive ? palette.gold : palette.steelGray, material, 1, entry.wallModel)
      if (executive) {
        entry.wallModel[5] = 1
        drawMesh(geometry.executiveDesk, palette.graphite, 0, 1, entry.wallModel)
        drawMesh(geometry.executiveBoard, palette.gold, 0, 1, entry.wallModel)
        drawMesh(geometry.executiveBoardInset, palette.coal, 0, 1, entry.wallModel)
        drawMesh(geometry.executivePlanLines, palette.silver, 2, 0.80, entry.wallModel)
      }
    }
    function rayAt(clientX: number, clientY: number): { origin: Vector; direction: Vector } | null {
      if (disposed || !orbProjection || gl!.isContextLost()) return null
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null
      const horizontal = ((clientX - bounds.left) / bounds.width * 2 - 1) * Math.tan(SPATIAL_VIEWPORT_VERTICAL_FOV / 2) * orbProjection.aspect
      const vertical = (1 - (clientY - bounds.top) / bounds.height * 2) * Math.tan(SPATIAL_VIEWPORT_VERTICAL_FOV / 2)
      const { eye, right, up, forward } = orbProjection
      return { origin: eye, direction: normalize([forward[0] + right[0] * horizontal + up[0] * vertical, forward[1] + right[1] * horizontal + up[1] * vertical, forward[2] + right[2] * horizontal + up[2] * vertical]) }
    }
    function rayBox(origin: Vector, direction: Vector, minimum: Vector, maximum: Vector): number {
      let near = 0.05, far = Infinity
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(direction[axis]!) < 0.000001) {
          if (origin[axis]! < minimum[axis]! || origin[axis]! > maximum[axis]!) return Infinity
          continue
        }
        const first = (minimum[axis]! - origin[axis]!) / direction[axis]!, second = (maximum[axis]! - origin[axis]!) / direction[axis]!
        near = Math.max(near, Math.min(first, second)); far = Math.min(far, Math.max(first, second))
        if (near > far) return Infinity
      }
      return near
    }
    return {
      draw(camera, seconds, interaction: Readonly<HologramInteraction> = { open: 0, excited: 0 }, layout: Readonly<HologramLayout> = {}) {
        if (disposed || !gl || gl.isContextLost()) return
        const width = canvas.clientWidth, height = canvas.clientHeight
        if (!width || !height) return
        // Monotonic per-renderer construction time survives camera resets and
        // repeated projections. Existing IDs never restart their build sequence.
        if (previousSeconds !== null) constructionClock += Math.max(0, Math.min(0.1, seconds - previousSeconds))
        previousSeconds = seconds
        updateOffices(layout.departments ?? EMPTY_DEPARTMENTS, Boolean(layout.reducedMotion))
        const floorRadius = Math.max(hologramFloorRadius(layout.officeLayerCount), officeLayout.floorRadius)
        const layoutChanged = floorRadius !== lastFloorRadius
        if (layoutChanged) {
          // Scale only X/Z: the finite disk remains anchored at the origin and
          // keeps its shared ground height regardless of camera pan or size.
          groundModel[0] = floorRadius; groundModel[10] = floorRadius
          lastFloorRadius = floorRadius
        }
        const open = Math.max(0, Math.min(1, interaction.open))
        // Explicit opened state suppresses excitement immediately, before the
        // opening transition advances; closing fragments stay quiet as well.
        const excited = interaction.opened || open > 0.001 ? 0 : Math.max(0, Math.min(1, interaction.excited))
        // Use native screen density in both states: opening must not switch
        // the orb to a visibly softer backing buffer. Keep a generous bound
        // for very large displays while honoring the actual GPU limit.
        const pixelBudget = 8_000_000
        const desiredDensity = Math.max(1.5, window.devicePixelRatio || 1)
        const ratio = Math.min(desiredDensity, 3, Math.sqrt(pixelBudget / (width * height)), maximumRenderDimension / Math.max(width, height))
        const renderWidth = Math.max(1, Math.floor(width * ratio)), renderHeight = Math.max(1, Math.floor(height * ratio))
        if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
          canvas.width = renderWidth; canvas.height = renderHeight
          gl.viewport(0, 0, renderWidth, renderHeight)
        }
        gl.depthMask(true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        if (layoutChanged || width !== lastWidth || height !== lastHeight || camera.yaw !== lastCamera[0] || camera.pitch !== lastCamera[1]
          || camera.zoom !== lastCamera[2] || camera.panX !== lastCamera[3] || camera.panY !== lastCamera[4]) {
          const frame = spatialViewportFrame(camera, width, height, floorRadius)
          const projection = perspective(frame.aspect, frame.far, frame.near), view = lookAt(frame.eye, frame.target)
          gl.uniformMatrix4fv(uniforms.uProjection!, false, projection)
          gl.uniformMatrix4fv(uniforms.uView!, false, view); gl.uniform3fv(uniforms.uEye!, frame.eye)
          viewProjection = matrixProduct(projection, view)
          orbProjection = {
            eye: frame.eye, right: frame.right, up: frame.up, forward: frame.forward,
            center: [0, 0.98, 0], radius: 0.84, aspect: frame.aspect,
          }
          lastCamera = [camera.yaw, camera.pitch, camera.zoom, camera.panX, camera.panY]
          lastWidth = width; lastHeight = height
        }
        const time = seconds % 1000, reveal = open * open * (3 - 2 * open)
        const float = Math.sin(time * 0.9) * 0.028, beat = 1 + Math.sin(time * 2.15) * 0.006, orbHeight = 0.98 + float
        const shakeX = Math.sin(time * 31) * excited * 0.005, shakeY = Math.sin(time * 37) * excited * 0.004
        gl.uniform1f(uniforms.uTime!, time); gl.uniform3fv(uniforms.uAccent!, palette.gold)
        if (orbProjection) {
          orbProjection.center[0] = shakeX; orbProjection.center[1] = orbHeight + shakeY
          orbProjection.radius = (0.84 - reveal * 0.14) * beat
        }
        drawMesh(geometry.ground, palette.coal, 6, 1, groundModel, true)
        drawMesh(geometry.groundEdge, palette.graphite, 0, 1, groundModel, true)
        drawOffice(executiveEntry, OFFICE_BUILD_SECONDS, true)
        for (const [id, entry] of officeEntries) drawOffice(entry, constructionClock - (firstSeen.get(id) ?? constructionClock))
        drawMesh(geometry.base, palette.charcoal, 0)
        drawMesh(geometry.bevel, palette.graphite, 0)
        drawMesh(geometry.deck, palette.charcoal, 0)
        drawMesh(geometry.inset, palette.graphite, 0)
        drawMesh(geometry.emitter, palette.coal, 0)
        drawMesh(geometry.outerRing, palette.steelGray, 5, 0.58, outerRingModel)
        drawMesh(geometry.innerRing, palette.silver, 2, 0.46, innerRingModel)
        drawMesh(geometry.emitterRing, palette.gold, 2, 0.60, emitterRingModel)
        for (const plate of plates) {
          const vibration = Math.sin(time * 33 + plate.phase) * excited * 0.014
          const drift = Math.sin(time * 0.65 + plate.phase) * reveal * 0.006
          const transform = model(
            plate.center[0] * beat + plate.travel[0] * reveal + plate.direction[0] * vibration + shakeX,
            orbHeight + plate.center[1] * beat + plate.travel[1] * reveal + drift + shakeY,
            plate.center[2] * beat + plate.travel[2] * reveal + plate.direction[2] * vibration,
            plate.rotation[0] * reveal + vibration, plate.rotation[1] * reveal + vibration, plate.rotation[2] * reveal, beat, plate.transform,
          )
          drawMesh(plate.body, plate.phase > Math.PI ? palette.graphite : palette.charcoal, 0, 1, transform)
          drawMesh(plate.seam, palette.gold, 2, 0.38 + excited * 0.30, transform)
        }
        model(shakeX, orbHeight + shakeY, 0, 0, 0, 0, beat, brainModel)
        if (reveal > 0.001) {
          drawMesh(geometry.lobes, palette.silver, 4, reveal * 0.88, brainModel, true)
          drawMesh(geometry.stem, palette.steelGray, 4, reveal * 0.85, brainModel)
          drawMesh(geometry.folds, palette.steelGray, 2, reveal * 0.78, brainModel)
          drawMesh(geometry.nerves, palette.gold, 3, reveal * 0.94, brainModel)
        }
        drawMesh(geometry.shell, palette.pearl, 1, 0.50, brainModel, true)
        drawMesh(geometry.auraShell, palette.silver, 1, 0.18, brainModel, true)
        model(shakeX, orbHeight + shakeY, 0, 0.52, 0, time * 0.13, 1, auraFirst)
        model(shakeX, orbHeight + shakeY, 0, 1.13, 0.22, -time * 0.09, 1, auraSecond)
        drawMesh(geometry.auraRing, palette.gold, 5, 0.34, auraFirst)
        drawMesh(geometry.auraRing, palette.gold, 5, 0.20, auraSecond)
      },
      hitTestOrb(clientX, clientY) {
        const ray = rayAt(clientX, clientY)
        if (!ray || !orbProjection) return false
        const { center } = orbProjection
        const origin: Vector = [ray.origin[0] - center[0], ray.origin[1] - center[1], ray.origin[2] - center[2]]
        const projection = dot(origin, ray.direction)
        const discriminant = projection * projection - dot(origin, origin) + orbProjection.radius * orbProjection.radius
        return discriminant >= 0 && -projection + Math.sqrt(discriminant) > 0.05
      },
      hitTestExecutive(clientX, clientY) {
        const ray = rayAt(clientX, clientY)
        if (!ray) return false
        const placement = executiveEntry.placement, cosine = Math.cos(placement.yaw), sine = Math.sin(placement.yaw)
        const x = ray.origin[0] - placement.x, z = ray.origin[2] - placement.z
        const origin: Vector = [cosine * x - sine * z, ray.origin[1] - SPATIAL_VIEWPORT_GROUND_Y - OFFICE_FOUNDATION_HEIGHT, sine * x + cosine * z]
        const direction: Vector = [cosine * ray.direction[0] - sine * ray.direction[2], ray.direction[1], sine * ray.direction[0] + cosine * ray.direction[2]]
        const board = rayBox(origin, direction, [-0.64, 0.40, 0.93], [0.64, 1.03, 1.04])
        const desk = rayBox(origin, direction, [-0.525, 0.55, -0.46], [0.525, 0.61, 0.10])
        const target = Math.min(board, desk)
        if (!Number.isFinite(target)) return false
        const backWall = rayBox(origin, direction, [-1.35, 0, 1.05], [1.35, OFFICE_WALL_HEIGHT, 1.15])
        const leftWall = rayBox(origin, direction, [-1.35, 0, -1.15], [-1.25, OFFICE_WALL_HEIGHT, 1.15])
        const rightWall = rayBox(origin, direction, [1.25, 0, -1.15], [1.35, OFFICE_WALL_HEIGHT, 1.15])
        return target < Math.min(backWall, leftWall, rightWall)
      },
      projectOfficeAnchor(id) {
        const entry = officeEntries.get(id)
        return entry ? projectAnchor(entry) : null
      },
      projectExecutiveAnchor() { return projectAnchor(executiveEntry) },
      dispose() {
        if (disposed) return
        disposed = true
        orbProjection = null
        viewProjection = null
        officeEntries.clear(); firstSeen.clear()
        for (const buffer of buffers) gl.deleteBuffer(buffer)
        for (const shader of shaders) gl.deleteShader(shader)
        gl.deleteProgram(program)
      },
    }
  }
  catch {
    for (const buffer of buffers) gl.deleteBuffer(buffer)
    for (const shader of shaders) gl.deleteShader(shader)
    if (program) gl.deleteProgram(program)
    return null
  }
}
