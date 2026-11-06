import type { DepartmentOfficeLayout, OfficePlacement } from './departmentOfficeLayout.ts'
import { departmentDeskLayout, officeExecutiveHitRegions } from './officeArchitecture.ts'
import { organicBoundaryAtX } from './organicOfficePlatform.ts'
import type { OfficeArchitectureGeometry } from './officeArchitecture.ts'

/** Founder-requested additional 25% enlargement from 1.28; furniture stays unchanged. */
export const HQ_AGENT_CHARACTER_SCALE = 1.6

export interface HqAgentCharacter {
  id: string
  name: string
  role: 'ceo' | 'hr' | 'agent'
  departmentId: string | null
  deskIndex: number | null
  activity: 'working' | 'idle' | 'offline' | 'unknown'
  /** Explicit presentation permission, independent of actual worker activity. */
  cosmeticIdle?: boolean
}
export interface HqAgentPoint { x: number; y: number; z: number }
export interface HqAgentRecreationDestination extends HqAgentPoint { yaw: number; kind: 'lounge' | 'fish' }
export interface HqAgentRecreation {
  route: readonly HqAgentPoint[]
  destinations: readonly HqAgentRecreationDestination[]
}
export interface HqAgentPose extends HqAgentPoint {
  id: string
  yaw: number
  mode: 'working' | 'walking' | 'standing' | 'fishing' | 'lounging'
  phase: number
  visible: boolean
}

type Geometry = OfficeArchitectureGeometry
type Vector = [number, number, number]
type PoseMode = HqAgentPose['mode']

/** Limb batches are local to these pivots; the character faces local -Z. */
export const HQ_AGENT_RIG = {
  height: 1.05,
  shoulderY: 0.76,
  shoulderX: 0.20,
  hipY: 0.43,
  hipX: 0.09,
  ankleY: 0.065,
  armLength: 0.35,
  legLength: 0.365,
} as const

export interface HqAgentCharacterGeometry {
  body: Geometry
  head: Geometry
  hair: Geometry
  clothes: Geometry
  trousers: Geometry
  shoes: Geometry
  eyes: Geometry
  leftArm: Geometry
  rightArm: Geometry
  leftHand: Geometry
  rightHand: Geometry
  leftLeg: Geometry
  rightLeg: Geometry
  leftShoe: Geometry
  rightShoe: Geometry
  rod: Geometry
}

function empty(): Geometry { return { positions: [], normals: [] } }
function normal(x: number, y: number, z: number): Vector {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}
function vertex(target: Geometry, point: Vector, direction: Vector): void {
  target.positions.push(...point); target.normals.push(...direction)
}
function append(target: Geometry, source: Geometry): void {
  for (const value of source.positions) target.positions.push(value)
  for (const value of source.normals) target.normals.push(value)
}
function ellipsoid(target: Geometry, center: Vector, radius: Vector, columns = 10, rows = 6, firstLatitude = 0, lastLatitude = Math.PI): void {
  function point(column: number, row: number): void {
    const longitude = column / columns * Math.PI * 2
    const latitude = firstLatitude + row / rows * (lastLatitude - firstLatitude)
    const direction: Vector = [Math.sin(latitude) * Math.cos(longitude), Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude)]
    vertex(target, [center[0] + direction[0] * radius[0], center[1] + direction[1] * radius[1], center[2] + direction[2] * radius[2]], normal(direction[0] / radius[0], direction[1] / radius[1], direction[2] / radius[2]))
  }
  for (let column = 0; column < columns; column++) for (let row = 0; row < rows; row++) {
    point(column, row); point(column + 1, row); point(column, row + 1)
    point(column + 1, row); point(column + 1, row + 1); point(column, row + 1)
  }
}
function tube(target: Geometry, start: Vector, end: Vector, firstRadius: number, lastRadius = firstRadius, segments = 8): void {
  const direction = normal(end[0] - start[0], end[1] - start[1], end[2] - start[2])
  const across = Math.abs(direction[1]) < 0.9 ? normal(direction[2], 0, -direction[0]) : normal(0, direction[2], -direction[1])
  const up: Vector = [direction[1] * across[2] - direction[2] * across[1], direction[2] * across[0] - direction[0] * across[2], direction[0] * across[1] - direction[1] * across[0]]
  for (let index = 0; index < segments; index++) {
    const a = index * Math.PI * 2 / segments, b = (index + 1) * Math.PI * 2 / segments
    const side = (angle: number): Vector => [across[0] * Math.cos(angle) + up[0] * Math.sin(angle), across[1] * Math.cos(angle) + up[1] * Math.sin(angle), across[2] * Math.cos(angle) + up[2] * Math.sin(angle)]
    const na = side(a), nb = side(b)
    const at = (point: Vector, radius: number, n: Vector): Vector => [point[0] + radius * n[0], point[1] + radius * n[1], point[2] + radius * n[2]]
    const lowA = at(start, firstRadius, na), lowB = at(start, firstRadius, nb), highA = at(end, lastRadius, na), highB = at(end, lastRadius, nb)
    vertex(target, lowA, na); vertex(target, lowB, nb); vertex(target, highA, na)
    vertex(target, highA, na); vertex(target, lowB, nb); vertex(target, highB, nb)
    vertex(target, start, [-direction[0], -direction[1], -direction[2]]); vertex(target, lowB, [-direction[0], -direction[1], -direction[2]]); vertex(target, lowA, [-direction[0], -direction[1], -direction[2]])
    vertex(target, end, direction); vertex(target, highA, direction); vertex(target, highB, direction)
  }
}

/** Cached palette-free mesh batches; no downloaded assets or synthetic roster. */
export function createHqAgentCharacterGeometry(): HqAgentCharacterGeometry {
  const result: HqAgentCharacterGeometry = {
    body: empty(), head: empty(), hair: empty(), clothes: empty(), trousers: empty(), shoes: empty(), eyes: empty(),
    leftArm: empty(), rightArm: empty(), leftHand: empty(), rightHand: empty(), leftLeg: empty(), rightLeg: empty(), leftShoe: empty(), rightShoe: empty(), rod: empty(),
  }
  tube(result.body, [0, 0.78, 0], [0, 0.85, 0], 0.053)
  ellipsoid(result.head, [0, 0.91, 0], [0.12, 0.14, 0.112], 12, 8)
  ellipsoid(result.body, [0, 0.9, -0.108], [0.025, 0.032, 0.026], 6, 4)
  for (const side of [-1, 1]) {
    ellipsoid(result.head, [side * 0.115, 0.905, 0.005], [0.025, 0.040, 0.028], 6, 4)
    ellipsoid(result.eyes, [side * 0.042, 0.929, -0.101], [0.011, 0.014, 0.009], 6, 4)
  }
  ellipsoid(result.hair, [0, 0.913, 0.006], [0.123, 0.14, 0.115], 12, 5, 0, Math.PI * 0.44)
  ellipsoid(result.clothes, [0, 0.66, 0.003], [0.18, 0.175, 0.107], 10, 6)
  ellipsoid(result.trousers, [0, 0.455, 0.008], [0.15, 0.075, 0.10], 10, 5)
  for (const side of ['left', 'right'] as const) {
    const arm = result[`${side}Arm`], hand = result[`${side}Hand`], leg = result[`${side}Leg`], shoe = result[`${side}Shoe`]
    tube(arm, [0, 0, 0], [0, -0.29, 0.012], 0.063, 0.047)
    ellipsoid(arm, [0, -0.01, 0], [0.065, 0.064, 0.065], 8, 5)
    ellipsoid(hand, [0, -0.325, 0.013], [0.045, 0.055, 0.043], 8, 5)
    tube(leg, [0, 0, 0], [0, -HQ_AGENT_RIG.legLength, 0], 0.072, 0.047)
    ellipsoid(shoe, [0, -0.021, -0.035], [0.066, 0.044, 0.105], 8, 5)
    // Aggregate shoes are available for a static pose; animated legs use the
    // separate ankle-local batches above instead of drawing both versions.
    const staticShoe = empty()
    ellipsoid(staticShoe, [side === 'left' ? -HQ_AGENT_RIG.hipX : HQ_AGENT_RIG.hipX, HQ_AGENT_RIG.ankleY - 0.021, -0.035], [0.066, 0.044, 0.105], 8, 5)
    append(result.shoes, staticShoe)
  }
  tube(result.rod, [0, 0, 0], [0, 0.89, -0.63], 0.012, 0.004, 8)
  tube(result.rod, [0, -0.10, 0.07], [0, 0.10, -0.07], 0.020, 0.018, 8)
  return result
}

interface Seat extends HqAgentPoint { yaw: number; office: OfficePlacement; localX: number; localZ: number }
interface AgentState {
  pose: HqAgentPose
  previousActivity: HqAgentCharacter['activity']
  previousCosmeticIdle: boolean
  route: HqAgentPoint[]
  routeIndex: number
  targetMode: PoseMode
  targetYaw: number
  home: HqAgentPoint[]
  roamLegs: number
  restUntil: number
  destinationIndex: number | null
  returning: boolean
  seatSignature: string
}
const FULL_TURN = Math.PI * 2
const WALK_SPEED = 0.91
const FLOOR_RISE = 0.14
const MAX_FRAME_STEP = 0.10
const MAX_VISIBLE_AGENTS = 256
const COURT_RADIUS = 6.25
const COURT_CLEARANCE = 0.012

function seed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return (hash >>> 0) / 4294967296
}
function copy(point: HqAgentPoint): HqAgentPoint { return { x: point.x, y: point.y, z: point.z } }
function spawnAngle(id: string, ids: ReadonlySet<string>, personality: number): number {
  // Nearby employee IDs can have very similar hashes. Spread first appearances
  // evenly instead of spawning a whole department on the same small patch.
  const index = [...ids].sort().indexOf(id)
  return -Math.PI / 2 + Math.max(0, index) / Math.max(1, ids.size) * FULL_TURN + personality * 0.12
}
function finite(point: HqAgentPoint): boolean { return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z) }
function angle(point: { x: number; z: number }): number { return Math.atan2(point.z, point.x) }
function radial(radius: number, theta: number, y: number): HqAgentPoint { return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius } }
function localPoint(office: OfficePlacement, x: number, z: number, y: number): HqAgentPoint {
  const cosine = Math.cos(office.yaw), sine = Math.sin(office.yaw)
  return { x: office.x + cosine * x + sine * z, y, z: office.z - sine * x + cosine * z }
}
function nearestAngleDelta(first: number, last: number): number { return Math.atan2(Math.sin(last - first), Math.cos(last - first)) }
function arc(first: HqAgentPoint, theta: number, radius: number, y: number): HqAgentPoint[] {
  const start = angle(first), delta = nearestAngleDelta(start, theta), startRadius = Math.hypot(first.x, first.z)
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / 0.045), Math.ceil(Math.abs(radius - startRadius) / 0.20))
  const result: HqAgentPoint[] = []
  for (let index = 1; index <= segments; index++) {
    const amount = index / segments, eased = amount * amount * (3 - 2 * amount)
    result.push(radial(startRadius + (radius - startRadius) * eased, start + delta * amount, first.y + (y - first.y) * eased))
  }
  return result
}
function workplace(agent: HqAgentCharacter, layout: DepartmentOfficeLayout): (OfficePlacement & { id: string }) | null {
  if (agent.role === 'ceo') return layout.executive
  return agent.departmentId ? layout.offices.find(office => office.id === agent.departmentId) ?? null : null
}
function chair(agent: HqAgentCharacter, layout: DepartmentOfficeLayout, floorY: number): Seat | null {
  const office = workplace(agent, layout)
  if (!office) return null
  if (agent.role === 'ceo') {
    const bounds = officeExecutiveHitRegions(office.width, office.depth).desk
    const localZ = (bounds.min[2] + bounds.max[2]) / 2 + 0.94
    return { ...localPoint(office, 0, localZ, floorY + 0.10), yaw: office.yaw, office, localX: 0, localZ }
  }
  const department = layout.offices.find(item => item.id === office.id)
  const rosterIndex = department?.agents?.findIndex(employee => employee.id === agent.id) ?? -1
  if (rosterIndex < 0) return null
  const desk = departmentDeskLayout(department?.agents?.length ?? 0).desks[rosterIndex]
  if (!desk) return null
  const localX = desk.x + Math.sin(desk.yaw) * 0.81, localZ = desk.z + Math.cos(desk.yaw) * 0.81
  return { ...localPoint(office, localX, localZ, floorY + 0.10), yaw: office.yaw + desk.yaw, office, localX, localZ }
}
function chairSignature(seat: Seat | null): string { return seat ? `${seat.x}:${seat.y}:${seat.z}:${seat.yaw}:${seat.office.ring}` : '' }

/** Chair to the open front. Paths bypass the fixed benches and CEO desk. */
function chairExit(seat: Seat, executive: boolean, floorY: number): HqAgentPoint[] {
  const office = seat.office, edge = organicBoundaryAtX(office.platform, 0, 'front'), front = edge - 0.24
  const side = seat.localX <= 0 ? -1 : 1, crossAisle = -office.depth / 2 + 0.5
  const behindChairs = Math.min(office.width / 2 - 0.40, 2.65), courtY = floorY - FLOOR_RISE + COURT_CLEARANCE
  const points = executive
    ? [localPoint(office, 1.62, seat.localZ, floorY), localPoint(office, 1.62, -1.36, floorY), localPoint(office, 0, -1.36, floorY)]
    : [localPoint(office, side * behindChairs, seat.localZ, floorY), localPoint(office, side * behindChairs, crossAisle, floorY), localPoint(office, 0, crossAisle, floorY)]
  points.push(localPoint(office, 0, edge + 0.18, floorY), localPoint(office, 0, front, courtY), radial(COURT_RADIUS, angle(office), courtY))
  return points
}
/** A first-ring office's central aisle is the passage to the exterior rim. */
function outwardPassage(office: OfficePlacement, executive: boolean, floorY: number): HqAgentPoint[] {
  const front = localPoint(office, 0, organicBoundaryAtX(office.platform, 0, 'front') - 0.24, floorY)
  const rim = radial(office.sector.outerRadius + 0.24, angle(office), floorY - FLOOR_RISE + 0.045)
  return executive
    ? [front, localPoint(office, 1.62, -1.36, floorY), localPoint(office, 1.62, organicBoundaryAtX(office.platform, 1.62, 'rear') + 0.26, floorY), rim]
    : [front, localPoint(office, 0, organicBoundaryAtX(office.platform, 0, 'rear') + 0.26, floorY), rim]
}
function recreationRoute(current: HqAgentPoint, office: OfficePlacement, executive: boolean, layout: DepartmentOfficeLayout, recreation: HqAgentRecreation, destination: HqAgentRecreationDestination, floorY: number): HqAgentPoint[] | null {
  // Additional occupied bands have no guaranteed cross-band passage. Keep
  // idle animation in the unobstructed central aisle until one is supplied.
  if (layout.layerCount !== 1 || recreation.route.length < 2 || !recreation.route.every(finite) || !finite(destination)) return null
  const start = recreation.route[0]!, rimRadius = office.sector.outerRadius + 0.24
  if (Math.hypot(start.x, start.z) < rimRadius) return null
  const outward = outwardPassage(office, executive, floorY), outer = outward[outward.length - 1]!
  const result = arc(current, angle(office), COURT_RADIUS, floorY - FLOOR_RISE + COURT_CLEARANCE).concat(outward, arc(outer, angle(start), rimRadius, outer.y), [copy(start)], recreation.route.slice(1).map(copy))
  // The beach route terminates at the first lounge. Follow the same dry coastal
  // band around to the selected chair/pier instead of cutting across the cliff.
  const last = result[result.length - 1]!, startAngle = angle(last), delta = nearestAngleDelta(startAngle, angle(destination))
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.05)), startRadius = Math.hypot(last.x, last.z), endRadius = Math.hypot(destination.x, destination.z)
  for (let index = 1; index <= steps; index++) {
    const amount = index / steps
    result.push(radial(startRadius + (endRadius - startRadius) * amount, startAngle + delta * amount, last.y + (destination.y - last.y) * amount))
  }
  result.push(copy(destination))
  return result
}
function beginRoute(state: AgentState, route: readonly HqAgentPoint[], targetMode: PoseMode, targetYaw: number): void {
  const points: HqAgentPoint[] = []
  let previous: HqAgentPoint = state.pose
  for (const point of route) {
    if (!finite(point) || Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z) < 0.0001) continue
    points.push(copy(point)); previous = point
  }
  state.route = points; state.routeIndex = 0
  state.targetMode = targetMode; state.targetYaw = targetYaw
  state.pose.mode = state.route.length ? 'walking' : targetMode
}
function advance(state: AgentState, distance: number): number {
  let remaining = distance
  while (state.routeIndex < state.route.length && remaining > 0) {
    const target = state.route[state.routeIndex]!, dx = target.x - state.pose.x, dy = target.y - state.pose.y, dz = target.z - state.pose.z
    const length = Math.hypot(dx, dy, dz)
    if (length <= remaining + 0.000001) {
      Object.assign(state.pose, target); remaining = Math.max(0, remaining - length); state.routeIndex += 1
    } else {
      const amount = remaining / length
      state.pose.x += dx * amount; state.pose.y += dy * amount; state.pose.z += dz * amount; remaining = 0
    }
  }
  if (state.routeIndex >= state.route.length) {
    state.route = []; state.routeIndex = 0; state.pose.mode = state.targetMode
  }
  return distance - remaining
}

function routeFacing(state: AgentState): number {
  let from: HqAgentPoint = state.pose, lookAhead = 0.55
  for (let index = state.routeIndex; index < state.route.length; index++) {
    const point = state.route[index]!, length = Math.hypot(point.x - from.x, point.z - from.z)
    if (length > lookAhead || index === state.route.length - 1) {
      const amount = length > 0 ? Math.min(1, lookAhead / length) : 0
      const dx = from.x + (point.x - from.x) * amount - state.pose.x
      const dz = from.z + (point.z - from.z) * amount - state.pose.z
      return Math.hypot(dx, dz) > 0.0001 ? Math.atan2(-dx, -dz) : state.targetYaw
    }
    lookAhead -= length; from = point
  }
  return state.targetYaw
}

function beginRoaming(state: AgentState, personality: number, courtY: number): void {
  const variation = seed(`${state.pose.id}:${state.roamLegs}`), direction = personality > 0.5 ? 1 : -1
  const theta = angle(state.pose) + direction * (1.25 + variation * 0.85)
  // This open court is outside the Orb/base and inside every office front.
  // Vary lanes gradually instead of snapping to the next radius first.
  const route = arc(state.pose, theta, 4.05 + variation * 1.75, courtY)
  const last = route[route.length - 1]!, before = route[route.length - 2] ?? state.pose
  const facing = Math.atan2(-(last.x - before.x), -(last.z - before.z))
  beginRoute(state, route, 'standing', facing)
  state.roamLegs += 1
}

export interface HqAgentMotion {
  /** time is monotonic seconds; this controller only animates supplied state. */
  update(layout: DepartmentOfficeLayout, agents: readonly HqAgentCharacter[], time: number, reducedMotion?: boolean, recreation?: HqAgentRecreation): readonly HqAgentPose[]
  reset(): void
}

/**
 * No timers, fetches, employment writes or inferred operational activity.
 * State follows stable employee IDs and value-based chair coordinates; fresh
 * roster/layout objects from presence snapshots do not restart roaming.
 */
export function createHqAgentMotion(groundY = -0.69): HqAgentMotion {
  const states = new Map<string, AgentState>(), floorY = groundY + FLOOR_RISE, courtY = groundY + COURT_CLEARANCE
  let previousTime: number | null = null
  return {
    reset() { states.clear(); previousTime = null },
    update(layout, agents, time, reducedMotion = false, recreation) {
      const now = Math.max(previousTime ?? 0, Number.isFinite(time) ? time : previousTime ?? 0)
      const delta = previousTime === null ? 0 : Math.max(0, Math.min(MAX_FRAME_STEP, now - previousTime))
      previousTime = now
      const roster = agents.slice(0, MAX_VISIBLE_AGENTS), ids = new Set(roster.map(agent => agent.id)), claimedDestinations = new Set<number>()
      for (const [id, state] of states) {
        if (!ids.has(id)) states.delete(id)
        else if (state.destinationIndex !== null) claimedDestinations.add(state.destinationIndex)
      }
      const poses: HqAgentPose[] = []
      for (const agent of roster) {
        if (!agent.id) continue
        const personality = seed(agent.id), seat = chair(agent, layout, floorY), signature = chairSignature(seat)
        const cosmeticIdle = agent.cosmeticIdle === true && agent.activity !== 'working'
        const roaming = agent.activity === 'idle' || cosmeticIdle
        const visible = roaming || (agent.activity === 'working' && seat !== null)
        let state = states.get(agent.id)
        if (!state) {
          const startAngle = spawnAngle(agent.id, ids, personality)
          const start = agent.activity === 'working' && seat ? seat : radial(4.1 + personality * 1.7, startAngle, courtY)
          const initialYaw = seat && agent.activity === 'working' ? seat.yaw : (personality > 0.5 ? Math.PI : 0) - startAngle
          const initialMode: PoseMode = agent.activity === 'working' && seat ? 'working' : 'standing'
          state = {
            pose: { id: agent.id, ...copy(start), yaw: initialYaw, mode: initialMode, phase: personality * FULL_TURN, visible },
            previousActivity: agent.activity, previousCosmeticIdle: cosmeticIdle, route: [], routeIndex: 0, targetMode: initialMode, targetYaw: initialYaw, home: [],
            roamLegs: 0, restUntil: 0, destinationIndex: null, returning: false, seatSignature: signature,
          }
          states.set(agent.id, state)
        }
        state.pose.visible = visible
        if (!visible) {
          if (state.destinationIndex !== null) claimedDestinations.delete(state.destinationIndex)
          state.destinationIndex = null; state.route = []; state.home = []; state.restUntil = 0
          state.previousActivity = agent.activity; state.previousCosmeticIdle = cosmeticIdle; state.seatSignature = signature
          poses.push({ ...state.pose }); continue
        }
        const activityChanged = state.previousActivity !== agent.activity
        if (agent.activity === 'working' && seat) {
          if (activityChanged || signature !== state.seatSignature || state.pose.mode !== 'working') {
            if (state.destinationIndex !== null) claimedDestinations.delete(state.destinationIndex)
            // Real work must be visible at its assigned chair immediately;
            // short jobs must not finish while the avatar is still commuting.
            Object.assign(state.pose, copy(seat), { yaw: seat.yaw, mode: 'working' as const })
            state.route = []; state.routeIndex = 0; state.home = []; state.returning = false
            state.destinationIndex = null; state.restUntil = 0
            state.targetMode = 'working'; state.targetYaw = seat.yaw
          }
        } else if (roaming) {
          const wasRoaming = state.previousActivity === 'idle' || state.previousCosmeticIdle
          if (!wasRoaming) {
            state.restUntil = 0; state.home = []; state.returning = false; state.route = []; state.routeIndex = 0
            state.targetMode = 'standing'; state.targetYaw = state.pose.yaw
            if (state.previousActivity === 'working' && seat && seat.office.ring === 1 && !reducedMotion) {
              const exit = chairExit(seat, agent.role === 'ceo', floorY)
              const last = exit[exit.length - 1]!, before = exit[exit.length - 2]!
              beginRoute(state, exit, 'standing', Math.atan2(-(last.x - before.x), -(last.z - before.z)))
            } else {
              const theta = spawnAngle(agent.id, ids, personality)
              Object.assign(state.pose, radial(4.1 + personality * 1.7, theta, courtY),
                { mode: 'standing' as const, yaw: (personality > 0.5 ? Math.PI : 0) - theta })
            }
          }
          if (reducedMotion) {
            state.route = []; state.routeIndex = 0
            if (state.pose.mode === 'walking') state.pose.mode = 'standing'
          } else if (!state.route.length && state.restUntil && now >= state.restUntil && state.home.length && !state.returning) {
            const home = [...state.home].reverse()
            const last = home[home.length - 1]!, before = home[home.length - 2] ?? state.pose
            beginRoute(state, home, 'standing', Math.atan2(-(last.x - before.x), -(last.z - before.z)))
            state.restUntil = 0; state.returning = true
          } else if (!state.route.length && now >= state.restUntil) {
            state.restUntil = 0
            if (state.returning) {
              if (state.destinationIndex !== null) claimedDestinations.delete(state.destinationIndex)
              state.destinationIndex = null; state.returning = false; state.home = []
            }
            const available = state.roamLegs > 0 && state.roamLegs % 3 === 0
              ? recreation?.destinations.map((destination, index) => ({ destination, index })).filter(item => finite(item.destination) && Number.isFinite(item.destination.yaw) && !claimedDestinations.has(item.index)) ?? []
              : []
            const choice = available.length ? available[Math.floor(personality * available.length)] : undefined
            const passage = workplace(agent, layout) ?? layout.offices[0] ?? layout.executive
            const route = choice && recreation ? recreationRoute(state.pose, passage, passage === layout.executive, layout, recreation, choice.destination, floorY) : null
            if (route && choice) {
              state.home = [copy(state.pose), ...route.map(copy)]
              state.destinationIndex = choice.index; claimedDestinations.add(choice.index)
              beginRoute(state, route, choice.destination.kind === 'fish' ? 'fishing' : 'lounging', choice.destination.yaw)
              state.restUntil = Number.POSITIVE_INFINITY
            } else {
              beginRoaming(state, personality, courtY)
            }
          }
        }
        state.previousActivity = agent.activity; state.previousCosmeticIdle = cosmeticIdle; state.seatSignature = signature
        if (!reducedMotion) {
          let remaining = delta * WALK_SPEED, walked = 0, carried = 0
          while (state.route.length && remaining > 0.000001) {
            const travelled = advance(state, remaining)
            walked += travelled; remaining -= travelled
            if (state.route.length || !roaming) break
            if (state.restUntil === Number.POSITIVE_INFINITY) {
              state.restUntil = now + (state.pose.mode === 'fishing' ? 12 : 7) + personality * 6
              break
            }
            if (state.returning) {
              if (state.destinationIndex !== null) claimedDestinations.delete(state.destinationIndex)
              state.destinationIndex = null; state.returning = false; state.home = []
            }
            // A short look-around after several complete walks replaces the
            // old 9–19 second delay after almost every tiny arc.
            const restEvery = 4 + Math.floor(personality * 3)
            if (state.roamLegs > 0 && state.roamLegs % restEvery === 0) {
              state.restUntil = now + 0.8 + personality * 0.9
              state.pose.mode = 'standing'
              break
            }
            if (carried++ >= 2) break
            beginRoaming(state, personality, courtY)
          }
          const facing = state.route.length ? routeFacing(state) : state.targetYaw
          state.pose.yaw += nearestAngleDelta(state.pose.yaw, facing) * (1 - Math.exp(-9 * delta))
          // Gait tracks actual distance, including carried waypoints. Explicit
          // standing poses keep stopped avatars out of a frozen mid-stride.
          if (walked > 0) state.pose.phase += walked * 8.0
          else if (state.pose.mode !== 'walking') state.pose.phase += delta * (state.pose.mode === 'working' ? 2.8 : 0.65)
        }
        poses.push({ ...state.pose })
      }
      return poses
    },
  }
}
