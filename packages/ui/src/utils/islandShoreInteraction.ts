import { FULL_TURN, OCEAN_WAVES, waveFrequency, ISLAND_SHORE_CONFIG as C } from './islandWaterConfig.ts'
import type { NaturalIslandGeometry } from './naturalIslandGeometry.ts'

type Point = { x: number; z: number }
type Contact = Point & { y: number; nx: number; nz: number; steepness: number }
export interface ShoreSample { distance: number; nx: number; nz: number; steepness: number; bed: number; shadow: number }
interface Edge { ax: number; az: number; bx: number; bz: number; nx: number; nz: number; steepness: number }
export interface IslandShore {
  seaLevel: number
  sample: (x: number, z: number) => ShoreSample
  contact: (angle: number, height: number) => Contact
}
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const direction = (x: number, z: number) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l } }
const wind = direction(OCEAN_WAVES[0].direction[0], OCEAN_WAVES[0].direction[1])
const cross2 = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx

/** Slice the actual triangles once; never raycast the terrain in the frame loop. */
export function createIslandShore(cliffs: NaturalIslandGeometry, seaLevel: number): IslandShore {
  type Section = { ar: number; ah: number; br: number; bh: number; nx: number; nz: number; steepness: number }
  const triangleBins: number[][] = Array.from({ length: C.waterSegments }, () => [])
  for (let offset = 0; offset < cliffs.positions.length; offset += 9) {
    const p = cliffs.positions
    if (Math.hypot(p[offset]!, p[offset + 2]!) < 0.001) continue // underside fan
    const angle = Math.atan2(p[offset + 2]!, p[offset]!)
    const relative = [0, 3, 6].map(side => {
      const delta = Math.atan2(p[offset + side + 2]!, p[offset + side]!) - angle
      return Math.atan2(Math.sin(delta), Math.cos(delta))
    })
    const first = Math.floor((angle + Math.min(...relative)) / FULL_TURN * C.waterSegments)
    const last = Math.floor((angle + Math.max(...relative)) / FULL_TURN * C.waterSegments)
    for (let bin = first; bin <= last; bin++) triangleBins[(bin % C.waterSegments + C.waterSegments) % C.waterSegments]!.push(offset)
  }
  const sections = new Map<string, Section[]>()
  const angleKey = (angle: number) => (((angle / FULL_TURN % 1 + 1) % 1) * FULL_TURN).toFixed(9)
  function buildSection(angle: number) {
    const key = angleKey(angle)
    if (sections.has(key)) return
    const dx = Math.cos(angle), dz = Math.sin(angle), result: Section[] = [], p = cliffs.positions
    const bin = Math.floor(((angle / FULL_TURN % 1 + 1) % 1) * C.waterSegments) % C.waterSegments
    // Only triangles in this angular column can intersect its radial plane.
    const candidates = new Set([...triangleBins[bin]!, ...triangleBins[(bin + C.waterSegments - 1) % C.waterSegments]!, ...triangleBins[(bin + 1) % C.waterSegments]!])
    for (const offset of candidates) {
      const hits: { r: number; h: number }[] = []
      for (let side = 0; side < 3; side++) {
        const a = offset + side * 3, b = offset + ((side + 1) % 3) * 3
        const sa = cross2(dx, dz, p[a]!, p[a + 2]!), sb = cross2(dx, dz, p[b]!, p[b + 2]!)
        if (Math.abs(sa) < 1e-7) hits.push({ r: dx * p[a]! + dz * p[a + 2]!, h: p[a + 1]! - seaLevel })
        if (sa * sb < -1e-14) {
          const t = sa / (sa - sb)
          hits.push({ r: dx * mix(p[a]!, p[b]!, t) + dz * mix(p[a + 2]!, p[b + 2]!, t), h: mix(p[a + 1]!, p[b + 1]!, t) - seaLevel })
        }
      }
      const a = hits[0], b = hits.find(hit => a && Math.abs(hit.r - a.r) + Math.abs(hit.h - a.h) > 1e-6)
      if (!a || !b || Math.max(a.r, b.r) <= 0) continue
      const n = direction(cliffs.normals[offset]!, cliffs.normals[offset + 2]!)
      if (n.x * dx + n.z * dz < 0) { n.x *= -1; n.z *= -1 }
      result.push({ ar: a.r, ah: a.h, br: b.r, bh: b.h, nx: n.x, nz: n.z,
        steepness: Math.sqrt(Math.max(0, 1 - cliffs.normals[offset + 1]! ** 2)) })
    }
    sections.set(key, result)
  }
  // Exact radial sections for all render columns and candidate emitters, built once.
  for (let i = 0; i < C.waterSegments; i++) buildSection(i / C.waterSegments * FULL_TURN)
  for (let i = 0; i < C.impactSites; i++) buildSection((i + C.impactSiteOffset) / C.impactSites * FULL_TURN)
  const contours = C.contactHeights.map(height => {
    const edges: Edge[] = [], level = seaLevel + height
    for (let offset = 0; offset < cliffs.positions.length; offset += 9) {
      const p = cliffs.positions, hits: Point[] = []
      for (let side = 0; side < 3; side++) {
        const a = offset + side * 3, b = offset + ((side + 1) % 3) * 3
        const ay = p[a + 1]!, by = p[b + 1]!
        if ((ay <= level && by > level) || (by <= level && ay > level)) {
          const t = (level - ay) / (by - ay)
          hits.push({ x: mix(p[a]!, p[b]!, t), z: mix(p[a + 2]!, p[b + 2]!, t) })
        }
      }
      if (hits.length !== 2) continue
      const a = hits[0]!, b = hits[1]!, normal = direction(cliffs.normals[offset]!, cliffs.normals[offset + 2]!)
      if (normal.x * (a.x + b.x) + normal.z * (a.z + b.z) < 0) { normal.x *= -1; normal.z *= -1 }
      edges.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, nx: normal.x, nz: normal.z,
        steepness: Math.sqrt(Math.max(0, 1 - cliffs.normals[offset + 1]! ** 2)) })
    }
    if (!edges.length) throw new Error('Island shoreline has no terrain intersection')
    return Array.from({ length: C.coastSamples }, (_, index) => {
      const angle = index / C.coastSamples * FULL_TURN, dx = Math.cos(angle), dz = Math.sin(angle)
      let radius = -Infinity, normal = { nx: dx, nz: dz, steepness: 1 }
      for (const edge of edges) {
        const ex = edge.bx - edge.ax, ez = edge.bz - edge.az, denominator = cross2(dx, dz, ex, ez)
        if (Math.abs(denominator) < 1e-8) continue
        const t = cross2(edge.ax, edge.az, ex, ez) / denominator
        const u = cross2(edge.ax, edge.az, dx, dz) / denominator
        if (t > radius && u >= -1e-6 && u <= 1 + 1e-6) { radius = t; normal = edge }
      }
      if (!Number.isFinite(radius) || radius <= 0) throw new Error('Island shoreline contour is incomplete')
      return { radius, nx: normal.nx, nz: normal.nz, steepness: normal.steepness }
    })
  })
  function at(angle: number, layer: number) {
    const sample = ((angle / FULL_TURN % 1 + 1) % 1) * C.coastSamples, index = Math.floor(sample), t = sample - index
    const a = contours[layer]![index]!, b = contours[layer]![(index + 1) % C.coastSamples]!
    const n = direction(mix(a.nx, b.nx, t), mix(a.nz, b.nz, t))
    return { radius: mix(a.radius, b.radius, t), nx: n.x, nz: n.z, steepness: mix(a.steepness, b.steepness, t) }
  }
  const coast = contours[1]!.map((_, index) => {
    const angle = index / C.coastSamples * FULL_TURN, p = at(angle, 1)
    // The face above the small waterline bevel governs cliff energy redirection.
    return { x: Math.cos(angle) * p.radius, z: Math.sin(angle) * p.radius, ...p, steepness: at(angle, 3).steepness }
  })
  const sideExtent = Math.max(...coast.map(p => Math.abs(-wind.z * p.x + wind.x * p.z)))
  // Silhouette lookup from the real coast, in the prevailing wave's coordinates.
  const backs = Array.from({ length: 257 }, (_, bin) => {
    const side = (bin / 256 * 2 - 1) * sideExtent
    let back = -Infinity
    for (let i = 0; i < coast.length; i++) {
      const a = coast[i]!, b = coast[(i + 1) % coast.length]!
      const sa = -wind.z * a.x + wind.x * a.z, sb = -wind.z * b.x + wind.x * b.z
      if ((side >= Math.min(sa, sb) && side <= Math.max(sa, sb)) && Math.abs(sb - sa) > 1e-8) {
        const t = (side - sa) / (sb - sa)
        back = Math.max(back, wind.x * mix(a.x, b.x, t) + wind.z * mix(a.z, b.z, t))
      }
    }
    return Number.isFinite(back) ? back : 0
  })
  return {
    seaLevel,
    contact(angle, height) {
      const h = clamp(height, C.contactHeights[0]!, C.contactHeights[C.contactHeights.length - 1]!)
      let layer = 0
      while (layer < C.contactHeights.length - 2 && h > C.contactHeights[layer + 1]!) layer++
      const t = (h - C.contactHeights[layer]!) / (C.contactHeights[layer + 1]! - C.contactHeights[layer]!)
      const a = at(angle, layer), b = at(angle, layer + 1), radius = mix(a.radius, b.radius, t)
      let exactRadius = radius, exactNormal = direction(mix(a.nx, b.nx, t), mix(a.nz, b.nz, t)), exactSteepness = mix(a.steepness, b.steepness, t)
      const section = sections.get(angleKey(angle))
      if (section) {
        let outer = -Infinity
        for (const face of section) if (h >= Math.min(face.ah, face.bh) - 1e-6 && h <= Math.max(face.ah, face.bh) + 1e-6 && Math.abs(face.bh - face.ah) > 1e-7) {
          const r = mix(face.ar, face.br, (h - face.ah) / (face.bh - face.ah))
          if (r > outer) { outer = r; exactNormal = { x: face.nx, z: face.nz }; exactSteepness = face.steepness }
        }
        if (Number.isFinite(outer)) exactRadius = outer
      }
      const n = exactNormal
      return { x: Math.cos(angle) * exactRadius, z: Math.sin(angle) * exactRadius, y: seaLevel + h,
        nx: n.x, nz: n.z, steepness: Math.max(exactSteepness, at(angle, 3).steepness) }
    },
    sample(x, z) {
      const radius = Math.hypot(x, z), angle = Math.atan2(z, x), base = at(angle, 1)
      let squared = Infinity, nearest = coast[0]!
      const center = Math.floor(((angle / FULL_TURN % 1 + 1) % 1) * coast.length)
      // The star-shaped coast is sampled densely; inspect only neighboring segments.
      for (let offset = -4; offset <= 4; offset++) {
        const i = (center + offset + coast.length) % coast.length
        const a = coast[i]!, b = coast[(i + 1) % coast.length]!, ex = b.x - a.x, ez = b.z - a.z
        const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / Math.max(1e-8, ex * ex + ez * ez))
        const d = (x - a.x - ex * t) ** 2 + (z - a.z - ez * t) ** 2
        if (d < squared) { squared = d; nearest = a }
      }
      const distance = Math.sqrt(squared) * (radius < base.radius ? -1 : 1)
      // Invert the sampled terrain sections, keeping the outermost intersection.
      let bed = radius > base.radius ? -0.30 - distance * 1.2 : C.contactHeights[C.contactHeights.length - 1]!
      for (let layer = 0; layer < C.contactHeights.length - 1; layer++) {
        const a = at(angle, layer), b = at(angle, layer + 1)
        if (radius >= Math.min(a.radius, b.radius) && radius <= Math.max(a.radius, b.radius) && Math.abs(b.radius - a.radius) > 1e-5) {
          bed = mix(C.contactHeights[layer]!, C.contactHeights[layer + 1]!, (radius - a.radius) / (b.radius - a.radius))
        }
      }
      const section = sections.get(angleKey(angle))
      if (section) {
        let upper = -Infinity
        for (const face of section) if (radius >= Math.min(face.ar, face.br) - 1e-6 && radius <= Math.max(face.ar, face.br) + 1e-6 && Math.abs(face.br - face.ar) > 1e-7) {
          upper = Math.max(upper, mix(face.ah, face.bh, (radius - face.ar) / (face.br - face.ar)))
        }
        if (Number.isFinite(upper)) bed = upper
      }
      const side = -wind.z * x + wind.x * z, bin = clamp((side / sideExtent + 1) * 128, 0, 256)
      const i = Math.min(255, Math.floor(bin)), back = mix(backs[i]!, backs[i + 1]!, bin - i)
      const behind = wind.x * x + wind.z * z - back
      const shadow = behind > -0.5 ? smooth((sideExtent - Math.abs(side)) / C.shadowEdgeWidth)
        * smooth((behind + 0.5) / 0.8) * Math.exp(-Math.max(behind, 0) / C.waveShadowRecoveryDistance) : 0
      return { distance, nx: nearest.nx, nz: nearest.nz, steepness: nearest.steepness, bed, shadow }
    },
  }
}

// Match the shader's smooth noise basis; floating-point roundoff is intentionally
// not used as an event source. Only robust crest crossings above thresholds emit.
const fract = (v: number) => v - Math.floor(v)
function hash(x: number, z: number) {
  let a = fract(x * 0.1031), b = fract(z * 0.1031), c = a
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
  a += d; b += d; c += d
  return fract((a + b) * c)
}
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(fract(x)), v = smooth(fract(z))
  return mix(mix(hash(ix, iz), hash(ix + 1, iz), u), mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v)
}
export interface ShoreImpact { x: number; z: number; height: number; nx: number; nz: number; steepness: number; dx: number; dz: number; strength: number; up: number; time: number }
export function createIslandShoreImpacts(shore: IslandShore) {
  const impacts: (ShoreImpact | null)[] = Array.from({ length: C.maxImpacts }, () => null)
  const positions = new Float32Array(C.maxImpacts * 4), normals = new Float32Array(C.maxImpacts * 4), velocities = new Float32Array(C.maxImpacts * 4)
  const sites = Array.from({ length: C.impactSites }, (_, i) => ({ angle: (i + C.impactSiteOffset) / C.impactSites * FULL_TURN, velocity: 0, last: -Infinity }))
  let previous: number | null = null, lastEvent = -Infinity
  function wave(x: number, z: number, seconds: number, sample: ShoreSample) {
    const drift = [Math.sin(seconds * 0.0137) * 2.1 + Math.sin(seconds * 0.0071) * 0.7,
      Math.cos(seconds * 0.0113) * 1.9 + Math.sin(seconds * 0.0053) * 0.8,
      Math.sin(seconds * 0.0191) * 1.3 + Math.cos(seconds * 0.0083) * 0.6,
      Math.cos(seconds * 0.0167) * 1.4 + Math.sin(seconds * 0.0067) * 0.5]
    const turbulence = noise(x * 0.071 + drift[0]!, z * 0.071 + drift[1]!)
    const t = clamp(Math.max(0, sample.distance) / C.shoreInteractionDistance), shallow = 1 - smooth(t)
    const integral = C.shoreInteractionDistance * (0.5 - t + t ** 3 - 0.5 * t ** 4)
    let height = 0, velocity = 0, lateralX = 0, lateralZ = 0, energy = 0, dx = 0, dz = 0
    for (let index = 0; index < OCEAN_WAVES.length; index++) {
      const w = OCEAN_WAVES[index]!, d = direction(w.direction[0], w.direction[1]), side = { x: -d.z, z: d.x }
      const k = FULL_TURN / w.wavelength, frequency = waveFrequency(w.wavelength, w.speed)
      const incoming = Math.max(0, -d.x * sample.nx - d.z * sample.nz)
      const delay = (1 / C.shallowWaterSpeedMultiplier - 1) * incoming * integral
      const bend = C.refractionStrength * shallow * (d.x * sample.nz - d.z * sample.nx)
      const shadowWeight = [1, 0.85, 0.65, 0.35, 0.15, 0, 0][index]!
      const diffraction = -k * C.diffractionStrength * sample.shadow * Math.abs(-wind.z * x + wind.x * z) * shadowWeight
      const theta = k * (d.x * x + d.z * z + delay) - seconds * frequency + w.phase + turbulence * 0.36 + bend + diffraction
      const packet = 0.90 + 0.10 * Math.sin((side.x * x + side.z * z) * k * 0.27 + w.phase + (drift[2]! * d.x + drift[3]! * d.z) * 0.4)
      const a = w.amplitude * (0.78 + turbulence * 0.22) * packet * (1 + shallow * (C.shallowWaterAmplitudeMultiplier - 1))
        * (1 - sample.shadow * C.waveShadowStrength * shadowWeight)
      height += a * Math.sin(theta); velocity -= a * Math.cos(theta) * frequency
      const horizontal = a * w.chop * (1 + shallow * (C.shallowWaterSteepnessMultiplier - 1)) * Math.cos(theta)
      lateralX += d.x * horizontal; lateralZ += d.z * horizontal
      const localSpeed = frequency / (k * (1 + (1 / C.shallowWaterSpeedMultiplier - 1) * incoming * shallow))
      const e = a * Math.max(0, Math.sin(theta)) * localSpeed * incoming
      energy += e; dx += d.x * e; dz += d.z * e
    }
    const guard = smooth(Math.max(0, sample.distance) / C.orbitalGuardDistance)
    return { height, velocity, lateralX: lateralX * guard, lateralZ: lateralZ * guard, energy, ...direction(dx, dz) }
  }
  function crest(angle: number, time: number) {
    let point = shore.contact(angle, 0), x = point.x, z = point.z
    let field = wave(x, z, time, shore.sample(x, z))
    for (let step = 0; step < 3; step++) {
      point = shore.contact(angle, clamp(field.height, 0, C.maxRunupHeight))
      x = point.x - field.lateralX; z = point.z - field.lateralZ
      field = wave(x, z, time, shore.sample(x, z))
    }
    return { point, field }
  }
  return {
    positions, normals, velocities,
    update(time: number, reduced: boolean) {
      if (reduced || (previous !== null && time < previous)) {
        impacts.fill(null); previous = null; lastEvent = -Infinity
        for (const site of sites) { site.velocity = 0; site.last = -Infinity }
      }
      const tick = !reduced && (previous === null || time - previous >= 1 / C.impactHz)
      if (tick) {
        const dt = previous === null ? 0 : time - previous, candidates: ShoreImpact[] = []
        for (const site of sites) {
          const { point, field } = crest(site.angle, time)
          if (dt > 0 && dt < 0.3 && site.velocity > 0 && field.velocity <= 0 && field.height > C.minImpactHeight
            && time - site.last > C.siteCooldown) {
            const strength = Math.min(C.maxSplashStrength, field.energy * mix(0.35, 1, point.steepness))
            if (strength >= C.splashThreshold) {
              // Interpolate the crest crossing, then re-solve its terrain contact.
              const impactTime = time - dt * (-field.velocity) / Math.max(1e-6, site.velocity - field.velocity)
              const contact = crest(site.angle, impactTime)
              candidates.push({ x: contact.point.x + point.nx * C.contactClearance, z: contact.point.z + point.nz * C.contactClearance,
                height: contact.field.height, nx: point.nx, nz: point.nz, steepness: point.steepness,
                dx: contact.field.x, dz: contact.field.z, strength, up: C.splashVerticalForce * Math.sqrt(strength) * mix(0.62, 1.1, point.steepness), time: impactTime })
            }
          }
          site.velocity = field.velocity
        }
        candidates.sort((a, b) => b.strength - a.strength)
        for (const event of candidates) {
          if (time - lastEvent < C.minEventGap || impacts.some(p => p && time - p.time < C.siteCooldown && Math.hypot(p.x - event.x, p.z - event.z) < C.impactSeparation)) continue
          const slot = impacts.findIndex(p => !p || time - p.time > C.foamLifetime)
          if (slot < 0) break
          impacts[slot] = event; lastEvent = time
          for (const site of sites) if (Math.abs(Math.atan2(Math.sin(site.angle - Math.atan2(event.z, event.x)), Math.cos(site.angle - Math.atan2(event.z, event.x)))) < C.impactSeparation / Math.max(1, Math.hypot(event.x, event.z))) site.last = time
        }
        previous = time
      }
      for (let index = 0; index < C.maxImpacts; index++) {
        const event = impacts[index], offset = index * 4
        if (!event || reduced || time - event.time > C.foamLifetime) { positions[offset + 2] = -1; positions[offset + 3] = 0; continue }
        positions.set([event.x, event.z, Math.max(0, time - event.time), event.strength], offset)
        normals.set([event.nx, event.nz, event.steepness, 0], offset)
        velocities.set([event.dx, event.dz, event.up, event.height], offset)
      }
    },
  }
}
export type IslandShoreImpacts = ReturnType<typeof createIslandShoreImpacts>
