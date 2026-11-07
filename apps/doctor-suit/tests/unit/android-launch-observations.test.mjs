import test from 'node:test'
import assert from 'node:assert/strict'
import {androidLaunchObservation} from '../../mobile/doctor/scripts/android-launch-observations.mjs'

const observe=(output,exitCode=0)=>androidLaunchObservation({attempted:true,completed:exitCode===0,exitCode,output})
test('launch command completion and starting output do not claim foreground or readiness',()=>{
  const value=observe('Starting: Intent { cmp=com.buildingsuit.doctor.synthetic/.MainActivity }')
  assert.equal(value.commandCompleted,true)
  assert.equal(value.startReported,true)
  assert.equal(value.errorReported,false)
  for(const key of ['accepted','ready','foreground','syntheticForeground']) assert.equal(Object.hasOwn(value,key),false)
  const missing=observe('Starting: Intent { cmp=private.sentinel/.Activity }\nError type 3\nError: Activity class {private.sentinel/.Activity} does not exist.')
  assert.equal(missing.commandCompleted,true)
  assert.equal(missing.activityMissing,true)
  assert.equal(missing.errorReported,true)
})
test('launch rejection and existing-instance cues remain separate',()=>{
  const denied=observe('Security exception: Permission Denial: private.sentinel',1)
  assert.equal(denied.permissionDenied,true)
  assert.equal(denied.commandCompleted,false)
  assert.equal(denied.exitCode,1)
  const both=androidLaunchObservation({attempted:true,completed:false,exitCode:1,output:'Starting: Intent { dat=private.sentinel }',errorOutput:'Security exception: private.sentinel'})
  assert.equal(both.startReported,true)
  assert.equal(both.permissionDenied,true)
  assert.equal(JSON.stringify(both).includes('private.sentinel'),false)
  assert.equal(observe('Error: Activity not started, unable to resolve Intent { dat=private.sentinel }').intentUnresolved,true)
  for(const suffix of ['intent has been delivered to currently running top-most instance.','its current task has been brought to the front']){
    const value=observe('Warning: Activity not started, '+suffix)
    assert.equal(value.existingInstanceReported,true)
    assert.equal(value.errorReported,false)
  }
  assert.equal(observe('Error: unclassified failure').errorReported,true)
})
test('unavailable launch output and invalid status stay unknown without coercion',()=>{
  const unavailable=androidLaunchObservation({attempted:false,completed:false,exitCode:null,output:null})
  assert.equal(unavailable.attempted,false)
  assert.equal(unavailable.commandCompleted,false)
  assert.equal(unavailable.exitCode,null)
  assert.equal(unavailable.outputAvailable,false)
  for(const input of [null,undefined,42,{}, {toString(){throw Error('must not coerce')}}]){
    const value=observe(input)
    assert.equal(value.outputAvailable,false)
    assert.equal(value.startReported,false)
  }
  for(const input of [null,undefined,'1',NaN,Infinity,-1,256,1.5]) assert.equal(androidLaunchObservation({attempted:true,completed:false,exitCode:input,output:''}).exitCode,null)
})
test('launch receipts bound inspection and exclude private output',()=>{
  const privateText='private.sentinel credential=secret-value'
  for(const output of [privateText,'Starting: Intent { dat='+privateText+' }','Error: '+privateText,'Security exception: '+privateText]){
    const value=observe(output)
    const serialized=JSON.stringify(value)
    assert.equal(serialized.includes('private.sentinel'),false)
    assert.equal(serialized.includes('secret-value'),false)
    assert.ok(Object.values(value).every(item=>typeof item==='boolean'||typeof item==='number'||item===null))
  }
  const bounded=observe('x'.repeat(8192)+'\nError type 3')
  assert.equal(bounded.outputTruncated,true)
  assert.equal(bounded.activityMissing,false)
  assert.equal(observe('x'.repeat(8192)).outputTruncated,false)
})
