import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick } from 'vue'
import { useFloatingMenu } from '../src/composables/useFloatingMenu.ts'

test('floating settings menu preserves positioning and reuses keyboard focus/dismissal behavior', async () => {
  const beforeDocument = globalThis.document
  const beforeWindow = globalThis.window
  const scope = effectScope()
  let restored = 0
  const items = [0, 1].map(id => ({ id, hasAttribute: () => false, focus() { globalThis.document.activeElement = this } }))
  globalThis.document = { activeElement: null }
  globalThis.window = { innerHeight: 800 }
  try {
    const menu = scope.run(() => useFloatingMenu('.panel'))
    menu.root.value = {
      querySelector: selector => selector === '.panel' ? { offsetHeight: 200 } : { focus() { restored++ } },
      getBoundingClientRect: () => ({ top: 600, bottom: 650 }),
    }
    menu.panel.value = { querySelector: () => items[0], querySelectorAll: () => items }
    await menu.openMenu()
    assert.equal(menu.open.value, true)
    assert.equal(globalThis.document.activeElement.id, 0)
    assert.equal(menu.position.value, 'top')
    menu.onKeydown({ key: 'ArrowDown', preventDefault() {} })
    assert.equal(globalThis.document.activeElement.id, 1)
    menu.onKeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} })
    await nextTick()
    assert.equal(menu.open.value, false)
    assert.equal(restored, 1)
    await menu.openMenu()
    menu.closeMenu(true)
    await nextTick()
    assert.equal(restored, 2, 'language selection can close and restore the trigger')
    await menu.openMenu()
    menu.onKeydown({ key: 'Tab' })
    await nextTick()
    assert.equal(menu.open.value, false)
    assert.equal(restored, 2, 'Tab closure does not steal the next control focus')
  } finally {
    scope.stop()
    globalThis.document = beforeDocument
    globalThis.window = beforeWindow
  }
})
