import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { installDoctorEntryValidity } from '../helpers/entry-validity.mjs'
async function fixture(count = 2) {
  class Input {
    constructor(index) {
      this.type = index === 1 ? 'password' : 'text'
      this.value = 'SYNTHETIC_PRIVATE_VALUE_' + index
      this.id = 'SYNTHETIC_PRIVATE_ID_' + index
      this.validationMessage = 'SYNTHETIC_PRIVATE_MESSAGE_' + index
      this.labels = [{ textContent: index === 0 ? 'Practice name' : 'SYNTHETIC_PRIVATE_LABEL_' + index }]
      this.required = true;this.disabled = false;this.isConnected = true
      this.validity = { valid: index !== 0, valueMissing: index === 0 }
    }
  }
  const inputs = Array.from({ length: count }, (_, index) => new Input(index)),listeners = {},window = {}
  await installDoctorEntryValidity({ addInitScript: async fn => runInNewContext('('+fn.toString()+')()', {
    window,HTMLInputElement: Input,HTMLSelectElement: class {},HTMLTextAreaElement: class {},
    document: { addEventListener: (name, fn) => { listeners[name] = fn },querySelector: () => null,
      querySelectorAll: selector => selector.startsWith('form ') ? inputs : [{}] },
  }) })
  return { inputs,listeners,snapshot: () => JSON.parse(JSON.stringify(window.__doctorEntrySafeValidity())) }
}
test('entry diagnostics retain only fixed validity facts, never values, labels, IDs or messages', async () => {
  const f = await fixture();f.listeners.invalid({ target: f.inputs[0] })
  const result = f.snapshot(),serialized = JSON.stringify(result)
  assert.equal(serialized.includes('SYNTHETIC_PRIVATE'), false)
  assert.equal(serialized.includes('Practice name'), false)
  assert.equal(result.controls[0].field, 'practice_name');assert.equal(result.controls[1].field, 'password')
  assert.equal(result.controls[0].valid, false);assert.equal(result.lastInvalid[0].missing, true)
  assert.equal(result.controls[1].provided, true);assert.equal(result.stageCount, 1)
})
test('entry diagnostics bound control/event counts and ignore non-controls', async () => {
  const f = await fixture(40)
  for (const target of f.inputs) f.listeners.invalid({ target })
  f.listeners.invalid({ target: { value: 'SYNTHETIC_PRIVATE_VALUE',type: 'email' } })
  const result = f.snapshot();assert.equal(result.controls.length, 16);assert.equal(result.lastInvalid.length, 8)
  assert.equal(result.lastInvalid.every(item => item.field === 'other'), true)
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE'), false)
})
