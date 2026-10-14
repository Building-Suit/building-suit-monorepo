import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const transpile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const policy = { exports: {} }
new Function('exports', transpile('../src/tabNavigation.ts'))(policy.exports)
const controller = { exports: {} }
new Function('exports', 'require', transpile('../src/composables/useTabNavigation.ts'))(controller.exports, () => policy.exports)
test('roving focus skips disabled tabs, follows RTL and retains a focusable fallback', () => {
  const tabs = [{ key: 'members' }, { key: 'disabled', disabled: true }, { key: 'roles' }]
  let selected = 'missing'
  let focused = -1
  let prevented = false
  const navigation = controller.exports.useTabNavigation(() => tabs, () => selected, key => { selected = key })
  assert.equal(navigation.tabindex('members'), 0)
  assert.equal(navigation.tabindex('disabled'), -1)
  globalThis.getComputedStyle = () => ({ direction: 'rtl' })
  try {
    const event = { key: 'ArrowLeft', preventDefault: () => { prevented = true }, currentTarget: { closest: () => ({ querySelectorAll: () => tabs.map((_tab, index) => ({ focus: () => { focused = index } })) }) } }
    navigation.onKeydown(event, 'members')
    assert.equal(selected, 'roles')
    assert.equal(focused, 2)
    assert.equal(prevented, true)
    assert.equal(navigation.tabindex('roles'), 0)
  } finally { delete globalThis.getComputedStyle }
})
