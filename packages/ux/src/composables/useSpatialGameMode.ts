import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

export interface SpatialGamePose {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  heading: number
  phase: number
  moving: boolean
}

const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
const walkSpeed = 1.9
const strideLength = 1.15

export function useSpatialGameMode(options: {
  surface: () => HTMLElement | null
  heightAt: (x: number, z: number) => number | null
  interact: (x: number, y: number) => boolean | undefined
  onExit: () => void
}) {
  const pose = shallowRef<SpatialGamePose | null>(null)
  const paused = ref(false)
  const locked = ref(false)
  const held = new Set<string>()
  let escapeArmed = false
  let releasing = false
  let unlockTime = -Infinity

  function pause() {
    paused.value = true
    held.clear()
    const surface = options.surface()
    if (surface && document.pointerLockElement === surface && !releasing) {
      releasing = true
      document.exitPointerLock()
    }
  }

  function resume() {
    const surface = options.surface()
    if (!pose.value || !surface) return
    paused.value = false
    escapeArmed = false
    surface.focus({ preventScroll: true })
    try {
      // Mouse movement over the scene still works if the browser declines capture.
      void Promise.resolve(surface.requestPointerLock?.()).catch(() => {})
    } catch { /* Continue with the uncaptured mouse. */ }
  }

  function start(position: Pick<SpatialGamePose, 'x' | 'y' | 'z'>) {
    pose.value = { ...position, yaw: 0, pitch: .16, heading: 0, phase: 0, moving: false }
    resume()
  }

  function stop() {
    if (!pose.value) return
    pause()
    pose.value = null
    escapeArmed = false
    options.onExit()
  }

  function onKeydown(event: KeyboardEvent) {
    if (!pose.value) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      // Some browsers unlock first and then send the same Escape key event.
      if (event.repeat || performance.now() - unlockTime < 120) return
      if (escapeArmed) stop()
      else {
        escapeArmed = true
        pause()
      }
      return
    }
    if (paused.value || event.ctrlKey || event.metaKey || event.altKey || !movementKeys.includes(event.code)) return
    if (!locked.value && !options.surface()?.contains(event.target as Node)) return
    event.preventDefault()
    held.add(event.code)
  }

  function onKeyup(event: KeyboardEvent) {
    held.delete(event.code)
    if (event.key === 'Escape') unlockTime = -Infinity
  }

  function onLockChange() {
    const captured = Boolean(document.pointerLockElement && document.pointerLockElement === options.surface())
    if (!captured && locked.value && pose.value) {
      paused.value = true
      held.clear()
      if (!releasing && !escapeArmed) {
        escapeArmed = true
        unlockTime = performance.now()
      }
    }
    if (captured && (!pose.value || paused.value)) {
      releasing = true
      document.exitPointerLock()
      return
    }
    locked.value = captured
    releasing = false
  }

  function look(event: MouseEvent) {
    const current = pose.value
    const surface = options.surface()
    if (!current || !surface || paused.value || (!locked.value && !surface.contains(event.target as Node))) return
    if ((event.target as Element | null)?.closest?.('[data-spatial-controls]')) return
    pose.value = {
      ...current,
      yaw: current.yaw - event.movementX * .0034,
      pitch: Math.max(-.38, Math.min(1.05, current.pitch + event.movementY * .0034)),
    }
  }

  function click(event: MouseEvent) {
    if (!pose.value || paused.value || event.button !== 0) return
    if ((event.target as Element | null)?.closest?.('[data-spatial-controls]')) return
    const bounds = options.surface()?.getBoundingClientRect()
    if (!bounds) return
    const x = locked.value ? bounds.left + bounds.width / 2 : event.clientX
    const y = locked.value ? bounds.top + bounds.height / 2 : event.clientY
    if (options.interact(x, y)) pause()
  }

  function advance(seconds: number): SpatialGamePose | null {
    const current = pose.value
    if (!current) return null
    const forward = Number(held.has('KeyW')) - Number(held.has('KeyS'))
    const right = Number(held.has('KeyD')) - Number(held.has('KeyA'))
    if (paused.value || (!forward && !right)) {
      if (current.moving) pose.value = { ...current, moving: false }
      return pose.value
    }
    const step = Math.min(.05, seconds) * walkSpeed / Math.hypot(forward, right)
    const s = Math.sin(current.yaw), c = Math.cos(current.yaw)
    const dx = (right * c - forward * s) * step, dz = (-forward * c - right * s) * step
    let { x, y, z } = current
    // Resolve each axis independently so the player can slide along a barrier.
    const xHeight = options.heightAt(x + dx, z)
    if (xHeight !== null) { x += dx; y = xHeight }
    const zHeight = options.heightAt(x, z + dz)
    if (zHeight !== null) { z += dz; y = zHeight }
    const distance = Math.hypot(x - current.x, z - current.z)
    const moving = distance > .0001
    const angle = moving ? Math.atan2(current.x - x, current.z - z) : current.heading
    const turn = angle - current.heading
    const heading = current.heading + Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, seconds * 15)
    pose.value = { ...current, x, y, z, heading, moving, phase: current.phase + distance * 2 * Math.PI / strideLength }
    return pose.value
  }

  function onBlur() { if (pose.value) pause() }
  function onVisibility() { if (document.hidden) onBlur() }
  onMounted(() => {
    document.addEventListener('keydown', onKeydown, true)
    document.addEventListener('keyup', onKeyup)
    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', look)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
  })
  onBeforeUnmount(() => {
    if (pose.value) pause()
    document.removeEventListener('keydown', onKeydown, true)
    document.removeEventListener('keyup', onKeyup)
    document.removeEventListener('pointerlockchange', onLockChange)
    document.removeEventListener('mousemove', look)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', onBlur)
  })

  return { pose, paused, locked, start, stop, pause, resume, click, advance }
}
