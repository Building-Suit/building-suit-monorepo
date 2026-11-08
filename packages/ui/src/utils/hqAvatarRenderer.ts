import type { HqAgentAvatar } from '../types/hqAgentsPresentation'
import type { HqAvatarAssets } from '../types/hqLayoutPresentation'
import { HQ_AGENT_CHARACTER_SCALE, HQ_AGENT_RIG } from './hqAgentCharacters.ts'
import type { HqAgentPose } from './hqAgentCharacters.ts'
import { matrixProduct, model } from './hqSceneMatrices.ts'

type Point = [number, number, number]
const parents = [-1, 0, 1, 1, 3, 4, 1, 6, 7, 0, 9, 10, 0, 12, 13]
const attributes = ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'] as const
const attributeSizes = [3, 3, 2, 4, 4]

interface AvatarParts {
  height: number
  pivots: Point[]
  body: number
  bodyMasks: number[]
  skin: number[]
  eyes: number
  eyeMaterials: number[]
  brows: number[]
  hair: number[]
  clothes: number[]
  shoes: number[]
}

interface AvatarGlb {
  extras: { hqAvatar: AvatarParts }
  meshes: { primitives: { attributes: Record<(typeof attributes)[number], number>; indices: number; material: number }[] }[]
  accessors: { bufferView: number; count: number; componentType: number; type: string; normalized?: boolean }[]
  bufferViews: { byteOffset: number; byteLength: number }[]
  materials: { alphaCutoff?: number; pbrMetallicRoughness: { baseColorTexture: { index: number } } }[]
  textures: { source: number }[]
  images: { bufferView: number; mimeType: string }[]
}

interface AvatarPack {
  parts: AvatarParts
  document: AvatarGlb
  buffers: Map<number, WebGLBuffer>
  textures: WebGLTexture[]
}

interface MotionBlend {
  walk: number
  work: number
  lounge: number
  fish: number
  time: number
  yaw: number
}

const vertexSource = `
precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
attribute vec4 aJoints;
attribute vec4 aWeights;
uniform mat4 uViewProjection;
uniform mat4 uModel;
uniform mat4 uJoints[${parents.length}];
varying mediump vec2 vUv;
varying mediump vec3 vNormal;
void main() {
  mat4 skin = uJoints[int(aJoints.x)] * aWeights.x + uJoints[int(aJoints.y)] * aWeights.y
            + uJoints[int(aJoints.z)] * aWeights.z + uJoints[int(aJoints.w)] * aWeights.w;
  mat4 world = uModel * skin;
  vNormal = (world * vec4(aNormal, 0.0)).xyz;
  vUv = aUv;
  gl_Position = uViewProjection * world * vec4(aPosition, 1.0);
}`

const fragmentSource = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec3 uTint;
uniform float uCutoff;
varying mediump vec2 vUv;
varying mediump vec3 vNormal;
void main() {
  vec4 sampleColor = texture2D(uTexture, vUv);
  if (sampleColor.a < uCutoff) discard;
  vec3 normal = normalize(gl_FrontFacing ? vNormal : -vNormal);
  float key = max(dot(normal, normalize(vec3(0.45, 0.8, 0.35))), 0.0);
  float fill = max(dot(normal, normalize(vec3(-0.6, 0.2, -0.75))), 0.0);
  vec3 light = vec3(0.65, 0.67, 0.72) + vec3(0.46, 0.43, 0.37) * key + vec3(0.16, 0.19, 0.24) * fill;
  gl_FragColor = vec4(sampleColor.rgb * uTint * light, 1.0);
}`

const hairTints: readonly Point[] = [[1, 1, 1], [1.25, 1.11, 0.94], [0.69, 0.66, 0.64], [1.32, 1.18, 1.05]]
const clothesTints: readonly Point[] = [[1, 1, 1], [0.77, 0.92, 1.15], [1.13, 0.85, 0.76], [0.77, 1.02, 0.89]]
const untinted: Point = [1, 1, 1]

function makeProgram(gl: WebGLRenderingContext) {
  const program = gl.createProgram()
  if (!program) return null
  const shaders: WebGLShader[] = []
  try {
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
      const shader = gl.createShader(kind)
      if (!shader) throw new Error('Avatar shader unavailable')
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Avatar renderer unavailable')
    return program
  } catch {
    gl.deleteProgram(program)
    return null
  } finally {
    for (const shader of shaders) gl.deleteShader(shader)
  }
}

function deletePack(gl: WebGLRenderingContext, buffers: Map<number, WebGLBuffer>, textures: WebGLTexture[]) {
  for (const buffer of buffers.values()) gl.deleteBuffer(buffer)
  for (const texture of textures) gl.deleteTexture(texture)
}

async function loadPack(gl: WebGLRenderingContext, blob: Blob, signal: AbortSignal): Promise<AvatarPack> {
  const data = await blob.arrayBuffer()
  if (signal.aborted || gl.isContextLost()) throw new Error('Avatar load cancelled')
  const header = new DataView(data)
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2) throw new Error('Invalid avatar pack')
  const jsonLength = header.getUint32(12, true)
  const document = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, jsonLength))) as AvatarGlb
  const { hqAvatar: parts } = document.extras
  if (parts.pivots.length !== parents.length || !Number.isFinite(parts.height) || parts.height <= 0) throw new Error('Invalid avatar rig')
  const contents = (index: number) => {
    const view = document.bufferViews[index]!
    return new Uint8Array(data, 28 + jsonLength + view.byteOffset, view.byteLength)
  }
  const buffers = new Map<number, WebGLBuffer>()
  const textures: WebGLTexture[] = []
  try {
    for (const image of document.images) {
      const bitmap = await createImageBitmap(new Blob([contents(image.bufferView)], { type: image.mimeType }))
      try {
        if (signal.aborted || gl.isContextLost()) throw new Error('Avatar load cancelled')
        const texture = gl.createTexture()
        if (!texture) throw new Error('Avatar texture unavailable')
        textures.push(texture)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        const mipmaps = (bitmap.width & (bitmap.width - 1)) === 0 && (bitmap.height & (bitmap.height - 1)) === 0
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
        if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D)
      } finally {
        bitmap.close()
      }
    }
    for (const accessor of document.accessors) {
      const view = accessor.bufferView
      if (buffers.has(view) || accessor.type === 'MAT4') continue
      const buffer = gl.createBuffer()
      if (!buffer) throw new Error('Avatar buffer unavailable')
      buffers.set(view, buffer)
      const target = accessor.type === 'SCALAR' ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER
      gl.bindBuffer(target, buffer)
      gl.bufferData(target, contents(view), gl.STATIC_DRAW)
    }
    return { parts, document, buffers, textures }
  } catch (error) {
    deletePack(gl, buffers, textures)
    throw error
  }
}

export function createHqAvatarRenderer(gl: WebGLRenderingContext, assets: () => HqAvatarAssets | undefined, onReady: () => void) {
  const program = makeProgram(gl)
  if (!program) return null
  const controller = new AbortController()
  const packs = new Map<HqAgentAvatar['body'], AvatarPack>()
  const requested = new Set<HqAgentAvatar['body']>()
  const motions = new Map<string, MotionBlend>()
  const locations = ['aPosition', 'aNormal', 'aUv', 'aJoints', 'aWeights'].map(name => gl.getAttribLocation(program, name))
  const uniforms = {
    viewProjection: gl.getUniformLocation(program, 'uViewProjection'),
    model: gl.getUniformLocation(program, 'uModel'),
    joints: gl.getUniformLocation(program, 'uJoints[0]'),
    texture: gl.getUniformLocation(program, 'uTexture'),
    tint: gl.getUniformLocation(program, 'uTint'),
    cutoff: gl.getUniformLocation(program, 'uCutoff'),
  }
  const palette = new Float32Array(parents.length * 16)
  const joints = parents.map((_, index) => palette.subarray(index * 16, (index + 1) * 16))
  const root = new Float32Array(16), local = new Float32Array(16)
  const grip = new Float32Array(16), rod = new Float32Array(16)

  function mesh(pack: AvatarPack, meshId: number, tint: Point, materialId?: number, indicesId?: number) {
    const { document, buffers, textures } = pack
    const primitive = document.meshes[meshId]!.primitives[0]!
    for (const [index, attribute] of attributes.entries()) {
      const accessor = document.accessors[primitive.attributes[attribute]]!
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.get(accessor.bufferView)!)
      gl.vertexAttribPointer(locations[index]!, attributeSizes[index]!, accessor.componentType, Boolean(accessor.normalized), 0, 0)
    }
    const indices = document.accessors[indicesId ?? primitive.indices]!
    const material = document.materials[materialId ?? primitive.material]!
    gl.bindTexture(gl.TEXTURE_2D, textures[document.textures[material.pbrMetallicRoughness.baseColorTexture.index]!.source]!)
    gl.uniform3fv(uniforms.tint, tint)
    gl.uniform1f(uniforms.cutoff, material.alphaCutoff ?? 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.get(indices.bufferView)!)
    gl.drawElements(gl.TRIANGLES, indices.count, indices.componentType, 0)
  }

  function bend(pivots: Point[], index: number, pitch = 0, roll = 0, yaw = 0, width = 1) {
    const [x, y, z] = pivots[index]!
    const parent = parents[index]!
    const transform = parent < 0 ? joints[index]! : local
    model(x, y, z, pitch, roll, yaw, 1, transform)
    for (let axis = 0; axis < 3; axis++) transform[axis] = transform[axis]! * width
    // T(pivot) * R * T(-pivot), then inherit the parent's bind-space motion.
    transform[12] = transform[12]! - (transform[0]! * x + transform[4]! * y + transform[8]! * z)
    transform[13] = transform[13]! - (transform[1]! * x + transform[5]! * y + transform[9]! * z)
    transform[14] = transform[14]! - (transform[2]! * x + transform[6]! * y + transform[10]! * z)
    if (parent >= 0) matrixProduct(joints[parent]!, transform, joints[index]!)
  }

  return {
    retain(ids: ReadonlyMap<string, unknown>) {
      for (const id of motions.keys()) if (!ids.has(id)) motions.delete(id)
    },
    draw(appearance: HqAgentAvatar, pose: HqAgentPose, viewProjection: Float32Array, time: number, reduced: boolean) {
      const pack = packs.get(appearance.body)
      if (!pack) {
        const asset = assets()?.[appearance.body]
        if (asset && !requested.has(appearance.body)) {
          requested.add(appearance.body)
          void loadPack(gl, asset, controller.signal).then(loaded => {
            if (controller.signal.aborted) deletePack(gl, loaded.buffers, loaded.textures)
            else { packs.set(appearance.body, loaded); onReady() }
          }).catch(() => { /* The scene keeps its neutral placeholder if the asset is unavailable. */ })
        }
        return null
      }
      const { parts } = pack
      const { pivots } = parts
      const targetYaw = pose.yaw + (pose.mode === 'fishing' || pose.mode === 'lounging' ? 0 : Math.PI)
      const target = {
        walk: Number(pose.mode === 'walking' && !reduced), work: Number(pose.mode === 'working'),
        lounge: Number(pose.mode === 'lounging'), fish: Number(pose.mode === 'fishing'),
      }
      const previous = motions.get(pose.id)
      const motion = previous ?? { ...target, time, yaw: targetYaw }
      const delta = time - motion.time
      const mix = !previous || reduced || delta > 0.25 ? 1 : 1 - Math.exp(-12 * Math.max(0, delta))
      for (const mode of ['walk', 'work', 'lounge', 'fish'] as const) motion[mode] += (target[mode] - motion[mode]) * mix
      const yawDelta = targetYaw - motion.yaw
      motion.yaw += Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta)) * mix
      motion.time = time
      motions.set(pose.id, motion)

      const { walk, work, lounge, fish } = motion
      const { strideScale, armSwing, idleRate, offset } = pose.gait
      const stride = Math.sin(pose.phase) * walk * strideScale
      const idleTime = time * idleRate
      const breath = reduced ? 0 : Math.sin(idleTime * 2.1 + offset)
      const seated = work + lounge
      const height = HQ_AGENT_RIG.height * HQ_AGENT_CHARACTER_SCALE * (appearance.body === 'female' ? 0.96 : 1)
      const scale = height / parts.height
      const hipHeight = (pivots[9]![1] + pivots[12]![1]) * .5 * scale
      const y = pose.y + Math.abs(stride) * .018 + breath * .004 - seated * (hipHeight - HQ_AGENT_RIG.hipY + .08)
      model(pose.x, y, pose.z, 0, 0, motion.yaw, scale, root)
      bend(pivots, 0, 0, stride * .035)
      bend(pivots, 1, lounge * -.35 + work * .11 + breath * .012, stride * -.022, stride * .07)
      const headWidth = .94 + (appearance.seed >>> 28) * .008
      bend(pivots, 2, lounge * .22 - work * .12 + breath * .016, 0, breath * .045 * (1 - seated), headWidth)

      for (const [side, shoulder, hip] of [[1, 3, 9], [-1, 6, 12]] as const) {
        const elbow = shoulder + 1
        const wrist = shoulder + 2
        const swing = stride * side
        const armDrop = -Math.atan2(pivots[elbow]![0] - pivots[shoulder]![0], pivots[shoulder]![1] - pivots[elbow]![1]) + side * .09
        const typing = reduced ? 0 : Math.sin(idleTime * 10 + offset + side * 1.7) * .055
        bend(pivots, shoulder, swing * .33 * armSwing - work * .41 - fish * .39 + lounge * .13, armDrop + side * (.08 * work + .10 * lounge))
        bend(pivots, elbow, -.12 - work * (.35 + typing) - fish * (.46 + breath * .03) - lounge * .23 - Math.max(0, swing) * .20)
        bend(pivots, wrist, work * (.16 + typing * .7))
        bend(pivots, hip, -swing * .35 - work * 1.46 - lounge * 1.15, side * (.08 * seated))
        bend(pivots, hip + 1, Math.max(0, -swing) * .57 + work * 1.44 + lounge * .62)
        bend(pivots, hip + 2, swing * .15 - lounge * .18 - Math.max(0, -swing) * .20)
      }

      const seed = appearance.seed
      const outfit = seed % parts.clothes.length, shoes = (seed >>> 6) % parts.shoes.length
      const hair = parts.hair[appearance.hairstyle % parts.hair.length]!
      const hairTint = hairTints[(seed >>> 13) % hairTints.length]!
      gl.useProgram(program)
      gl.disable(gl.CULL_FACE)
      gl.depthMask(true)
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1i(uniforms.texture, 0)
      gl.uniformMatrix4fv(uniforms.viewProjection, false, viewProjection)
      gl.uniformMatrix4fv(uniforms.model, false, root)
      gl.uniformMatrix4fv(uniforms.joints, false, palette)
      for (const location of locations) gl.enableVertexAttribArray(location)
      mesh(pack, parts.body, untinted, parts.skin[(seed >>> 3) % parts.skin.length], parts.bodyMasks[outfit * parts.shoes.length + shoes])
      mesh(pack, parts.clothes[outfit]!, clothesTints[(seed >>> 8) % clothesTints.length]!)
      mesh(pack, parts.shoes[shoes]!, untinted)
      mesh(pack, parts.eyes, untinted, parts.eyeMaterials[(seed >>> 18) % parts.eyeMaterials.length])
      mesh(pack, parts.brows[(seed >>> 23) % parts.brows.length]!, hairTint)
      mesh(pack, hair, hairTint)
      for (const location of locations) gl.disableVertexAttribArray(location)

      if (pose.mode === 'fishing') {
        const [x, wristY, z] = pivots[8]!
        // Attach the existing prop just inside the animated right hand.
        model(x - .025, wristY - .055, z + .025, 0, 0, 0, 1, local)
        matrixProduct(joints[8]!, local, grip)
        model(grip[12]!, grip[13]!, grip[14]!, -.08 + breath * .03, 0, Math.PI, 1, local)
        matrixProduct(root, local, rod)
      }
      return { labelY: y + height + .18, rod: pose.mode === 'fishing' ? rod : null }
    },
    dispose() {
      controller.abort()
      for (const pack of packs.values()) deletePack(gl, pack.buffers, pack.textures)
      packs.clear(); motions.clear()
      gl.deleteProgram(program)
    },
  }
}
