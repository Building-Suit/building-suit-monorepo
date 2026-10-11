import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
function controller(file, globals) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('exports', ...Object.keys(globals), code)(module.exports, ...Object.values(globals))
  return module.exports
}
test('workspace route dismissal does not steal focus; explicit closing restores its trigger', async () => {
  let routeChanged
  let focused = 0
  const route = { path: '/tasks/T-1', fullPath: '/tasks/T-1?tab=checks' }
  const exports = controller('../src/composables/useWorkspaceNavigation.ts', { useRoute: () => route, ref: value => ({ value }), useTheme: () => {}, nextTick: async () => {}, watch: (_getter, callback) => { routeChanged = callback } })
  const navigation = exports.useWorkspaceNavigation()
  assert.equal(navigation.isActive('/tasks'), true)
  assert.equal(navigation.isActive('/task'), false)
  navigation.topHeader.value = { focusNavigationTrigger: () => { focused++ } }
  navigation.mobileNavOpen.value = true
  routeChanged()
  await Promise.resolve()
  assert.equal(navigation.mobileNavOpen.value, false)
  assert.equal(focused, 0)
  navigation.mobileNavOpen.value = true
  await navigation.closeMobileNav()
  assert.equal(navigation.mobileNavOpen.value, false)
  assert.equal(focused, 1)
})
test('polling begins on mount and clears its own interval on unmount', () => {
  let mount, unmount, tick, cleared
  let refreshes = 0
  const exports = controller('../src/composables/usePolling.ts', { onMounted: callback => { mount = callback }, onBeforeUnmount: callback => { unmount = callback }, setInterval: (callback, milliseconds) => { assert.equal(milliseconds, 15000); tick = callback; return 42 }, clearInterval: id => { cleared = id } })
  exports.usePolling(() => { refreshes++ }, () => 15000)
  assert.equal(tick, undefined)
  mount()
  tick()
  assert.equal(refreshes, 1)
  unmount()
  assert.equal(cleared, 42)
})
