/** GPU-only effects for the native, antialiased WebGL canvas. */
export interface HologramEffects {
  resize: (width: number, height: number) => boolean
  compositeBloom: () => void
  dispose: () => void
}

interface EffectTarget {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}
interface EffectProgram {
  program: WebGLProgram
  source: WebGLUniformLocation | null
  texel: WebGLUniformLocation | null
  step: WebGLUniformLocation | null
  strength: WebGLUniformLocation | null
  bloom: WebGLUniformLocation | null
}

const MAXIMUM_SCENE_PIXELS = 8_000_000
const BLOOM_SCALE = 0.25
const BLOOM_LONG_SIDE = 768
const BLOOM_STRENGTH = 0.48
const POSITION_ATTRIBUTE = 0

const vertexShader = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const fragmentPrecision = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uSource;
`

// Extract each tap before averaging so a thin bright seam can contribute even
// when its surrounding coal surface would pull the average below the threshold.
const brightShader = `${fragmentPrecision}
uniform vec2 uTexel;
vec3 bright(vec3 color) {
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return color * smoothstep(0.34, 0.70, luminance);
}
void main() {
  vec2 offset = uTexel * 1.5;
  vec3 color = bright(texture2D(uSource, vUv + vec2(-offset.x, -offset.y)).rgb);
  color += bright(texture2D(uSource, vUv + vec2(offset.x, -offset.y)).rgb);
  color += bright(texture2D(uSource, vUv + vec2(-offset.x, offset.y)).rgb);
  color += bright(texture2D(uSource, vUv + offset).rgb);
  gl_FragColor = vec4(color * 0.25, 1.0);
}`

const blurShader = `${fragmentPrecision}
uniform vec2 uStep;
void main() {
  vec3 color = texture2D(uSource, vUv).rgb * 0.2270270270;
  color += (texture2D(uSource, vUv + uStep).rgb + texture2D(uSource, vUv - uStep).rgb) * 0.1945945946;
  color += (texture2D(uSource, vUv + uStep * 2.0).rgb + texture2D(uSource, vUv - uStep * 2.0).rgb) * 0.1216216216;
  color += (texture2D(uSource, vUv + uStep * 3.0).rgb + texture2D(uSource, vUv - uStep * 3.0).rgb) * 0.0540540541;
  color += (texture2D(uSource, vUv + uStep * 4.0).rgb + texture2D(uSource, vUv - uStep * 4.0).rgb) * 0.0162162162;
  gl_FragColor = vec4(color, 1.0);
}`

const compositeShader = `${fragmentPrecision}
uniform float uStrength;
uniform sampler2D uBloom;
void main() {
  vec4 source = texture2D(uSource, vUv);
  vec3 glow = texture2D(uBloom, vUv).rgb * uStrength;
  float glowAlpha = clamp(max(max(glow.r, glow.g), glow.b), 0.0, 1.0);
  float alpha = source.a + glowAlpha * (1.0 - source.a);
  // The caller accumulates premultiplied RGB/coverage in its native target;
  // resolve to straight alpha once for its premultipliedAlpha:false canvas.
  vec3 color = (source.rgb + glow) / max(alpha, 0.0001);
  gl_FragColor = vec4(color, alpha);
}`

function scaledSize(width: number, height: number, scale: number, limit: number): [number, number] {
  const ratio = Math.min(scale, limit / Math.max(width, height))
  return [Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio))]
}

/**
 * Main geometry stays on the browser's native antialiased framebuffer. Bloom
 * copies its resolved pixels entirely on the GPU, then combines blurred light
 * with that exact source using straight alpha. Halos can extend over the CSS
 * background while unchanged source pixels retain their native antialiasing.
 * With an 8M-pixel caller budget, target storage is bounded at about 36 MB:
 * RGBA scene copy + two quarter-size RGBA bloom targets (the long-side cap
 * can reduce this further). No secondary geometry or depth target is allocated.
 *
 * Fullscreen passes intentionally do not snapshot/restore renderer GL state.
 * After compositeBloom, the default framebuffer/full viewport are bound;
 * depth testing/writes, culling, scissor and blending are off; color writes are
 * on. The composite program and quad ARRAY_BUFFER
 * remain bound, with attribute 0 enabled. Texture units 0 and 1 are unbound,
 * and unit 0 is active. The caller restores its program, attributes and world
 * rendering state before drawing geometry again.
 */
export function createHologramEffects(gl: WebGLRenderingContext): HologramEffects | null {
  const textures = new Set<WebGLTexture>()
  const framebuffers = new Set<WebGLFramebuffer>()
  const shaders = new Set<WebGLShader>()
  const programs = new Set<WebGLProgram>()
  let quad: WebGLBuffer | null = null
  let scene: EffectTarget | null = null
  let bloomA: EffectTarget | null = null, bloomB: EffectTarget | null = null
  let mainWidth = 0, mainHeight = 0
  let ready = false, failed = false, disposed = false

  function freeTargets() {
    ready = false
    for (const framebuffer of framebuffers) gl.deleteFramebuffer(framebuffer)
    for (const texture of textures) gl.deleteTexture(texture)
    framebuffers.clear(); textures.clear()
    scene = null; bloomA = null; bloomB = null
  }
  function freeResources() {
    freeTargets()
    for (const program of programs) gl.deleteProgram(program)
    for (const shader of shaders) gl.deleteShader(shader)
    programs.clear(); shaders.clear()
    if (quad) gl.deleteBuffer(quad)
    quad = null
  }
  function mainTarget() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, mainWidth || gl.drawingBufferWidth, mainHeight || gl.drawingBufferHeight)
  }
  function clearTextureUnits() {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null)
  }
  function disable() {
    failed = true
    try { freeResources(); mainTarget(); clearTextureUnits() }
    catch { /* Context disposal must never break the caller's primary renderer. */ }
  }
  function usable() { return !disposed && !failed && !gl.isContextLost() }

  try {
    if (gl.isContextLost()) return null
    const maximumTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    if (!Number.isFinite(maximumTextureSize) || maximumTextureSize < 1) return null

    function compile(kind: number, source: string) {
      const shader = gl.createShader(kind)
      if (!shader) throw new Error('Hologram effects unavailable')
      shaders.add(shader)
      gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Hologram effects unavailable')
      return shader
    }
    function makeProgram(fragment: string): EffectProgram {
      const program = gl.createProgram()
      if (!program) throw new Error('Hologram effects unavailable')
      programs.add(program)
      const vertex = compile(gl.VERTEX_SHADER, vertexShader), pixel = compile(gl.FRAGMENT_SHADER, fragment)
      gl.attachShader(program, vertex); gl.attachShader(program, pixel)
      gl.bindAttribLocation(program, POSITION_ATTRIBUTE, 'aPosition')
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Hologram effects unavailable')
      gl.detachShader(program, vertex); gl.detachShader(program, pixel)
      gl.deleteShader(vertex); gl.deleteShader(pixel); shaders.delete(vertex); shaders.delete(pixel)
      return {
        program,
        source: gl.getUniformLocation(program, 'uSource'), texel: gl.getUniformLocation(program, 'uTexel'),
        step: gl.getUniformLocation(program, 'uStep'), strength: gl.getUniformLocation(program, 'uStrength'),
        bloom: gl.getUniformLocation(program, 'uBloom'),
      }
    }
    const bright = makeProgram(brightShader), blur = makeProgram(blurShader), composite = makeProgram(compositeShader)
    quad = gl.createBuffer()
    if (!quad) throw new Error('Hologram effects unavailable')
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

    function target(width: number, height: number): EffectTarget {
      const texture = gl.createTexture()
      if (!texture) throw new Error('Hologram effects unavailable')
      textures.add(texture)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      const framebuffer = gl.createFramebuffer()
      if (!framebuffer) throw new Error('Hologram effects unavailable')
      framebuffers.add(framebuffer); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Hologram effects unavailable')
      return { texture, framebuffer, width, height }
    }
    function fullscreen(program: EffectProgram, source: WebGLTexture, destination: EffectTarget | null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, destination?.framebuffer ?? null)
      gl.viewport(0, 0, destination?.width ?? mainWidth, destination?.height ?? mainHeight)
      gl.useProgram(program.program)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, source)
      gl.uniform1i(program.source, 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    return {
      resize(width, height) {
        if (!usable()) return false
        if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
          || width > maximumTextureSize || height > maximumTextureSize || width * height > MAXIMUM_SCENE_PIXELS) {
          disable()
          return false
        }
        if (ready && width === mainWidth && height === mainHeight) return true
        try {
          // Release first: resizing never keeps two complete target sets alive.
          freeTargets()
          mainWidth = width; mainHeight = height
          const [bloomWidth, bloomHeight] = scaledSize(width, height, BLOOM_SCALE, Math.min(BLOOM_LONG_SIDE, maximumTextureSize))
          // A temporary framebuffer attachment also validates the copy texture.
          scene = target(width, height)
          bloomA = target(bloomWidth, bloomHeight); bloomB = target(bloomWidth, bloomHeight)
          ready = true
          mainTarget(); clearTextureUnits()
          return true
        }
        catch { disable(); return false }
      },
      compositeBloom() {
        if (!usable() || !ready || !scene || !bloomA || !bloomB || !quad) return
        if (mainWidth !== gl.drawingBufferWidth || mainHeight !== gl.drawingBufferHeight) return
        try {
          mainTarget()
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.texture)
          gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, mainWidth, mainHeight)
          gl.disable(gl.DEPTH_TEST); gl.depthMask(false)
          gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND)
          gl.colorMask(true, true, true, true)
          gl.bindBuffer(gl.ARRAY_BUFFER, quad)
          gl.enableVertexAttribArray(POSITION_ATTRIBUTE)
          gl.vertexAttribPointer(POSITION_ATTRIBUTE, 2, gl.FLOAT, false, 0, 0)
          gl.useProgram(bright.program); gl.uniform2f(bright.texel, 1 / mainWidth, 1 / mainHeight)
          fullscreen(bright, scene.texture, bloomA)
          gl.useProgram(blur.program); gl.uniform2f(blur.step, 1 / bloomA.width, 0)
          fullscreen(blur, bloomA.texture, bloomB)
          gl.uniform2f(blur.step, 0, 1 / bloomB.height)
          fullscreen(blur, bloomB.texture, bloomA)
          gl.useProgram(composite.program); gl.uniform1f(composite.strength, BLOOM_STRENGTH)
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomA.texture)
          gl.uniform1i(composite.bloom, 1)
          fullscreen(composite, scene.texture, null)
          mainTarget(); clearTextureUnits()
        }
        catch { disable() }
      },
      dispose() {
        if (disposed) return
        disposed = true
        try { freeResources(); mainTarget(); clearTextureUnits() }
        catch { /* Disposing effects never changes availability of the scene. */ }
      },
    }
  }
  catch {
    disable()
    return null
  }
}
