import test from 'node:test'
import assert from 'node:assert/strict'
import {validClinicalSnapshot} from '../../app/utils/clinical.ts'
import {snapshot,id} from '../clinical-fixtures.mjs'
test('M2-011 reviewed/released result shape requires an explicit source document and linked request',()=>{const value=snapshot();value.orders=[{id:id(500),kind:'imaging',request:'Synthetic request',due_at:null,state:'requested',reason:''}];value.results=[{id:id(501),order_id:id(500),document_version_id:null,stage:'requested',annotation:''}];assert.equal(validClinicalSnapshot(value),true);value.results[0].stage='reviewed';assert.equal(validClinicalSnapshot(value),false);value.results[0].document_version_id=id(601);assert.equal(validClinicalSnapshot(value),true);value.results[0].order_id=id(999);assert.equal(validClinicalSnapshot(value),false)})
test('M2-011 a file upload cannot add an inferred normality or diagnosis flag',()=>{const value=snapshot();value.results=[{id:id(501),order_id:id(500),document_version_id:id(601),stage:'uploaded',annotation:'',normal:true}];assert.equal(validClinicalSnapshot(value),false)})
