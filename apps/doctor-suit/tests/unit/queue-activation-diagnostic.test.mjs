import test from 'node:test'
import assert from 'node:assert/strict'
import { observeQueueActivation } from '../helpers/queue-activation-diagnostic.ts'

test('queue activation diagnostic distinguishes input, disabling and dialog removal without reading content', () => {
  const previous = globalThis.MutationObserver, observers = []
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  class Button extends EventTarget {
    disabled = false; isConnected = true
    ownerDocument = { documentElement: {}, querySelectorAll: () => Array(dialogs).fill({}) }
    hasAttribute(name) { assert.equal(name, 'disabled'); return this.disabled }
    get textContent() { throw new Error('Content must never be read') }
    get value() { throw new Error('Values must never be read') }
  }
  let dialogs = 0
  try {
    const button = new Button(), observation = observeQueueActivation(button)
    button.dispatchEvent(new Event('pointerdown'))
    button.disabled = true; observers[0].callback()
    button.dispatchEvent(new Event('pointerup'))
    assert.equal(observation.read().counts.click, 0)
    button.disabled = false; observers[0].callback()
    button.dispatchEvent(new Event('click'))
    dialogs = 1; observers[1].callback(); dialogs = 0; observers[1].callback()
    const result = observation.read()
    assert.deepEqual(result.counts, { pointerdown: 1, pointerup: 1, click: 1, focus: 0, blur: 0, disabledChanges: 2, dialogChanges: 2 })
    assert.deepEqual(result.events.map(item => item.event), ['armed','pointerdown','disabled','pointerup','disabled','click','dialogs','dialogs'])
    assert.deepEqual(Object.keys(result.events[0]).sort(), ['connected','dialogs','disabled','event'])
    for (let n = 0; n < 150; n++) button.dispatchEvent(new Event('click'))
    assert.equal(observation.read().counts.click, 100); assert.equal(observation.read().events.length, 12)
    const last = observation.read(); last.counts.click = -1; last.events[0].event = 'mutated'
    assert.equal(observation.read().counts.click, 100); assert.equal(observation.read().events[0].event, 'click')
    observation.dispose(); const disposed = observation.read()
    button.dispatchEvent(new Event('click')); observers.forEach(observer => observer.callback())
    assert.deepEqual(observation.read(), disposed)
    assert.ok(observers.every(observer => observer.disconnected))
  } finally { globalThis.MutationObserver = previous }
})
