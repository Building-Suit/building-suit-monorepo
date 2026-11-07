import { readonly, shallowRef } from 'vue'
import { spatialViewportFrame, SPATIAL_VIEWPORT_GROUND_Y, SPATIAL_VIEWPORT_MAX_ZOOM, SPATIAL_VIEWPORT_MIN_ZOOM, SPATIAL_VIEWPORT_TARGET_Y, SPATIAL_VIEWPORT_VERTICAL_FOV } from '../spatialViewportGeometry.ts'
import type { SpatialViewportCamera } from '../spatialViewportGeometry.ts'

export interface SpatialWorkspaceTarget {
  id: string
  x: number
  z: number
  width: number
  depth: number
  height: number
  /** Footprint orientation; the default focus looks through its open front. */
  yaw: number
  bottom?: number
  viewYaw?: number
  /** Optional fixed focus distance for compact subjects such as an orb. */
  distance?: number
  pitch?: number
}
export interface SpatialWorkspaceSelectionPolicy {
  camera: Readonly<SpatialViewportCamera>
  viewport: () => { width: number; height: number }
  sceneRadius: () => number
  overlayWidth: () => number
  rtl: () => boolean
  transitionTo: (target: Readonly<SpatialViewportCamera>) => void
}

/** One reversible focus session, even when switching between spatial subjects. */
export function useSpatialWorkspaceSelection(policy: SpatialWorkspaceSelectionPolicy) {
  const selectedId = shallowRef<string | null>(null)
  let previousCamera: SpatialViewportCamera | null = null
  let currentTarget: SpatialWorkspaceTarget | null = null

  function focusCamera(target: SpatialWorkspaceTarget): SpatialViewportCamera {
    const viewport = policy.viewport()
    const width = Math.max(1, Number.isFinite(viewport.width) ? viewport.width : 1)
    const height = Math.max(1, Number.isFinite(viewport.height) ? viewport.height : 1)
    // A narrow overlay covers most of a phone; keep the subject centered there.
    // On wider screens, fit and place it in the space beside the overlay.
    const overlayWidth = policy.overlayWidth()
    const overlay = Math.max(0, Math.min(width, Number.isFinite(overlayWidth) ? overlayWidth : 0))
    const inset = width - overlay >= width * 0.45 ? overlay : 0
    const available = Math.max(0.45, (width - inset) / width)
    const camera = { yaw: target.viewYaw ?? target.yaw + Math.PI - 0.25, pitch: target.pitch ?? 0.55, zoom: 1, panX: target.x, panY: target.z }
    const frame = spatialViewportFrame(camera, width, height, policy.sceneRadius())
    const tangent = Math.tan(SPATIAL_VIEWPORT_VERTICAL_FOV / 2)
    let distance = target.distance ?? 2
    if (target.distance === undefined) {
      // Fit the complete room, including its walls, through both frustum axes.
      const cosine = Math.cos(target.yaw), sine = Math.sin(target.yaw)
      for (const side of [-1, 1]) for (const end of [-1, 1]) for (const top of [0, 1]) {
        const x = side * target.width / 2, z = end * target.depth / 2
        const delta = [cosine * x + sine * z, (target.bottom ?? SPATIAL_VIEWPORT_GROUND_Y) + top * target.height - SPATIAL_VIEWPORT_TARGET_Y, -sine * x + cosine * z]
        const right = frame.right.reduce((sum, value, index) => sum + value * delta[index]!, 0)
        const up = frame.up.reduce((sum, value, index) => sum + value * delta[index]!, 0)
        const forward = frame.forward.reduce((sum, value, index) => sum + value * delta[index]!, 0)
        distance = Math.max(distance, Math.abs(right) / (tangent * frame.aspect * available * 0.82) - forward, Math.abs(up) / (tangent * 0.82) - forward)
      }
    }
    camera.zoom = Math.max(SPATIAL_VIEWPORT_MIN_ZOOM, Math.min(SPATIAL_VIEWPORT_MAX_ZOOM, frame.distance / distance))
    const actualDistance = frame.distance / camera.zoom
    const shift = actualDistance * tangent * frame.aspect * (inset / width) * (policy.rtl() ? -1 : 1)
    camera.panX -= frame.right[0] * shift
    camera.panY -= frame.right[2] * shift
    return camera
  }

  function select(target: Readonly<SpatialWorkspaceTarget>): boolean {
    if (!target.id || ![target.x, target.z, target.width, target.depth, target.height, target.yaw].every(Number.isFinite)
      || target.width <= 0 || target.depth <= 0 || target.height <= 0
      || (target.distance !== undefined && (!Number.isFinite(target.distance) || target.distance <= 0))
      || (target.bottom !== undefined && !Number.isFinite(target.bottom))
      || (target.viewYaw !== undefined && !Number.isFinite(target.viewYaw))
      || (target.pitch !== undefined && !Number.isFinite(target.pitch))) return false
    if (!selectedId.value) previousCamera = { ...policy.camera }
    currentTarget = { ...target }
    selectedId.value = target.id
    policy.transitionTo(focusCamera(currentTarget))
    return true
  }

  function clear(restoreCamera = true): boolean {
    if (!selectedId.value) return false
    const previous = previousCamera
    selectedId.value = null
    currentTarget = null
    previousCamera = null
    if (restoreCamera && previous) policy.transitionTo(previous)
    return true
  }

  function refit() { if (currentTarget) policy.transitionTo(focusCamera(currentTarget)) }
  return { selectedId: readonly(selectedId), select, clear, refit }
}
