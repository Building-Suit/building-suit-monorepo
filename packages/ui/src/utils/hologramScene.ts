import type { SpatialViewportCamera } from '@building-suit/ux'

type Vector = [number, number, number]
type Matrix = Float32Array
interface Geometry { positions: number[]; normals: number[] }
interface Mesh { position: WebGLBuffer; normal: WebGLBuffer; count: number; mode: number }
interface OrbProjection { eye: Vector; right: Vector; up: Vector; forward: Vector; center: Vector; aspect: number }

export interface HologramPalette { light: Vector; blue: Vector; metal: Vector }
export interface HologramRenderer {
  draw: (camera: Readonly<SpatialViewportCamera>, seconds: number) => void
  hitTestOrb: (clientX: number, clientY: number) => boolean
  dispose: () => void
}

const vertexShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uPointSize;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProjection * uView * world;
  gl_PointSize = uPointSize;
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
  float rim = pow(1.0 - facing, 2.6);
  float diffuse = max(dot(normal, normalize(vec3(-1.5, 3.0, 2.0))), 0.0);
  float specular = pow(max(dot(reflect(-normalize(vec3(-1.5, 3.0, 2.0)), normal), view), 0.0), 42.0);
  vec3 color = uColor * (0.38 + 0.62 * diffuse) + vec3(specular * 0.4);
  float alpha = uOpacity;
  if (uMaterial > 0.5 && uMaterial < 1.5) {
    float scan = pow(0.5 + 0.5 * sin(vWorld.y * 100.0 - uTime * 1.8), 13.0);
    color = uColor * (0.65 + rim * 1.45 + scan * 0.25) + vec3(specular * 0.65);
    alpha *= 0.38 + rim * 0.62;
  } else if (uMaterial > 1.5 && uMaterial < 2.5) {
    color = uColor * 1.35;
  } else if (uMaterial > 2.5 && uMaterial < 3.5) {
    float height = clamp((vWorld.y + 0.2) / 1.2, 0.0, 1.0);
    color = uColor;
    alpha *= pow(1.0 - height, 2.0) * (0.2 + rim * 0.8);
  } else if (uMaterial > 3.5) {
    color = uColor;
    alpha *= exp(-dot(vWorld.xz, vWorld.xz) * 0.7);
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
function model(x = 0, y = 0, z = 0, tilt = 0, turn = 0): Matrix {
  const translation = identity()
  translation[12] = x; translation[13] = y; translation[14] = z
  const rotationX = identity(), rotationZ = identity()
  rotationX[5] = Math.cos(tilt); rotationX[6] = Math.sin(tilt)
  rotationX[9] = -Math.sin(tilt); rotationX[10] = Math.cos(tilt)
  rotationZ[0] = Math.cos(turn); rotationZ[1] = Math.sin(turn)
  rotationZ[4] = -Math.sin(turn); rotationZ[5] = Math.cos(turn)
  return multiply(translation, multiply(rotationX, rotationZ))
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
function grid(): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  for (let i = -7; i <= 7; i++) {
    geometry.positions.push(i, -0.7, -7, i, -0.7, 7, -7, -0.7, i, 7, -0.7, i)
    for (let j = 0; j < 4; j++) geometry.normals.push(0, 1, 0)
  }
  return geometry
}
function particles(): Geometry {
  const geometry: Geometry = { positions: [], normals: [] }
  for (let i = 0; i < 72; i++) {
    const angle = i * 2.39996, radius = 0.85 + ((i * 17) % 23) / 32
    geometry.positions.push(Math.cos(angle) * radius, -0.1 + ((i * 13) % 41) / 22, Math.sin(angle) * radius)
    geometry.normals.push(0, 1, 0)
  }
  return geometry
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
    const uniforms = Object.fromEntries(['uProjection', 'uView', 'uModel', 'uEye', 'uColor', 'uOpacity', 'uTime', 'uMaterial', 'uPointSize'].map(name => [name, gl.getUniformLocation(program!, name)]))
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
    const geometry = {
      floor: mesh(cylinder(3.1, 3.1, -0.71, -0.705)),
      grid: mesh(grid(), gl.LINES),
      base: mesh(cylinder(1.53, 1.53, -0.65, -0.47)),
      bevel: mesh(cylinder(1.53, 1.39, -0.47, -0.39)),
      deck: mesh(cylinder(1.32, 1.32, -0.39, -0.31)),
      inset: mesh(cylinder(0.94, 0.94, -0.31, -0.25)),
      emitter: mesh(cylinder(0.43, 0.43, -0.25, -0.15)),
      outerRing: mesh(torus(1.535, 0.012)),
      ring: mesh(torus(1.27, 0.013)),
      innerRing: mesh(torus(0.94, 0.009)),
      emitterRing: mesh(torus(0.42, 0.012)),
      halo: mesh(torus(1.26, 0.055)),
      beam: mesh(cylinder(0.36, 0.56, -0.14, 0.86)),
      core: mesh(sphere(0.57)),
      shell: mesh(sphere(0.64)),
      orbit: mesh(torus(0.76, 0.004)),
      points: mesh(particles(), gl.POINTS),
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
      draw(camera, seconds) {
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
        gl.uniform3fv(uniforms.uEye!, eye); gl.uniform1f(uniforms.uTime!, seconds); gl.uniform1f(uniforms.uPointSize!, 1.8 * ratio)
        const time = seconds % 1000, float = Math.sin(time * 1.25) * 0.055
        orbProjection = { eye, right, up, forward: normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]), center: [0, 0.88 + float, 0], aspect: width / height }
        drawMesh(geometry.grid, palette.blue, 4, 0.14)
        drawMesh(geometry.floor, palette.blue, 4, 0.16, identity(), true)
        drawMesh(geometry.base, palette.metal, 0)
        drawMesh(geometry.bevel, palette.blue.map(value => value * 0.32) as Vector, 0)
        drawMesh(geometry.deck, palette.metal.map(value => value * 1.5) as Vector, 0)
        drawMesh(geometry.inset, palette.metal, 0)
        drawMesh(geometry.emitter, palette.blue.map(value => value * 0.3) as Vector, 0)
        drawMesh(geometry.outerRing, palette.blue, 2, 0.7, model(0, -0.48), true)
        drawMesh(geometry.ring, palette.light, 2, 0.95, model(0, -0.3), true)
        drawMesh(geometry.innerRing, palette.blue, 2, 0.65, model(0, -0.245), true)
        drawMesh(geometry.emitterRing, palette.light, 2, 1, model(0, -0.145), true)
        drawMesh(geometry.halo, palette.blue, 2, 0.06, model(0, -0.29), true)
        drawMesh(geometry.beam, palette.blue, 3, 0.24, identity(), true)
        drawMesh(geometry.core, palette.blue, 1, 0.74, model(0, 0.88 + float, 0, 0, time * 0.08), true)
        drawMesh(geometry.shell, palette.light, 1, 0.38, model(0, 0.88 + float), true)
        drawMesh(geometry.orbit, palette.light, 2, 0.4, model(0, 0.88 + float, 0, 0.48, time * 0.13), true)
        drawMesh(geometry.orbit, palette.blue, 2, 0.3, model(0, 0.88 + float, 0, 1.12, -time * 0.09), true)
        drawMesh(geometry.points, palette.light, 2, 0.48, model(0, Math.sin(time * 0.35) * 0.05, 0, 0, time * 0.025), true)
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
        const discriminant = projection * projection - dot(origin, origin) + 0.64 * 0.64
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
