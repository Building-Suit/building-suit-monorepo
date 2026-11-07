import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'
import { useRecordAction } from '@building-suit/ux'
import { doctorAppointmentsState } from '../../app/utils/appointmentsController.ts'

const source = new URL('../../app/composables/useDoctorAppointmentsPage.ts', import.meta.url)
const require = createRequire(source)
const code = ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture({ holdOffers = false } = {}) {
  const scope = effectScope(), mounted = [], unmounted = [], clearers = [], consultationReads = [], patientRead = deferred(), offerRead = deferred()
  const state = reactive(doctorAppointmentsState()), key = ref('scope-a')
  state.board = { canWrite: true, canQueue: true, canReadPatients: true, items: [], queue: [] }
  let patients = 0, offers = 0
  const appointments = {
    state, scopeKey: () => key.value, discard() {}, clear() {}, load: async () => true,
    async patients() { patients++; state.patientsLoading = true; await patientRead.promise; state.patientsLoading = false },
    async offers() { offers++; if(holdOffers) { state.offersLoading = true; await offerRead.promise; state.offersLoading = false } },
  }
  const context = { state: reactive({ current: { edition: 'synthetic_preview' }, options: [] }), refresh: async () => true, registerClear(callback) { clearers.push(callback); return () => {} } }
  const nuxt = { $doctorAppointments: appointments, $doctorAppointmentsScope: () => ({ practiceId: 'practice-a', locationId: 'clinic-a', timezone: 'Etc/UTC' }), $doctorAppointmentsLive: { connected: true, update: async () => {} }, $doctorConsultations: { state: { types: [] }, load() { const read = deferred(); consultationReads.push(read); return read.promise } } }
  const globals = { computed, ref, watch, onMounted: callback => mounted.push(callback), onBeforeUnmount: callback => unmounted.push(callback), useNuxtApp: () => nuxt, useDoctorContext: () => context, useI18n: () => ({ locale: ref('en') }), useRoute: () => ({ query: {} }) }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => name === '@building-suit/ux' ? { useRecordAction, usePageRevalidation() {} } : require(name.startsWith('.') ? name + '.ts' : name), module, module.exports, ...Object.values(globals))
  const flow = scope.run(() => module.exports.useDoctorAppointmentsPage())
  return { flow, key, state, consultationReads, patientRead, offerRead, calls: () => ({ patients, offers }), mount: () => mounted[0](), invalidate: () => clearers.forEach(callback => callback()), async close() { unmounted.forEach(callback => callback()); await nextTick(); scope.stop() } }
}

test('appointment picker remains loading throughout initial consultation and patient preparation', async () => {
  const f = fixture()
  try {
    await f.mount()
    const opening = f.flow.open()
    assert.equal(f.flow.editorOpen.value, true)
    assert.deepEqual(f.calls(), { patients: 0, offers: 0 })
    assert.equal(f.flow.editorView.value.patientLoading, true, 'An open picker cannot appear ready before its initial lookup has even started')
    assert.equal(f.flow.editorView.value.offersLoading, true)
    assert.equal(f.flow.editorView.value.pending, false, 'Read preparation remains cancellable, unlike a submitted write')
    assert.equal(f.flow.editorView.value.disabled, true)
    f.consultationReads[0].resolve(); await nextTick()
    assert.equal(f.flow.editorView.value.patientLoading, true)
    f.patientRead.resolve(); await opening
    assert.equal(f.flow.editorView.value.patientLoading, false)
    assert.equal(f.flow.editorView.value.offersLoading, false)
  } finally { f.patientRead.resolve(); f.consultationReads.forEach(read => read.resolve()); await f.close() }
})

test('closing and reopening preparation rejects the old read without releasing the new loading state', async () => {
  const f = fixture()
  try {
    await f.mount(); const oldOpening = f.flow.open()
    f.flow.editorOpen.value = false
    const newOpening = f.flow.open()
    f.consultationReads[0].resolve(); await oldOpening
    assert.deepEqual(f.calls(), { patients: 0, offers: 0 })
    assert.equal(f.flow.editorView.value.patientLoading, true)
    f.consultationReads[1].resolve(); f.patientRead.resolve(); await newOpening
    assert.deepEqual(f.calls(), { patients: 1, offers: 1 })
    assert.equal(f.flow.editorOpen.value, true)
    assert.equal(f.flow.editorView.value.patientLoading, false)
  } finally { f.patientRead.resolve(); f.consultationReads.forEach(read => read.resolve()); await f.close() }
})

test('context invalidation during preparation cannot start patient or slot reads in a later scope', async () => {
  const f = fixture()
  try {
    await f.mount(); const opening = f.flow.open()
    f.invalidate(); f.key.value = 'scope-b'
    f.consultationReads[0].resolve(); await opening
    assert.deepEqual(f.calls(), { patients: 0, offers: 0 })
    assert.equal(f.flow.editorOpen.value, false)
    assert.equal(f.flow.editorView.value.patientLoading, false)
  } finally { f.patientRead.resolve(); f.consultationReads.forEach(read => read.resolve()); await f.close() }
})

for (const first of ['patients', 'offers']) test(`initial ${first} lookup enables its picker independently of the other lookup`, async () => {
  const f = fixture({ holdOffers: true })
  try {
    await f.mount()
    const opening = f.flow.open()
    f.consultationReads[0].resolve(); await nextTick()
    assert.equal(f.flow.editorView.value.patientLoading, true)
    assert.equal(f.flow.editorView.value.offersLoading, true)
    const ready = first === 'patients' ? 'patientLoading' : 'offersLoading'
    const waiting = first === 'patients' ? 'offersLoading' : 'patientLoading'
    ;(first === 'patients' ? f.patientRead : f.offerRead).resolve(); await nextTick()
    assert.equal(f.flow.editorView.value[ready], false, 'The completed lookup must enable its own picker while the other request is still pending')
    assert.equal(f.flow.editorView.value[waiting], true)
    assert.equal(f.flow.editorView.value.disabled, true, 'Independent picker readiness does not permit an incomplete booking')
    f.patientRead.resolve(); f.offerRead.resolve(); await opening
  } finally { f.patientRead.resolve(); f.offerRead.resolve(); f.consultationReads.forEach(read => read.resolve()); await f.close() }
})
