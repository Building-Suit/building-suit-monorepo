import test from 'node:test'
import assert from 'node:assert/strict'
import {validClinicalSnapshot} from '../../app/utils/clinical.ts'
import {clinicalFields,clinicalSnapshotFromFields} from '../../app/utils/clinicalPresentation.ts'
import {snapshot,prescription} from '../clinical-fixtures.mjs'
test('M2-006 exact entered decimal, medicine, route and instructions survive editing',()=>{const value=snapshot();value.prescriptions=[prescription()];assert.deepEqual(clinicalSnapshotFromFields(clinicalFields(value)),value);assert.equal(value.prescriptions[0].dose.amount,'1.2500')})
test('M2-006 invalid numeric shape yields rejection, never a replacement amount',()=>{for(const amount of ['0','-1','1e3','1,5','NaN','',1.25]){const value=snapshot();value.prescriptions=[prescription()];value.prescriptions[0].dose.amount=amount;assert.equal(validClinicalSnapshot(value),false)}})
test('M2-006 absent medicine or added recommendations are outside the contract',()=>{const value=snapshot();value.prescriptions=[prescription()];delete value.prescriptions[0].medicine.strength;assert.equal(validClinicalSnapshot(value),false);value.prescriptions[0]=prescription();value.prescriptions[0].recommendation='Invented';assert.equal(validClinicalSnapshot(value),false)})
