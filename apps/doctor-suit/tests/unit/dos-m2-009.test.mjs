import test from 'node:test'
import assert from 'node:assert/strict'
import {renderReportDocument} from '@building-suit/ui/utils/reportDocument'
import {clinicalCopy} from '../../app/utils/clinicalPresentation.ts'
import {prescription} from '../clinical-fixtures.mjs'
test('M2-009 detached print keeps entered instructions literal and bilingual scope notice visible',()=>{for(const ar of [false,true]){const c=clinicalCopy(ar),rx=prescription(),output=renderReportDocument([c.name,c.instructions],[[rx.medicine.label,rx.instructions]],new Set(),{title:c.print,organization:'Synthetic practice',currency:'3',generatedAt:'2026-10-20T10:00:00Z',direction:ar?'rtl':'ltr',labels:{organization:'Practice',currency:c.revision,generatedAt:c.date,warning:c.status},filters:[{label:c.status,value:'Superseded'}],warning:c.notice});assert.ok(output.includes('&lt;not markup&gt;'));assert.ok(output.includes(c.notice));assert.ok(output.includes('Superseded'));assert.ok(output.includes(ar?'dir="rtl"':'dir="ltr"'))}})
