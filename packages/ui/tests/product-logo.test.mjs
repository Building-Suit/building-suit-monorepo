import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import ts from 'typescript'
import { productLogoImages } from '../../brand/src/productAssets.ts'
const require = createRequire(import.meta.url)
function fixture() {
  const file = new URL('../src/atoms/BsProductLogo.vue', import.meta.url), { descriptor } = parse(readFileSync(file, 'utf8'))
  const script = compileScript(descriptor, { id: 'product-logo', inlineTemplate: true })
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, module = { exports: {} }
  new Function('require','module','exports','ref','computed','watch',code)(name => name === '@building-suit/brand' ? { productLogoImages } : require(name),module,module.exports,vue.ref,vue.computed,vue.watch)
  const root = { children: [] }, props = vue.reactive({ name: 'Doctor Suit', assetPrefix: '/brand/doctor-suit', kind: 'wordmark', tone: 'auto', size: 'navigation' })
  const renderer = vue.createRenderer({ createElement: tag => ({ tag, children: [] }), createText: text => ({ text }), createComment: text => ({ text }), setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text }, parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node)+1] || null, patchProp: (node,key,previous,value) => { node[key] = value },
    insert(node,parent,anchor) { if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node); const at = anchor ? parent.children.indexOf(anchor) : -1; if (at < 0) parent.children.push(node); else parent.children.splice(at,0,node); node.parent = parent }, remove(node) { if (node.parent) node.parent.children = node.parent.children.filter(child => child !== node) },
  })
  const app = renderer.createApp({ render: () => vue.h(module.exports.default, props) }); app.mount(root)
  function find(tag) { const found = []; function visit(node) { if (node.tag === tag) found.push(node); node.children?.forEach(visit) }; visit(root); return found }
  return { props, root, find, close: () => app.unmount() }
}
test('logo errors use the available tone and then the existing accessible monogram', async () => {
  const f = fixture()
  try {
    assert.equal(f.find('img').length,2); assert.equal(f.root.children[0].role,'img'); assert.equal(f.root.children[0]['aria-label'],'Doctor Suit by Building Suit')
    assert.ok(f.find('img').every(node => node.alt === '' && node.width === 1600 && node.height === 420))
    f.find('img').find(node => node.src.endsWith('-dark.svg')).onError(); await vue.nextTick()
    assert.ok(f.find('img').every(node => node.src === '/brand/doctor-suit-wordmark-light.svg'))
    f.find('img')[0].onError(); await vue.nextTick(); assert.equal(f.find('img').length,0)
    assert.ok(f.find('span').some(node => node.text === 'D'))
  } finally { f.close() }
})
test('late failed images cannot poison a changed product or collapsed mark', async () => {
  const f = fixture()
  try {
    const late = f.find('img')[0].onError; f.props.assetPrefix = '/brand/shop-suit'; f.props.kind = 'mark'; await vue.nextTick()
    late(); await vue.nextTick(); assert.equal(f.find('img').length,2)
    assert.ok(f.find('img').every(node => node.src.startsWith('/brand/shop-suit-mark-') && node.width === 1024 && node.height === 1024))
    f.props.assetPrefix = ''; await vue.nextTick(); assert.equal(f.find('img').length,0)
    assert.ok(f.find('span').some(node => node.text === 'D'))
  } finally { f.close() }
})
