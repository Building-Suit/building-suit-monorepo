import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { useDebouncedTask } from '../src/composables/useDebouncedTask.ts'
import { runPrimaryEnter, exclusiveChoiceOptions } from '../src/utils/browserActions.ts'
test('search keeps only the newest edit and disposal cancels the pending query', async () => {
  const committed = []
  const scope = effectScope()
  const interaction = scope.run(() => useDebouncedTask(value => committed.push(value), 5))
  interaction.schedule('older')
  interaction.schedule('newest')
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.deepEqual(committed, ['newest'])
  interaction.schedule('disposed')
  scope.stop()
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.deepEqual(committed, ['newest'])
})
test('CSV shortcut requires the primary modifier; mapping preserves its own selected column', () => {
  let submitted = 0
  assert.equal(runPrimaryEnter({ key: 'Enter', ctrlKey: false, metaKey: false }, () => submitted++), false)
  assert.equal(runPrimaryEnter({ key: 'Enter', ctrlKey: true, metaKey: false }, () => submitted++), true)
  assert.equal(runPrimaryEnter({ key: 'Enter', ctrlKey: false, metaKey: true }, () => submitted++), true)
  assert.equal(submitted, 2)
  const options = [{ value: 'amount', label: 'Amount' }, { value: 'date', label: 'Date' }]
  assert.deepEqual(exclusiveChoiceOptions(options, ['amount', 'date'], 'amount').map(option => option.disabled), [false, true])
  assert.equal('disabled' in options[0], false)
})
