import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'
import { useCodeEntry } from '../src/composables/useCodeEntry.ts'

test('numeric code paste normalizes input, respects length, completes and focuses the final digit', () => {
  const scope = effectScope(), value = ref(''), completed = []
  let focused = -1, prevented = false
  const control = scope.run(() => useCodeEntry(() => value.value, () => 4, next => { value.value = next }, next => completed.push(next)))
  control.inputs.value = [0, 1, 2, 3].map(index => ({ focus() { focused = index } }))
  control.onPaste({ clipboardData: { getData: () => '1a2-3456' }, preventDefault() { prevented = true } })
  assert.equal(value.value, '1234')
  assert.deepEqual(completed, ['1234'])
  assert.equal(focused, 3)
  assert.equal(prevented, true)
  control.onPaste({ clipboardData: { getData: () => 'letters' }, preventDefault() { assert.fail('Empty code must not cancel native paste') } })
  assert.equal(value.value, '1234')
  scope.stop()
})

test('numeric digit entry advances and fixed-direction arrows/backspace respect the field edges', () => {
  const scope = effectScope(), value = ref(''), completed = []
  let focused = -1
  const control = scope.run(() => useCodeEntry(() => value.value, () => 4, next => { value.value = next }, next => completed.push(next)))
  control.inputs.value = [0, 1, 2, 3].map(index => ({ focus() { focused = index } }))
  const input = { value: 'a7' }
  control.updateDigit(0, { target: input })
  assert.equal(value.value, '7'); assert.equal(input.value, '7'); assert.equal(focused, 1)
  assert.deepEqual(completed, [])
  control.onKeydown(1, { key: 'Backspace' }); assert.equal(focused, 0)
  control.onKeydown(0, { key: 'ArrowRight' }); assert.equal(focused, 1)
  control.onKeydown(1, { key: 'ArrowLeft' }); assert.equal(focused, 0)
  control.onKeydown(0, { key: 'ArrowLeft' }); assert.equal(focused, 0)
  scope.stop()
})
