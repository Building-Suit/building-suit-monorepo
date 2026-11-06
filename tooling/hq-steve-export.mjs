// Portable model/review artifact generation, not a test or application build.
// Node 26 (repository runtime): node tooling/hq-steve-export.mjs [output-directory]
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHqSteveCharacter, HQ_STEVE_RIG, hqStevePigments, HQ_STEVE_MATERIAL_GLSL } from '../packages/ui/src/utils/hqSteveCharacter.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, process.argv[2] ?? '.local/artifacts/steve')
const tokenSource = JSON.parse(await readFile(resolve(root, 'packages/design-tokens/tokens.json'), 'utf8'))
// Use the same canonical primitive sources as BsHologramScene's CSS reads.
const rgb = token => [1, 3, 5].map(i => parseInt(token.value.slice(i, i + 2), 16) / 255)
const { brand, neutral } = tokenSource.color
const colors = hqStevePigments({ navy: rgb(brand.buildingNavy), steelGray: rgb(neutral.steelGray), coal: rgb(neutral.ink), charcoal: rgb(neutral.charcoal), pearl: rgb(brand.pearlWhite), gold: rgb(brand.premiumGold) })
const parts = createHqSteveCharacter().map(part => {
  const positions = [], normals = [], indices = [], unique = new Map()
  const g = part.geometry
  for (let i = 0; i < g.positions.length; i += 3) {
    const values = [...g.positions.slice(i, i + 3), ...g.normals.slice(i, i + 3)].map(v => Math.round(v * 1e6) / 1e6)
    const key = values.join(',')
    let index = unique.get(key)
    if (index === undefined) { index = positions.length / 3; unique.set(key, index); positions.push(...values.slice(0, 3)); normals.push(...values.slice(3)) }
    indices.push(index)
  }
  return { ...part, geometry: { positions, normals, indices } }
})
const joints = ['root', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'leftShoe', 'rightShoe']
const pigmentNames = Object.keys(colors)
const nodes = joints.map(name => ({ name, children: [] }))
const rig = HQ_STEVE_RIG
for (const side of ['left', 'right']) {
  const sign = side === 'left' ? -1 : 1
  const arm = nodes[joints.indexOf(`${side}Arm`)], leg = nodes[joints.indexOf(`${side}Leg`)], shoe = nodes[joints.indexOf(`${side}Shoe`)]
  arm.translation = [sign * rig.shoulderX, rig.shoulderY, 0]
  arm.rotation = [0, 0, Math.sin(sign * 0.06), Math.cos(sign * 0.06)]
  leg.translation = [sign * rig.hipX, rig.hipY, 0]
  shoe.translation = [0, -rig.legLength, 0]
  leg.children.push(joints.indexOf(`${side}Shoe`))
  nodes[0].children.push(joints.indexOf(`${side}Arm`), joints.indexOf(`${side}Leg`))
}
const gltf = { asset: { version: '2.0', generator: 'Building Suit Steve geometry authoring', extras: { reference: 'Founder-supplied CEO character sheet; authored approximation, not exact reconstruction' } }, scene: 0, scenes: [{ nodes: [0] }], nodes, meshes: [], materials: pigmentNames.map(name => ({ name, pbrMetallicRoughness: { baseColorFactor: [...colors[name].map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), 1], metallicFactor: name === 'gold' ? 0.72 : 0, roughnessFactor: name === 'gold' ? 0.34 : ['iris', 'pupil', 'eyeWhite'].includes(name) ? 0.20 : ['hair', 'hairRidge'].includes(name) ? 0.55 : 0.82 }, doubleSided: true })), buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] }
const chunks = []; let bytes = 0
function attribute(array, minMax = false) {
  const values = new Float32Array(array), chunk = Buffer.from(values.buffer)
  const view = gltf.bufferViews.length
  gltf.bufferViews.push({ buffer: 0, byteOffset: bytes, byteLength: chunk.length, target: 34962 }); chunks.push(chunk); bytes += chunk.length
  const accessor = { bufferView: view, componentType: 5126, count: array.length / 3, type: 'VEC3' }
  if (minMax) {
    accessor.min = [Infinity, Infinity, Infinity]; accessor.max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < array.length; i++) { const a = i % 3; accessor.min[a] = Math.min(accessor.min[a], array[i]); accessor.max[a] = Math.max(accessor.max[a], array[i]) }
  }
  gltf.accessors.push(accessor); return gltf.accessors.length - 1
}
function indexAttribute(indices) {
  const values = new Uint16Array(indices), chunk = Buffer.from(values.buffer), padding = (4 - chunk.length % 4) % 4
  const view = gltf.bufferViews.length
  gltf.bufferViews.push({ buffer: 0, byteOffset: bytes, byteLength: chunk.length, target: 34963 })
  chunks.push(chunk, Buffer.alloc(padding)); bytes += chunk.length + padding
  gltf.accessors.push({ bufferView: view, componentType: 5123, count: indices.length, type: 'SCALAR' })
  return gltf.accessors.length - 1
}
for (const joint of joints) {
  const primitives = parts.filter(p => p.joint === joint).map(p => ({ attributes: { POSITION: attribute(p.geometry.positions, true), NORMAL: attribute(p.geometry.normals) }, indices: indexAttribute(p.geometry.indices), material: pigmentNames.indexOf(p.pigment), mode: 4 }))
  nodes[joints.indexOf(joint)].mesh = gltf.meshes.length
  gltf.meshes.push({ name: joint, primitives })
}
gltf.buffers[0].byteLength = bytes
const json = Buffer.from(JSON.stringify(gltf)), jsonPadding = (4 - json.length % 4) % 4
const jsonChunk = Buffer.concat([json, Buffer.alloc(jsonPadding, 32)]), binChunk = Buffer.concat(chunks)
const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8)
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonChunk.length + binChunk.length, 8)
jsonHeader.writeUInt32LE(jsonChunk.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
binHeader.writeUInt32LE(binChunk.length); binHeader.writeUInt32LE(0x004e4942, 4)
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'steve.glb'), Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]))
const template = await readFile(resolve(root, 'tooling/hq-steve-review.html'), 'utf8')
await writeFile(resolve(output, 'steve-review.html'), template.replace('/*MODEL_DATA*/null', JSON.stringify({ parts, colors, rig, fragment: HQ_STEVE_MATERIAL_GLSL })))
console.log(`Created ${resolve(output, 'steve.glb')} and steve-review.html`)
