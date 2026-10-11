import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick, ref } from 'vue'
import { useCheckboxSelection } from '../src/composables/useCheckboxSelection.ts'
import { useFileSelection } from '../src/composables/useFileSelection.ts'
import { useTagSelection } from '../src/composables/useTagSelection.ts'
import { useDebouncedChange } from '../src/composables/useDebouncedChange.ts'

test('checkbox choices preserve immutable selections and native indeterminate state', async () => {
  const scope = effectScope(), model = ref(['a']), choice = ref('b'), mixed = ref(true)
  const calls = []
  const control = scope.run(() => useCheckboxSelection({ model: () => model.value, checked: () => undefined, choice: () => choice.value, indeterminate: () => mixed.value }, (...args) => calls.push(args)))
  const event = { target: { checked: true } }
  control.update(event)
  assert.deepEqual(model.value, ['a'])
  assert.deepEqual(calls[0], [['a', 'b'], true, event])
  choice.value = 'a'
  assert.equal(control.checked.value, true)
  control.update({ target: { checked: false } })
  assert.deepEqual(calls[1][0], [])
  control.input.value = { indeterminate: false }
  await nextTick()
  assert.equal(control.input.value.indeterminate, true)
  scope.stop()
})

test('file selections preserve single/multiple events and reset native controls', async () => {
  const scope = effectScope(), model = ref(null), multiple = ref(false), calls = []
  const control = scope.run(() => useFileSelection(() => model.value, () => multiple.value, (...args) => calls.push(args)))
  const files = [{ name: 'a.csv' }, { name: 'b.csv' }], event = { target: { files } }
  control.update(event)
  assert.deepEqual(calls[0], [files[0], event])
  multiple.value = true
  control.update(event)
  assert.deepEqual(calls[1], [files, event])
  model.value = files
  await nextTick()
  assert.equal(control.selectedFiles.value.length, 2)
  control.input.value = { value: 'prior.csv' }
  model.value = null
  await nextTick()
  assert.equal(control.input.value.value, '')
  scope.stop()
})

test('tag options exclude assigned records and clear invalid selections', async () => {
  const scope = effectScope(), tags = ref([{ id: 'a' }]), options = ref([{ id: 'a' }, { id: 'b' }])
  const control = scope.run(() => useTagSelection(() => tags.value, () => options.value))
  assert.deepEqual(control.available.value, [{ id: 'b' }])
  control.selected.value = 'b'
  tags.value.push({ id: 'b' })
  await nextTick()
  assert.equal(control.selected.value, null)
  scope.stop()
})

test('debounced changes coalesce and cancellation/disposal prevent stale commits', async () => {
  const scope = effectScope(), source = ref(''), calls = []
  const control = scope.run(() => useDebouncedChange(source, value => calls.push(value), 10))
  source.value = 'first'
  await nextTick()
  source.value = 'last'
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.deepEqual(calls, ['last'])
  source.value = 'cancelled'
  await nextTick()
  control.cancel()
  await new Promise(resolve => setTimeout(resolve, 25))
  source.value = 'disposed'
  await nextTick()
  scope.stop()
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.deepEqual(calls, ['last'])
})
