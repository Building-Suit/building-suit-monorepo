import {doctorReturnPath} from '../../app/utils/authConfiguration.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {validClinicalSnapshot,clinicalDetail,clinicalCommandResult} from '../../app/utils/clinical.ts'
import {clinicalFields,clinicalSnapshotFromFields,clinicalCopy,clinicalChoices} from '../../app/utils/clinicalPresentation.ts'
import {snapshot,prescription,detail,outcome,id} from '../clinical-fixtures.mjs'
test('M2-014 complete synthetic entered-data projection preserves all source content',()=>{const value=snapshot();value.prescriptions=[prescription()];value.intake=[{id:id(600),kind:'history',knowledge:'reported',text:'Synthetic history',value:'',unit:'',source:'patient'}];value.orders=[{id:id(500),kind:'follow_up',request:'Synthetic follow-up',due_at:null,state:'requested',reason:''}];value.results=[{id:id(501),order_id:id(500),document_version_id:null,stage:'requested',annotation:''}];assert.equal(validClinicalSnapshot(value,true),true);assert.deepEqual(clinicalSnapshotFromFields(clinicalFields(value)),value);assert.equal(clinicalCommandResult(outcome()).live_prescribing,false);assert.equal(clinicalDetail(detail(),id(101),id(102),id(300)).clinical_approval,false)})
test('M2-014 English and Arabic copy and explicit choices cover the same controlled fields',()=>{assert.deepEqual(Object.keys(clinicalCopy(true)).sort(),Object.keys(clinicalCopy(false)).sort());for(const key of Object.keys(clinicalChoices(false)))assert.deepEqual(clinicalChoices(true)[key].map(x=>x.value),clinicalChoices(false)[key].map(x=>x.value))})

test('M2-014 protected clinical return paths stay internal and bounded',()=>{assert.equal(doctorReturnPath('/clinical'),'/clinical');assert.equal(doctorReturnPath('/clinical-releases/'+id(700)),'/clinical-releases/'+id(700));assert.equal(doctorReturnPath('https://example.invalid/clinical'),'/workspace')})
