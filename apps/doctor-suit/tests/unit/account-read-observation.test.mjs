import test from 'node:test'
import assert from 'node:assert/strict'
import {doctorAccountReadObservation,doctorAccountAssertion} from '../helpers/account-read-observation.mjs'

test('account freshness read distinguishes permitted, expired and unavailable flags',()=>{
 for(const allowed of[true,false])assert.deepEqual(doctorAccountReadObservation({status:200,error:null,data:{can_change_contact:allowed,personal_name:'private.sentinel'}}),{status:200,errorPresent:false,errorCode:null,contactAllowed:allowed})
 for(const result of[null,undefined,{}, {data:{can_change_contact:'false'}}])assert.equal(doctorAccountReadObservation(result).contactAllowed,null)
})
test('account read failures retain only fixed error codes and bounded statuses',()=>{
 for(const code of['42501','57014','53300','PGRST116','PGRST301','PGRST302']){
  const observation=doctorAccountReadObservation({status:403,error:{code,message:'private.sentinel',details:'credential.sentinel'},data:null})
  assert.equal(observation.errorPresent,true);assert.equal(observation.errorCode,code);assert.equal(observation.status,403)
  assert.equal(JSON.stringify(observation).includes('sentinel'),false)
 }
 assert.equal(doctorAccountReadObservation({status:0,error:{code:'private.sentinel'}}).errorCode,'other')
 for(const status of[-1,600,200.5,'200',Infinity,NaN,null])assert.equal(doctorAccountReadObservation({status}).status,null)
})
test('account assertion classification does not expose errors or coerce payloads',()=>{
 assert.equal(doctorAccountAssertion(new Error('Real account settings read rejected')),'account-read-rejected')
 assert.equal(doctorAccountAssertion(new Error('Actual account stage timed out')),'account-readiness-timeout')
 for(const value of[new Error('private.sentinel'),null,{message:'Real account settings read rejected'},{toString(){throw Error('do not coerce')}}])assert.equal(doctorAccountAssertion(value),'other')
 const value=doctorAccountReadObservation({status:{valueOf(){throw Error('do not coerce')}},error:{code:{toString(){throw Error('do not coerce')}}},data:{can_change_contact:{valueOf(){throw Error('do not coerce')}}}})
 assert.deepEqual(value,{status:null,errorPresent:true,errorCode:'other',contactAllowed:null})
})
