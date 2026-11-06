import { ISLAND_SHORE_CONFIG as C, waterGlslNumber as f } from './islandWaterConfig.ts'
import { ISLAND_SHORE_UNIFORMS_GLSL, ISLAND_SPLASH_VELOCITY_GLSL, islandShoreCalls } from './islandShoreShaders.ts'
import type { IslandShoreImpacts } from './islandShoreInteraction.ts'

const vertex = `
precision highp float;
attribute vec4 aParticle;
uniform mat4 uView, uProjection;
uniform vec3 uEye;
uniform float uPixelScale, uSeaLevel, uMaxPointSize;
${ISLAND_SHORE_UNIFORMS_GLSL}
varying mediump vec4 vSpray;
varying mediump vec2 vStretch;
${ISLAND_SPLASH_VELOCITY_GLSL}
void main() {
  vec4 event = vec4(0.0, 0.0, -1.0, 0.0), coast = vec4(0.0, 1.0, 1.0, 0.0), motion = vec4(0.0);
${islandShoreCalls(i => `  if (abs(aParticle.x - ${f(i)}) < 0.25) { event = uShoreImpact[${i}]; coast = uShoreNormal[${i}]; motion = uShoreMotion[${i}]; }`)}
  if (event.z < 0.0 || event.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; vSpray = vec4(0.0); vStretch = vec2(0.0, 1.0); return;
  }
  if (uWaterDebug > 6.5 && uWaterDebug < 7.5 && event.z >= 0.0 && event.w > 0.0 && aParticle.w < 0.00001) {
    gl_Position = uProjection * uView * vec4(event.x, uSeaLevel + motion.w, event.y, 1.0);
    gl_PointSize = min(8.0, uMaxPointSize); vSpray = vec4(1.0, 2.0, 0.0, 1.0); vStretch = vec2(0.0, 1.0); return;
  }
  float kind = aParticle.z, age = event.z - aParticle.w;
  vec3 velocity = islandSplashVelocity(coast, motion, event.w, aParticle.y, kind);
  vec3 position = vec3(event.x, uSeaLevel + motion.w, event.y) + velocity * age;
  position.y -= 0.5 * ${f(C.gravity)} * age * age;
  float distance = length(uEye - position);
  float lifetime = kind > 1.5 ? ${f(C.mistLifetime)} : ${f(C.splashLifetime)};
  float lod = kind > 0.5 ? 1.0 - smoothstep(${f(C.fineSprayDistance * 0.7)}, ${f(C.fineSprayDistance)}, distance)
    : 1.0 - smoothstep(${f(C.splashDistance * 0.7)}, ${f(C.splashDistance)}, distance);
  float fade = smoothstep(0.0, 0.045, age) * (1.0 - smoothstep(lifetime * 0.6, lifetime, age));
  float radius = kind > 1.5 ? 0.075 : (kind > 0.5 ? 0.012 : 0.026);
  float pixels = radius * 2.0 * uPixelScale / max(distance, 0.1);
  float alpha = (kind > 1.5 ? 0.10 : (kind > 0.5 ? 0.25 : 0.62)) * fade * lod * smoothstep(0.45, 1.1, pixels);
  if (event.w <= 0.0 || age < 0.0 || age > lifetime || position.y < uSeaLevel - 0.04 || alpha < 0.002) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; vSpray = vec4(0.0); vStretch = vec2(0.0, 1.0); return;
  }
  gl_Position = uProjection * uView * vec4(position, 1.0);
  gl_PointSize = clamp(pixels, 1.0, uMaxPointSize);
  vec4 projectedVelocity = uProjection * uView * vec4(velocity - vec3(0.0, ${f(C.gravity)} * age, 0.0), 0.0);
  vStretch = normalize(projectedVelocity.xy + vec2(0.0001));
  vSpray = vec4(alpha, kind, age / lifetime, 1.0);
}`
const fragment = `
precision mediump float;
uniform vec3 uFoamColor;
varying mediump vec4 vSpray;
varying mediump vec2 vStretch;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  if (vSpray.y < 0.5) p = vec2(dot(p, vec2(-vStretch.y, vStretch.x)) * 1.15, dot(p, vStretch) * 0.75);
  float radius = dot(p, p);
  float alpha = (1.0 - smoothstep(vSpray.y > 1.5 ? 0.0 : 0.25, 1.0, radius)) * vSpray.x;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uFoamColor * (0.85 + 0.15 * (1.0 - radius)), alpha);
}`

/** Fixed point pool, GPU ballistics, no per-particle CPU integration or new targets. */
export function createIslandShoreEffects(gl: WebGLRenderingContext, foamColor: readonly number[]) {
  const shaders: WebGLShader[] = []
  let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null
  const dispose = () => { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); for (const shader of shaders) gl.deleteShader(shader) }
  try {
    program = gl.createProgram(); if (!program) throw new Error('Shore spray program unavailable')
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(kind); if (!shader) throw new Error('Shore spray shader unavailable')
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shore spray shader unavailable')
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shore spray program unavailable')
    const attribute = gl.getAttribLocation(program, 'aParticle')
    const uniforms = Object.fromEntries(['uView', 'uProjection', 'uEye', 'uPixelScale', 'uSeaLevel', 'uMaxPointSize', 'uWaterDebug', 'uFoamColor', 'uShoreImpact[0]', 'uShoreNormal[0]', 'uShoreMotion[0]'].map(name => [name, gl.getUniformLocation(program!, name)]))
    const particles: number[] = []
    for (let slot = 0; slot < C.maxImpacts; slot++) for (let index = 0; index < C.particlesPerImpact; index++) {
      const seed = index === 0 ? 0.5 : ((index * 0.618033989 + slot * 0.173) % 1)
      particles.push(slot, seed, index < 10 ? 0 : (index < 30 ? 1 : 2), index === 0 ? 0 : seed * 0.10)
    }
    buffer = gl.createBuffer(); if (!buffer) throw new Error('Shore spray buffer unavailable')
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particles), gl.STATIC_DRAW)
    const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array
    const maxPoint = Math.min(C.maxPointSize, pointRange[1] ?? C.maxPointSize)
    const color = new Float32Array(foamColor)
    return {
      draw(impacts: IslandShoreImpacts, view: Float32Array, projection: Float32Array, eye: readonly number[], pixelScale: number, seaLevel: number, debug: number) {
        gl.useProgram(program); gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE)
        gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.uniformMatrix4fv(uniforms.uView!, false, view); gl.uniformMatrix4fv(uniforms.uProjection!, false, projection)
        gl.uniform3f(uniforms.uEye!, eye[0]!, eye[1]!, eye[2]!); gl.uniform1f(uniforms.uPixelScale!, pixelScale)
        gl.uniform1f(uniforms.uSeaLevel!, seaLevel); gl.uniform1f(uniforms.uMaxPointSize!, maxPoint)
        gl.uniform1f(uniforms.uWaterDebug!, debug)
        gl.uniform3fv(uniforms.uFoamColor!, color)
        gl.uniform4fv(uniforms['uShoreImpact[0]']!, impacts.positions)
        gl.uniform4fv(uniforms['uShoreNormal[0]']!, impacts.normals)
        gl.uniform4fv(uniforms['uShoreMotion[0]']!, impacts.velocities)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, 0, 0)
        gl.drawArrays(gl.POINTS, 0, particles.length / 4)
        gl.disableVertexAttribArray(attribute); gl.depthMask(true)
      },
      dispose,
    }
  } catch { dispose(); return null }
}
export type IslandShoreEffects = NonNullable<ReturnType<typeof createIslandShoreEffects>>
