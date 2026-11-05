import { SPATIAL_VIEWPORT_GROUND_Y, SPATIAL_VIEWPORT_VERTICAL_FOV, spatialViewportFrame } from '@building-suit/ux'
import type { SpatialViewportCamera } from '@building-suit/ux'
import type { HqDepartmentOffice } from '../types/hqLayoutPresentation'
import { DEPARTMENT_OFFICE_DEPTH, DEPARTMENT_OFFICE_WIDTH, departmentOfficeFloorRadius, layoutDepartmentOffices } from './departmentOfficeLayout.ts'
import type { OfficePlacement } from './departmentOfficeLayout.ts'
import { createHologramEffects } from './hologramEffects.ts'
import type { HologramEffects } from './hologramEffects.ts'
import { createOfficeArchitecture } from './officeArchitecture.ts'
import { createCircularWorkplaceGeometry } from './circularWorkplaceGeometry.ts'
import { createHqIslandFootprint } from './hqIslandGeometry.ts'
import type { HqIslandFootprint } from './hqIslandGeometry.ts'
import { createHologramTerrainMaterial } from './hologramTerrainMaterial.ts'
import type { HologramTerrainMaterial } from './hologramTerrainMaterial.ts'
import { createNaturalIslandGeometry } from './naturalIslandGeometry.ts'
import { createNaturalIslandMaterial } from './naturalIslandMaterial.ts'
import type { NaturalIslandMaterial } from './naturalIslandMaterial.ts'

type Vector = [number, number, number]
type Matrix = Float32Array
const SCENE_FAR = 150
const BASE_RADIUS_SCALE = 1.12
const OFFICE_BUILD_SECONDS = 2.4
const OFFICE_FOUNDATION_HEIGHT = 0.14
const OFFICE_WALL_HEIGHT = 1.9
const EMPTY_DEPARTMENTS: readonly HqDepartmentOffice[] = []
interface Geometry { positions: number[]; normals: number[] }
interface Mesh { position: WebGLBuffer; normal: WebGLBuffer; indices: WebGLBuffer; count: number }
interface OrbProjection { eye: Vector; right: Vector; up: Vector; forward: Vector; center: Vector; radius: number; aspect: number }
interface SceneRay { origin: Vector; direction: Vector }
interface OfficeRenderEntry {
  placement: OfficePlacement & { id: string }
  wallModel: Matrix
  completedHeight: number
  standingLight: Vector
}

export interface HologramPalette { coal: Vector; charcoal: Vector; graphite: Vector; navy: Vector; navyDeep: Vector; gold: Vector; steelGray: Vector; silver: Vector; pearl: Vector }
export interface HologramInteraction { open: number; excited: number; opened?: boolean }
export interface HologramLayout { officeLayerCount?: number; departments?: readonly HqDepartmentOffice[]; reducedMotion?: boolean }
export interface HologramOfficeAnchor { x: number; y: number; visible: boolean }
export interface HologramRenderer {
  draw: (camera: Readonly<SpatialViewportCamera>, seconds: number, interaction?: Readonly<HologramInteraction>, layout?: Readonly<HologramLayout>) => void
  hitTestOrb: (clientX: number, clientY: number) => boolean
  hitTestWorkplace: (clientX: number, clientY: number) => string | null
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
uniform vec3 uNavy;
uniform vec3 uNavyDeep;
uniform vec3 uSilver;
uniform vec3 uBrainLight;
uniform float uBrainLightStrength;
uniform vec3 uRoomLight;
uniform float uRoomLightStrength;
uniform sampler2D uTerrainMap;
uniform float uTerrainScale;
uniform sampler2D uIslandMap;
uniform float uIslandScale;
uniform vec3 uIslandSoil;
uniform vec3 uIslandMoss;
uniform float uSweepY;
uniform float uConstruction;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  if ((uMaterial > 5.5 && uMaterial < 6.5) || (uMaterial > 8.5 && uMaterial < 9.5) || uMaterial > 13.5) {
    // Land has its own material/sampler. Office concrete and every other scene
    // object retain their existing texture, lighting and surface response.
    bool cliff = uMaterial > 8.5 && uMaterial < 9.5;
    bool grass = uMaterial > 13.5;
    vec3 normal = normalize(vNormal);
    vec2 plane = cliff ? (abs(normal.x) > abs(normal.z) ? vWorld.zy : vWorld.xy) : vWorld.xz;
    vec2 uv = plane * uIslandScale;
    vec4 mineral = texture2D(uIslandMap, uv);
    vec2 warped = uv + (mineral.rg - vec2(0.5)) * 0.11;
    vec4 detail = texture2D(uIslandMap, mat2(0.80, -0.60, 0.60, 0.80) * warped * 7.13 + vec2(0.19, 0.43));
    vec4 grit = texture2D(uIslandMap, mat2(0.39, 0.92, -0.92, 0.39) * warped * 29.71 + vec2(0.67, 0.11));
    vec2 slope = (mineral.rg - vec2(0.5)) * 0.34 + (detail.rg - vec2(0.5)) * 0.13;
    if (cliff) normal = normalize(normal + vec3(slope.x, (grit.b - 0.5) * 0.10, slope.y));
    else normal = normalize(normal + vec3(slope.x, 0.0, slope.y));
    float diffuse = max(dot(normal, normalize(vec3(-1.5, 3.0, 2.0))), 0.0);
    float cavities = (1.0 - smoothstep(0.26, 0.52, detail.b)) * 0.18;
    float variation = 0.68 + mineral.b * 0.54 + (grit.b - 0.5) * 0.15 - cavities;
    vec3 rock = uColor * variation;
    float soil = smoothstep(0.42, 0.72, mineral.a) * 0.56;
    float moss = smoothstep(0.72, 0.88, mineral.a) * smoothstep(0.40, 0.66, detail.a);
    moss *= smoothstep(0.35, 0.82, max(normal.y, 0.0));
    vec3 surface = mix(rock, uIslandSoil * (0.78 + detail.b * 0.40), soil);
    if (cliff) {
      // Broken mineral bands follow warped rock, without regular terrace lines.
      float bedding = fract(vWorld.y * 2.1 + mineral.b * 2.7 + detail.b * 0.23);
      float erosion = (1.0 - smoothstep(0.02, 0.16, bedding)) * smoothstep(0.38, 0.70, detail.a);
      surface *= 1.0 - erosion * 0.19;
      moss *= 0.24;
    }
    surface = mix(surface, uIslandMoss * (0.78 + grit.b * 0.38), moss * 0.75);
    if (grass) surface = uColor * (0.76 + detail.b * 0.36);
    vec3 color = surface * (0.72 + diffuse * 0.36);
    // Preserve the existing diffuse Brain spill; land never adds clearcoat or
    // a metallic/environment reflection, even along the fractured cliff faces.
    if (!cliff && !grass) {
      float radius = length(vWorld.xz);
      color *= 1.0 - 0.66 * exp(-radius * radius / 2.1);
      float lightPool = 0.34 * exp(-radius * radius / 7.6) + 0.08 * exp(-pow(radius - 2.18, 2.0) / 0.70);
      color += mix(uAccent, uSilver, 0.22) * lightPool * uBrainLightStrength * (0.96 + 0.04 * sin(uTime * 2.15));
    } else {
      vec3 brainOffset = uBrainLight - vWorld;
      float distanceSquared = max(dot(brainOffset, brainOffset), 0.01);
      float brainDiffuse = max(dot(normal, brainOffset * inversesqrt(distanceSquared)), 0.0);
      color += mix(uAccent, uSilver, 0.32) * uBrainLightStrength / (1.0 + 0.58 * distanceSquared) * (0.10 + 0.62 * brainDiffuse);
    }
    gl_FragColor = vec4(color, uOpacity);
    return;
  }
  if (uMaterial > 12.5) {
    // Honed concrete stays diffuse: no reflected office/orb image or clearcoat.
    vec3 surfaceNormal = normalize(vNormal);
    vec4 stone = texture2D(uTerrainMap, vWorld.xz * uTerrainScale * 3.0);
    float grain = texture2D(uTerrainMap, (vWorld.xz + vWorld.yy) * uTerrainScale * 24.0).a;
    float diffuse = max(dot(surfaceNormal, normalize(vec3(-1.5, 3.0, 2.0))), 0.0);
    vec3 color = uColor * (0.66 + 0.34 * diffuse) * (0.94 + stone.b * 0.08 + (grain - 0.5) * 0.055);
    vec3 brainOffset = uBrainLight - vWorld;
    color += mix(uAccent, uSilver, 0.32) * uBrainLightStrength * 0.10 / (1.0 + dot(brainOffset, brainOffset) * 0.58);
    gl_FragColor = vec4(color, uOpacity);
    return;
  }
  if (uMaterial > 11.5) {
    vec3 view = normalize(uEye - vWorld), normal = normalize(vNormal);
    float rim = pow(1.0 - abs(dot(normal, view)), 3.0);
    float highlight = pow(abs(dot(normalize(vec3(-1.5, 3.0, 2.0)) + view, normal)) * 0.5, 32.0);
    vec3 color = mix(uColor, uNavy, 0.18) + uSilver * highlight * 0.32;
    gl_FragColor = vec4(color, uOpacity * (0.16 + rim * 0.30));
    return;
  }
  if (uMaterial > 10.5 && uMaterial < 11.5) {
    // This independent water material precedes the contact-shadow branch.
    // Geometry carries coastal distance and offshore blend in vNormal.xy;
    // analytic wave slopes provide fluid motion without rebuilding the mesh.
    float shoreDistance = vNormal.x;
    float offshore = clamp(vNormal.y, 0.0, 1.0);
    float phaseA = dot(vWorld.xz, vec2(0.90, 0.44)) - uTime * 0.65;
    float phaseB = dot(vWorld.xz, vec2(-0.53, 0.81)) + uTime * 0.43;
    float waveA = sin(phaseA), waveB = sin(phaseB);
    vec2 slope = vec2(0.90, 0.44) * cos(phaseA) * 0.055;
    slope += vec2(-0.53, 0.81) * cos(phaseB) * 0.035;
    vec3 waterNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 waterView = normalize(uEye - vWorld);
    float fresnel = pow(1.0 - max(dot(waterNormal, waterView), 0.0), 3.0);
    float shallow = exp(-max(shoreDistance, 0.0) * 1.18);
    vec3 deepWater = mix(uNavyDeep, uNavy, 0.54 + waveA * 0.045 + waveB * 0.025);
    deepWater = mix(deepWater, uSilver, 0.065);
    vec3 shallowWater = mix(uNavy, uSilver, 0.22);
    vec3 waterColor = mix(deepWater, shallowWater, shallow * 0.58);
    waterColor += uSilver * fresnel * 0.10;
    float rippleCrest = smoothstep(0.72, 0.98, 0.5 + waveA * 0.5);
    rippleCrest += smoothstep(0.80, 0.99, 0.5 + waveB * 0.5) * 0.55;
    waterColor += uSilver * rippleCrest * 0.024;
    vec3 halfLight = normalize(normalize(vec3(-1.5, 3.0, 2.0)) + waterView);
    float sparkle = pow(max(dot(waterNormal, halfLight), 0.0), 72.0);
    waterColor += uSilver * sparkle * 0.30;
    // A narrow, gently breathing foam line follows the actual directional
    // coast. It is diffuse shore detail, never a mirrored island/object image.
    float foamEdge = abs(shoreDistance - 0.055 - waveA * 0.026 - waveB * 0.018);
    float foam = (1.0 - smoothstep(0.025, 0.13, foamEdge));
    foam *= 0.55 + 0.25 * waveA + 0.20 * waveB;
    waterColor = mix(waterColor, uColor, foam * 0.27);
    float alpha = (1.0 - smoothstep(0.66, 1.0, offshore)) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(waterColor, alpha);
    return;
  }
  if (uMaterial > 9.5) {
    // Vertex-weighted concentric geometry gives a soft ground contact shadow
    // without a texture, readback, extra target or per-office shadow map.
    gl_FragColor = vec4(uColor, uOpacity * clamp(vNormal.y, 0.0, 1.0));
    return;
  }
  vec3 view = normalize(uEye - vWorld);
  vec3 normal = normalize(vNormal);
  float facing = abs(dot(normal, view));
  float rim = pow(1.0 - facing, 3.0);
  vec3 keyLight = normalize(vec3(-1.5, 3.0, 2.0));
  float diffuse = max(dot(normal, keyLight), 0.0);
  float clearcoat = pow(max(dot(reflect(-keyLight, normal), view), 0.0), 84.0);
  vec3 reflected = reflect(-view, normal);
  float softbox = pow(max(dot(reflected, normalize(vec3(-1.0, 1.7, 1.2))), 0.0), 28.0);
  float warmStrip = pow(max(dot(reflected, normalize(vec3(1.0, 0.75, -1.2))), 0.0), 42.0);
  vec3 environment = mix(uNavyDeep, uNavy, 0.5 + 0.5 * reflected.y);
  environment += uSilver * softbox * 0.8 + uAccent * warmStrip * 0.24;
  float metallic = uMaterial > 7.5 && uMaterial < 8.5 ? 0.82 : 0.12;
  vec3 color = uColor * (0.44 + 0.64 * diffuse) * (1.0 - metallic * 0.42);
  color += environment * (0.20 + rim * 0.72) * metallic;
  color += uSilver * clearcoat * (0.30 + metallic * 0.62);
  if (uMaterial < 0.5 || uMaterial > 6.5) {
    vec3 brainOffset = uBrainLight - vWorld;
    float brainDistanceSquared = max(dot(brainOffset, brainOffset), 0.01);
    float brainDiffuse = max(dot(normal, brainOffset * inversesqrt(brainDistanceSquared)), 0.0);
    vec3 brainRadiance = mix(uAccent, uSilver, 0.32) * uBrainLightStrength / (1.0 + 0.58 * brainDistanceSquared);
    color += brainRadiance * (0.10 + 0.62 * brainDiffuse);
    // Each office binds only its own lamp for these surface draws. This gives
    // a warm shaded floor/wall pool without per-office shadow maps or a loop
    // over every department's light at every screen fragment.
    if (uRoomLightStrength > 0.0) {
      vec3 lampOffset = uRoomLight - vWorld;
      float lampDistanceSquared = max(dot(lampOffset, lampOffset), 0.01);
      float lampDiffuse = max(dot(normal, lampOffset * inversesqrt(lampDistanceSquared)), 0.0);
      float lampAttenuation = uRoomLightStrength / (1.0 + 0.75 * lampDistanceSquared);
      color += (uColor * 0.80 + vec3(0.05)) * mix(uAccent, uSilver, 0.68) * lampAttenuation * (0.15 + lampDiffuse);
    }
  }
  float alpha = uOpacity;
  if (uMaterial > 0.5 && uMaterial < 1.5) {
    color = mix(uColor, uNavy, 0.25) * 0.85 + uSilver * clearcoat * 0.38;
    alpha *= 0.035 + rim * 0.36;
  } else if (uMaterial > 1.5 && uMaterial < 2.5) {
    // Hot cores survive the native antialias resolve; bloom adds their halo.
    color = uColor * 1.42 + vec3(0.035);
  } else if (uMaterial > 2.5 && uMaterial < 3.5) {
    float impulse = pow(max(0.0, sin(uTime * 2.6 - vWorld.y * 8.0 - abs(vWorld.x) * 7.0)), 5.0);
    color = uColor * (1.05 + impulse * 0.58) + vec3(impulse * 0.06);
    alpha *= 0.60 + impulse * 0.40;
  } else if (uMaterial > 3.5 && uMaterial < 4.5) {
    color = uColor * (0.55 + diffuse * 0.4) + rim * uNavy * 0.26;
  } else if (uMaterial > 4.5 && uMaterial < 5.5) {
    float orbit = atan(vWorld.z, vWorld.x);
    float ribbon = pow(0.5 + 0.5 * sin(orbit * 3.0 - uTime * 0.9), 5.0);
    color = uColor * 1.35 + vec3(0.025);
    alpha *= 0.52 + ribbon * 0.48;
  } else if (uMaterial > 6.5 && uMaterial < 7.5) {
    float sweep = 1.0 - smoothstep(0.015, 0.065, abs(vWorld.y - uSweepY));
    color = mix(color, uAccent * 1.65, sweep * uConstruction * 0.82);
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
function islandWater(footprint: HqIslandFootprint): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  const seaLevel = SPATIAL_VIEWPORT_GROUND_Y - 0.50
  const outerRadius = footprint.radius * 2.4
  // Eight fixed radial bands resolve the narrow shore and the broad offshore
  // fade. Indexed upload merges shared vertices:256×8 vertices,3584 triangles.
  // Rebuilt only when occupied sectors change, never on pan/zoom or each frame.
  const bands = 8
  function vertex(index: number, band: number) {
    const sample = index % footprint.outline.length
    const angle = sample / footprint.outline.length * Math.PI * 2
    const coastRadius = footprint.radii[sample]!
    // Match the rock's near-surface inset where it crosses this sea level;
    // the first band tucks underneath, so no transparent gap outlines the land.
    const waterline = coastRadius * 0.99 - 0.04
    const span = outerRadius - waterline
    const offsets = [-0.40, 0, 0.16, 0.55, 1.40, span * 0.36, span * 0.70, span]
    const distance = offsets[band]!
    const radius = waterline + distance
    geometry.positions.push(Math.cos(angle) * radius, seaLevel, Math.sin(angle) * radius)
    geometry.normals.push(distance, Math.max(0, distance / span), 0)
  }
  for (let band = 0; band < bands - 1; band++) for (let index = 0; index < footprint.outline.length; index++) {
    vertex(index, band); vertex(index + 1, band); vertex(index, band + 1)
    vertex(index + 1, band); vertex(index + 1, band + 1); vertex(index, band + 1)
  }
  return geometry
}
function islandGroundShadow(footprint: HqIslandFootprint): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  const height = SPATIAL_VIEWPORT_GROUND_Y - footprint.depth * 1.22 - 0.16
  const bands = [{ scale: 0, weight: 0.70 }, { scale: 0.84, weight: 0.70 }, { scale: 1.02, weight: 0.36 }, { scale: 1.12, weight: 0.10 }, { scale: 1.23, weight: 0 }]
  function vertex(index: number, band: number) {
    const point = footprint.outline[index % footprint.outline.length]!, edge = bands[band]!
    geometry.positions.push(point.x * edge.scale, height, point.z * edge.scale)
    geometry.normals.push(0, edge.weight, 0)
  }
  for (let band = 0; band < bands.length - 1; band++) for (let index = 0; index < footprint.outline.length; index++) {
    vertex(index, band); vertex(index + 1, band + 1); vertex(index, band + 1)
    vertex(index, band); vertex(index + 1, band); vertex(index + 1, band + 1)
  }
  return geometry
}
/** Finite HQ radius fits the outermost office ring and its rounded platforms. */
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
        seams.push(tube(seamPath, 0.006))
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
  let effects: HologramEffects | null = null
  let terrainMaterial: HologramTerrainMaterial | null = null
  let islandMaterial: NaturalIslandMaterial | null = null
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
    const uniforms = Object.fromEntries(['uProjection', 'uView', 'uModel', 'uEye', 'uColor', 'uOpacity', 'uTime', 'uMaterial', 'uAccent', 'uSweepY', 'uConstruction', 'uNavy', 'uNavyDeep', 'uSilver', 'uBrainLight', 'uBrainLightStrength', 'uRoomLight', 'uRoomLightStrength', 'uTerrainMap', 'uTerrainScale', 'uIslandMap', 'uIslandScale', 'uIslandSoil', 'uIslandMoss'].map(name => [name, gl.getUniformLocation(program!, name)]))
    terrainMaterial = createHologramTerrainMaterial(gl)
    islandMaterial = createNaturalIslandMaterial(gl)
    effects = createHologramEffects(gl)
    gl.useProgram(program)
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
    const officeArchitecture = createOfficeArchitecture(DEPARTMENT_OFFICE_WIDTH, DEPARTMENT_OFFICE_DEPTH)
    const furnitureMeshes = (furniture: typeof officeArchitecture.executive) => ({
      body: mesh(furniture.body), top: mesh(furniture.top), metal: mesh(furniture.metal),
      screen: mesh(furniture.screen), light: mesh(furniture.light), details: mesh(furniture.details),
    })
    const officeMeshes = {
      executive: furnitureMeshes(officeArchitecture.executive), department: furnitureMeshes(officeArchitecture.department),
      furnishings: {
        body: mesh(officeArchitecture.furnishings.body), metal: mesh(officeArchitecture.furnishings.metal),
        leaves: mesh(officeArchitecture.furnishings.leaves), light: mesh(officeArchitecture.furnishings.light), shade: mesh(officeArchitecture.furnishings.shade),
      },
    }
    const officeFloorColor = palette.silver.map((value, index) => value * 0.65 + palette.gold[index]! * 0.12 + palette.steelGray[index]! * 0.23) as Vector
    const officeTopColor = palette.pearl.map((value, index) => value * 0.72 + palette.gold[index]! * 0.12 + palette.silver[index]! * 0.16) as Vector
    const officeConcreteColor = palette.silver.map((value, index) => value * 0.68 + palette.steelGray[index]! * 0.22 + palette.navy[index]! * 0.10) as Vector
    const officeCabinetColor = palette.navy.map((value, index) => value * 0.55 + palette.steelGray[index]! * 0.45) as Vector
    const officeScreenColor = palette.navy.map((value, index) => value * 0.70 + palette.silver[index]! * 0.30) as Vector
    const officeWarmLightColor = palette.gold.map((value, index) => value * 0.65 + palette.pearl[index]! * 0.35) as Vector
    const brainAuraColor = palette.navy.map((value, index) => value * 0.55 + palette.silver[index]! * 0.45) as Vector
    const islandTopColor = palette.charcoal.map((value, index) => value * 0.72 + palette.navy[index]! * 0.28) as Vector
    const islandRockColor = palette.coal.map((value, index) => value * 0.52 + palette.navyDeep[index]! * 0.30 + palette.steelGray[index]! * 0.18) as Vector
    const islandSoilColor = palette.gold.map((value, index) => value * 0.24 + palette.coal[index]! * 0.56 + palette.steelGray[index]! * 0.20) as Vector
    const islandMossColor: Vector = [palette.gold[0] * 0.22, palette.gold[1] * 0.36, palette.navy[2] * 0.30]
    const officeFoliageColor = palette.navy.map((value, index) => value * 0.55 + palette.gold[index]! * 0.20 + palette.steelGray[index]! * 0.25) as Vector
    let officeLayout = layoutDepartmentOffices(EMPTY_DEPARTMENTS)
    function workplaceMeshes() {
      const shared = createCircularWorkplaceGeometry(officeLayout, SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT)
      return { floor: mesh(shared.floor), edge: mesh(shared.edge), concrete: mesh(shared.concrete), glass: mesh(shared.glass), frames: mesh(shared.frames) }
    }
    let sharedWorkplaces = workplaceMeshes()
    let islandFootprint = createHqIslandFootprint(officeLayout), lastIslandLayout = officeLayout
    function naturalLand() {
      return createNaturalIslandGeometry(islandFootprint, Math.max(...officeLayout.rings.map(ring => ring.outerRadius)) + 0.12, SPATIAL_VIEWPORT_GROUND_Y)
    }
    const initialLand = naturalLand()
    const geometry = {
      water: mesh(islandWater(islandFootprint)),
      ground: mesh(initialLand.top),
      groundEdge: mesh(initialLand.cliffs),
      groundLight: mesh(initialLand.topGold),
      groundMidLight: mesh(initialLand.middleGold),
      groundShadow: mesh(islandGroundShadow(islandFootprint)),
      islandRocks: mesh(initialLand.rocks), islandGrass: mesh(initialLand.grass),
      hub: mesh(cylinder(2.16, 2.16, SPATIAL_VIEWPORT_GROUND_Y + 0.004, SPATIAL_VIEWPORT_GROUND_Y + 0.044)),
      hubRing: mesh(torus(2.14, 0.012, 192, 8)),
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
    }
    const maximumRenderDimension = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number)
    let disposed = false
    let orbProjection: OrbProjection | null = null
    const staticModel = identity(), brainModel = identity(), auraFirst = identity(), auraSecond = identity(), groundModel = identity()
    const groundLightModel = identity(), hubRingModel = model(0, SPATIAL_VIEWPORT_GROUND_Y + 0.047)
    const outerRingModel = model(0, -0.48), innerRingModel = model(0, -0.30), emitterRingModel = model(0, -0.145)
    let lastCamera: number[] = [], lastWidth = 0, lastHeight = 0, lastFloorRadius = -1
    let viewProjection: Matrix | null = null
    let sceneProjection: Matrix | null = null, sceneView: Matrix | null = null
    let previousDepartments: readonly HqDepartmentOffice[] | null = null, departmentSignature = ''
    let officeEntries = new Map<string, OfficeRenderEntry>()
    const firstSeen = new Map<string, number>()
    let constructionClock = 0, previousSeconds: number | null = null, brainLightPower = 0.86
    function makeEntry(placement: OfficePlacement & { id: string }): OfficeRenderEntry {
      const lamp = officeArchitecture.standingLightPosition, cosine = Math.cos(placement.yaw), sine = Math.sin(placement.yaw)
      return {
        placement,
        wallModel: model(placement.x, SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT, placement.z, 0, 0, placement.yaw),
        completedHeight: 0,
        standingLight: [placement.x + cosine * lamp[0] + sine * lamp[2], SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT + lamp[1], placement.z - sine * lamp[0] + cosine * lamp[2]],
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
          for (const shape of Object.values(sharedWorkplaces)) releaseMesh(shape)
          sharedWorkplaces = workplaceMeshes()
          const nextEntries = new Map<string, OfficeRenderEntry>()
          for (const placement of officeLayout.offices) {
            let entry = officeEntries.get(placement.id)
            if (entry && (entry.placement.x !== placement.x || entry.placement.z !== placement.z || entry.placement.yaw !== placement.yaw)) entry = undefined
            if (!entry) entry = makeEntry(placement)
            nextEntries.set(placement.id, entry)
            if (!firstSeen.has(placement.id)) firstSeen.set(placement.id, constructionClock)
          }
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
    function configureScenePass() {
      if (!gl || !program || !sceneProjection || !sceneView || !orbProjection) return
      gl.useProgram(program)
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true)
      gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD)
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true)
      gl.frontFace(gl.CCW)
      gl.uniformMatrix4fv(uniforms.uProjection!, false, sceneProjection)
      gl.uniformMatrix4fv(uniforms.uView!, false, sceneView)
      const eye = orbProjection.eye
      gl.uniform3fv(uniforms.uEye!, eye)
      gl.uniform3fv(uniforms.uAccent!, palette.gold)
      gl.uniform3fv(uniforms.uNavy!, palette.navy); gl.uniform3fv(uniforms.uNavyDeep!, palette.navyDeep)
      gl.uniform3fv(uniforms.uSilver!, palette.silver)
      gl.uniform3fv(uniforms.uBrainLight!, orbProjection.center)
      gl.uniform1f(uniforms.uBrainLightStrength!, brainLightPower)
      gl.uniform1f(uniforms.uRoomLightStrength!, 0)
      gl.uniform1i(uniforms.uTerrainMap!, 1)
      gl.uniform1f(uniforms.uTerrainScale!, 1 / terrainMaterial!.worldSize)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, terrainMaterial!.texture)
      gl.uniform1i(uniforms.uIslandMap!, 2)
      gl.uniform1f(uniforms.uIslandScale!, 1 / islandMaterial!.worldSize)
      gl.uniform3fv(uniforms.uIslandSoil!, islandSoilColor); gl.uniform3fv(uniforms.uIslandMoss!, islandMossColor)
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, islandMaterial!.texture)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null)
    }
    function drawMesh(shape: Mesh, color: Vector, material: number, opacity = 1, transform = staticModel, singleSided = false, count = shape.count) {
      if (!gl || count <= 0) return
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(position)
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.normal); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(normal)
      gl.uniformMatrix4fv(uniforms.uModel!, false, transform)
      gl.uniform3fv(uniforms.uColor!, color); gl.uniform1f(uniforms.uMaterial!, material); gl.uniform1f(uniforms.uOpacity!, opacity)
      gl.depthMask((opacity >= 1 && (material === 0 || material === 6 || material === 7 || material === 8 || material === 9 || material === 11 || material === 13 || material === 14)) || (material === 4 && opacity > 0.5))
      if (singleSided) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK) }
      else gl.disable(gl.CULL_FACE)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape.indices)
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)
    }
    function drawOffice(entry: OfficeRenderEntry, age: number, executive = false) {
      const complete = age >= OFFICE_BUILD_SECONDS
      const furnishingRise = constructionStage(age, 1.15, 2.20)
      const lampPower = constructionStage(age, 1.55, 2.20)
      gl!.uniform3f(uniforms.uRoomLight!, entry.standingLight[0], SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT + officeArchitecture.standingLightPosition[1] * furnishingRise, entry.standingLight[2])
      gl!.uniform1f(uniforms.uRoomLightStrength!, lampPower * 0.80)
      entry.completedHeight = constructionStage(age, 0.65, 1.45)
      const material = complete ? 0 : 7
      gl!.uniform1f(uniforms.uConstruction!, complete ? 0 : 1 - constructionStage(age, 1.7, OFFICE_BUILD_SECONDS))
      gl!.uniform1f(uniforms.uSweepY!, SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT + OFFICE_WALL_HEIGHT * constructionStage(age, 0.65, 2.2))
      entry.wallModel[5] = Math.max(0.001, furnishingRise)
      if (furnishingRise > 0) {
        const furniture = executive ? officeMeshes.executive : officeMeshes.department
        drawMesh(furniture.body, palette.charcoal, material, 1, entry.wallModel)
        drawMesh(furniture.top, officeTopColor, 8, 1, entry.wallModel)
        drawMesh(furniture.metal, palette.steelGray, 8, 1, entry.wallModel)
        drawMesh(furniture.screen, officeScreenColor, 2, 0.94, entry.wallModel)
        drawMesh(furniture.details, palette.silver, 8, 1, entry.wallModel)
        drawMesh(officeMeshes.furnishings.body, officeCabinetColor, material, 1, entry.wallModel)
        drawMesh(officeMeshes.furnishings.metal, palette.steelGray, 8, 1, entry.wallModel)
        drawMesh(officeMeshes.furnishings.leaves, officeFoliageColor, 0, 1, entry.wallModel)
        drawMesh(officeMeshes.furnishings.shade, officeTopColor, material, 1, entry.wallModel)
        drawMesh(furniture.light, palette.gold, 2, 0.9, entry.wallModel)
        drawMesh(officeMeshes.furnishings.light, officeWarmLightColor, 2, 1, entry.wallModel)
      }
      gl!.uniform1f(uniforms.uRoomLightStrength!, 0)
    }
    function rayAt(clientX: number, clientY: number): SceneRay | null {
      if (disposed || !orbProjection || gl!.isContextLost()) return null
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return null
      const horizontal = ((clientX - bounds.left) / bounds.width * 2 - 1) * Math.tan(SPATIAL_VIEWPORT_VERTICAL_FOV / 2) * orbProjection.aspect
      const vertical = (1 - (clientY - bounds.top) / bounds.height * 2) * Math.tan(SPATIAL_VIEWPORT_VERTICAL_FOV / 2)
      const { eye, right, up, forward } = orbProjection
      return { origin: eye, direction: normalize([forward[0] + right[0] * horizontal + up[0] * vertical, forward[1] + right[1] * horizontal + up[1] * vertical, forward[2] + right[2] * horizontal + up[2] * vertical]) }
    }
    function orbIntersection(ray: SceneRay): number {
      if (!orbProjection) return Infinity
      const { center, radius } = orbProjection
      const origin: Vector = [ray.origin[0] - center[0], ray.origin[1] - center[1], ray.origin[2] - center[2]]
      const projection = dot(origin, ray.direction), discriminant = projection * projection - dot(origin, origin) + radius * radius
      if (discriminant < 0) return Infinity
      const root = Math.sqrt(discriminant), near = -projection - root, far = -projection + root
      return near >= 0.05 ? near : far >= 0.05 ? far : Infinity
    }
    function workplaceIntersection(entry: OfficeRenderEntry, ray: SceneRay, executive = false): number {
      const age = executive ? OFFICE_BUILD_SECONDS : constructionClock - (firstSeen.get(entry.placement.id) ?? constructionClock)
      if (constructionStage(age, 0.25, 0.85) <= 0) return Infinity
      const { startAngle, endAngle, innerRadius, outerRadius } = entry.placement.sector
      const bottom = SPATIAL_VIEWPORT_GROUND_Y + OFFICE_FOUNDATION_HEIGHT
      const top = bottom + OFFICE_WALL_HEIGHT * entry.completedHeight
      const [ox, oy, oz] = ray.origin, [dx, dy, dz] = ray.direction
      const centerAngle = (startAngle + endAngle) / 2, halfSpan = (endAngle - startAngle) / 2
      let nearest = Infinity
      // An annular sector is concave at its inner arc. Intersect its actual
      // horizontal faces, circular sides and two radial sides analytically;
      // rectangular furniture bounds and convex hulls would fill the aisle.
      const candidate = (distance: number) => {
        if (distance < 0.05 || distance >= nearest) return
        const x = ox + dx * distance, y = oy + dy * distance, z = oz + dz * distance
        const radius = Math.hypot(x, z)
        const relativeAngle = Math.atan2(Math.sin(Math.atan2(z, x) - centerAngle), Math.cos(Math.atan2(z, x) - centerAngle))
        if (y >= bottom - 0.0001 && y <= top + 0.0001 && radius >= innerRadius - 0.0001 && radius <= outerRadius + 0.0001 && Math.abs(relativeAngle) <= halfSpan + 0.0001) nearest = distance
      }
      if (Math.abs(dy) > 0.000001) { candidate((bottom - oy) / dy); candidate((top - oy) / dy) }
      const a = dx * dx + dz * dz, b = ox * dx + oz * dz
      if (a > 0.000001) for (const radius of [innerRadius, outerRadius]) {
        const discriminant = b * b - a * (ox * ox + oz * oz - radius * radius)
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant)
          candidate((-b - root) / a); candidate((-b + root) / a)
        }
      }
      for (const angle of [startAngle, endAngle]) {
        const nx = -Math.sin(angle), nz = Math.cos(angle), denominator = nx * dx + nz * dz
        if (Math.abs(denominator) > 0.000001) candidate(-(nx * ox + nz * oz) / denominator)
      }
      return nearest
    }
    function pickSceneAt(clientX: number, clientY: number): { orb: boolean; workplaceId: string | null } {
      const ray = rayAt(clientX, clientY)
      if (!ray) return { orb: false, workplaceId: null }
      let workplaceDistance = workplaceIntersection(executiveEntry, ray, true)
      let workplaceId: string | null = Number.isFinite(workplaceDistance) ? executiveEntry.placement.id : null
      for (const entry of officeEntries.values()) {
        const distance = workplaceIntersection(entry, ray)
        if (distance < workplaceDistance) { workplaceDistance = distance; workplaceId = entry.placement.id }
      }
      const orbDistance = orbIntersection(ray)
      // Use the same nearest-depth decision for both public pick methods. A
      // foreground workplace blocks an orb/office behind it; an orb blocks the
      // office behind its visible sphere. Roads are never candidates.
      if (Number.isFinite(orbDistance) && orbDistance <= workplaceDistance) return { orb: true, workplaceId: null }
      return { orb: false, workplaceId }
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
        if (officeLayout !== lastIslandLayout) {
          // Only land relief/material geometry changes. Preserve the original
          // water boundary, scene radius, flat workplace support and camera fit.
          islandFootprint = createHqIslandFootprint(officeLayout)
          const land = naturalLand()
          for (const shape of [geometry.water, geometry.ground, geometry.groundEdge, geometry.groundLight, geometry.groundMidLight, geometry.groundShadow, geometry.islandRocks, geometry.islandGrass]) releaseMesh(shape)
          geometry.water = mesh(islandWater(islandFootprint))
          geometry.ground = mesh(land.top)
          geometry.groundEdge = mesh(land.cliffs)
          geometry.groundLight = mesh(land.topGold)
          geometry.groundMidLight = mesh(land.middleGold)
          geometry.groundShadow = mesh(islandGroundShadow(islandFootprint))
          geometry.islandRocks = mesh(land.rocks); geometry.islandGrass = mesh(land.grass)
          lastIslandLayout = officeLayout
        }
        const floorRadius = Math.max(hologramFloorRadius(layout.officeLayerCount), officeLayout.floorRadius, islandFootprint.radius)
        const layoutChanged = floorRadius !== lastFloorRadius
        lastFloorRadius = floorRadius
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
        gl.useProgram(program)
        gl.depthMask(true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        if (layoutChanged || width !== lastWidth || height !== lastHeight || camera.yaw !== lastCamera[0] || camera.pitch !== lastCamera[1]
          || camera.zoom !== lastCamera[2] || camera.panX !== lastCamera[3] || camera.panY !== lastCamera[4]) {
          const frame = spatialViewportFrame(camera, width, height, floorRadius)
          // Extend only the presentation far clip to contain the soft sea fade;
          // framing, movement limits, ray directions and minimap remain shared.
          const seaFar = islandFootprint.radius * 2.4 + frame.distance + 2
          const projection = perspective(frame.aspect, Math.max(frame.far, seaFar), frame.near), view = lookAt(frame.eye, frame.target)
          sceneProjection = projection; sceneView = view
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
        brainLightPower = 0.86 + reveal * 0.26
        const float = Math.sin(time * 0.9) * 0.028, beat = 1 + Math.sin(time * 2.15) * 0.006, orbHeight = 0.98 + float
        const shakeX = Math.sin(time * 31) * excited * 0.005, shakeY = Math.sin(time * 37) * excited * 0.004
        gl.uniform1f(uniforms.uTime!, time); gl.uniform3fv(uniforms.uAccent!, palette.gold)
        if (orbProjection) {
          orbProjection.center[0] = shakeX; orbProjection.center[1] = orbHeight + shakeY
          orbProjection.radius = (0.84 - reveal * 0.14) * beat
        }
        // Pose once for shield motion, build progress and neural/aura animation.
        for (const plate of plates) {
          const vibration = Math.sin(time * 33 + plate.phase) * excited * 0.014
          const drift = Math.sin(time * 0.65 + plate.phase) * reveal * 0.006
          model(
            plate.center[0] * beat + plate.travel[0] * reveal + plate.direction[0] * vibration + shakeX,
            orbHeight + plate.center[1] * beat + plate.travel[1] * reveal + drift + shakeY,
            plate.center[2] * beat + plate.travel[2] * reveal + plate.direction[2] * vibration,
            plate.rotation[0] * reveal + vibration, plate.rotation[1] * reveal + vibration, plate.rotation[2] * reveal, beat, plate.transform,
          )
        }
        model(shakeX, orbHeight + shakeY, 0, 0, 0, 0, beat, brainModel)
        model(shakeX, orbHeight + shakeY, 0, 0.52, 0, time * 0.13, 1, auraFirst)
        model(shakeX, orbHeight + shakeY, 0, 1.13, 0.22, -time * 0.09, 1, auraSecond)
        const drawSceneObjects = () => {
          drawMesh(geometry.groundLight, palette.gold, 2, 0.76, groundLightModel)
          drawMesh(geometry.islandRocks, islandRockColor, 9)
          drawMesh(geometry.islandGrass, islandMossColor, 14)
          drawMesh(geometry.hub, palette.navyDeep, 8)
          drawMesh(geometry.hubRing, palette.gold, 2, 0.94, hubRingModel)
          drawMesh(sharedWorkplaces.floor, officeFloorColor, 13)
          drawMesh(sharedWorkplaces.edge, palette.gold, 2, 0.76)
          drawMesh(sharedWorkplaces.concrete, officeConcreteColor, 13)
          drawMesh(sharedWorkplaces.frames, palette.steelGray, 8)
          drawOffice(executiveEntry, OFFICE_BUILD_SECONDS, true)
          for (const [id, entry] of officeEntries) drawOffice(entry, constructionClock - (firstSeen.get(id) ?? constructionClock))
          drawMesh(geometry.base, palette.navyDeep, 8)
          drawMesh(geometry.bevel, palette.steelGray, 8)
          drawMesh(geometry.deck, palette.coal, 8)
          drawMesh(geometry.inset, palette.navy, 8)
          drawMesh(geometry.emitter, palette.charcoal, 8)
          drawMesh(geometry.outerRing, palette.silver, 2, 0.94, outerRingModel)
          drawMesh(geometry.innerRing, palette.silver, 2, 0.86, innerRingModel)
          drawMesh(geometry.emitterRing, palette.gold, 2, 1, emitterRingModel)
          for (const plate of plates) {
            const coating = plate.phase < 1.7 ? palette.navyDeep : plate.phase < 3.5 ? palette.navy : palette.charcoal
            drawMesh(plate.body, coating, 8, 1, plate.transform)
            drawMesh(plate.seam, palette.gold, 2, 0.94 + excited * 0.06, plate.transform)
          }
          if (reveal > 0.001) {
            drawMesh(geometry.lobes, palette.silver, 4, reveal * 0.88, brainModel, true)
            drawMesh(geometry.stem, palette.steelGray, 4, reveal * 0.85, brainModel)
            drawMesh(geometry.folds, palette.steelGray, 2, reveal * 0.78, brainModel)
            drawMesh(geometry.nerves, palette.gold, 3, reveal * 0.94, brainModel)
          }
          drawMesh(geometry.shell, palette.pearl, 1, 0.50, brainModel, true)
          drawMesh(geometry.auraShell, brainAuraColor, 1, 0.36, brainModel, true)
          drawMesh(geometry.auraRing, palette.gold, 5, 0.74, auraFirst)
          drawMesh(geometry.auraRing, palette.silver, 5, 0.46, auraSecond)
        }
        const effectsReady = effects?.resize(renderWidth, renderHeight) ?? false
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, renderWidth, renderHeight)
        configureScenePass()
        gl.uniform1f(uniforms.uTime!, time)
        gl.depthMask(true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        // Water depth hides submerged rock while the opaque upper coast and
        // rooms render naturally in front. No reflection pass/target is used.
        drawMesh(geometry.water, palette.pearl, 11, 1, staticModel, true)
        drawMesh(geometry.groundShadow, palette.coal, 10, 0.48, staticModel)
        drawMesh(geometry.ground, islandTopColor, 6, 1, groundModel, true)
        drawMesh(geometry.groundEdge, islandRockColor, 9, 1, groundModel, true)
        drawMesh(geometry.groundMidLight, palette.gold, 2, 0.68)
        drawSceneObjects()
        // Transparent upper partitions follow all opaque objects, retaining
        // visibility through neighbouring workplaces without writing depth.
        drawMesh(sharedWorkplaces.glass, palette.silver, 12, 1)
        if (effectsReady) effects?.compositeBloom()

      },
      hitTestOrb(clientX, clientY) {
        return pickSceneAt(clientX, clientY).orb
      },
      hitTestWorkplace(clientX, clientY) {
        return pickSceneAt(clientX, clientY).workplaceId
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
        effects?.dispose(); effects = null
        terrainMaterial?.dispose(); terrainMaterial = null
        islandMaterial?.dispose(); islandMaterial = null
        for (const buffer of buffers) gl.deleteBuffer(buffer)
        for (const shader of shaders) gl.deleteShader(shader)
        gl.deleteProgram(program)
      },
    }
  }
  catch {
    effects?.dispose()
    terrainMaterial?.dispose()
    islandMaterial?.dispose()
    for (const buffer of buffers) gl.deleteBuffer(buffer)
    for (const shader of shaders) gl.deleteShader(shader)
    if (program) gl.deleteProgram(program)
    return null
  }
}
