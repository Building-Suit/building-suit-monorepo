import test from 'node:test'
import assert from 'node:assert/strict'
import {validClinicalSnapshot} from '../../app/utils/clinical.ts'
import {clinicalFields,clinicalSnapshotFromFields} from '../../app/utils/clinicalPresentation.ts'
import {snapshot} from '../clinical-fixtures.mjs'
test('M2-004 template version and section identity remain pinned to the saved note',()=>{const value=snapshot();assert.equal(validClinicalSnapshot(value),true);value.note.template_version=2;assert.equal(validClinicalSnapshot(value),false);value.note.template_version=1;value.note.sections[1].key='entered_note';assert.equal(validClinicalSnapshot(value),false)})
test('M2-004 incomplete note can remain a draft but cannot be finalized',()=>{const value=snapshot();value.note.sections[0].text='';assert.equal(validClinicalSnapshot(value),true);assert.equal(validClinicalSnapshot(value,true),false)})
test('M2-004 form projection preserves Arabic and literal markup without rewriting it',()=>{const value=snapshot();value.note.sections[0].text='نص اصطناعي\n<script>literal</script>';assert.deepEqual(clinicalSnapshotFromFields(clinicalFields(value)),value)})
