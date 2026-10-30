import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

// Resolve the actual Nuxt → Nitro → Rollup Terser worker consumer.
const rootRequire = createRequire(new URL('../../package.json', import.meta.url))
const nuxtRequire = createRequire(rootRequire.resolve('nuxt/package.json'))
const integrationRequire = createRequire(nuxtRequire.resolve('@nuxt/nitro-server'))
const nitroRequire = createRequire(integrationRequire.resolve('nitropack/package.json'))
const pluginFile = nitroRequire.resolve('@rollup/plugin-terser')
const pluginRequire = createRequire(pluginFile)
const serialize = pluginRequire('serialize-javascript')
const { default: terser } = await import(pathToFileURL(pluginFile).href)

test('Nitro serializer neutralizes a function closing-script prefix across output boundaries', () => {
  function first() {}
  function second() {}
  first.toString = () => 'function first(){ return 1 }//</script'
  second.toString = () => 'function second(value){ return value } > <span id="synthetic-marker">synthetic</span>'
  const source = serialize({ nested: { first }, second }, { space: 2 })
  assert.doesNotMatch(source, /<\/script(?=[\t\n\f\r />])/i)
  // Strings and mixed-case function prefixes must retain the same protection.
  for (const suffix of ['</ScRiPt', '</script>', '</script\n']) {
    first.toString = () => 'function first(){ return 1 }//' + suffix
    assert.doesNotMatch(serialize({ first }, { space: 2 }), /<\/script(?=[\t\n\f\r />])/i)
  }
  assert.doesNotMatch(serialize({ text: '</script><span>synthetic</span>' }), /<\/script/i)
})

test('patched serializer preserves ordinary values and actual Terser worker function options', async () => {
  const source = serialize({ increment: value => value + 1, date: new Date('2026-10-25T00:00:00Z'), expression: /ledger/i })
  const roundTrip = vm.runInNewContext('(' + source + ')')
  assert.equal(roundTrip.increment(41), 42)
  assert.equal(roundTrip.date.toISOString(), '2026-10-25T00:00:00.000Z')
  assert.equal(roundTrip.expression.test('LEDGER'), true)
  const plugin = terser({ maxWorkers: 1, format: { comments: (_node, comment) => comment.value.includes('keep') } })
  const result = await plugin.renderChunk('/* keep synthetic */ function total(a, b) { return a + b } globalThis.syntheticTotal = total(20, 22);', {}, { format: 'cjs', sourcemap: true })
  assert.match(result.code, /keep synthetic/)
  const sandbox = {}
  vm.runInNewContext(result.code, sandbox)
  assert.equal(sandbox.syntheticTotal, 42)
  assert.equal(result.map.version, 3)
})
