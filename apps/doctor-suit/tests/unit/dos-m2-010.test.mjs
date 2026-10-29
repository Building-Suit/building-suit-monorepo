import test from 'node:test'
import assert from 'node:assert/strict'
import {validClinicalSnapshot} from '../../app/utils/clinical.ts'
import {clinicalFields,clinicalSnapshotFromFields} from '../../app/utils/clinicalPresentation.ts'
import {snapshot,id} from '../clinical-fixtures.mjs'
test('M2-010 explicit request lifecycle preserves entered text without interpretation',()=>{const value=snapshot();value.orders=[{id:id(500),kind:'referral',request:'Synthetic authored request',due_at:'2026-10-22T09:00:00+02:00',state:'tracking',reason:''}];assert.equal(validClinicalSnapshot(value),true);assert.deepEqual(clinicalSnapshotFromFields(clinicalFields(value)),value);value.orders[0].diagnosis='Invented';assert.equal(validClinicalSnapshot(value),false)})
test('M2-010 cancellation requires a reason and ambiguous due clocks are rejected',()=>{const value=snapshot();value.orders=[{id:id(500),kind:'lab',request:'Synthetic request',due_at:null,state:'cancelled',reason:''}];assert.equal(validClinicalSnapshot(value),false);value.orders[0].reason='Entered cancellation';assert.equal(validClinicalSnapshot(value),true);value.orders[0].due_at='2026-10-22T09:00:00';assert.equal(validClinicalSnapshot(value),false)})
