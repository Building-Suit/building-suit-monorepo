/** Shared perspective geometry for spatial gestures, rendering and overviews. */
export interface SpatialViewportCamera {
  yaw: number
  pitch: number
  zoom: number
  /** Stable world X target offset; rotation never changes the panned center. */
  panX: number
  /** Stable world Z target offset. The orbit target remains above the floor. */
  panY: number
}
export type SpatialViewportVector = [number, number, number]
export interface SpatialViewportPoint { x: number; z: number }
export interface SpatialViewportFrame {
  target: SpatialViewportVector
  eye: SpatialViewportVector
  right: SpatialViewportVector
  up: SpatialViewportVector
  forward: SpatialViewportVector
  distance: number
  halfWidth: number
  halfHeight: number
  aspect: number
  pitch: number
  near: number
  far: number
}

export const SPATIAL_VIEWPORT_DEFAULT_CAMERA: Readonly<SpatialViewportCamera> = Object.freeze({ yaw: 0.55, pitch: 0.5, zoom: 1, panX: 0, panY: 0 })
export const SPATIAL_VIEWPORT_MIN_ZOOM = 0.35
// The overview now starts farther away; retain enough magnification to focus
// the same orb without changing the meaning of the default 100% overview.
export const SPATIAL_VIEWPORT_MAX_ZOOM = 32
export const SPATIAL_VIEWPORT_GROUND_Y = -0.69
export const SPATIAL_VIEWPORT_MIN_PITCH = 0.08
export const SPATIAL_VIEWPORT_TARGET_Y = 0.42
export const SPATIAL_VIEWPORT_MIN_TARGET_Y = SPATIAL_VIEWPORT_GROUND_Y + 0.10
export const SPATIAL_VIEWPORT_VERTICAL_FOV = Math.PI / 4
const tangent = Math.tan(SPATIAL_VIEWPORT_VERTICAL_FOV / 2)
const overviewCoverage = 0.86
const highestScenePoint = 2.1
const circleSegments = 160
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback
const dot = (left: SpatialViewportVector, right: SpatialViewportVector) => left[0] * right[0] + left[1] * right[1] + left[2] * right[2]

/** One camera model: finite-floor overview at 100%, scaled by actual aspect. */
export function spatialViewportFrame(camera: Readonly<SpatialViewportCamera>, width: number, height: number, sceneRadius = 4.8): SpatialViewportFrame {
  const aspect = Math.max(1, finite(width, 1)) / Math.max(1, finite(height, 1))
  const radius = Math.max(0.1, finite(sceneRadius, 4.8))
  const yaw = finite(camera.yaw, SPATIAL_VIEWPORT_DEFAULT_CAMERA.yaw)
  const pitch = Math.max(SPATIAL_VIEWPORT_MIN_PITCH, Math.min(Math.PI / 2 - SPATIAL_VIEWPORT_MIN_PITCH, finite(camera.pitch, SPATIAL_VIEWPORT_DEFAULT_CAMERA.pitch)))
  const zoom = Math.max(SPATIAL_VIEWPORT_MIN_ZOOM, Math.min(SPATIAL_VIEWPORT_MAX_ZOOM, finite(camera.zoom, 1)))
  const right: SpatialViewportVector = [Math.cos(yaw), 0, -Math.sin(yaw)]
  const up: SpatialViewportVector = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)]
  const forward: SpatialViewportVector = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]
  // Fit the floor/office/orb cylinder at the default pitch. Orbiting keeps a
  // fixed distance instead of quietly changing zoom as the camera tilts.
  // Radius and aspect determine the overview distance, rather than a fixed orb
  // distance or a guessed minimap percentage. Do not recenter a panned target.
  const defaultPitch = SPATIAL_VIEWPORT_DEFAULT_CAMERA.pitch
  const overviewRight: SpatialViewportVector = [1, 0, 0]
  const overviewUp: SpatialViewportVector = [0, Math.cos(defaultPitch), -Math.sin(defaultPitch)]
  const overviewForward: SpatialViewportVector = [0, -Math.sin(defaultPitch), -Math.cos(defaultPitch)]
  let overviewDistance = 14
  for (const [axis, angle] of [[overviewRight, tangent * aspect], [overviewUp, tangent]] as const) {
    for (const sign of [-1, 1]) {
      const plane: SpatialViewportVector = [
        sign * axis[0] / (angle * overviewCoverage) - overviewForward[0],
        sign * axis[1] / (angle * overviewCoverage) - overviewForward[1],
        sign * axis[2] / (angle * overviewCoverage) - overviewForward[2],
      ]
      overviewDistance = Math.max(overviewDistance,
        radius * Math.hypot(plane[0], plane[2]) + Math.max(plane[1] * (SPATIAL_VIEWPORT_GROUND_Y - SPATIAL_VIEWPORT_TARGET_Y), plane[1] * (highestScenePoint - SPATIAL_VIEWPORT_TARGET_Y)))
    }
  }
  const distance = overviewDistance / zoom
  const target: SpatialViewportVector = [finite(camera.panX, 0), SPATIAL_VIEWPORT_TARGET_Y, finite(camera.panY, 0)]
  const eye: SpatialViewportVector = [target[0] - forward[0] * distance, target[1] - forward[1] * distance, target[2] - forward[2] * distance]
  const halfHeight = distance * tangent
  return { target, eye, right, up, forward, distance, halfHeight, halfWidth: halfHeight * aspect, aspect, pitch, near: 0.05, far: Math.max(150, distance + Math.hypot(...target) + radius * 2 + 4) }
}

/** Screen-aspect rectangle at the orbit focus distance, viewed from above.
 * Its aspect is the actual screen aspect; perspective ground coverage is the
 * separate frustum intersection below, and is generally not rectangular.
 */
export function spatialViewportScreenRectangle(frame: SpatialViewportFrame): readonly SpatialViewportPoint[] {
  const groundUp = [frame.right[2], -frame.right[0]] as const
  return ([[-1, 1], [1, 1], [1, -1], [-1, -1]] as const).map(([x, y]) => ({
    x: frame.target[0] + frame.right[0] * x * frame.halfWidth + groundUp[0] * y * frame.halfHeight,
    z: frame.target[2] + frame.right[2] * x * frame.halfWidth + groundUp[1] * y * frame.halfHeight,
  }))
}

/** Clip the finite 160-sided floor against the actual six camera planes.
 * This also handles the horizon at shallow pitch, unlike extending four rays
 * past the camera or clamping guessed corner coordinates into a map circle.
 */
export function spatialViewportGroundFootprint(frame: SpatialViewportFrame, radius: number): readonly SpatialViewportPoint[] {
  const floorRadius = Math.max(0.1, finite(radius, 4.8))
  let polygon: SpatialViewportPoint[] = Array.from({ length: circleSegments }, (_, index) => ({ x: Math.cos(index * Math.PI * 2 / circleSegments) * floorRadius, z: Math.sin(index * Math.PI * 2 / circleSegments) * floorRadius }))
  const normals: [SpatialViewportVector, number][] = []
  for (const [axis, angle] of [[frame.right, tangent * frame.aspect], [frame.up, tangent]] as const) {
    for (const sign of [-1, 1]) normals.push([[
      frame.forward[0] * angle + axis[0] * sign,
      frame.forward[1] * angle + axis[1] * sign,
      frame.forward[2] * angle + axis[2] * sign,
    ], 0])
  }
  normals.push([frame.forward, -frame.near], [[-frame.forward[0], -frame.forward[1], -frame.forward[2]], frame.far])
  for (const [normal, offset] of normals) {
    if (!polygon.length) break
    const distance = (point: SpatialViewportPoint) => dot([point.x - frame.eye[0], SPATIAL_VIEWPORT_GROUND_Y - frame.eye[1], point.z - frame.eye[2]], normal) + offset
    const clipped: SpatialViewportPoint[] = []
    let previous = polygon[polygon.length - 1]!, previousDistance = distance(previous)
    for (const current of polygon) {
      const currentDistance = distance(current)
      if ((currentDistance >= 0) !== (previousDistance >= 0)) {
        const fraction = previousDistance / (previousDistance - currentDistance)
        clipped.push({ x: previous.x + (current.x - previous.x) * fraction, z: previous.z + (current.z - previous.z) * fraction })
      }
      if (currentDistance >= 0) clipped.push(current)
      previous = current; previousDistance = currentDistance
    }
    polygon = clipped
  }
  return polygon
}
