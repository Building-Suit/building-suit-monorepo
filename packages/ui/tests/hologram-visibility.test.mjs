import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as vue from 'vue'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { descriptor } = parse(readFileSync(new URL('../src/organisms/BsHologramScene.vue', import.meta.url), 'utf8'))
const code = ts.transpileModule(compileScript(descriptor, { id: 'hologram-visibility', inlineTemplate: true }).content.replaceAll('import.meta.dev', 'false'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function fixture({ observer = true, reduced = false, available = true } = {}) {
  const state = { constructions: 0, draws: 0, disposals: 0, activations: 0, selections: [], orb: true, workplace: null, available }
  const frames = new Map(), listeners = new Map()
  let nextFrame = 0, intersect, resize, motionChange, intersectionDisconnected = false, resizeDisconnected = false
  const document = { hidden: false, addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: name => listeners.delete(name) }
  const motion = { matches: reduced, addEventListener: (_, listener) => { motionChange = listener }, removeEventListener: () => { motionChange = null } }
  const globals = {
    window: {}, document, matchMedia: () => motion,
    getComputedStyle: () => ({ getPropertyValue: () => '#112233' }),
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { constructor(callback) { resize = callback } observe() {} disconnect() { resizeDisconnected = true } },
    IntersectionObserver: observer ? class { constructor(callback) { intersect = callback } observe() {} disconnect() { intersectionDisconnected = true } } : undefined,
  }
  const previous = new Map(Object.keys(globals).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  const module = { exports: {} }
  const createHologramRenderer = () => {
    state.constructions++
    return state.available ? {
      draw: () => state.draws++, dispose: () => state.disposals++,
      hitTestOrb: () => state.orb, hitTestWorkplace: () => state.workplace,
      projectAgentAnchor: () => null, projectOfficeAnchor: () => null, projectExecutiveAnchor: () => null,
    } : null
  }
  new Function('require', 'module', 'exports', code)(name => name === '../utils/hologramScene'
    ? { createHologramRenderer } : name === '../utils/islandWaterConfig' ? { islandWaterDebug: () => null } : require(name), module, module.exports)
  const node = tag => ({ tag, children: [], style: {} })
  const remove = child => { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child) }
  const renderer = vue.createRenderer({
    createElement: node, createText: node, createComment: node, setText() {}, setElementText() {},
    patchProp: (element, key, _, value) => { element[key] = value }, parentNode: child => child.parent,
    nextSibling: child => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
    insert(child, parent, anchor) { remove(child); const at = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(at < 0 ? parent.children.length : at, 0, child); child.parent = parent }, remove,
  })
  const root = node('root'), exposed = vue.ref()
  const props = vue.reactive({ camera: { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 }, resetVersion: 0, label: 'Scene', unavailableLabel: 'Unavailable' })
  const app = renderer.createApp({ render: () => vue.h(module.exports.default, { ...props, ref: exposed, onActivate: () => state.activations++, onSelectWorkplace: id => state.selections.push(id) }) })
  app.mount(root)
  function find(tag, current = root) { return current.tag === tag ? current : current.children.flatMap(child => find(tag, child) ?? []).find(Boolean) }
  const canvas = find('canvas')
  let closed = false
  return {
    state, frames, props, motion, listeners,
    enter: value => intersect([{ isIntersecting: value }]), resize: () => resize(),
    visibility(hidden) { document.hidden = hidden; listeners.get('visibilitychange')?.() },
    motionChange(matches) { motion.matches = matches; motionChange?.() },
    tick() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(100) },
    activate: () => exposed.value.activateAt(10, 20),
    context(name) { const key = Object.keys(canvas).find(key => key.toLowerCase() === 'onwebglcontext' + name); let prevented = false; canvas[key]({ preventDefault() { prevented = true } }); return prevented },
    unmount() { if (!closed) { app.unmount(); closed = true } },
    cleanup() { this.unmount(); for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] } },
    disconnected: () => ({ intersection: intersectionDisconnected, resize: resizeDisconnected }),
  }
}

test('offscreen mount allocates no renderer; entering renders and preserves scene controls', async () => {
  const f = fixture()
  try {
    assert.equal(f.state.constructions, 0); assert.equal(f.activate(), false)
    f.enter(false); f.resize(); f.props.resetVersion++; await vue.nextTick()
    assert.equal(f.state.constructions, 0); assert.equal(f.frames.size, 0)
    f.enter(true); assert.equal(f.state.constructions, 1); f.tick(); assert.equal(f.state.draws, 1)
    assert.equal(f.activate(), true); assert.equal(f.state.activations, 1)
    f.state.orb = false; f.state.workplace = 'engineering'
    assert.equal(f.activate(), true); assert.deepEqual(f.state.selections, ['engineering'])
    f.enter(false); assert.equal(f.frames.size, 0); assert.equal(f.activate(), false)
    f.resize(); f.enter(true); f.tick()
    assert.equal(f.state.constructions, 1); assert.equal(f.state.draws, 2)
  } finally { f.cleanup() }
  assert.equal(f.state.disposals, 1); assert.deepEqual(f.disconnected(), { intersection: true, resize: true })
})

test('hidden startup and offscreen context restoration wait for actual visibility', () => {
  const f = fixture()
  try {
    f.visibility(true); f.enter(true); assert.equal(f.state.constructions, 0)
    f.visibility(false); assert.equal(f.state.constructions, 1)
    assert.equal(f.context('lost'), true); assert.equal(f.state.disposals, 1)
    f.visibility(false); assert.equal(f.state.constructions, 1)
    f.enter(false); f.context('restored'); assert.equal(f.state.constructions, 1)
    f.enter(true); assert.equal(f.state.constructions, 2)
    f.context('lost'); f.visibility(true); f.context('restored'); assert.equal(f.state.constructions, 2)
    f.visibility(false); assert.equal(f.state.constructions, 3)
    f.unmount(); f.enter(true); f.context('restored')
    assert.equal(f.state.constructions, 3); assert.equal(f.frames.size, 0)
    assert.equal(f.listeners.size, 0)
  } finally { f.cleanup() }
  assert.equal(f.state.disposals, 3)
})

test('observer fallback renders in view; reduced motion, pause and resume remain intact', () => {
  const f = fixture({ observer: false, reduced: true })
  try {
    assert.equal(f.state.constructions, 1); f.tick(); assert.equal(f.frames.size, 0)
    f.motionChange(false); assert.equal(f.frames.size, 1); f.tick(); assert.equal(f.frames.size, 1)
    f.visibility(true); assert.equal(f.frames.size, 0)
    f.visibility(false); assert.equal(f.frames.size, 1); assert.equal(f.state.constructions, 1)
  } finally { f.cleanup() }
})

test('unavailable WebGL is not repeatedly constructed on scrolling and can recover on restoration', () => {
  const f = fixture({ available: false })
  try {
    f.enter(true); assert.equal(f.state.constructions, 1); assert.equal(f.frames.size, 0)
    f.enter(false); f.enter(true); assert.equal(f.state.constructions, 1)
    f.state.available = true; f.context('restored'); assert.equal(f.state.constructions, 2)
    f.tick(); assert.equal(f.state.draws, 1)
  } finally { f.cleanup() }
})
