import test from 'node:test'
import assert from 'node:assert/strict'
import { ref,effectScope,nextTick } from 'vue'
import { useRecordAction } from '@building-suit/ux'
import { createDoctorAccountController,doctorAccountState } from '../../app/utils/accountController.ts'
const initial = { personalName: '',contactPhone: '',inAppConfirmations: false,version: 0,canChangeContact: true }
function fixture(repository) {
  const scope = effectScope();const form = ref({ personalName: '',contactPhone: '',inAppConfirmations: false });let action
  scope.run(() => { action = useRecordAction(() => form.value) })
  const state = doctorAccountState();const controller = createDoctorAccountController(repository,state,() => ({ userId: 'synthetic-user',sessionId: 'synthetic-sid',practiceId: null }),'local',() => 'stable-synthetic-key')
  const save = () => action.run(async () => { if(!await controller.update(form.value))throw new Error('unconfirmed') },() => 'The outcome is uncertain; retry unchanged values.')
  return { scope,form,action,state,controller,save }
}
test('C03 cross-layer uncertain save keeps the dirty editor open and confirms an identical retry only once',async () => {
  const receipts = new Map();let lost = true;const f = fixture({ load: async () => ({ ...initial }),update: async (value,version,key) => { if(!receipts.has(key))receipts.set(key,{ ...value,version: version+1,canChangeContact: true });if(lost) { lost = false;throw new Error('synthetic transport loss') }return receipts.get(key) } })
  try { await f.controller.load();f.action.edit();await nextTick();f.form.value = { ...f.form.value,personalName: 'Synthetic unsaved draft' };assert.equal(await f.save(),false);assert.equal(f.action.visible.value,true);assert.equal(f.action.dirty.value,true);assert.equal(f.action.pending.value,false);assert.equal(f.state.saved,false);assert.equal(f.state.settings.version,0);assert.equal(await f.save(),true);assert.equal(receipts.size,1);assert.equal(f.action.visible.value,false);assert.equal(f.state.settings.version,1) } finally { f.scope.stop() }
})
test('C03 pending repeated actions execute one product command and preserve operation state until its response',async () => {
  let resolve;let calls = 0;const f = fixture({ load: async () => ({ ...initial }),update: (value,version) => { calls++;return new Promise(done => { resolve = () => done({ ...value,version: version+1,canChangeContact: true }) }) } })
  try { await f.controller.load();f.action.edit();await nextTick();f.form.value.personalName = 'Synthetic pending';const first = f.save();assert.equal(f.action.pending.value,true);assert.equal(await f.save(),false);assert.equal(calls,1);assert.equal(f.action.visible.value,true);resolve();assert.equal(await first,true);assert.equal(f.action.pending.value,false) } finally { f.scope.stop() }
})
test('C03 account loss resets both interaction and product generations before a late save completes',async () => {
  let resolve;const f = fixture({ load: async () => ({ ...initial }),update: value => new Promise(done => { resolve = () => done({ ...value,version: 1,canChangeContact: true }) }) })
  try { await f.controller.load();f.action.edit();await nextTick();f.form.value.personalName = 'Synthetic old account';const first = f.save();f.controller.clear();f.action.reset();f.form.value = { personalName: '',contactPhone: '',inAppConfirmations: false };f.action.edit();await nextTick();resolve();assert.equal(await first,false);assert.equal(f.state.settings,null);assert.equal(f.action.visible.value,true);assert.equal(f.action.error.value,null);assert.equal(f.form.value.personalName,'') } finally { f.scope.stop() }
})
