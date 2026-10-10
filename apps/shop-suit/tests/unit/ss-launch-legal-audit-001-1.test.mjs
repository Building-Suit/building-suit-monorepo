import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
const source = await read('app/utils/legal.ts')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { legalDocuments } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const body = doc => JSON.stringify(doc.sections)

test('all four policies have aligned EN/AR sections, metadata and revision dates', () => {
  for (const key of ['terms', 'privacy', 'delivery', 'refund']) {
    const { en, ar } = legalDocuments[key]
    assert.ok(en.title && ar.title && en.intro && ar.intro)
    assert.equal(en.sections.length, ar.sections.length)
    en.sections.forEach((section, index) => {
      for (const field of ['paragraphs', 'bullets']) {
        assert.equal(section[field]?.length, ar.sections[index][field]?.length, `${key} ${section.title} ${field}`)
        for (const value of section[field] ?? []) assert.ok(value.trim())
      }
    })
    assert.equal(en.updated, ['terms', 'privacy'].includes(key) ? '10 October 2026' : '30 September 2026')
    assert.equal(ar.updated, ['terms', 'privacy'].includes(key) ? '10 أكتوبر 2026' : '30 سبتمبر 2026')
  }
})

test('commercial and team claims trace to current Shop terms and authorization', async () => {
  const migrations = await import('node:fs/promises').then(fs => fs.readdir(new URL('../../supabase/migrations/', import.meta.url)))
  const solo = await read(`supabase/migrations/${migrations.find(name => name.includes('solo_member_variants'))}`)
  assert.match(solo, /max_members.*8/)
  assert.match(solo, /max_members.*16/)
  assert.match(solo, /members when 1/)
  const team = await read('supabase/migrations/20261007010000_launch_team_controls.sql')
  assert.match(team, /not shop_private.has_permission/)
  assert.match(body(legalDocuments.terms.en), /Solo \(1 or 2 members\).*Team \(8 members\).*25 members/)
  assert.match(body(legalDocuments.terms.ar), /Solo \(عضو واحد أو عضوان\).*Team \(8 أعضاء\).*25 عضوًا/)
  assert.match(body(legalDocuments.terms.en), /include the owner.*pending invitations reserve capacity/)
  assert.match(body(legalDocuments.terms.en), /cannot grant permissions they do not hold/)
})

test('session disclosure preserves the external enforcement gate and local logout scope', async () => {
  assert.match(await read('docs/single-session.md'), /Launch enforcement: \*\*blocked\*\*/)
  assert.match(await read('app/plugins/session-loss.client.ts'), /event !== 'SIGNED_OUT'/)
  assert.match(body(legalDocuments.terms.en), /not currently verified as enabled.*session refresh.*until expiry/)
  assert.match(body(legalDocuments.terms.ar), /لم يتم التحقق حاليًا.*تحديث الجلسة.*انتهاء مدتها/)
  assert.match(body(legalDocuments.terms.en), /Normal logout ends only the current session/)
})

test('privacy discloses actual support payload and scoped realtime processing', async () => {
  const sender = await read('supabase/functions/_shared/support-notifications.mjs')
  assert.match(sender, /https:\/\/api.resend.com\/emails/)
  for (const field of ['requester_email', 'subject', 'customer_message', 'category', 'priority', 'request_id']) assert.ok(sender.includes(field))
  const realtime = await read('app/composables/useShopRealtime.ts')
  assert.match(realtime, /userId: actor, tenantId: shop, locationId: location, sessionId/)
  for (const locale of ['en', 'ar']) assert.match(body(legalDocuments.privacy[locale]), /Resend/)
  assert.match(body(legalDocuments.privacy.en), /Recording a request does not guarantee email delivery or a response time/)
  assert.match(body(legalDocuments.privacy.en), /Session identifiers.*clear local workspace state/)
})

test('delivery and refunds retain manual-review boundaries without new promises', () => {
  assert.match(body(legalDocuments.delivery.en), /Submission alone is not payment confirmation/)
  assert.match(body(legalDocuments.refund.en), /no automatic refund or fixed processing time is promised/)
  assert.match(body(legalDocuments.terms.en), /responsible for their accuracy, legality/)
})

// Keep the pre-existing public/legal contract regression in this required executable.
await import('./public-legal.test.mjs')
