import test from 'node:test'
import assert from 'node:assert/strict'
import {validClinicalSnapshot} from '../../app/utils/clinical.ts'
import {clinicalFields,clinicalSnapshotFromFields} from '../../app/utils/clinicalPresentation.ts'
import {snapshot,id} from '../clinical-fixtures.mjs'
test('M2-003 missing, unknown and none-reported remain distinct and do not gain findings',()=>{
 for(const knowledge of ['missing','unknown','none_reported']){const value=snapshot();value.intake=[{id:id(601),kind:'allergy',knowledge,text:'',value:'',unit:'',source:'patient'}];assert.equal(validClinicalSnapshot(value),true);assert.deepEqual(clinicalSnapshotFromFields(clinicalFields(value)),value);value.intake[0].text='Invented';assert.equal(validClinicalSnapshot(value),false)}
})
test('M2-003 client-provided review/authority fields are not an intake contract',()=>{const value=snapshot();value.intake=[{id:id(601),kind:'history',knowledge:'reported',text:'Synthetic entered history',value:'',unit:'',source:'staff',reviewed_by:id(1)}];assert.equal(validClinicalSnapshot(value),false)})
