import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { LivingOfficeEmployee, LivingOfficeRoom } from '../types/livingOffice'

export interface OfficeAnchor { key: string; x: number; y: number; visible: boolean }
interface SceneOptions {
  canvas: HTMLCanvasElement
  anchors: (values: OfficeAnchor[]) => void
  lost: () => void
  /** `textures` counts image/material maps; renderer-owned shadow buffers are not image assets. */
  stats: (value: { frames: number; triangles: number; rooms: number; meshes: number; textures: number }) => void
}
type Triple = [number, number, number]
type Finish = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial
type AnchorPoint = { key: string; point: THREE.Vector3; parent: THREE.Object3D }
type RoomFinish = { floor: number; wall: number; edge: number; trim: number }

// These are material pigments in a fixed 3D illustration, not a second application theme.
const ROOM_FINISHES: RoomFinish[] = [
  { floor: 0xe99f28, wall: 0xb2772c, edge: 0xc78027, trim: 0xffd47b },
  { floor: 0x527deb, wall: 0x365cae, edge: 0x3156b0, trim: 0x91b6ff },
  { floor: 0xebc54e, wall: 0x9c771e, edge: 0xbd9728, trim: 0xffe78b },
  { floor: 0xbe59d3, wall: 0x782683, edge: 0x9434a2, trim: 0xe698ec },
  { floor: 0x9061dc, wall: 0x5733a1, edge: 0x6941b3, trim: 0xba99f6 },
  { floor: 0x43b9b9, wall: 0x216d73, edge: 0x2c9196, trim: 0x8fe4df },
  { floor: 0xe4666a, wall: 0x9c3f42, edge: 0xbc4c51, trim: 0xffa0a0 },
  { floor: 0x48b973, wall: 0x267d4c, edge: 0x30995b, trim: 0x92dfa7 },
]
const ROOM_SLOTS: Triple[] = [
  [.99, 0, -10.61], [10.45, 0, -9.03], [13.42, 0, 2.99],
  [9.81, 0, 13.52], [-.88, 0, 12.91], [-10.66, 0, 8.61],
]

/**
 * An inert, demand-rendered architectural model. Every visible object is local
 * geometry. Records determine rooms and occupants; geometry never simulates work.
 */
export function createReferenceOfficeScene(options: SceneOptions) {
  const { canvas } = options
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x252c3c, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  renderer.shadowMap.autoUpdate = false

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-20, 20, 10.25, -10.25, .1, 160)
  camera.position.set(30, 24.494897, 30)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  const ambient = new THREE.HemisphereLight(0xc9dcff, 0x363144, 1.7)
  scene.add(ambient)
  const key = new THREE.DirectionalLight(0xffebce, 3.1)
  key.position.set(-5, 45, 12)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 })
  key.shadow.normalBias = .025
  key.shadow.bias = -.00015
  key.shadow.radius = 4
  key.shadow.blurSamples = 8
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x8fbeff, 1.1)
  fill.position.set(12, 14, -16)
  scene.add(fill)

  let world = new THREE.Group()
  scene.add(world)
  let geometries = new Set<THREE.BufferGeometry>()
  let materials = new Set<THREE.Material>()
  let anchors: AnchorPoint[] = []
  let roomCount = 0
  let meshCount = 0
  let frames = 0
  let frame = 0
  let visible = true
  let disposed = false
  let contextLost = false
  let dirty = true
  let dataKey = ''
  // A slot is retained for an existing department even if another record is added.
  const departmentSlots = new Map<string, number>()

  function finish(color: number, roughness = .65, metalness = 0) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    materials.add(mat)
    return mat
  }
  function glow(color: number, intensity = 1, opacity = 1) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .35, transparent: opacity < 1, opacity, depthWrite: opacity === 1 })
    materials.add(mat)
    return mat
  }
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, at: Triple = [0, 0, 0], shadows = true) {
    geometries.add(geometry)
    const object = new THREE.Mesh(geometry, material)
    object.position.set(...at)
    object.castShadow = shadows
    object.receiveShadow = shadows
    parent.add(object)
    meshCount++
    return object
  }
  function box(parent: THREE.Object3D, size: Triple, at: Triple, mat: Finish, radius = 0) {
    return mesh(parent, radius > 0
      ? new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(v => v * .45)))
      : new THREE.BoxGeometry(...size), mat, at)
  }
  function sphere(parent: THREE.Object3D, radius: number, at: Triple, mat: Finish, scale: Triple = [1, 1, 1]) {
    const object = mesh(parent, new THREE.SphereGeometry(radius, 24, 16), mat, at)
    object.scale.set(...scale)
    return object
  }
  function cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number, at: Triple, mat: Finish, segments = 24) {
    return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), mat, at)
  }
  function bar(parent: THREE.Object3D, start: Triple, end: Triple, radius: number, mat: Finish) {
    const from = new THREE.Vector3(...start), to = new THREE.Vector3(...end)
    const delta = to.clone().sub(from)
    const object = mesh(parent, new THREE.CapsuleGeometry(radius, Math.max(.001, delta.length() - radius * 2), 4, 12), mat)
    object.position.copy(from.add(to).multiplyScalar(.5))
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
    return object
  }
  function ring(parent: THREE.Object3D, radius: number, tube: number, y: number, mat: Finish) {
    const object = mesh(parent, new THREE.TorusGeometry(radius, tube, 8, 120), mat, [0, y, 0], false)
    object.rotation.x = Math.PI / 2
    return object
  }
  function group(parent: THREE.Object3D, at: Triple, rotation = 0) {
    const object = new THREE.Group()
    object.position.set(...at)
    object.rotation.y = rotation
    parent.add(object)
    return object
  }
  function contact(parent: THREE.Object3D, x: number, z: number, sx: number, sz: number, opacity = .12) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x050916, transparent: true, opacity, depthWrite: false })
    materials.add(mat)
    for (let i = 0; i < 3; i++) {
      const disc = mesh(parent, new THREE.CircleGeometry(1, 48), mat, [x, .008 + i * .001, z], false)
      disc.rotation.x = -Math.PI / 2
      disc.scale.set(sx * (1 - i * .14), sz * (1 - i * .14), 1)
    }
  }

  function floor() {
    const geometry = new THREE.PlaneGeometry(100, 100, 80, 80)
    geometry.rotateX(-Math.PI / 2)
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 3)
    const dark = new THREE.Color(0x151c29), light = new THREE.Color(0x3a425b)
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i)
      const distance = Math.hypot((x + 5) * .8, z - 2)
      const tint = dark.clone().lerp(light, Math.max(0, 1 - distance / 27))
      colors.set([tint.r, tint.g, tint.b], i * 3)
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98, metalness: .04 })
    materials.add(mat)
    mesh(world, geometry, mat, [0, -.22, 0], false).receiveShadow = true
  }

  function plant(parent: THREE.Object3D, x: number, z: number, scale = 1) {
    const p = group(parent, [x, 0, z])
    p.scale.setScalar(scale)
    const ceramic = finish(0xf1e9d8, .38), soil = finish(0x4a3529), stem = finish(0x337a43)
    cylinder(p, .18, .13, .31, [0, .155, 0], ceramic)
    cylinder(p, .185, .185, .055, [0, .30, 0], ceramic)
    cylinder(p, .157, .157, .01, [0, .334, 0], soil)
    bar(p, [0, .3, 0], [0, .78, 0], .033, stem)
    const greens = [finish(0x2ca967, .6), finish(0x40bd6b, .62), finish(0x168951, .65)]
    for (let i = 0; i < 7; i++) {
      const a = i * 2.39996, r = i === 6 ? 0 : .15
      sphere(p, .185, [Math.sin(a) * r, .66 + (i % 3) * .12, Math.cos(a) * r], greens[i % 3]!, [.91, 1.05, .9])
    }
    contact(parent, x, z, .22 * scale, .22 * scale, .055)
  }

  function lamp(parent: THREE.Object3D, x: number, z: number) {
    const p = group(parent, [x, 0, z])
    const metal = finish(0x514d42, .42, .55)
    cylinder(p, .13, .16, .045, [0, .03, 0], metal)
    cylinder(p, .027, .032, 1.51, [0, .80, 0], metal)
    cylinder(p, .075, .075, .04, [0, 1.57, 0], metal)
    const shade = glow(0xffe9bd, .8)
    box(p, [.27, .31, .27], [0, 1.72, 0], shade, .035)
    const fixture = new THREE.PointLight(0xffd691, 4, 4.5, 2)
    fixture.position.set(0, 1.7, .12)
    p.add(fixture)
  }

  function sofa(parent: THREE.Object3D, x: number, z: number, rotation = Math.PI / 2) {
    const p = group(parent, [x, 0, z], rotation)
    const linen = finish(0xe8e1d7, .92), seams = finish(0xd1c9bd, .9), feet = finish(0x65584c, .7)
    for (const dx of [-.55, .55]) for (const dz of [-.23, .23]) box(p, [.07, .13, .07], [dx, .075, dz], feet, .015)
    box(p, [1.48, .28, .66], [0, .25, 0], seams, .055)
    box(p, [1.42, .49, .15], [0, .52, -.26], linen, .055)
    for (const dx of [-.35, .35]) {
      box(p, [.65, .14, .48], [dx, .44, .035], linen, .055)
      const cushion = box(p, [.63, .38, .12], [dx, .62, -.17], linen, .04)
      cushion.rotation.x = -.1
    }
    for (const dx of [-.71, .71]) box(p, [.15, .38, .68], [dx, .43, 0], linen, .045)
    contact(parent, x, z, .58, .67, .06)
  }

  function chair(parent: THREE.Object3D, x: number, z: number, rotation = 0) {
    const p = group(parent, [x, 0, z], rotation)
    const upholstered = finish(0x343940, .9), edge = finish(0x22272e, .65), chrome = finish(0x64696f, .36, .7)
    cylinder(p, .04, .05, .46, [0, .29, 0], chrome)
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * .4
      const dx = Math.sin(a) * .27, dz = Math.cos(a) * .27
      bar(p, [0, .13, 0], [dx, .07, dz], .025, chrome)
      sphere(p, .045, [dx, .055, dz], edge, [1, .8, 1])
    }
    box(p, [.55, .12, .51], [0, .58, 0], upholstered, .055)
    const back = box(p, [.53, .66, .11], [0, .91, -.245], upholstered, .055)
    back.rotation.x = -.13
    box(p, [.37, .38, .025], [0, .91, -.173], edge, .02)
    for (const dx of [-.31, .31]) {
      bar(p, [dx, .55, -.12], [dx, .82, -.09], .023, chrome)
      box(p, [.075, .055, .32], [dx, .83, .035], edge, .025)
    }
  }

  function desk(parent: THREE.Object3D, x: number, z: number, small = false, rotation = 0) {
    const p = group(parent, [x, 0, z], rotation)
    const w = small ? 1.25 : 2.25, d = small ? .7 : 1.0
    const ivory = finish(0xf1ede3, .54), steel = finish(0x35393d, .45, .6), silver = finish(0x8a9298, .35, .7)
    box(p, [w, .11, d], [0, .99, 0], ivory, .035)
    box(p, [w - .12, .055, d - .10], [0, .91, 0], finish(0xc9c6bf, .6), .01)
    for (const dx of [-w / 2 + .14, w / 2 - .14]) {
      for (const dz of [-d / 2 + .13, d / 2 - .13]) box(p, [.055, .88, .055], [dx, .46, dz], steel, .012)
      box(p, [.06, .05, d - .15], [dx, .045, 0], steel, .01)
    }
    bar(p, [-w / 2 + .14, .76, d / 2 - .12], [w / 2 - .14, .76, d / 2 - .12], .022, steel)
    if (small) {
      box(p, [.30, .015, .38], [.12, 1.055, -.02], finish(0xffffff, .9), .006)
      return
    }
    const computerX = small ? .1 : .38
    const computer = group(p, [computerX, 1.055, .22], -.06)
    box(computer, [.31, .025, .22], [0, .015, 0], silver, .015)
    bar(computer, [0, .03, .025], [0, .28, .04], .025, silver)
    box(computer, [.66, .45, .055], [0, .42, .035], finish(0x23262a, .43), .025)
    // Screen faces its seated employee. Even the display details are solid geometry.
    box(computer, [.598, .382, .008], [0, .42, .003], finish(0x243d4c, .4), .005)
    const display = glow(0x8ac7ce, .1)
    for (let i = 0; i < 4; i++) box(computer, [.28 + (i % 2) * .12, .011, .004], [-.06, .54 - i * .06, -.003], display)
    box(p, [.49, .028, .17], [computerX, 1.061, -.14], finish(0xbfc5c5, .58), .015)
    const keys = finish(0x6f7b81, .8)
    for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) {
      box(p, [.035, .004, .026], [computerX - .19 + col * .047, 1.077, -.19 + row * .047], keys, .002)
    }
    sphere(p, .055, [computerX + .38, 1.078, -.14], silver, [.7, .35, 1])
    if (!small) {
      const paper = finish(0xffffff, .9), notebook = finish(0x747f8e, .8)
      const documents = group(p, [-.64, 1.054, -.09], -.16)
      box(documents, [.38, .028, .46], [0, .015, 0], notebook, .006)
      box(documents, [.34, .012, .42], [.015, .038, 0], paper, .003)
      for (let i = 0; i < 4; i++) box(documents, [.23, .003, .009], [.02, .045, -.10 + i * .04], keys)
    }
    const cupX = w / 2 - .22
    cylinder(p, .062, .055, .13, [cupX, 1.125, .20], ivory)
    cylinder(p, .049, .049, .006, [cupX, 1.193, .20], finish(0x63452e))
    const handle = mesh(p, new THREE.TorusGeometry(.045, .012, 6, 16), ivory, [cupX + .065, 1.13, .20])
    handle.rotation.y = Math.PI / 2
  }

  function wallChart(parent: THREE.Object3D, x: number, z: number, width: number, rotation: number) {
    const p = group(parent, [x, 1.43, z], rotation)
    box(p, [width, .74, .055], [0, 0, 0], finish(0x161e28, .5), .018)
    box(p, [width - .09, .65, .015], [0, 0, .036], finish(0x202b33, .9), .005)
    const axis = finish(0x5a6971, .8), gold = finish(0xc9ae72, .6), cyan = finish(0x84c1c1, .6)
    for (let i = 0; i < 3; i++) box(p, [width - .25, .009, .008], [0, -.22 + i * .20, .05], axis)
    for (let i = 0; i < 5; i++) {
      const bx = -width / 2 + .17 + i * (width - .34) / 5
      const h = .09 + ((i * 3) % 5) * .055
      box(p, [.045, h, .012], [bx, -.19 + h / 2, .061], i % 2 ? cyan : gold)
      if (i < 4) bar(p, [bx, .01 + i % 2 * .12, .07], [bx + (width - .34) / 5, .01 + (i + 1) % 2 * .12, .07], .009, gold)
    }
    box(p, [width * .27, .022, .009], [-width * .23, .24, .05], finish(0xd3d5cb, .8))
    box(p, [width * .18, .012, .009], [-width * .275, .19, .05], axis)
  }

  function bookshelf(parent: THREE.Object3D) {
    const p = group(parent, [1.32, 1.15, -2.40])
    box(p, [1.17, .075, .27], [0, 0, 0], finish(0xe4dfd2, .6), .02)
    for (const dx of [-.36, .36]) box(p, [.045, .15, .19], [dx, -.10, -.025], finish(0x8e8c86, .6))
    const colors = [0xef7d95, 0x64c7bf, 0xf4d162, 0x7186c8, 0xf4eee1, 0xd886aa]
    colors.forEach((color, i) => {
      const height = .25 + (i % 3) * .045
      const book = box(p, [.10, height, .14], [-.44 + i * .155, height / 2 + .04, -.015], finish(color, .8), .008)
      book.rotation.z = i === 5 ? -.18 : 0
      box(p, [.064, .013, .005], [-.44 + i * .155, .12, .058], finish(0xe9e9df, .7))
    })
  }

  function employee(parent: THREE.Object3D, record: LivingOfficeEmployee, index: number, at: Triple, seated: boolean, rotation = 0) {
    const p = group(parent, at, rotation)
    p.name = `employee:${record.id}`
    const identity = `${record.id} ${record.name}`.toLowerCase()
    const style = /steve|ceo-001/.test(identity) ? 0 : /maya|hr-001/.test(identity) ? 1 : /noah|hr-002/.test(identity) ? 2 : /iris|hr-003/.test(identity) ? 3 : index % 4
    const skins = [0xd8a57f, 0xc48a62, 0xe2b08a, 0xaf795b]
    const jackets = [0x4675be, 0xe19b39, 0x718e86, 0x9279aa]
    const skin = finish(skins[style]!, .8), jacket = finish(jackets[style]!, .88)
    const hair = finish(style === 2 ? 0x63412c : 0x292622, .9), pants = finish(0x303944, .9)
    const shirt = finish(0xf3eee7, .87), shoes = finish(0x24292d, .5), eyes = finish(0x1f2225, .7)
    const hip = seated ? .70 : .82, shoulder = seated ? 1.22 : 1.35, headY = seated ? 1.53 : 1.66
    // Rounded, slightly tapered torso; separate shirt, lapels and jacket seams.
    const torso = cylinder(p, .205, .17, .49, [0, (hip + shoulder) / 2, 0], jacket)
    torso.scale.z = .64
    box(p, [.115, .37, .025], [0, shoulder - .19, .129], shirt, .012)
    for (const side of [-1, 1]) {
      const lapel = box(p, [.075, .25, .03], [side * .092, shoulder - .13, .137], jacket, .012)
      lapel.rotation.z = side * -.22
      sphere(p, .014, [side * .043, hip + .14, .143], shoes)
    }
    if (style === 0) {
      box(p, [.038, .20, .014], [0, shoulder - .20, .15], finish(0x3c5484), .008)
      sphere(p, .025, [0, shoulder - .085, .15], finish(0x3c5484), [.8, .9, .5])
    }
    cylinder(p, .065, .07, .13, [0, headY - .22, 0], skin)
    sphere(p, .195, [0, headY, .01], skin, [.87, 1.08, .88])
    for (const side of [-1, 1]) {
      sphere(p, .044, [side * .17, headY - .015, .005], skin, [.55, 1, .7])
      sphere(p, .015, [side * .067, headY + .015, .171], eyes, [.85, 1, .45])
      const brow = sphere(p, .024, [side * .068, headY + .052, .167], hair, [1.25, .3, .35])
      brow.rotation.z = side * .1
    }
    sphere(p, .033, [0, headY - .024, .181], skin, [.67, .8, 1])
    bar(p, [-.028, headY - .082, .163], [.028, headY - .082, .163], .006, finish(0x925e50, .8))
    const cap = mesh(p, new THREE.SphereGeometry(.199, 24, 14, 0, Math.PI * 2, 0, 1.64), hair, [0, headY + .025, -.011])
    cap.scale.set(.89, .98, .87)
    const fringe = sphere(p, .12, [style === 2 ? .055 : -.04, headY + .13, .09], hair, [1.05, .49, .8])
    fringe.rotation.z = -.21
    if (style === 1) {
      sphere(p, .11, [0, headY + .08, -.18], hair)
      sphere(p, .07, [0, headY - .04, -.19], hair, [.8, 1.9, .8])
    }
    if (style === 3) {
      for (const side of [-1, 1]) {
        sphere(p, .12, [side * .14, headY - .045, -.055], hair, [.55, 1.65, .8])
        const glasses = mesh(p, new THREE.TorusGeometry(.048, .009, 6, 16), eyes, [side * .069, headY + .012, .181])
        glasses.scale.y = .85
      }
      bar(p, [-.02, headY + .015, .183], [.02, headY + .015, .183], .007, eyes)
    }
    for (const side of [-1, 1]) {
      const dx = side * .105
      if (seated) {
        bar(p, [dx, hip, .01], [dx, hip - .03, .32], .078, pants)
        bar(p, [dx, hip - .03, .32], [dx, .19, .37], .067, pants)
        box(p, [.15, .11, .28], [dx, .14, .44], shoes, .045)
        bar(p, [side * .21, shoulder - .045, 0], [side * .265, .98, .18], .062, jacket)
        bar(p, [side * .265, .98, .18], [side * .19, 1.025, .39], .049, jacket)
        sphere(p, .057, [side * .18, 1.03, .43], skin, [.9, .65, 1])
      } else {
        bar(p, [dx, hip, 0], [dx, .43, .015], .076, pants)
        bar(p, [dx, .43, .015], [dx, .14, .035], .063, pants)
        box(p, [.15, .11, .27], [dx, .09, .10], shoes, .04)
        const holding = style === 3 || side === 1
        bar(p, [side * .21, shoulder - .045, 0], [side * .255, 1.06, holding ? .10 : 0], .062, jacket)
        bar(p, [side * .255, 1.06, holding ? .10 : 0], [side * (holding ? .16 : .25), holding ? 1.08 : .88, holding ? .26 : .03], .048, jacket)
        sphere(p, .054, [side * (holding ? .16 : .25), holding ? 1.08 : .84, holding ? .27 : .035], skin)
      }
    }
    if (!seated) {
      const tablet = box(p, [.30, .36, .028], [0, 1.12, .30], finish(0x404d59, .45), .025)
      tablet.rotation.x = -.20
      box(p, [.25, .29, .008], [0, 1.12, .318], finish(0xb9c9cd, .6), .01).rotation.x = -.20
    }
    anchors.push({ key: `employee:${record.id}`, point: new THREE.Vector3(0, headY + .31, 0), parent: p })
  }

  function pathway(position: Triple) {
    const toward = new THREE.Vector3(position[0], 0, position[2])
    const distance = toward.length()
    toward.normalize()
    const near = toward.clone().multiplyScalar(4.47)
    const far = toward.clone().multiplyScalar(distance - 2.8)
    const length = far.distanceTo(near)
    if (distance <= 7.3) return
    const midpoint = near.clone().add(far).multiplyScalar(.5)
    const p = group(world, [midpoint.x, -.11, midpoint.z], Math.atan2(toward.x, toward.z))
    box(p, [.63, .07, length], [0, 0, 0], finish(0x283640, .76, .12), .025)
    const rail = finish(0x59686c, .42, .55)
    for (const dx of [-.32, .32]) box(p, [.025, .027, length], [dx, .045, 0], rail, .009)
    const light = glow(0xffedc0, 2.4)
    const count = Math.max(1, Math.floor(length / 1.6))
    for (let i = 0; i < count; i++) {
      const z = -length / 2 + (i + .5) * length / count
      cylinder(p, .075, .085, .025, [0, .061, z], rail, 16)
      sphere(p, .042, [0, .086, z], light, [1, .55, 1])
    }
  }

  function brain() {
    const p = group(world, [0, -.08, 0])
    p.name = 'brain'
    const base = finish(0x354d5d, .49, .32), edge = finish(0x405c6b, .52, .4)
    cylinder(p, 4.48, 4.48, .12, [0, .06, 0], base, 160)
    cylinder(p, 3.30, 3.43, .16, [0, .18, 0], edge, 128)
    cylinder(p, 3.06, 3.22, .16, [0, .30, 0], base, 128)
    const cyan = glow(0x8bdfff, 2.5), mutedCyan = glow(0x68bacb, .6)
    ring(p, 4.48, .015, .13, mutedCyan)
    ring(p, 3.26, .017, .23, mutedCyan)
    ring(p, 3.08, .030, .39, cyan)
    ring(p, 2.19, .012, .397, mutedCyan)
    ring(p, 1.46, .010, .402, mutedCyan)
    contact(world, 0, 0, 4.6, 4.6, .10)

    const glass = new THREE.MeshPhysicalMaterial({ color: 0x8cdfff, emissive: 0x2d9dc8, emissiveIntensity: .6, metalness: .10, roughness: .10, transparent: true, opacity: .52, clearcoat: 1, clearcoatRoughness: .06, depthWrite: false })
    materials.add(glass)
    const core = new THREE.MeshPhysicalMaterial({ color: 0x94ebff, emissive: 0x50c9ef, emissiveIntensity: .7, metalness: .05, roughness: .18, transparent: true, opacity: .64, clearcoat: 1, depthWrite: false })
    materials.add(core)
    sphere(p, .91, [0, 1.68, 0], core).castShadow = false
    const orb = sphere(p, 1.12, [0, 1.62, 0], glass)
    orb.castShadow = false
    const aura = new THREE.MeshBasicMaterial({ color: 0x48cfff, transparent: true, opacity: .045, blending: THREE.AdditiveBlending, depthWrite: false })
    materials.add(aura)
    for (const thickness of [.06, .11, .18]) ring(p, 3.08, thickness, .39, aura)
    for (const radius of [1.20, 1.34, 1.48]) {
      const shell = mesh(p, new THREE.SphereGeometry(radius, 40, 24), aura, [0, 1.62, 0], false)
      shell.renderOrder = 2
    }
    const orbEdge = glow(0x92eaff, 1.7, .7)
    // The silhouette rim is a 3D ring facing the fixed camera, not a sprite.
    const silhouette = ring(p, 1.12, .012, 1.62, orbEdge)
    silhouette.quaternion.copy(camera.quaternion)
    for (let i = 0; i < 3; i++) {
      const orbit = ring(p, 1.32 + i * .09, .007, 1.62, glow(0x79d9f8, .8, .17))
      orbit.rotation.set(.45 + i * .58, .35 + i * .78, i * .51)
    }
    const beam = glow(0xb7eeff, .8, .11)
    cylinder(p, .11, .26, 1.5, [0, .83, 0], beam, 40).castShadow = false
    cylinder(p, .065, .12, 1.12, [0, 3.03, 0], glow(0xc6f4ff, 1.2, .25), 32).castShadow = false
    const pool = new THREE.PointLight(0x64d9ff, 16, 9, 2)
    pool.position.set(0, 1.5, 0)
    p.add(pool)
    anchors.push({ key: 'brain:brain', point: new THREE.Vector3(.19, 4.40, -.19), parent: world })
  }

  function isHr(room: LivingOfficeRoom) {
    return room.id === 'hr'
  }
  function positionFor(room: LivingOfficeRoom): { at: Triple; finish: RoomFinish } {
    if (room.kind === 'executive') return { at: [-7.70, 0, -8.93], finish: ROOM_FINISHES[1]! }
    if (isHr(room)) return { at: [-10.96, 0, -1.41], finish: ROOM_FINISHES[0]! }
    const slot = departmentSlots.get(room.id)!
    if (slot < ROOM_SLOTS.length) return { at: ROOM_SLOTS[slot]!, finish: ROOM_FINISHES[2 + slot]! }
    // Further persisted departments continue outwards without moving the canonical offices.
    const extra = slot - ROOM_SLOTS.length, tier = Math.floor(extra / 10)
    const angle = extra % 10 * Math.PI / 5 - Math.PI / 2
    const radius = 25 + tier * 8
    return { at: [Math.sin(angle) * radius, 0, Math.cos(angle) * radius], finish: ROOM_FINISHES[2 + extra % 6]! }
  }
  function room(roomRecord: LivingOfficeRoom, members: LivingOfficeEmployee[]) {
    const placement = positionFor(roomRecord), pigment = placement.finish
    pathway(placement.at)
    const p = group(world, placement.at)
    p.name = `room:${roomRecord.id}`
    const platform = finish(pigment.floor, .62), side = finish(pigment.edge, .55), wall = finish(pigment.wall, .87), trim = finish(pigment.trim, .5)
    box(p, [5.45, .24, 5.45], [0, -.015, 0], side, .075)
    box(p, [5.30, .12, 5.30], [0, .115, 0], platform, .04)
    const interior = group(p, [0, .18, 0])
    box(interior, [.14, 1.96, 5.16], [-2.48, .98, 0], wall, .025)
    box(interior, [5.16, 1.96, .14], [0, .98, -2.48], wall, .025)
    box(interior, [.17, .065, 5.18], [-2.48, 1.975, 0], trim, .018)
    box(interior, [5.18, .065, .17], [0, 1.975, -2.48], trim, .018)
    box(interior, [.025, .105, 5.02], [-2.395, .07, 0], side, .008)
    box(interior, [5.02, .105, .025], [0, .07, -2.395], side, .008)
    // Back wall accents, shelving and neutral furnishing keep the room a small diorama.
    wallChart(interior, -2.389, -.95, 1.35, Math.PI / 2)
    bookshelf(interior)
    const executive = roomRecord.kind === 'executive'
    lamp(interior, -2.06, executive ? -1.85 : 1.58)
    plant(interior, 2.03, -1.73, 1.08)
    if (!executive) plant(interior, 1.72, 2.08, .74)
    const rug = box(interior, [2.78, .022, 2.36], [.32, .018, .49], finish(0xe4e0d7, .98), .025)
    rug.receiveShadow = true
    desk(interior, .85, -.15, false, Math.PI / 2)
    chair(interior, 0, -.15, Math.PI / 2)
    if (executive) {
      desk(interior, -1.75, .85, true, Math.PI / 2)
      wallChart(interior, -2.389, .70, .75, Math.PI / 2)
    } else sofa(interior, -1.85, .13)
    const ordered = [...members].sort((a, b) => a.id.localeCompare(b.id))
    ordered.forEach((member, i) => {
      if (i === 0) employee(interior, member, i, [0, 0, -.15], true, Math.PI / 2)
      else if (i === 1) employee(interior, member, i, [-1.19, 0, 1.36], false, .55)
      else if (i === 2) employee(interior, member, i, [1.53, 0, -.95], false, -.38)
      else {
        const n = i - 3
        employee(interior, member, i, [-1.5 + n % 4 * .90, 0, 1.78 - Math.floor(n / 4) * .65], false, -.15)
      }
    })
    const point = executive ? new THREE.Vector3(-1.90, 2.10, -2.90) : new THREE.Vector3(-2.79, 2.10, -2.51)
    anchors.push({ key: `room:${roomRecord.id}`, point, parent: p })
  }

  function releaseWorld() {
    for (const geometry of geometries) geometry.dispose()
    for (const mat of materials) mat.dispose()
    geometries.clear()
    materials.clear()
    world.clear()
    scene.remove(world)
  }
  function updateAnchors() {
    scene.updateMatrixWorld(true)
    options.anchors(anchors.map(anchor => {
      const point = anchor.parent.localToWorld(anchor.point.clone()).project(camera)
      return { key: anchor.key, x: (point.x + 1) / 2, y: (1 - point.y) / 2, visible: point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1 }
    }))
  }
  function render() {
    frame = 0
    if (disposed || contextLost || !visible || !dirty) return
    dirty = false
    renderer.shadowMap.needsUpdate = true
    renderer.render(scene, camera)
    updateAnchors()
    frames++
    // No Texture, loader, canvas image, or material map is created by this engine.
    const textureMaps = new Set<THREE.Texture>()
    for (const mat of materials) for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textureMaps.add(value)
    options.stats({ frames, triangles: renderer.info.render.triangles, rooms: roomCount, meshes: meshCount, textures: textureMaps.size })
  }
  function invalidate() {
    dirty = true
    if (!disposed && !contextLost && visible && !frame) frame = window.requestAnimationFrame(render)
  }
  function onContextLost(event: Event) {
    event.preventDefault()
    contextLost = true
    if (frame) window.cancelAnimationFrame(frame)
    frame = 0
    options.lost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost, false)

  return {
    setData(rooms: LivingOfficeRoom[], employees: LivingOfficeEmployee[]) {
      if (disposed) return
      const uniqueRooms = [...new Map(rooms.map(record => [record.id, record])).values()]
      const uniqueEmployees = [...new Map(employees.map(record => [record.id, record])).values()]
      const nextKey = JSON.stringify([uniqueRooms, uniqueEmployees])
      if (nextKey === dataKey) return
      dataKey = nextKey
      for (const record of [...uniqueRooms].sort((a, b) => a.id.localeCompare(b.id))) {
        if (record.kind !== 'executive' && !isHr(record) && !departmentSlots.has(record.id)) departmentSlots.set(record.id, departmentSlots.size)
      }
      releaseWorld()
      world = new THREE.Group()
      scene.add(world)
      geometries = new Set()
      materials = new Set()
      anchors = []
      meshCount = 0
      roomCount = uniqueRooms.length
      floor()
      brain()
      for (const record of uniqueRooms) room(record, uniqueEmployees.filter(member => member.departmentId === record.id))
      invalidate()
    },
    resize(width: number, height: number) {
      if (disposed || width <= 0 || height <= 0) return
      const aspect = width / height
      const referenceAspect = 1582 / 820
      const viewWidth = aspect >= referenceAspect ? 40 * aspect / referenceAspect : 40
      const viewHeight = viewWidth / aspect
      camera.left = -viewWidth / 2
      camera.right = viewWidth / 2
      camera.top = viewHeight / 2
      camera.bottom = -viewHeight / 2
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      invalidate()
    },
    // The still illustration has no ambient loop, so reduced motion is its default.
    setReducedMotion(_value: boolean) {},
    setVisible(value: boolean) {
      visible = value
      if (!visible && frame) { window.cancelAnimationFrame(frame); frame = 0 }
      if (visible) invalidate()
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      releaseWorld()
      key.shadow.dispose()
      scene.clear()
      renderer.renderLists.dispose()
      renderer.dispose()
      anchors = []
    },
  }
}
