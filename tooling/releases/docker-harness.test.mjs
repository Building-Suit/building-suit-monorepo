import test from 'node:test'
import assert from 'node:assert/strict'
import { dockerFailureReason, ensureDisposableImage } from './docker-harness.mjs'
test('Docker failures use static categories and the official same-version mirror only for pull failures', () => {
  assert.equal(dockerFailureReason('private-sentinel denied: authorization token expired'),'DOCKER_IMAGE_ACCESS_DENIED')
  assert.equal(dockerFailureReason('no space left on device private-sentinel'),'DOCKER_STORAGE_EXHAUSTED')
  assert.equal(dockerFailureReason('bind: address already in use private-sentinel'),'DOCKER_PORT_UNAVAILABLE')
  const calls=[]
  const run=(_program,args)=>{
    calls.push(args)
    return {status:args[0]==='image'||args[1]==='primary'?1:0,stderr:'denied: private-sentinel'}
  }
  ensureDisposableImage('primary','mirror',run)
  assert.deepEqual(calls,[['image','inspect','primary'],['pull','primary'],['pull','mirror'],['tag','mirror','primary']])
  const failure=()=>({status:125,stderr:'no space left on device private-sentinel'})
  assert.throws(()=>ensureDisposableImage('primary','mirror',failure),error=>{
    assert.match(error.message,/DOCKER_STORAGE_EXHAUSTED/)
    assert.doesNotMatch(error.message,/private-sentinel/)
    return true
  })
})
test('an unclassified pull failure uses only the explicit mirror and retains both-failed errors', () => {
  const calls=[]
  const run=(_program,args)=>{
    calls.push(args)
    return {status:args[0]==='image'||args[1]==='primary'?1:0,stderr:'unexpected registry response private-sentinel'}
  }
  ensureDisposableImage('primary','mirror',run)
  assert.deepEqual(calls,[['image','inspect','primary'],['pull','primary'],['pull','mirror'],['tag','mirror','primary']])
  const failedCalls=[]
  assert.throws(()=>ensureDisposableImage('primary','mirror',(_program,args)=>{
    failedCalls.push(args);return {status:1,stderr:'unexpected registry response private-sentinel'}
  }),error=>error.message==='Disposable image unavailable: DOCKER_START_FAILED; raw output omitted')
  assert.deepEqual(failedCalls,[['image','inspect','primary'],['pull','primary'],['pull','mirror']])
})
test('known local failures never try a registry mirror and no mirror is inferred', () => {
  for(const [message,reason] of [
    ['no space left on device','DOCKER_STORAGE_EXHAUSTED'],
    ['cannot connect to Docker daemon','DOCKER_DAEMON_UNAVAILABLE'],
    ['port is already allocated','DOCKER_PORT_UNAVAILABLE'],
  ]){
    const calls=[]
    assert.throws(()=>ensureDisposableImage('primary','mirror',(_program,args)=>{
      calls.push(args);return {status:1,stderr:message}
    }),error=>error.message===`Disposable image unavailable: ${reason}; raw output omitted`)
    assert.deepEqual(calls,[['image','inspect','primary'],['pull','primary']])
  }
  const calls=[]
  assert.throws(()=>ensureDisposableImage('primary',undefined,(_program,args)=>{
    calls.push(args);return {status:1,stderr:'unclassified private-sentinel'}
  }),/DOCKER_START_FAILED/)
  assert.deepEqual(calls,[['image','inspect','primary'],['pull','primary']])
})
