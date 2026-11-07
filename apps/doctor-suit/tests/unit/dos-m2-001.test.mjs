import test from 'node:test'
import assert from 'node:assert/strict'
import {clinicalDirectory,clinicalCommandResult} from '../../app/utils/clinical.ts'
import {directory,outcome} from '../clinical-fixtures.mjs'
test('M2-001 an engineering envelope cannot promote clinical approval or live prescribing',()=>{
 for(const key of ['clinical_approval','live_prescribing']){const value=directory();value[key]=true;assert.throws(()=>clinicalDirectory(value));const command=outcome();command[key]=true;assert.throws(()=>clinicalCommandResult(command))}
 assert.equal(clinicalDirectory(directory()).clinical_approval,false)
})
test('M2-001 unavailable response cannot carry private projections',()=>{const value=directory();value.available=false;assert.throws(()=>clinicalDirectory(value))})
