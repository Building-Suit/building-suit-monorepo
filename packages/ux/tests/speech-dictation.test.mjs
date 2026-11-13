import test from 'node:test'
import assert from 'node:assert/strict'
import { createSpeechDictation } from '../src/composables/useSpeechDictation.ts'

function fixture(initial = '', maximumLength = 6000) {
  let draft = initial, disabled = false
  const sessions = [], state = { supported: false, phase: 'idle', error: null }
  class Recognition {
    onstart = null; onend = null; onresult = null; onerror = null
    starts = 0; stops = 0; aborts = 0
    constructor() { sessions.push(this) }
    start() { this.starts++ }
    stop() { this.stops++ }
    abort() { this.aborts++ }
    result(...texts) { this.onresult?.({ results: texts.map((transcript,index) => ({ isFinal: index < texts.length - 1, 0: { transcript } })) }) }
  }
  const controller = createSpeechDictation({ getDraft: () => draft, setDraft: value => { draft = value }, language: () => 'ar-EG', disabled: () => disabled, maximumLength }, state)
  controller.setConstructor(Recognition)
  return { controller, state, sessions, draft: () => draft, edit(value) { draft = value }, disable() { disabled = true } }
}

test('speech revises the session suffix without duplicating interim text or touching the existing draft', () => {
  const f = fixture('Please review'); f.controller.start(); const r = f.sessions[0]
  assert.equal(f.state.phase,'starting'); assert.equal(r.lang,'ar-EG'); assert.equal(r.interimResults,true)
  r.onstart(); r.result('the'); assert.equal(f.draft(),'Please review the')
  r.result('the budget'); assert.equal(f.draft(),'Please review the budget')
  r.result('the budget','tomorrow'); assert.equal(f.draft(),'Please review the budget tomorrow')
  f.controller.stop(); assert.equal(f.state.phase,'stopping'); assert.equal(r.stops,1)
  r.onend(); assert.equal(f.state.phase,'idle'); assert.equal(f.draft(),'Please review the budget tomorrow')
  f.controller.start(); f.sessions[1].result('please'); f.sessions[1].onend()
  assert.equal(f.draft(),'Please review the budget tomorrow please'); f.controller.dispose()
})
test('repeated clicks, errors and late callbacks never start another session or overwrite an edited draft', () => {
  const f=fixture('Existing'); f.controller.start(); f.controller.start(); assert.equal(f.sessions.length,1)
  const r=f.sessions[0], late=r.onresult; r.result('words'); f.edit('Edited by user'); late({results:[{0:{transcript:'stale'}}]})
  assert.equal(f.draft(),'Edited by user'); assert.equal(f.state.phase,'idle'); assert.equal(r.aborts,1)
  f.controller.start(); const second=f.sessions[1]; second.onerror({error:'not-allowed'})
  assert.equal(f.state.error,'denied'); assert.equal(f.state.phase,'idle'); assert.equal(f.draft(),'Edited by user')
  f.controller.dispose(); f.controller.start(); assert.equal(f.sessions.length,2)
})
test('disabled/access changes, disposal and missing browser capability stop recording without losing text', () => {
  const f=fixture('Keep'); f.disable(); f.controller.start(); assert.equal(f.sessions.length,0)
  const g=fixture('Keep'); g.controller.start(); const r=g.sessions[0]; r.result('draft'); const late=r.onresult
  g.disable(); late({results:[{0:{transcript:'must not append'}}]}); assert.equal(g.draft(),'Keep draft'); assert.equal(r.aborts,1)
  g.controller.setConstructor(undefined); g.controller.start(); assert.equal(g.state.supported,false)
  const h=fixture();h.controller.setConstructor(undefined);h.controller.start();assert.equal(h.state.error,'unsupported');h.controller.dispose()
})
test('speech service denial is separate from microphone permission and preserves the draft', () => {
  const f=fixture('Keep this draft')
  f.controller.start(); const service=f.sessions[0], late=service.onresult
  service.onerror({error:'service-not-allowed'})
  assert.equal(f.state.error,'service'); assert.equal(f.state.phase,'idle'); assert.equal(service.aborts,1)
  late({results:[{0:{transcript:'stale service output'}}]})
  assert.equal(f.draft(),'Keep this draft')
  f.controller.start(); f.sessions[1].onerror({error:'not-allowed'})
  assert.equal(f.state.error,'denied'); assert.equal(f.state.phase,'idle')
  f.controller.dispose()
})
test('length limits preserve valid Unicode and a lost end event cannot keep the microphone running', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const f=fixture('',4); f.controller.start(); const r=f.sessions[0]; r.result('abc😀')
  assert.equal(f.draft(),'abc'); assert.equal(f.state.error,'limit'); assert.equal(f.state.phase,'stopping')
  context.mock.timers.tick(3000); assert.equal(r.aborts,1); assert.equal(f.state.phase,'idle'); f.controller.dispose()
})
