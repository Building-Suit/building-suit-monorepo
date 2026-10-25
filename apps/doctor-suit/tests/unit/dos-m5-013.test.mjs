import test from 'node:test'
import assert from 'node:assert/strict'
import { patientAccessiblePrescription } from '../../app/utils/patientAccessiblePreview.ts'
import { id, released } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-25T10:00:00Z')
const scope = () => ({ environment: 'synthetic', portal: 'patient', accountId: id(4), sessionId: id(14), patientId: id(200), validUntil: now + 60000, relationships: [{ id: id(900), version: 1, doctorId: id(1), practiceId: id(101), locationIds: [id(102)] }] })
const request = () => ({ releaseId: id(700), prescriptionId: id(400) })
function raw() { return { timeline_page: { account_id: id(4), patient_id: id(200), page: 0, page_size: 20, total: 1, rows: [{ relationship_id: id(900), relationship_version: 1, doctor_id: id(1), practice_id: id(101), location_id: id(102), revoked: false, release: { ...released(), expires_at: new Date(now + 120000).toISOString() } }], data_mode: 'synthetic', clinical_approval: false, live_prescribing: false }, prescription_id: id(400), current: null } }
const availability = () => ({ scopeKey: JSON.stringify(scope()), network: 'online', foreground: true, revoked: false, lastSuccessfulReadAt: now, notification: 'unsupported' })
const project = (r = raw(), a = availability(), locale = 'en', s = scope(), at = now) => patientAccessiblePrescription(r, s, request(), a, locale, at)
test('complete bilingual instructions, exact decimal strings and segment reading order survive locale switching without abbreviation', () => {
 const r = raw(), p = r.timeline_page.rows[0].release.prescriptions[0]; p.instructions = ('تعليمات مدخلة كاملة / entered instructions <plain text> e\u0301\n').repeat(30); p.segments[0].instructions = 'نص طويل كامل\nKeep every entered word';
 const before = structuredClone(r), en = project(r), ar = project(r, availability(), 'ar'); assert.equal(en.direction, 'ltr'); assert.equal(ar.direction, 'rtl'); assert.deepEqual(en.privateContent.readingOrder.map(f => [f.key, f.value]), ar.privateContent.readingOrder.map(f => [f.key, f.value])); assert.equal(ar.privateContent.readingOrder.find(f => f.key === 'instructions').value, p.instructions); assert.equal(en.privateContent.readingOrder.find(f => f.key === 'amount').value, '1.2500'); assert.equal(en.privateContent.readingOrder.at(-1).value, p.segments[0].instructions); assert.deepEqual(r, before); assert.equal(en.privateContent.instructionKind, 'as_needed'); assert.throws(() => { en.privateContent.readingOrder[0].value = 'changed' })
})
test('every segment retains its own exact dates, zone, entered time arrays and instructions in source order', () => {
 const r = raw(), p = r.timeline_page.rows[0].release.prescriptions[0]; p.segments[0].end_date = '2026-10-20'; p.segments.push({ ...p.segments[0], start_date: '2026-10-21', end_date: '2026-10-22', instructions: 'second original segment' }); const view = project(r).privateContent; assert.equal(view.readingOrder.filter(f => f.key.endsWith(':instructions')).length, 2); assert.equal(view.readingOrder.find(f => f.key === 'segment:1:instructions').value, 'second original segment'); assert.equal(view.readingOrder.find(f => f.key === 'segment:0:interval').value, 'null')
})
test('offline/unknown connection retains truthful last-success metadata but never private instructions or a confirmed appointment', () => {
 for (const network of ['offline', 'unknown']) { const view = project(raw(), { ...availability(), network }); assert.equal(view.privateContent, null); assert.equal(view.lastSuccessfulReadAt, now); assert.equal(view.privatePersistentCache, false); assert.equal('appointmentConfirmed' in view, false); assert.notEqual(view.status, project().status) }
 const never = project(null, { ...availability(), network: 'offline', lastSuccessfulReadAt: null }); assert.equal(never.lastSuccessfulReadAt, null); assert.equal(never.privateContent, null)
})
test('session/dependent/version change, expiry, release withdrawal, background and revocation hide private previews', () => {
 for (const patch of [{ foreground: false }, { revoked: true }, { scopeKey: 'foreign-scope' }]) assert.equal(project(raw(), { ...availability(), ...patch }).privateContent, null)
 assert.equal(project(raw(), availability(), 'en', { ...scope(), sessionId: id(15) }).privateContent, null); assert.equal(project(raw(), availability(), 'en', { ...scope(), patientId: id(201) }).privateContent, null); assert.equal(project(raw(), availability(), 'en', scope(), now + 60000).privateContent, null)
 const r = raw(); r.timeline_page.rows[0].revoked = true; assert.equal(project(r).privateContent, null)
 const changed = scope(); changed.relationships[0].version = 2; assert.equal(project(raw(), { ...availability(), scopeKey: JSON.stringify(changed) }, 'en', changed).privateContent, null)
})
test('notification permission is independent of consent/delivery and unknown/unsupported/denied state remains explicit in both languages', () => {
 for (const locale of ['en', 'ar']) { const texts = new Set(); for (const notification of ['unknown', 'unsupported', 'denied', 'permission_reported']) { const v = project(raw(), { ...availability(), notification }, locale); texts.add(v.notificationStatus); assert.equal(v.deliveryConfirmed, false); assert.equal(v.externalNotifications, false); assert.equal(v.qualifiedNative, false); assert.equal(v.qualifiedAccessibility, false); assert(v.notice.length > 20) } assert.equal(texts.size, 4) }
})
test('unknown source state remains unknown rather than creating a missed dose or treatment advice', () => {
 const view = project(); assert.equal(view.privateContent.state, 'unknown'); for (const key of ['missedDose', 'diagnosis', 'compensation', 'takeNow', 'clinicalAdvice']) assert.equal(key in view, false); assert.equal(view.clinicalApproval, false)
})
test('malformed/future refresh metadata and invalid locale fail closed; foreign scope cannot reveal its last successful read', () => {
 for (const patch of [{ network: 'probably' }, { notification: 'delivered' }, { lastSuccessfulReadAt: now + 1 }, { lastSuccessfulReadAt: -1 }]) assert.throws(() => project(raw(), { ...availability(), ...patch }))
 assert.throws(() => project(raw(), availability(), 'fr')); const v = project(raw(), { ...availability(), scopeKey: 'different-session' }); assert.equal(v.lastSuccessfulReadAt, null); assert.equal(v.privateContent, null)
})
