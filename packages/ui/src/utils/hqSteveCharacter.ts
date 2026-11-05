import type { OfficeArchitectureGeometry } from './officeArchitecture.ts'

type V = [number, number, number]
type Geometry = OfficeArchitectureGeometry
export type StevePigment = 'skin' | 'skinShade' | 'hair' | 'hairRidge' | 'navy' | 'lapel' | 'waistcoat' | 'coal' | 'shirt' | 'gold' | 'eyeWhite' | 'iris' | 'pupil' | 'lip' | 'sole'
export type SteveJoint = 'root' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'leftShoe' | 'rightShoe'
export interface SteveCharacterBatch { joint: SteveJoint; pigment: StevePigment; geometry: Geometry }

/** Adult proportions from the founder's CEO turnaround, normalized at draw time. */
export const HQ_STEVE_RIG = { height: 1.52, shoulderY: 1.19, shoulderX: 0.195, hipY: 0.72, hipX: 0.099, ankleY: 0.065, legLength: 0.655, armLength: 0.49 } as const

const TAU = Math.PI * 2
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s]
const unit = (a: V): V => scale(a, 1 / (Math.hypot(...a) || 1))
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

function vertex(g: Geometry, p: V, n: V) { g.positions.push(...p); g.normals.push(...n) }
function patch(g: Geometry, points: V[]) {
  if (cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!))[2] > 0) points = [...points].reverse()
  const n = unit(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!)))
  for (let i = 1; i < points.length - 1; i++) for (const p of [points[0]!, points[i]!, points[i + 1]!]) vertex(g, p, n)
}
/** Smooth parametric surfaces are baked once; no per-frame vertex work. */
function surface(g: Geometry, point: (u: number, v: number) => V, columns: number, rows: number, reverse = false) {
  const at = (i: number, j: number) => {
    const u = i / columns, v = j / rows, p = point(u, v)
    const du = sub(point(clamp(u + 0.0001), v), point(clamp(u - 0.0001), v))
    const dv = sub(point(u, clamp(v + 0.0001)), point(u, clamp(v - 0.0001)))
    const n = unit(reverse ? cross(dv, du) : cross(du, dv))
    vertex(g, p, n)
  }
  for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
    if (reverse) {
      at(i, j); at(i, j + 1); at(i + 1, j)
      at(i + 1, j); at(i, j + 1); at(i + 1, j + 1)
    } else {
      at(i, j); at(i + 1, j); at(i, j + 1)
      at(i + 1, j); at(i + 1, j + 1); at(i, j + 1)
    }
  }
}
function oval(g: Geometry, center: V, radii: V, columns = 20, rows = 12) {
  surface(g, (u, v) => {
    const a = u * TAU, b = 0.0001 + v * (Math.PI - 0.0002)
    return [center[0] + radii[0] * Math.sin(b) * Math.sin(a), center[1] + radii[1] * Math.cos(b), center[2] - radii[2] * Math.sin(b) * Math.cos(a)]
  }, columns, rows)
}
type Section = [y: number, xRadius: number, zRadius: number, zOffset?: number]
function section(profile: Section[], y: number): [number, number, number] {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]!, b = profile[i + 1]!
    if (y <= b[0]) {
      const t = clamp((y - a[0]) / (b[0] - a[0])), s = t * t * (3 - 2 * t)
      return [mix(a[1], b[1], s), mix(a[2], b[2], s), mix(a[3] ?? 0, b[3] ?? 0, s)]
    }
  }
  const last = profile[profile.length - 1]!
  return [last[1], last[2], last[3] ?? 0]
}
function loft(g: Geometry, profile: Section[], columns = 28, rows = 36) {
  surface(g, (u, v) => {
    const y = mix(profile[0]![0], profile[profile.length - 1]![0], v), r = section(profile, y), a = u * TAU
    return [r[0] * Math.sin(a), y, r[2] - r[1] * Math.cos(a)]
  }, columns, rows, true)
}
function curve(a: V, b: V, c: V, d: V, t: number): V {
  const s = 1 - t
  return [0, 1, 2].map(i => a[i]! * s ** 3 + 3 * b[i]! * s * s * t + 3 * c[i]! * s * t * t + d[i]! * t ** 3) as V
}
function strand(g: Geometry, points: [V, V, V, V], radius: number, endRadius = radius, flat = 1, steps = 14, sides = 8) {
  surface(g, (u, v) => {
    const p = curve(...points, v), tangent = unit(sub(curve(...points, clamp(v + 0.001)), curve(...points, clamp(v - 0.001))))
    const across = unit(cross(tangent, Math.abs(tangent[1]) < 0.92 ? [0, 1, 0] : [0, 0, 1])), up = cross(tangent, across)
    const r = mix(radius, endRadius, v), a = u * TAU
    return add(p, add(scale(across, Math.cos(a) * r), scale(up, Math.sin(a) * r * flat)))
  }, sides, steps)
}
function line(g: Geometry, points: V[], radius: number) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!
    strand(g, [a, add(a, scale(sub(b, a), 0.33)), add(a, scale(sub(b, a), 0.67)), b], radius, radius, 1, 2, 6)
  }
}

/**
 * Steve-only, reference-led solid geometry: front/side/back all have real volume.
 * Material/joint batches reuse the HQ WebGL buffers, lights and pose controller.
 * No image billboard, remote asset dependency, provider call or roster change.
 */
export function createHqSteveCharacter(): SteveCharacterBatch[] {
  const batches: SteveCharacterBatch[] = []
  function batch(pigment: StevePigment, joint: SteveJoint = 'root'): Geometry {
    const existing = batches.find(b => b.joint === joint && b.pigment === pigment)
    if (existing) return existing.geometry
    const geometry = { positions: [], normals: [] }
    batches.push({ joint, pigment, geometry }); return geometry
  }
  const skin = batch('skin'), shade = batch('skinShade'), hair = batch('hair'), ridges = batch('hairRidge')
  const jacket = batch('navy'), lapel = batch('lapel'), shirt = batch('shirt'), vest = batch('waistcoat'), gold = batch('gold')
  const coal = batch('coal'), white = batch('eyeWhite'), iris = batch('iris'), pupils = batch('pupil'), lips = batch('lip')

  // Neck, jaw, cheeks and brow: narrow chin and adult forehead, not the generic sphere.
  loft(skin, [[1.16, 0.045, 0.043], [1.23, 0.045, 0.044], [1.30, 0.047, 0.045]], 24, 12)
  const face: Section[] = [[1.267, 0.029, 0.034], [1.278, 0.047, 0.050], [1.300, 0.065, 0.063], [1.335, 0.078, 0.071], [1.375, 0.080, 0.074], [1.417, 0.074, 0.071], [1.452, 0.061, 0.057], [1.470, 0.006, 0.008]]
  loft(skin, face, 48, 60)
  function facePatch(target: Geometry, cx: number, cy: number, rx: number, ry: number, lift: number) {
    surface(target, (u, v) => {
      const a = u * TAU, radius = 0.0001 + v * 0.9999
      const x = cx + Math.cos(a) * rx * radius, y = cy + Math.sin(a) * ry * radius
      const r = section(face, y), z = -r[1] * Math.sqrt(Math.max(0.01, 1 - (x / r[0]) ** 2))
      return [x, y, z - lift - (1 - radius * radius) * 0.0015]
    }, 32, 12)
  }

  for (const side of [-1, 1]) {
    oval(skin, [side * 0.079, 1.357, 0.003], [0.017, 0.029, 0.016])
    oval(shade, [side * 0.087, 1.356, -0.009], [0.0075, 0.018, 0.004], 12, 8)
    oval(skin, [side * 0.086, 1.354, -0.013], [0.003, 0.012, 0.004], 10, 6)
    // Sculpted cheek and lower eyelid support; large warm brown eyes from the sheet.
    facePatch(shade, side * 0.034, 1.377, 0.024, 0.013, 0.0005)
    facePatch(white, side * 0.034, 1.377, 0.021, 0.010, 0.0010)
    facePatch(iris, side * 0.034, 1.377, 0.0086, 0.009, 0.0030)
    facePatch(pupils, side * 0.034, 1.377, 0.0045, 0.0062, 0.0045)
    facePatch(white, side * 0.034 - 0.0025, 1.381, 0.0018, 0.0018, 0.0060)
    strand(skin, [[side * 0.013, 1.376, -0.073], [side * 0.023, 1.390, -0.073], [side * 0.047, 1.390, -0.061], [side * 0.055, 1.376, -0.054]], 0.0035, 0.0025)
    strand(hair, [[side * 0.011, 1.399, -0.072], [side * 0.024, 1.406, -0.071], [side * 0.043, 1.405, -0.062], [side * 0.060, 1.396, -0.045]], 0.006, 0.003, 0.6)
  }
  // A projecting nose bridge/tip, nostrils and gentle closed smile.
  loft(skin, [[1.326, 0.006, 0.004, -0.079], [1.334, 0.014, 0.010, -0.081], [1.343, 0.011, 0.011, -0.079], [1.370, 0.006, 0.005, -0.073], [1.380, 0.002, 0.001, -0.070]], 28, 28)
  for (const side of [-1, 1]) {
    oval(shade, [side * 0.009, 1.330, -0.086], [0.004, 0.0023, 0.004], 12, 6)
  }
  // Beard hugs the jaw surface; exposed lips and cheeks are never painted black.
  surface(hair, (u, v) => {
    const a = mix(-Math.PI * 0.68, Math.PI * 0.68, u), upper = 1.294 + Math.pow(Math.abs(Math.sin(a)), 0.85) * 0.061
    const y = mix(1.271, upper, v), r = section(face, y)
    return [(r[0] + 0.0025) * Math.sin(a), y, -(r[1] + 0.003) * Math.cos(a)]
  }, 44, 22, true)
  strand(lips, [[-0.021, 1.310, -0.064], [-0.009, 1.305, -0.068], [0.010, 1.305, -0.068], [0.022, 1.311, -0.063]], 0.0012, 0.0010, 0.7)
  strand(hair, [[-0.026, 1.315, -0.072], [-0.014, 1.325, -0.081], [-0.004, 1.321, -0.083], [0, 1.318, -0.081]], 0.0035, 0.003)
  strand(hair, [[0, 1.318, -0.081], [0.006, 1.322, -0.083], [0.018, 1.323, -0.079], [0.027, 1.315, -0.071]], 0.003, 0.0035)
  oval(hair, [0, 1.290, -0.065], [0.013, 0.008, 0.003], 16, 8)

  // Continuous back/temple cap plus overlapping swept locks and restrained ridges.
  surface(hair, (u, v) => {
    const a = u * TAU, edge = 1.423 - Math.pow(Math.max(0, -Math.cos(a)), 0.7) * 0.095 + Math.sin(a) * 0.009 + Math.cos(a * 3.0) * 0.009
    const b = v * Math.PI / 2, horizontal = Math.sin(b)
    return [Math.sin(a) * 0.085 * horizontal, mix(1.484, edge, 1 - Math.cos(b)), -Math.cos(a) * 0.081 * horizontal + 0.005]
  }, 40, 20)
  function hairLock(target: Geometry, path: [V, V, V, V], width: number) {
    surface(target, (u, v) => {
      const p = curve(...path, v), tangent = unit(sub(curve(...path, clamp(v + 0.001)), curve(...path, clamp(v - 0.001))))
      const across = unit(cross(tangent, [0, 0, 1])), up = cross(tangent, across)
      const r = 0.001 + Math.pow(Math.sin(v * Math.PI), 0.55) * width, a = u * TAU
      return add(p, add(scale(across, Math.cos(a) * r), scale(up, Math.sin(a) * r * 0.78)))
    }, 12, 24)
  }
  for (let i = 0; i < 7; i++) {
    const z = -0.060 + i * 0.020
    const path: [V, V, V, V] = [[0.065, 1.430, z], [0.042, 1.529 - i * 0.003, z - 0.009], [-0.047, 1.519 - i * 0.002, z - 0.009], [-0.072, 1.435 - i * 0.002, z + 0.014]]
    hairLock(hair, path, 0.020)
    const ridge = path.map(p => [p[0], p[1] + 0.021, p[2] - 0.004] as V) as [V, V, V, V]
    hairLock(ridges, ridge, 0.0012)
  }
  // Characteristic loose front wave and sideburns.
  hairLock(hair, [[0.042, 1.448, -0.064], [0.013, 1.514, -0.097], [-0.048, 1.477, -0.095], [-0.054, 1.415, -0.068]], 0.023)
  for (const side of [-1, 1]) strand(hair, [[side * 0.073, 1.431, -0.019], [side * 0.083, 1.405, -0.017], [side * 0.078, 1.371, -0.018], [side * 0.071, 1.345, -0.025]], 0.009, 0.005, 0.65)

  // Flatten the excessive cap volume into a swept, rounded quiff.
  for (const g of [hair, ridges]) {
    for (let i = 1; i < g.positions.length; i += 3) {
      if (g.positions[i]! > 1.42) g.positions[i] = 1.42 + (g.positions[i]! - 1.42) * 0.60
    }
  }
  // A continuous undercut volume closes the crown/back beneath separate locks.
  oval(hair, [0, 1.432, 0.008], [0.078, 0.048, 0.078], 36, 24)
  // Set the jaw into the open collar; preserve all sculpted feature alignment.
  for (const g of [skin, shade, hair, ridges, white, iris, pupils, lips]) {
    for (let i = 0; i < g.positions.length; i += 3) {
      g.positions[i] = g.positions[i]! * 1.10
      g.positions[i + 1] = 1.36 + (g.positions[i + 1]! - 1.36) * 1.06 - 0.036
    }
    for (let i = 0; i < g.normals.length; i += 3) {
      const n = unit([g.normals[i]! / 1.10, g.normals[i + 1]! / 1.06, g.normals[i + 2]!])
      g.normals[i] = n[0]; g.normals[i + 1] = n[1]; g.normals[i + 2] = n[2]
    }
  }
  // Tailored shoulder/chest/waist silhouette and a real back seam.
  loft(jacket, [[0.688, 0.162, 0.096], [0.728, 0.173, 0.103], [0.865, 0.155, 0.093], [1.015, 0.184, 0.108], [1.153, 0.198, 0.100], [1.204, 0.177, 0.075]], 40, 48)
  line(lapel, [[0, 0.705, 0.100], [0, 0.89, 0.095], [0, 1.09, 0.103], [0, 1.19, 0.078]], 0.0015)
  // Open collar and charcoal buttoned waistcoat sit above the jacket front.
  patch(vest, [[-0.072, 1.142, -0.111], [-0.078, 0.786, -0.108], [0, 0.752, -0.119], [0, 1.037, -0.123]])
  patch(vest, [[0.072, 1.142, -0.111], [0.078, 0.786, -0.108], [0, 0.752, -0.119], [0, 1.037, -0.123]])
  patch(shirt, [[-0.058, 1.204, -0.105], [-0.061, 1.124, -0.117], [0, 1.047, -0.125], [0.061, 1.124, -0.117], [0.058, 1.204, -0.105]])
  for (const side of [-1, 1]) {
    patch(shirt, [[side * 0.012, 1.228, -0.080], [side * 0.058, 1.211, -0.108], [side * 0.057, 1.160, -0.124], [side * 0.025, 1.185, -0.128]])
    const edge: V[] = [[side * 0.064, 1.216, -0.078], [side * 0.135, 1.166, -0.103], [side * 0.115, 1.145, -0.113], [side * 0.147, 1.143, -0.104], [side * 0.064, 0.978, -0.118], [side * 0.045, 0.879, -0.108], [side * 0.051, 0.706, -0.100]]
    patch(lapel, [edge[0]!, edge[1]!, edge[2]!, edge[3]!, edge[4]!, [side * 0.030, 1.041, -0.126]])
    line(gold, edge, 0.0021)
    line(gold, [[side * 0.086, 0.852, -0.091], [side * 0.149, 0.854, -0.070]], 0.0024)
    patch(lapel, [[side * 0.083, 0.851, -0.093], [side * 0.148, 0.853, -0.073], [side * 0.148, 0.837, -0.073], [side * 0.084, 0.835, -0.093]])
    oval(gold, [side * 0.057, 0.915, -0.110], [0.0034, 0.0034, 0.0018], 12, 8)
  }
  for (let i = 0; i < 4; i++) oval(gold, [0.002, 1.006 - i * 0.049, -0.124], [0.0025, 0.0025, 0.0016], 10, 6)
  // Belt/buckle, shoe welt and the small white Building Suit monogram.
  loft(coal, [[0.718, 0.142, 0.092], [0.747, 0.143, 0.093]], 28, 4)
  line(gold, [[-0.017, 0.721, -0.097], [-0.017, 0.744, -0.097], [0.017, 0.744, -0.097], [0.017, 0.721, -0.097], [-0.017, 0.721, -0.097]], 0.0022)
  const badgeX = -0.118, badgeY = 1.071, badgeZ = -0.103
  line(shirt, [[badgeX - 0.008, badgeY - 0.015, badgeZ], [badgeX - 0.008, badgeY + 0.015, badgeZ]], 0.0022)
  line(shirt, [[badgeX - 0.002, badgeY - 0.015, badgeZ], [badgeX - 0.002, badgeY + 0.015, badgeZ], [badgeX + 0.009, badgeY + 0.012, badgeZ], [badgeX + 0.011, badgeY + 0.005, badgeZ], [badgeX - 0.001, badgeY, badgeZ], [badgeX + 0.011, badgeY - 0.003, badgeZ], [badgeX + 0.011, badgeY - 0.011, badgeZ], [badgeX - 0.002, badgeY - 0.015, badgeZ]], 0.0017)
  line(gold, [[badgeX - 0.013, badgeY - 0.015, badgeZ], [badgeX - 0.013, badgeY + 0.015, badgeZ]], 0.0012)

  // A-pose limbs use the existing joint animation; hands have separate fingers.
  loft(coal, [[0.68, 0.142, 0.088], [0.731, 0.143, 0.089]], 28, 8)
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1, armJoint = `${side}Arm` as SteveJoint, legJoint = `${side}Leg` as SteveJoint, shoeJoint = `${side}Shoe` as SteveJoint
    const sleeve = batch('navy', armJoint), hand = batch('skin', armJoint), cuff = batch('shirt', armJoint), buttons = batch('gold', armJoint)
    loft(sleeve, [[-0.406, 0.042, 0.042, -0.012], [-0.294, 0.048, 0.046, -0.007], [-0.218, 0.052, 0.050], [-0.10, 0.059, 0.059], [-0.010, 0.067, 0.066], [0.023, 0.039, 0.043]], 24, 28)
    loft(cuff, [[-0.418, 0.040, 0.040, -0.012], [-0.402, 0.041, 0.041, -0.012]], 24, 4)
    oval(hand, [0, -0.448, -0.011], [0.036, 0.041, 0.022], 20, 12)
    for (let finger = 0; finger < 4; finger++) {
      const x = -0.025 + finger * 0.016, length = [0.041, 0.052, 0.048, 0.036][finger]!
      strand(hand, [[x, -0.466, -0.010], [x, -0.480, -0.012], [x, -0.466 - length, -0.020], [x, -0.470 - length, -0.029]], 0.0082, 0.0062, 0.85, 10, 8)
      oval(hand, [x, -0.472 - length, -0.027], [0.0062, 0.0065, 0.0062], 10, 6)
    }
    strand(hand, [[sign * 0.028, -0.435, -0.008], [sign * 0.052, -0.444, -0.015], [sign * 0.046, -0.466, -0.037], [sign * 0.037, -0.471, -0.038]], 0.011, 0.0075, 0.9, 12, 8)
    for (let i = 0; i < 3; i++) oval(buttons, [sign * 0.041, -0.390 + i * 0.015, -0.018], [0.0028, 0.0028, 0.0028], 10, 6)
    const pants = batch('coal', legJoint), crease = batch('waistcoat', legJoint)
    loft(pants, [[-0.655, 0.048, 0.048], [-0.608, 0.052, 0.050], [-0.430, 0.054, 0.052, 0.005], [-0.322, 0.060, 0.058, -0.003], [-0.210, 0.070, 0.065], [-0.060, 0.083, 0.080], [0.031, 0.075, 0.082]], 28, 38)
    line(crease, [[0, -0.08, -0.082], [0, -0.30, -0.063], [0, -0.48, -0.053], [0, -0.62, -0.051]], 0.0012)
    const shoe = batch('coal', shoeJoint), sole = batch('sole', shoeJoint), welt = batch('gold', shoeJoint), laces = batch('waistcoat', shoeJoint)
    oval(sole, [0, -0.041, -0.034], [0.061, 0.018, 0.117], 28, 10)
    oval(shoe, [0, -0.014, -0.034], [0.058, 0.037, 0.111], 32, 16)
    oval(shoe, [0, 0.014, 0.017], [0.045, 0.044, 0.053], 24, 12)
    const outline: V[] = Array.from({ length: 33 }, (_, i) => { const a = i / 32 * TAU; return [Math.sin(a) * 0.060, -0.028, -0.034 - Math.cos(a) * 0.115] })
    line(welt, outline, 0.0018)
    for (let i = 0; i < 5; i++) line(laces, [[-0.024, 0.019 + i * 0.004, -0.072 + i * 0.014], [0.024, 0.022 + i * 0.004, -0.064 + i * 0.014]], 0.0017)
  }
  return batches
}

/** Steve-only cloth/skin/hair/shoe response; other scene material IDs are untouched. */
export const HQ_STEVE_MATERIAL_GLSL = `
  if (uMaterial >= 20.0) {
    vec3 n = normalize(vNormal), view = normalize(uEye - vWorld);
    vec3 key = normalize(vec3(-1.5, 3.0, -2.5));
    float diffuse = max(dot(n, key), 0.0);
    float fill = max(dot(n, normalize(vec3(2.0, 1.5, 1.5))), 0.0);
    float rim = pow(1.0 - max(dot(n, view), 0.0), 3.0);
    vec3 halfLight = normalize(key + view);
    float shine = pow(max(dot(n, halfLight), 0.0), uMaterial > 23.5 ? 64.0 : 22.0);
    vec3 surface = uColor;
    // Distance-filtered cloth weave: small enough to read as fabric, never stripes.
    if (uMaterial < 20.5) {
      float detail = 1.0 - smoothstep(1.2, 4.5, length(uEye - vWorld));
      float weave = sin(vLocal.x * 1250.0) * sin(vLocal.y * 1370.0);
      surface *= 1.0 + weave * 0.025 * detail;
    }
    vec3 color = surface * (0.56 + diffuse * 0.48 + fill * 0.13);
    float gloss = uMaterial > 23.5 ? 0.42 : uMaterial > 22.5 ? 0.12 : uMaterial > 21.5 ? 0.07 : uMaterial > 20.5 ? 0.045 : 0.018;
    color += mix(uSilver, surface, 0.48) * shine * gloss;
    color += surface * rim * 0.10;
    vec3 brainOffset = uBrainLight - vWorld;
    color += mix(uAccent, uSilver, 0.32) * uBrainLightStrength * 0.035 / (1.0 + dot(brainOffset, brainOffset) * 0.58);
    gl_FragColor = vec4(color, uOpacity);
    return;
  }
`

/** Shared costume pigments for the live character and its portable model export. */
export function hqStevePigments(palette: Record<'navy' | 'steelGray' | 'coal' | 'charcoal' | 'pearl' | 'gold', V>): Record<StevePigment, V> {
  return {
    skin: [0.84, 0.55, 0.35], skinShade: [0.62, 0.32, 0.19],
    hair: [0.090, 0.058, 0.045], hairRidge: [0.170, 0.113, 0.084],
    navy: palette.navy.map((v, i) => v * 0.66 + palette.steelGray[i]! * 0.22 + palette.coal[i]! * 0.12) as V,
    lapel: palette.navy.map((v, i) => v * 0.63 + palette.steelGray[i]! * 0.25 + palette.coal[i]! * 0.12) as V,
    waistcoat: palette.charcoal.map((v, i) => v * 0.85 + palette.coal[i]! * 0.15) as V,
    coal: palette.coal.map((v, i) => v * 0.78 + palette.charcoal[i]! * 0.22) as V,
    shirt: palette.pearl, gold: palette.gold, eyeWhite: [0.88, 0.84, 0.77],
    iris: [0.26, 0.13, 0.055], pupil: [0.016, 0.011, 0.009], lip: [0.39, 0.19, 0.115], sole: [0.025, 0.025, 0.028],
  }
}
