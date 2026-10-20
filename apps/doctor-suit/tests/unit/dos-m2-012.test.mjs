import test from 'node:test'
import assert from 'node:assert/strict'
import {clinicalDetail} from '../../app/utils/clinical.ts'
import {createClinicalController,clinicalState} from '../../app/utils/clinicalController.ts'
import {detail,scope,id} from '../clinical-fixtures.mjs'
import {clinicalReleased} from '../../app/utils/clinical.ts'
import {createClinicalReleaseController,clinicalReleaseState} from '../../app/utils/clinicalReleaseController.ts'
import {released,deferred} from '../clinical-fixtures.mjs'
test('M2-012 detail projections cannot cross the requested practice, clinic or encounter',()=>{for(const patch of [{practice_id:id(999)},{location_id:id(999)},{id:id(999)}]){const value=detail();Object.assign(value.encounter,patch);assert.throws(()=>clinicalDetail(value,id(101),id(102),id(300)))}})
test('M2-012 denial clears previously private details instead of retaining stale chart content',async()=>{const state=clinicalState();state.detail=detail();const controller=createClinicalController({load:async()=>{throw {code:'42501'}}},state,scope);assert.equal(await controller.load(0,'',true),false);assert.equal(state.detail,null);assert.equal(state.directory,null);assert.equal(state.error,'denied')})
test('M2-012 released projection rejects private working notes, intake and object URLs',()=>{assert.equal(clinicalReleased(released(),id(700)).professional_signature,false);for(const key of ['note','intake','object_path','url']){const value=released();value[key]='private';assert.throws(()=>clinicalReleased(value,id(700)))}})
test('M2-012 recipient session changes discard late old-user release responses',async()=>{let actor={userId:id(4),sessionId:id(14)};const pending=deferred(),state=clinicalReleaseState(),controller=createClinicalReleaseController({load:()=>pending.promise},state,()=>actor,'local');const work=controller.load(id(700));actor={userId:id(5),sessionId:id(15)};pending.resolve(released());assert.equal(await work,false);assert.equal(state.release,null)})
test('M2-012 a revoked download clears the previously displayed released version',async()=>{const state=clinicalReleaseState();state.release=released();const controller=createClinicalReleaseController({download:async()=>{throw {code:'42501'}}},state,()=>({userId:id(4),sessionId:id(14)}),'local');assert.equal(await controller.download(id(602)),null);assert.equal(state.release,null);assert.equal(state.error,'denied')})
