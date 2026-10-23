import test from 'node:test'
import assert from 'node:assert/strict'
import {validClinicalSnapshot} from '../../app/utils/clinical.ts'
import {snapshot,prescription} from '../clinical-fixtures.mjs'
test('M2-005 manual synthetic identity never becomes a licensed catalogue entry',()=>{const value=snapshot();value.prescriptions=[prescription()];assert.equal(validClinicalSnapshot(value),true);for(const provenance of ['licensed_catalogue','EDA','verified',null]){value.prescriptions[0].medicine.provenance=provenance;assert.equal(validClinicalSnapshot(value),false)}})
test('M2-005 unknown source revision is rejected instead of silently migrated',()=>{const value=snapshot();value.prescriptions=[prescription()];value.prescriptions[0].medicine.source_version='manual-v2';assert.equal(validClinicalSnapshot(value),false)})
