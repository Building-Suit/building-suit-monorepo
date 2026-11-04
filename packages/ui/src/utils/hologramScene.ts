import type { SpatialViewportCamera } from '@building-suit/ux'

type Vector = [number, number, number]
type Matrix = Float32Array
interface Geometry { positions: number[]; normals: number[] }
interface Mesh { position: WebGLBuffer; normal: WebGLBuffer; count: number; mode: number }
interface OrbProjection { eye: Vector; right: Vector; up: Vector; forward: Vector; center: Vector; radius: number; aspect: number }

export interface HologramPalette { navy: Vector; surface: Vector; gold: Vector; steel: Vector; light: Vector; pearl: Vector }
export interface HologramInteraction { open: number; excited: number }
export interface HologramRenderer {
  draw: (camera: Readonly<SpatialViewportCamera>, seconds: number, interaction?: Readonly<HologramInteraction>) => void
  hitTestOrb: (clientX: number, clientY: number) => boolean
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
precision mediump float;
uniform vec3 uEye;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uMaterial;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
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
  } else if (uMaterial > 3.5) {
    color = uColor * (0.55 + diffuse * 0.4) + rim * uColor * 0.12;
  }
  gl_FragColor = vec4(color, alpha);
}`

function identity(): Matrix { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) }
function multiply(a: Matrix, b: Matrix): Matrix {
  const result = new Float32Array(16)
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let value = 0
      for (let k = 0; k < 4; k++) value += a[k * 4 + row]! * b[column * 4 + k]!
      result[column * 4 + row] = value
    }
  }
  return result
}
function model(x = 0, y = 0, z = 0, tilt = 0, turn = 0, spin = 0, scale = 1): Matrix {
  const translation = identity()
  translation[12] = x; translation[13] = y; translation[14] = z
  const rotationX = identity(), rotationZ = identity(), rotationY = identity(), scaling = identity()
  rotationX[5] = Math.cos(tilt); rotationX[6] = Math.sin(tilt)
  rotationX[9] = -Math.sin(tilt); rotationX[10] = Math.cos(tilt)
  rotationZ[0] = Math.cos(turn); rotationZ[1] = Math.sin(turn)
  rotationZ[4] = -Math.sin(turn); rotationZ[5] = Math.cos(turn)
  rotationY[0] = Math.cos(spin); rotationY[2] = -Math.sin(spin)
  rotationY[8] = Math.sin(spin); rotationY[10] = Math.cos(spin)
  scaling[0] = scale; scaling[5] = scale; scaling[10] = scale
  return multiply(translation, multiply(rotationY, multiply(rotationX, multiply(rotationZ, scaling))))
}
function dot(a: Vector, b: Vector): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
function normalize(a: Vector): Vector { const length = Math.hypot(...a) || 1; return [a[0] / length, a[1] / length, a[2] / length] }
function cross(a: Vector, b: Vector): Vector { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
function lookAt(eye: Vector, target: Vector): Matrix {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]])
  const x = normalize(cross([0, 1, 0], z)), y = cross(z, x)
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1])
}
function perspective(aspect: number): Matrix {
  const f = 1 / Math.tan(Math.PI / 8), near = 0.05, far = 150
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
function sphere(radius: number): Geometry {
  const normal = (u: number, v: number): Vector => [Math.sin(v * Math.PI) * Math.cos(u * Math.PI * 2), Math.cos(v * Math.PI), Math.sin(v * Math.PI) * Math.sin(u * Math.PI * 2)]
  return parametric(64, 40, (u, v) => normal(u, v).map(value => value * radius) as Vector, normal)
}
function torus(radius: number, tube: number): Geometry {
  return parametric(96, 10, (u, v) => {
    const angle = u * Math.PI * 2, side = v * Math.PI * 2
    return [(radius + tube * Math.cos(side)) * Math.cos(angle), tube * Math.sin(side), (radius + tube * Math.cos(side)) * Math.sin(angle)]
  }, (u, v) => [Math.cos(v * Math.PI * 2) * Math.cos(u * Math.PI * 2), Math.sin(v * Math.PI * 2), Math.cos(v * Math.PI * 2) * Math.sin(u * Math.PI * 2)])
}
function cylinder(bottomRadius: number, topRadius: number, bottom: number, top: number): Geometry {
  const geometry = parametric(96, 1, (u, v) => {
    const radius = bottomRadius + (topRadius - bottomRadius) * v
    return [radius * Math.cos(u * Math.PI * 2), bottom + (top - bottom) * v, radius * Math.sin(u * Math.PI * 2)]
  }, u => normalize([Math.cos(u * Math.PI * 2), (bottomRadius - topRadius) / (top - bottom), Math.sin(u * Math.PI * 2)]))
  for (let i = 0; i < 96; i++) for (const [height, radius, direction] of [[bottom, bottomRadius, -1], [top, topRadius, 1]]) {
    const angle = i * Math.PI / 48, next = (i + 1) * Math.PI / 48
    geometry.positions.push(0, height!, 0, radius! * Math.cos(angle), height!, radius! * Math.sin(angle), radius! * Math.cos(next), height!, radius! * Math.sin(next))
    for (let j = 0; j < 3; j++) geometry.normals.push(0, direction!, 0)
  }
  return geometry
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
function tube(path: Vector[], radius: number, sides = 5): Geometry {
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
function curve(points: [Vector, Vector, Vector, Vector], steps = 24): Vector[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps, rest = 1 - t
    return [0, 1, 2].map(axis => rest ** 3 * points[0][axis]! + 3 * rest ** 2 * t * points[1][axis]!
      + 3 * rest * t ** 2 * points[2][axis]! + t ** 3 * points[3][axis]!) as Vector
  })
}
function shieldPlate(angle: number): { body: Geometry; seam: Geometry; center: Vector } {
  const center: Vector = [Math.cos(angle) * 0.55, 0, Math.sin(angle) * 0.55]
  const radial = (u: number, v: number): Vector => {
    const polar = Math.PI * (0.13 + v * 0.78)
    const width = 0.46 * Math.PI / 3 * (0.74 + Math.sin(v * Math.PI) * 0.26)
    const azimuth = angle + (u * 2 - 1) * width
    return [Math.sin(polar) * Math.cos(azimuth), Math.cos(polar), Math.sin(polar) * Math.sin(azimuth)]
  }
  const point = (u: number, v: number, radius = 0.83): Vector => radial(u, v).map((value, axis) => value * radius - center[axis]!) as Vector
  const outer = parametric(20, 26, (u, v) => point(u, v), radial)
  const inner = parametric(20, 26, (u, v) => point(u, v, 0.793), (u, v) => radial(u, v).map(value => -value) as Vector)
  const edges: Geometry[] = []
  for (const side of [0, 1]) {
    edges.push(parametric(1, 26, (u, v) => point(side, v, 0.793 + u * 0.037), (_u, v) => radial(side, v)))
    edges.push(parametric(20, 1, (u, v) => point(u, side, 0.793 + v * 0.037), (u, _v) => radial(u, side)))
  }
  const seam = tube(Array.from({ length: 40 }, (_, index) => point(0, 0.08 + index / 39 * 0.82, 0.834)), 0.004, 4)
  return { body: merge(outer, inner, ...edges), seam, center }
}
function brainPoint(side: number, u: number, v: number): Vector {
  const azimuth = u * Math.PI * 2, polar = v * Math.PI
  const fold = 1 + Math.sin(azimuth * 8 + Math.sin(polar * 6) * 0.8) * Math.sin(polar) ** 1.3 * 0.045
    + Math.sin(polar * 15 + azimuth * 2) * Math.sin(polar) * 0.018
  return [side * 0.22 + Math.sin(polar) * Math.cos(azimuth) * 0.20 * fold,
    Math.cos(polar) * 0.33 * fold, Math.sin(polar) * Math.sin(azimuth) * 0.40 * fold]
}
function brainLobe(side: number): Geometry {
  return parametric(64, 40, (u, v) => brainPoint(side, u, v), (u, v) => {
    const safeV = Math.max(0.0001, Math.min(0.9998, v)), point = brainPoint(side, u, safeV)
    const nextU = brainPoint(side, u + 0.0001, safeV), nextV = brainPoint(side, u, safeV + 0.0001)
    return normalize(cross([nextU[0] - point[0], nextU[1] - point[1], nextU[2] - point[2]], [nextV[0] - point[0], nextV[1] - point[1], nextV[2] - point[2]]))
  })
}
function brainFolds(): Geometry {
  const folds: Geometry[] = []
  for (const side of [-1, 1]) for (let index = 0; index < 7; index++) {
    const path = Array.from({ length: 38 }, (_, step) => {
      const v = 0.09 + step / 37 * 0.80, u = index / 7 + Math.sin(v * 14 + index * 1.7) * 0.025
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
    const uniforms = Object.fromEntries(['uProjection', 'uView', 'uModel', 'uEye', 'uColor', 'uOpacity', 'uTime', 'uMaterial'].map(name => [name, gl.getUniformLocation(program!, name)]))
    const mesh = (geometry: Geometry, mode: number = gl.TRIANGLES): Mesh => {
      function buffer(data: number[]) {
        const result = gl!.createBuffer()
        if (!result) throw new Error('Hologram geometry unavailable')
        buffers.push(result); gl!.bindBuffer(gl!.ARRAY_BUFFER, result)
        gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(data), gl!.STATIC_DRAW)
        return result
      }
      return { position: buffer(geometry.positions), normal: buffer(geometry.normals), count: geometry.positions.length / 3, mode }
    }
    const plates = Array.from({ length: 6 }, (_, index) => {
      const angle = index * Math.PI / 3, plate = shieldPlate(angle)
      return { angle, center: plate.center, body: mesh(plate.body), seam: mesh(plate.seam) }
    })
    const geometry = {
      base: mesh(cylinder(1.10, 1.10, -0.64, -0.53)),
      deck: mesh(cylinder(1.10, 1.01, -0.53, -0.45)),
      outerRing: mesh(torus(1.06, 0.008)),
      innerRing: mesh(torus(0.80, 0.005)),
      shell: mesh(sphere(0.69)),
      lobes: mesh(merge(brainLobe(-1), brainLobe(1))),
      folds: mesh(brainFolds()),
      nerves: mesh(brainNerves()),
      stem: mesh(tube(curve([[0, -0.23, 0.04], [0, -0.31, 0.08], [0.015, -0.38, 0.10], [0, -0.43, 0.08]]), 0.025, 8)),
    }
    let disposed = false
    let orbProjection: OrbProjection | null = null
    function drawMesh(shape: Mesh, color: Vector, material: number, opacity = 1, transform = identity(), additive = false) {
      if (!gl) return
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(position)
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.normal); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(normal)
      gl.uniformMatrix4fv(uniforms.uModel!, false, transform)
      gl.uniform3fv(uniforms.uColor!, color); gl.uniform1f(uniforms.uMaterial!, material); gl.uniform1f(uniforms.uOpacity!, opacity)
      gl.depthMask(opacity >= 1 && material === 0)
      gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA)
      gl.drawArrays(shape.mode, 0, shape.count)
    }
    return {
      draw(camera, seconds, interaction = { open: 0, excited: 0 }) {
        if (disposed || !gl || gl.isContextLost()) return
        const width = canvas.clientWidth, height = canvas.clientHeight
        if (!width || !height) return
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const renderWidth = Math.round(width * ratio), renderHeight = Math.round(height * ratio)
        if (canvas.width !== renderWidth || canvas.height !== renderHeight) { canvas.width = renderWidth; canvas.height = renderHeight }
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.depthMask(true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.useProgram(program)
        const right: Vector = [Math.cos(camera.yaw), 0, -Math.sin(camera.yaw)]
        const up: Vector = [-Math.sin(camera.yaw) * Math.sin(camera.pitch), Math.cos(camera.pitch), -Math.cos(camera.yaw) * Math.sin(camera.pitch)]
        const target: Vector = [right[0] * camera.panX + up[0] * camera.panY, 0.42 + up[1] * camera.panY, right[2] * camera.panX + up[2] * camera.panY]
        const distance = 8.5 * Math.max(1, 0.76 / (width / height)) / camera.zoom
        const eye: Vector = [target[0] + Math.sin(camera.yaw) * Math.cos(camera.pitch) * distance, target[1] + Math.sin(camera.pitch) * distance, target[2] + Math.cos(camera.yaw) * Math.cos(camera.pitch) * distance]
        gl.uniformMatrix4fv(uniforms.uProjection!, false, perspective(width / height))
        gl.uniformMatrix4fv(uniforms.uView!, false, lookAt(eye, target))
        const time = seconds % 1000, open = Math.max(0, Math.min(1, interaction.open)), excited = Math.max(0, Math.min(1, interaction.excited))
        const reveal = open * open * (3 - 2 * open), float = Math.sin(time * 0.9) * 0.028
        const beat = 1 + Math.sin(time * 2.15) * 0.006, orbHeight = 0.98 + float
        const shakeX = Math.sin(time * 31) * excited * 0.005
        const shakeY = Math.sin(time * 37) * excited * 0.004
        gl.uniform3fv(uniforms.uEye!, eye); gl.uniform1f(uniforms.uTime!, time)
        orbProjection = {
          eye, right, up, forward: normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]),
          center: [shakeX, orbHeight + shakeY, 0], radius: (0.84 - reveal * 0.14) * beat, aspect: width / height,
        }
        drawMesh(geometry.base, palette.navy, 0)
        drawMesh(geometry.deck, palette.surface, 0)
        drawMesh(geometry.outerRing, palette.steel, 2, 0.65, model(0, -0.49))
        drawMesh(geometry.innerRing, palette.gold, 2, 0.34, model(0, -0.445))
        for (let index = 0; index < plates.length; index++) {
          const plate = plates[index]!, phase = index * 1.71
          const vibration = excited * (1 - reveal * 0.5)
          const radial = reveal * 0.88 + Math.sin(time * 33 + phase) * vibration * 0.014
          const lift = reveal * (index % 2 ? 0.94 : -0.80) + Math.sin(time * 38 + phase) * vibration * 0.010
          const tilt = reveal * 0.67 + Math.sin(time * 35 + phase) * vibration * 0.018
          const transform = model(
            plate.center[0] * beat + Math.cos(plate.angle) * radial + shakeX,
            orbHeight + lift + shakeY,
            plate.center[2] * beat + Math.sin(plate.angle) * radial,
            -Math.sin(plate.angle) * tilt, Math.cos(plate.angle) * tilt, reveal * Math.sin(phase) * 0.18, beat,
          )
          drawMesh(plate.body, index % 2 ? palette.surface : palette.navy, 0, 1, transform)
          drawMesh(plate.seam, palette.gold, 2, 0.38 + excited * 0.30, transform)
        }
        const brain = model(shakeX, orbHeight + shakeY, 0, 0, 0, 0, beat)
        if (reveal > 0.001) {
          drawMesh(geometry.lobes, palette.light, 4, reveal * 0.84, brain)
          drawMesh(geometry.stem, palette.steel, 4, reveal * 0.85, brain)
          drawMesh(geometry.folds, palette.steel, 2, reveal * 0.78, brain)
          drawMesh(geometry.nerves, palette.gold, 3, reveal * 0.94, brain)
        }
        drawMesh(geometry.shell, palette.pearl, 1, 0.50, brain)
      },
      hitTestOrb(clientX, clientY) {
        if (disposed || !orbProjection || gl.isContextLost()) return false
        const bounds = canvas.getBoundingClientRect()
        if (!bounds.width || !bounds.height || clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) return false
        const horizontal = ((clientX - bounds.left) / bounds.width * 2 - 1) * Math.tan(Math.PI / 8) * orbProjection.aspect
        const vertical = (1 - (clientY - bounds.top) / bounds.height * 2) * Math.tan(Math.PI / 8)
        const { eye, right, up, forward, center } = orbProjection
        const direction = normalize([forward[0] + right[0] * horizontal + up[0] * vertical, forward[1] + right[1] * horizontal + up[1] * vertical, forward[2] + right[2] * horizontal + up[2] * vertical])
        const origin: Vector = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]
        const projection = dot(origin, direction)
        const discriminant = projection * projection - dot(origin, origin) + orbProjection.radius * orbProjection.radius
        return discriminant >= 0 && -projection + Math.sqrt(discriminant) > 0.05
      },
      dispose() {
        if (disposed) return
        disposed = true
        orbProjection = null
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
