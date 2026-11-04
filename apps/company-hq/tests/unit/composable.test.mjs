import test from 'node:test'
import assert from 'node:assert/strict'
import { computed, effectScope, nextTick, onScopeDispose, ref, watch } from 'vue'
import { load } from '../../scripts/load-test-module.mjs'

const { useCompanyHq } = await load('../app/composables/useCompanyHq.ts')
const signedIn = () => ({
  configured: true, authenticated: true,
  state: {
    agents: [], tasks: [], events: [], brain: { notes: [] },
    messages: [{ id: 'private-message', role: 'founder', text: 'Synthetic private conversation', createdAt: '2026-11-03T12:00:00Z', status: 'queued' }],
  },
})
const signedOut = () => ({ configured: true, authenticated: false, state: null })
const deferred = () => {
  let resolve
  const promise = new Promise(accept => { resolve = accept })
  return { promise, resolve }
}

function fixture(t, options) {
  let fetch = async () => signedIn()
  let confirmation = async () => true
  const globals = {
    ref, computed, watch, onScopeDispose,
    // Tests invoke load explicitly; no real mounted polling timer is started.
    onMounted: () => {},
    useI18n: () => ({ t: key => key, tm: () => ({}), locale: ref('en'), setLocale: async () => {} }),
    useConfirmation: () => ({ ask: (...args) => confirmation(...args) }),
    // Deliberately ignore AbortSignal so an uncooperative/settled transport cannot bypass the stale-response guard.
    $fetch: (...args) => fetch(...args),
  }
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  const scope = effectScope()
  const hq = scope.run(() => useCompanyHq(options))
  t.after(() => {
    scope.stop()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return { hq, scope, transport: value => { fetch = value }, confirm: value => { confirmation = value } }
}

test('a transient background failure preserves drafts and signed-in records, blocks writes, and a verified sign-out clears them', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const draft = { title: 'Unsaved plan', brief: 'Synthetic outcome', acceptance: 'Review evidence', allowedActions: 'Read only' }
  hq.messageDraft.value = 'Unsaved founder message'
  hq.taskDraft.value = { ...draft }
  hq.conversationOpen.value = true
  hq.taskOpen.value = true
  const requests = []
  transport(async url => { requests.push(url); throw new Error('Synthetic network failure') })
  await hq.load(true)
  await nextTick()
  assert.equal(hq.authenticated.value, true)
  assert.equal(hq.messages.value[0].text, 'Synthetic private conversation')
  assert.equal(hq.messageDraft.value, 'Unsaved founder message')
  assert.deepEqual(hq.taskDraft.value, draft)
  assert.equal(hq.conversationOpen.value, true)
  assert.equal(hq.taskOpen.value, true)
  assert.equal(hq.error.value, 'hq.error')
  assert.equal(hq.readOnly.value, true)
  await hq.sendMessage('Must not be submitted while disconnected')
  assert.deepEqual(requests, ['/api/hq/state'])

  transport(async () => signedOut())
  await hq.load(true)
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
  assert.equal(hq.messageDraft.value, '')
  assert.deepEqual(hq.taskDraft.value, { title: '', brief: '', acceptance: '', allowedActions: '' })
  assert.equal(hq.conversationOpen.value, false)
  assert.equal(hq.taskOpen.value, false)
})

test('an authenticated response started before logout cannot restore private records after logout succeeds', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const oldResponse = deferred()
  let stateReads = 0
  transport(async url => {
    if (url === '/api/hq/auth/logout') return { ok: true }
    assert.equal(url, '/api/hq/state')
    return ++stateReads === 1 ? oldResponse.promise : signedOut()
  })
  const olderLoad = hq.load(true)
  await hq.signOut()
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])

  oldResponse.resolve(signedIn())
  await olderLoad
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
  assert.equal(hq.readOnly.value, true)
})

test('a newer session-denial response wins over an older authenticated refresh', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const oldResponse = deferred()
  let reads = 0
  transport(async () => ++reads === 1 ? oldResponse.promise : signedOut())
  const olderLoad = hq.load(true)
  await hq.load(true)
  oldResponse.resolve(signedIn())
  await olderLoad
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
})

test('disposing the composable invalidates a pending authenticated response', async t => {
  const { hq, scope, transport } = fixture(t)
  transport(async () => signedOut())
  await hq.load()
  const response = deferred()
  transport(async () => response.promise)
  const pendingLoad = hq.load(true)
  scope.stop()
  response.resolve(signedIn())
  await pendingLoad
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
})


test('ambiguous command keeps its idempotency key across an unrelated successful action', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const commands=[];let first=true
  transport(async(url, options) => {
    if(url === '/api/hq/state') return signedIn()
    commands.push(options.body)
    if(first){first=false;throw Error('Synthetic response lost after save')}
    return {ok:true}
  })
  await hq.sendMessage('Retry this exact message')
  await hq.createTask({title:'Different action',brief:'Read only',acceptance:'Evidence',allowedActions:'No spending'})
  await hq.sendMessage('Retry this exact message')
  assert.equal(commands.length,3)
  assert.equal(commands[0].idempotencyKey,commands[2].idempotencyKey)
  assert.notEqual(commands[0].idempotencyKey,commands[1].idempotencyKey)
})

test('unrelated chat success preserves a milestone draft; matching milestone success clears it', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const draft={title:'Unsaved milestone',acceptance:'Independent evidence'}
  hq.milestoneDraft.value={...draft}
  transport(async url => url === '/api/hq/state' ? signedIn() : {ok:true})
  await hq.sendMessage('Unrelated conversation')
  assert.deepEqual(hq.milestoneDraft.value,draft)
  await hq.addMilestone({id:'task_synthetic',...draft})
  assert.deepEqual(hq.milestoneDraft.value,{title:'',acceptance:''})
})

test('planning from a saved founder message keeps private conversation out of the shared brief and never approves work', async t => {
  const {hq,transport}=fixture(t);const commands=[]
  transport(async(url,options)=>{if(url==='/api/hq/state')return signedIn();commands.push(options.body);return {ok:true}})
  await hq.load();await hq.planMessage('private-message')
  assert.equal(hq.taskOpen.value,true);assert.equal(hq.taskDraft.value.sourceMessageId,'private-message')
  assert.equal(hq.taskDraft.value.brief,'');assert.equal(hq.sourceMessageText.value,'Synthetic private conversation')
  assert.deepEqual(commands,[])
  await hq.createTask({...hq.taskDraft.value,brief:'Explicitly shared request',acceptance:'Independent review',allowedActions:'Read approved files'})
  assert.equal(commands.length,1);assert.equal(commands[0].action,'create_task');assert.equal(commands[0].sourceMessageId,'private-message')
  assert.ok(!JSON.stringify(commands).includes('Synthetic private conversation'))
})

test('exact Brain selection normalizes links, keeps failed scope and retries its same idempotency key without enabling work', async t => {
  const {hq,transport}=fixture(t);const response=signedIn()
  response.state.tasks=[{id:'task_linked',title:'Linked',owner:'ceo',status:'queued',brief:'Shared',acceptance:'Review',allowedActions:'Read only',approvedAt:'2026-11-04',updatedAt:'2026-11-04',sourceMessage:{id:'private-message',text:'Synthetic private conversation',digest:'synthetic'}}]
  const commands=[];let fail=true
  transport(async(url,options)=>{if(url==='/api/hq/state')return response;commands.push(options.body);if(fail){fail=false;throw Error('Synthetic lost response')};return {ok:true}})
  await hq.load();await hq.prepareWorkflow('task_linked')
  const files=Object.fromEntries(hq.workflowFields.value.map((field,i)=>[field.key,i%2?`https://docs.google.com/document/d/source_${i}/edit`:`https://drive.google.com/file/d/source_${i}/view`]))
  hq.workflowDraft.value.brainFiles={...files}
  await hq.authorizeWorkflow(hq.workflowDraft.value)
  assert.equal(hq.workflowOpen.value,true);assert.deepEqual(hq.workflowDraft.value.brainFiles,files)
  await hq.authorizeWorkflow(hq.workflowDraft.value)
  assert.equal(commands.length,2);assert.equal(commands[0].idempotencyKey,commands[1].idempotencyKey)
  assert.deepEqual(commands[0].allowedTools,[]);assert.deepEqual(commands[0].publicInputs,[])
  assert.equal(commands[0].daily,false);assert.equal(commands[0].timezoneConfirmed,false)
  assert.deepEqual(Object.values(commands[0].brainFiles),Array.from({length:16},(_,i)=>'source_'+i))
  assert.equal(hq.workflowOpen.value,false);assert.deepEqual(hq.workflowDraft.value,{id:'',brainFiles:{}})
})

test('duplicate and foreign Brain links are rejected locally; session loss clears private workflow selection', async t => {
  const {hq,transport}=fixture(t);const response=signedIn()
  response.state.tasks=[{id:'task_linked',title:'Linked',owner:'ceo',status:'queued',approvedAt:'2026-11-04',updatedAt:'2026-11-04',sourceMessage:{id:'private-message',text:'Synthetic private conversation',digest:'synthetic'}}]
  const commands=[];transport(async(url,options)=>{if(url==='/api/hq/state')return response;commands.push(options.body);return {ok:true}})
  await hq.load();await hq.prepareWorkflow('task_linked')
  const files=Object.fromEntries(hq.workflowFields.value.map(field=>[field.key,'same_file']))
  hq.workflowDraft.value.brainFiles=files;await hq.authorizeWorkflow(hq.workflowDraft.value)
  assert.deepEqual(commands,[]);assert.match(hq.taskError.value,/16 distinct/)
  hq.workflowDraft.value.brainFiles=Object.fromEntries(hq.workflowFields.value.map((field,i)=>[field.key,'https://untrusted.example/file/d/source_'+i]))
  await hq.authorizeWorkflow(hq.workflowDraft.value);assert.deepEqual(commands,[])
  transport(async()=>signedOut());await hq.load();await nextTick()
  assert.equal(hq.workflowOpen.value,false);assert.deepEqual(hq.workflowDraft.value,{id:'',brainFiles:{}})
})

test('a pending cancellation confirmation cannot mutate or refetch after HQ is disposed', async t => {
  const {hq,scope,transport,confirm}=fixture(t);await hq.load()
  const approval=deferred(),requests=[];confirm(()=>approval.promise)
  transport(async(url)=>{requests.push(url);return signedIn()})
  const pending=hq.cancelTask('task_stale');scope.stop();approval.resolve(true);await pending
  await hq.load();await hq.sendMessage('Disposed intent')
  assert.deepEqual(requests,[])
})

test('a confirmation from a prior authenticated session cannot recreate a private task draft after login changes', async t => {
  const {hq,transport,confirm}=fixture(t);await hq.load()
  hq.taskDraft.value={title:'Earlier draft',brief:'Private draft',acceptance:'Review',allowedActions:'Read'}
  const approval=deferred();confirm(()=>approval.promise)
  const pending=hq.planMessage('private-message')
  transport(async()=>signedOut());await hq.load();await nextTick()
  transport(async()=>signedIn());await hq.load();approval.resolve(true);await pending
  assert.deepEqual(hq.taskDraft.value,{title:'',brief:'',acceptance:'',allowedActions:''})
  assert.equal(hq.taskOpen.value,false)
})

test('authenticated readback reconciles an exact committed scope after its POST response is lost, without resending', async t => {
  const {hq,transport}=fixture(t);const response=signedIn()
  const task={id:'task_linked',title:'Linked',owner:'ceo',status:'queued',approvedAt:'2026-11-04',updatedAt:'2026-11-04',sourceMessage:{id:'private-message',text:'Synthetic private conversation',digest:'synthetic'}}
  response.state.tasks=[task];const commands=[]
  transport(async(url,options)=>{
    if(url==='/api/hq/state')return structuredClone(response)
    commands.push(options.body)
    task.workflow={brainFiles:options.body.brainFiles,allowedTools:[],publicInputs:[],daily:false,timezoneConfirmed:false,timezone:'Africa/Cairo',approvedAt:'2026-11-04'}
    throw Error('Synthetic commit succeeded but response was lost')
  })
  await hq.load();await hq.prepareWorkflow('task_linked')
  hq.workflowDraft.value.brainFiles=Object.fromEntries(hq.workflowFields.value.map((field,i)=>[field.key,'https://drive.google.com/file/d/readback_'+i+'/view']))
  await hq.authorizeWorkflow(hq.workflowDraft.value)
  assert.equal(hq.workflowOpen.value,true);assert.equal(commands.length,1)
  await hq.load(true)
  assert.equal(hq.workflowOpen.value,false);assert.deepEqual(hq.workflowDraft.value,{id:'',brainFiles:{}})
  assert.equal(hq.taskError.value,null);assert.equal(commands.length,1)
})

test('3D visual review uses only authenticated department and employee records, with no demo fallback', async t => {
  const { hq, transport } = fixture(t, { visualReview: true })
  assert.deepEqual(hq.rooms.value, []); assert.deepEqual(hq.employees.value, [])
  const response = signedIn()
  response.state.departments = []; response.state.employees = []
  transport(async () => structuredClone(response))
  await hq.load()
  assert.deepEqual(hq.rooms.value, []); assert.deepEqual(hq.employees.value, [])
  response.state.departments = [{ id: 'hr', name: 'HR & Agent Development', description: 'Existing local record' }]
  response.state.employees = [{ id: 'AG-CEO-001', name: 'Steve', role: 'CEO', departmentId: 'ceo', reportsTo: 'founder', status: 'idle' }]
  await hq.load()
  assert.deepEqual(hq.rooms.value.map(room => room.id), ['ceo', 'hr'])
  assert.equal(hq.rooms.value[0].label, 'CEO')
  response.state.departments.push({ id: 'local-created', name: 'Local created department', description: 'Persisted local fixture' })
  await hq.load()
  assert.deepEqual(hq.rooms.value.map(room => room.id), ['ceo', 'hr', 'local-created'])
  assert.equal(hq.rooms.value[2].label, 'Local created department')
  transport(async () => { throw new Error('Synthetic read failure') })
  await hq.load(true)
  assert.deepEqual(hq.rooms.value, []); assert.deepEqual(hq.employees.value, [])
  transport(async () => signedOut())
  await hq.load(true)
  assert.deepEqual(hq.rooms.value, []); assert.deepEqual(hq.employees.value, [])
})
