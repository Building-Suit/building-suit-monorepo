import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { LivingOfficeBrainActivity, LivingOfficeEmployee, LivingOfficeRoom } from '../types/livingOffice'

export interface OfficeAnchor { key: string; x: number; y: number; visible: boolean }
export interface OfficePalette { background: string; surface: string; muted: string; border: string; text: string; accent: string; info: string; success: string; warning: string; danger: string }
type Selection = { kind: 'room' | 'employee' | 'brain'; id: string }
interface SceneOptions {
  canvas: HTMLCanvasElement
  palette: OfficePalette
  anchors: (values: OfficeAnchor[]) => void
  select: (value: Selection) => void
  lost: () => void
  stats: (value: { frames: number; triangles: number; creatingRooms: number; pulses: number; recipients: string[] }) => void
}
/** Local geometry only. No assets, networking, credentials, timers that imply business progress, or product imports. */
export function createLivingOfficeScene(options: SceneOptions) {
  const { canvas } = options
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.22
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 300)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = false
  controls.minPolarAngle = .22
  controls.maxPolarAngle = Math.PI * .43
  controls.minDistance = 9
  controls.maxDistance = 120
  controls.enablePan = true
  controls.screenSpacePanning = false
  controls.rotateSpeed = .65
  controls.zoomSpeed = .8
  const ambient = new THREE.HemisphereLight(0xffffff, 0x455469, 2.8)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xffffff, 4)
  sun.position.set(-8, 24, 12); sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -28; sun.shadow.camera.right = 28
  sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28
  sun.shadow.bias = -.0005
  scene.add(sun)
  const rim = new THREE.DirectionalLight(0xffffff, 1.2)
  rim.position.set(15, 12, -15); scene.add(rim)
  let world = new THREE.Group(); scene.add(world)
  let palette = options.palette
  let rooms: LivingOfficeRoom[] = [], employees: LivingOfficeEmployee[] = []
  let anchors: { key: string; point: THREE.Vector3; parent?: THREE.Object3D }[] = []
  let pickables: THREE.Object3D[] = []
  let figures: { group: THREE.Group; arm: THREE.Group; state: LivingOfficeEmployee['status']; base: number }[] = []
  let growing: { group: THREE.Group; since: number }[] = []
  let pulses: { mesh: THREE.Mesh; since: number; direction: string; room: THREE.Vector3; employeeId: string }[] = []
  const knownRooms = new Set<string>(), seenEvents = new Set<string>()
  let initializedRooms = false, initializedEvents = false, paused = false, reduced = false, disposed = false, visible = true
  let frame = 0, renderedFrames = 0, previous = 0, dirty = true, maxDepth = 1, selected: Selection | null = null
  let selectionRing: THREE.Mesh | undefined
  const material = (color: string, metalness = 0, roughness = .8) => new THREE.MeshStandardMaterial({ color, metalness, roughness })
  const color = (value: string) => new THREE.Color(value)
  const blend = (a: string, b: string, t: number) => '#' + color(a).lerp(color(b), t).getHexString()
  const cube = (parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat)
    mesh.position.set(...at); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const sphere = (parent: THREE.Object3D, radius: number, at: [number, number, number], mat: THREE.Material, segments = 10) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, 8), mat)
    mesh.position.set(...at); mesh.castShadow = true; parent.add(mesh); return mesh
  }
  const cylinder = (parent: THREE.Object3D, top: number, bottom: number, height: number, at: [number, number, number], mat: THREE.Material, segments = 10) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), mat)
    mesh.position.set(...at); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  function plant(parent: THREE.Object3D, x: number, z: number, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, .28, z); g.scale.setScalar(scale); parent.add(g)
    cylinder(g, .31, .23, .45, [0, .22, 0], material(palette.border))
    cylinder(g, .035, .045, .65, [0, .72, 0], material(palette.muted))
    const leaf = material(blend(palette.success, palette.muted, .25))
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * .4
      const mesh = sphere(g, .3, [Math.cos(angle) * .18, .93 + i % 2 * .2, Math.sin(angle) * .18], leaf)
      mesh.scale.set(.6, 1.5, .9); mesh.rotation.z = Math.cos(angle) * .45
    }
  }
  function desk(parent: THREE.Object3D, x: number, z: number, tint: string, working: boolean) {
    const g = new THREE.Group(); g.position.set(x, .28, z); parent.add(g)
    const wood = material(blend(palette.accent, palette.surface, .72)), dark = material(palette.border)
    cube(g, [2.1, .14, 1.05], [0, 1.12, 0], wood)
    for (const dx of [-.86, .86]) for (const dz of [-.35, .35]) cube(g, [.09, 1.05, .09], [dx, .55, dz], dark)
    cube(g, [.36, .06, .3], [0, 1.22, -.13], dark)
    cube(g, [.07, .4, .07], [0, 1.42, -.22], dark)
    cube(g, [.98, .66, .08], [0, 1.71, -.25], dark)
    const screen = new THREE.MeshStandardMaterial({ color: blend(tint, palette.surface, .7), emissive: tint, emissiveIntensity: working ? .24 : .04, roughness: .5 })
    cube(g, [.87, .54, .015], [0, 1.71, -.199], screen)
    for (let i = 0; i < 3; i++) cube(g, [.5 - i * .08, .025, .018], [-.1, 1.83 - i * .13, -.185], material(blend(tint, palette.surface, .3)))
    cube(g, [.58, .035, .22], [0, 1.22, .3], dark)
    cylinder(g, .105, .08, .24, [.76, 1.32, .2], material(palette.surface))
    cube(g, [.42, .05, .55], [-.73, 1.23, .05], material(tint))
    cylinder(g, .4, .4, .11, [0, .72, .98], material(palette.border))
    cube(g, [.65, .65, .12], [0, 1.07, 1.22], material(palette.border))
    cylinder(g, .055, .055, .64, [0, .35, 1], dark)
    cube(g, [.65, .07, .12], [0, .06, 1], dark)
  }
  function person(parent: THREE.Group, employee: LivingOfficeEmployee, index: number, x: number, z: number) {
    const g = new THREE.Group(); g.position.set(x, .3, z); parent.add(g)
    const tint = [palette.accent, palette.info, palette.success, palette.warning][index % 4]!
    const jacket = material(tint), trousers = material(blend(palette.background, palette.border, .45))
    const face = material(blend(palette.accent, palette.surface, .58)), hair = material(blend(palette.background, palette.accent, .15))
    cube(g, [.34, .65, .36], [-.21, .35, 0], trousers)
    cube(g, [.34, .65, .36], [.21, .35, 0], trousers)
    cube(g, [.37, .17, .52], [-.21, .08, .08], material(palette.background))
    cube(g, [.37, .17, .52], [.21, .08, .08], material(palette.background))
    cube(g, [.86, .75, .48], [0, .97, 0], jacket)
    cube(g, [.2, .57, .02], [0, 1.02, .25], material(palette.surface))
    if (index % 4 === 0) cube(g, [.09, .45, .03], [0, 1.02, .27], material(palette.accent))
    const arm = new THREE.Group(); arm.position.set(-.56, 1.25, 0); g.add(arm)
    cube(arm, [.23, .52, .27], [0, -.22, 0], jacket)
    sphere(arm, .13, [0, -.52, 0], face)
    cube(g, [.23, .52, .27], [.56, 1.02, 0], jacket)
    sphere(g, .13, [.56, .73, 0], face)
    sphere(g, .38, [0, 1.65, 0], face)
    const cap = sphere(g, .39, [0, 1.81, -.035], hair); cap.scale.y = .65
    if (index % 4 === 1) sphere(g, .24, [0, 1.95, -.22], hair)
    if (index % 4 === 2) { const tuft = cube(g, [.45, .23, .28], [0, 2.02, -.03], hair); tuft.rotation.z = -.18 }
    if (index % 4 === 3) {
      for (const dx of [-.16, .16]) { const glass = new THREE.Mesh(new THREE.TorusGeometry(.11, .025, 4, 8), material(palette.background)); glass.position.set(dx, 1.68, .32); g.add(glass) }
      cube(g, [.11, .035, .04], [0, 1.68, .35], material(palette.background))
    } else for (const dx of [-.14, .14]) sphere(g, .035, [dx, 1.68, .335], material(palette.background), 6)
    const statusColor = employee.status === 'blocked' ? palette.danger : employee.status === 'working' ? palette.success : employee.status === 'queued' ? palette.warning : employee.status === 'reviewing' ? palette.info : palette.border
    cylinder(g, .6, .6, .025, [0, -.005, 0], material(statusColor))
    g.userData.selection = { kind: 'employee', id: employee.id }; pickables.push(g)
    anchors.push({ key: 'employee:' + employee.id, point: new THREE.Vector3(0, 2.45, 0), parent: g })
    figures.push({ group: g, arm, state: employee.status, base: g.position.y })
  }
  function disposeObject(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
    object.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) { geometries.add(child.geometry); for (const m of Array.isArray(child.material) ? child.material : [child.material]) materials.add(m) } })
    for (const geometry of geometries) geometry.dispose()
    for (const mat of materials) mat.dispose()
  }
  function rebuild() {
    disposeObject(world); scene.remove(world); world = new THREE.Group(); scene.add(world)
    anchors = []; pickables = []; figures = []; growing = []; pulses = []; selectionRing = undefined
    maxDepth = Math.max(1, Math.ceil(rooms.length / 2))
    const depth = maxDepth * 7.6 + 5.2, centerZ = (maxDepth - 1) * 3.8
    const base = material(blend(palette.surface, palette.muted, .5))
    cube(world, [25, .48, depth + 1], [0, -.25, centerZ + 1.3], base)
    cube(world, [25.2, .08, depth + 1.2], [0, -.53, centerZ + 1.3], material(palette.border))
    // A central circulation lane is architectural space, never an invented department.
    cube(world, [3.3, .02, depth], [0, .01, centerZ + 1.3], material(palette.muted))
    for (let i = 0; i < maxDepth * 8 + 4; i++) cube(world, [.045, .025, .14], [0, .035, -2.5 + i * .8], material(palette.border))
    rooms.forEach((room, index) => {
      const x = index % 2 === 0 ? -6.5 : 6.5, z = Math.floor(index / 2) * 7.6
      const group = new THREE.Group(); group.position.set(x, 0, z); world.add(group)
      const accent = room.kind === 'executive' ? palette.accent : palette.info
      cube(group, [10.1, .28, 6.7], [0, .13, 0], material(blend(palette.surface, accent, .07)))
      cube(group, [10.15, .055, .09], [0, .3, 3.36], material(accent))
      // Cutaway walls leave all occupants and controls visible.
      cube(group, [10.1, 1.65, .16], [0, 1.1, -3.3], material(palette.muted))
      cube(group, [.16, 1.3, 6.7], [index % 2 === 0 ? -5 : 5, .95, 0], material(palette.muted))
      cube(group, [10.15, .08, .19], [0, 1.97, -3.3], material(palette.border))
      for (let w = 0; w < 3; w++) cube(group, [1.8, 1.01, .04], [-2.8 + w * 2.8, 1.28, -3.19], material(blend(palette.info, palette.surface, .82)))
      const members = employees.filter(employee => employee.departmentId === room.id)
      members.forEach((employee, n) => {
        const px = members.length === 1 ? 0 : -3 + n % 3 * 3
        const pz = members.length > 3 ? -1.3 + Math.floor(n / 3) * 2.6 : -.7
        const ei = employees.findIndex(e => e.id === employee.id)
        desk(group, px, pz, [palette.accent, palette.info, palette.success, palette.warning][ei % 4]!, employee.status === 'working')
        person(group, employee, ei, px, pz + 1.55)
      })
      if (!members.length) {
        // A newly persisted empty department is visibly furnished, without invented staff.
        desk(group, 0, -.5, accent, false)
        cube(group, [1.8, .1, 1.3], [3.1, .7, 1.4], material(palette.surface))
        for (const dx of [2.45, 3.75]) cylinder(group, .25, .25, .5, [dx, .45, 1.45], material(palette.border))
      }
      plant(group, -4.35, -2.65, 1.1); plant(group, 4.35, -2.65, .85)
      const shelf = material(palette.border)
      cube(group, [1.5, .8, .45], [room.kind === 'executive' ? 3.4 : -3.4, .7, -2.9], shelf)
      group.userData.selection = { kind: 'room', id: room.id }; pickables.push(group)
      anchors.push({ key: 'room:' + room.id, point: new THREE.Vector3(0, 2.9, -2.8), parent: group })
      if (initializedRooms && !knownRooms.has(room.id) && !reduced && !paused) { group.scale.y = .01; growing.push({ group, since: performance.now() }) }
      knownRooms.add(room.id)
    })
    initializedRooms ||= rooms.length > 0
    const brain = new THREE.Group(); brain.position.set(0, 0, -1.25); world.add(brain)
    cylinder(brain, 1.05, 1.3, .38, [0, .2, 0], material(palette.border), 8)
    cylinder(brain, .75, .95, .3, [0, .54, 0], material(palette.surface), 8)
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.66, 0), new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: .15, metalness: .55, roughness: .3 }))
    core.position.y = 1.35; brain.add(core)
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(.97, .035, 6, 36), material(palette.accent, .5)); orbit.position.y = 1.35; orbit.rotation.x = Math.PI / 2.8; brain.add(orbit)
    brain.userData.selection = { kind: 'brain', id: 'brain' }; pickables.push(brain)
    anchors.push({ key: 'brain:brain', point: new THREE.Vector3(0, 2.8, -1.25) })
    for (const x of [-11.7, 11.7]) for (const z of [3, centerZ * 2 + 3]) plant(world, x, z, 1.15)
    dirty = true
    if (selected) select(selected)
  }
  function update(nextRooms: LivingOfficeRoom[], nextEmployees: LivingOfficeEmployee[], events: LivingOfficeBrainActivity[], evidenceReady = true) {
    // Defensive presentation limits supplement, not replace, server authorization.
    const next = nextRooms.filter(room => room.kind === 'executive' || room.kind === 'department').slice(0, 25)
    const nextMembers = nextEmployees.filter(employee => next.some(room => room.id === employee.departmentId)).slice(0, 100)
    const changed = JSON.stringify([next, nextMembers]) !== JSON.stringify([rooms, employees])
    const layoutChanged = next.map(room => room.id).join('|') !== rooms.map(room => room.id).join('|')
    rooms = next; employees = nextMembers
    if (changed) rebuild()
    if (layoutChanged) reset()
    if (!evidenceReady) {
      // Session loss or a pending authenticated snapshot must not retain/replay old traffic.
      initializedEvents = false; seenEvents.clear()
      for (const pulse of pulses) { world.remove(pulse.mesh); disposeObject(pulse.mesh) }
      pulses = []
    } else {
      for (const event of events.slice(0, 80)) {
        const employee = employees.find(person => person.id === event.employeeId)
        const roomIndex = employee ? rooms.findIndex(room => room.id === employee.departmentId) : -1
        if (!seenEvents.has(event.id) && initializedEvents && employee && roomIndex >= 0 && !reduced && !paused) {
          const members = employees.filter(person => person.departmentId === employee.departmentId)
          const seatIndex = members.findIndex(person => person.id === employee.id)
          const deskX = members.length === 1 ? 0 : -3 + seatIndex % 3 * 3
          const deskZ = members.length > 3 ? -1.3 + Math.floor(seatIndex / 3) * 2.6 : -.7
          const destination = new THREE.Vector3((roomIndex % 2 === 0 ? -6.5 : 6.5) + deskX, 1.35, Math.floor(roomIndex / 2) * 7.6 + deskZ + 1.55)
          const mesh = sphere(world, .13, [0, 1.35, -1.25], material(event.direction === 'inbound' ? palette.info : palette.accent))
          pulses.push({ mesh, since: performance.now(), direction: event.direction, room: destination, employeeId: employee.id })
        }
        seenEvents.add(event.id)
      }
      // An empty ready snapshot is still a baseline: the next new read is fresh evidence.
      initializedEvents = true
    }
    // IDs are evidence markers only; keep memory bounded without replaying historical props.
    if (seenEvents.size > 1000) { seenEvents.clear(); for (const event of events.slice(0, 80)) seenEvents.add(event.id) }
    dirty = true; wake()
  }
  function resize() {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    renderer.setSize(rect.width, rect.height, false)
    const previousAspect = camera.aspect
    camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix()
    if (Math.abs(previousAspect - camera.aspect) > .3) reset()
    dirty = true; wake()
  }
  function reset() {
    const center = new THREE.Vector3(0, .8, (maxDepth - 1) * 3.8 + 1.3)
    controls.target.copy(center)
    const direction = new THREE.Vector3(.48, .73, .8).normalize()
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize()
    const up = new THREE.Vector3().crossVectors(direction, right).normalize()
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * Math.max(.3, camera.aspect)
    let distance = 12
    // Fit every floor corner and the label height to this viewport, including narrow screens.
    for (const x of [-12.7, 12.7]) for (const y of [-1.4, 3]) for (const z of [-1, 1]) {
      const corner = new THREE.Vector3(x, y, z * (maxDepth * 3.8 + 3.1))
      distance = Math.max(distance, corner.dot(direction) + Math.max(Math.abs(corner.dot(right)) / tanH, Math.abs(corner.dot(up)) / tanV))
    }
    distance *= 1.12
    controls.maxDistance = Math.max(90, distance * 2.5)
    camera.far = Math.max(300, controls.maxDistance * 3); camera.updateProjectionMatrix()
    camera.position.copy(center).addScaledVector(direction, distance)
    controls.update(); dirty = true; wake()
  }
  function rotate(amount: number) {
    const offset = camera.position.clone().sub(controls.target)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), amount); camera.position.copy(controls.target).add(offset)
    controls.update(); dirty = true; wake()
  }
  function zoom(factor: number) {
    const offset = camera.position.clone().sub(controls.target), distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance)
    camera.position.copy(controls.target).add(offset.setLength(distance)); controls.update(); dirty = true; wake()
  }
  function select(value: Selection) {
    selected = value
    if (selectionRing) { world.remove(selectionRing); disposeObject(selectionRing); selectionRing = undefined }
    const anchor = anchors.find(a => a.key === value.kind + ':' + value.id)
    if (anchor) {
      const position = anchor.parent ? anchor.parent.getWorldPosition(new THREE.Vector3()) : anchor.point.clone()
      selectionRing = new THREE.Mesh(new THREE.RingGeometry(value.kind === 'room' ? 2.2 : .69, value.kind === 'room' ? 2.3 : .77, 48), new THREE.MeshBasicMaterial({ color: palette.accent, side: THREE.DoubleSide }))
      selectionRing.rotation.x = -Math.PI / 2; selectionRing.position.set(position.x, .32, position.z); world.add(selectionRing)
    }
    dirty = true; wake()
  }
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2()
  let down = { x: 0, y: 0 }
  const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY } }
  const pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return
    const bounds = canvas.getBoundingClientRect()
    mouse.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
    raycaster.setFromCamera(mouse, camera)
    for (const hit of raycaster.intersectObjects(pickables, true)) {
      let object: THREE.Object3D | null = hit.object
      while (object && !object.userData.selection) object = object.parent
      if (object?.userData.selection) { select(object.userData.selection); options.select(object.userData.selection); break }
    }
  }
  function projectedAnchors() {
    scene.updateMatrixWorld()
    const rect = canvas.getBoundingClientRect()
    options.anchors(anchors.map(anchor => {
      const point = anchor.point.clone()
      if (anchor.parent) anchor.parent.localToWorld(point)
      point.project(camera)
      return { key: anchor.key, x: (point.x + 1) * rect.width / 2, y: (1 - point.y) * rect.height / 2, visible: point.z > -1 && point.z < 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1 }
    }))
  }
  function animate(now: number) {
    frame = 0
    if (disposed || !visible || document.hidden) return
    const motion = !paused && !reduced
    const active = motion && (figures.some(f => f.state === 'working' || f.state === 'reviewing') || growing.length > 0 || pulses.length > 0)
    if (now - previous >= 1000 / 30 && (dirty || active)) {
      previous = now
      for (const figure of figures) {
        figure.arm.rotation.x = motion && figure.state === 'working' ? -.65 + Math.sin(now * .009) * .16 : 0
        figure.group.rotation.y = motion && figure.state === 'reviewing' ? Math.sin(now * .0018) * .12 : 0
        figure.group.position.y = figure.base
      }
      for (const entry of growing) entry.group.scale.y = motion ? Math.min(1, 1 - Math.pow(1 - Math.min(1, (now - entry.since) / 850), 3)) : 1
      growing = growing.filter(entry => entry.group.scale.y < 1)
      pulses = pulses.filter(pulse => {
        const t = Math.min(1, (now - pulse.since) / 1500)
        if (t >= 1 || !motion) { world.remove(pulse.mesh); disposeObject(pulse.mesh); return false }
        const start = new THREE.Vector3(0, 1.35, -1.25), end = pulse.room
        pulse.mesh.position.lerpVectors(start, end, pulse.direction === 'inbound' ? t : 1 - t)
        pulse.mesh.position.y += Math.sin(t * Math.PI) * 1.4; return true
      })
      renderer.render(scene, camera); projectedAnchors(); dirty = false
      options.stats({ frames: ++renderedFrames, triangles: renderer.info.render.triangles, creatingRooms: growing.length, pulses: pulses.length, recipients: [...new Set(pulses.map(pulse => pulse.employeeId))] })
    }
    if (active || dirty) frame = requestAnimationFrame(animate)
  }
  function wake() { if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(animate) }
  const changed = () => { dirty = true; wake() }
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0 } else changed() }
  const contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; options.lost() }
  controls.addEventListener('change', changed)
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('webglcontextlost', contextLost)
  document.addEventListener('visibilitychange', visibility)
  rebuild(); reset(); resize()
  return {
    update, resize, reset, rotate, zoom, select,
    setMotion(nextPaused: boolean, nextReduced: boolean) { paused = nextPaused; reduced = nextReduced; changed() },
    setVisible(value: boolean) { visible = value; if (!visible) { cancelAnimationFrame(frame); frame = 0 } else changed() },
    setPalette(next: OfficePalette) { palette = next; rebuild(); changed() },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); controls.removeEventListener('change', changed); controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('webglcontextlost', contextLost)
      document.removeEventListener('visibilitychange', visibility)
      disposeObject(world); renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
