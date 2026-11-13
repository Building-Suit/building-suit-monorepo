import test from 'node:test'
import assert from 'node:assert/strict'
import {createClinicalController,clinicalState} from '../../app/utils/clinicalController.ts'
import {directory,detail,deferred,scope,outcome,id} from '../clinical-fixtures.mjs'
test('M2-002 late prior-practice directory and command results are discarded',async()=>{
 let active=scope();const pending=deferred();const state=clinicalState();const controller=createClinicalController({load:()=>pending.promise},state,()=>active)
 const work=controller.load();active={...active,practiceId:id(999)};controller.clear();pending.resolve(directory());assert.equal(await work,false);assert.equal(state.directory,null)
 const command=deferred();const writes=createClinicalController({command:()=>command.promise},state,()=>active);state.detail=detail();const save=writes.command('start',{});writes.clear();command.resolve(outcome());assert.equal(await save,null);assert.equal(state.detail,null)
})
test('M2-002 newer search wins even when the older transport ignores abort',async()=>{
 const older=deferred(),newer=deferred();let count=0;const state=clinicalState(),controller=createClinicalController({load:()=>++count===1?older.promise:newer.promise},state,scope)
 const first=controller.load(0,'old'),second=controller.load(0,'new');const fresh=directory();fresh.rows[0].patient_name='New synthetic result';newer.resolve(fresh);assert.equal(await second,true);older.resolve(directory());assert.equal(await first,false);assert.equal(state.directory.rows[0].patient_name,'New synthetic result')
})
test('M2-002 record switches retire late old-record reads',async()=>{
 const older=deferred(),newer=deferred();let count=0;const state=clinicalState(),controller=createClinicalController({detail:()=>++count===1?older.promise:newer.promise},state,scope)
 const first=controller.detail(id(300)),second=controller.detail(id(399));const fresh=detail();fresh.encounter.id=id(399);newer.resolve(fresh);assert.equal(await second,true);older.resolve(detail());assert.equal(await first,false);assert.equal(state.detail.encounter.id,id(399))
})
