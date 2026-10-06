import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  addSyntheticReceipt,
  buildSetupChecklist,
  createSyntheticDemo,
  resetSyntheticDemo,
  reviewedChartTemplates,
} from '../../app/utils/setupExperience.ts'

test('setup checklist reports live facts without treating optional opening or team work as blockers', () => {
  const checklist = buildSetupChecklist({
    organizationConfigured: true,
    accountCount: 12,
    eligibleMappingAccountCount: 8,
    mappedAccountCount: 6,
    periodCount: 1,
    acceptedOpeningCount: 0,
    memberCount: 1,
    pendingInvitationCount: 0,
  })
  assert.equal(checklist.find(item => item.key === 'organization').state, 'complete')
  assert.equal(checklist.find(item => item.key === 'chart').state, 'needs_attention')
  assert.equal(checklist.find(item => item.key === 'periods').state, 'complete')
  assert.equal(checklist.find(item => item.key === 'opening').state, 'optional')
  assert.equal(checklist.find(item => item.key === 'team').state, 'optional')
})

test('unreadable configuration is explicit instead of being reported as incomplete', () => {
  const checklist = buildSetupChecklist({
    organizationConfigured: true,
    accountCount: null,
    eligibleMappingAccountCount: null,
    mappedAccountCount: null,
    periodCount: null,
    acceptedOpeningCount: null,
    memberCount: null,
    pendingInvitationCount: null,
  })
  assert.ok(checklist.slice(1).every(item => item.state === 'unavailable'))
})

test('reviewed chart templates are read-only hierarchical starting points with explicit classifications', () => {
  assert.deepEqual(reviewedChartTemplates.map(template => template.key), ['services', 'trading'])
  for (const template of reviewedChartTemplates) {
    assert.equal(template.reviewStatus, 'product_reviewed_starting_point')
    const codes = new Set(template.accounts.map(account => account.code))
    assert.equal(codes.size, template.accounts.length)
    for (const account of template.accounts) {
      if (account.parentCode) assert.ok(codes.has(account.parentCode), `${template.key}/${account.code} has a missing parent`)
      if (account.role === 'group') assert.equal(account.statementLine, null)
      else assert.ok(account.statementLine, `${template.key}/${account.code} has no suggested statement line`)
    }
    assert.ok(template.accounts.some(account => account.role === 'group'))
    assert.ok(template.accounts.some(account => account.role === 'control'))
    assert.ok(template.accounts.some(account => account.role === 'posting'))
  }
})

test('synthetic demo uses exact minor units and reset rejects any real-tenant-shaped scope', () => {
  const initial = createSyntheticDemo()
  const changed = addSyntheticReceipt(initial, '9007199254740993')
  assert.equal(initial.organizationId, null)
  assert.equal(changed.accounts.find(account => account.nameKey === 'cash').debitMinor, '9007199267240993')
  assert.deepEqual(resetSyntheticDemo(changed), initial)
  assert.throws(
    () => resetSyntheticDemo({ ...initial, organizationId: 'real-tenant-id' }),
    /DEMO_SCOPE_REQUIRED/,
  )
})

test('demo component has no backend client and template review exposes no apply action', () => {
  const demo = readFileSync(new URL('../../app/components/SyntheticDemo.vue', import.meta.url), 'utf8')
  const templates = readFileSync(new URL('../../app/components/ChartTemplateReview.vue', import.meta.url), 'utf8')
  const checklist = readFileSync(new URL('../../app/composables/useLedgerSetupChecklist.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(demo, /useSupabaseClient|\.from\(|\.rpc\(/)
  assert.doesNotMatch(templates, /useSupabaseClient|applyTemplate|create_account/)
  assert.doesNotMatch(checklist, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/)
  assert.match(templates, /data-chart-template-review/)
})

test('English and Arabic expose every setup, template and demo account label', () => {
  const locale = name => JSON.parse(readFileSync(new URL(`../../i18n/locales/${name}.json`, import.meta.url), 'utf8'))
  const en = locale('en')
  const ar = locale('ar')
  for (const key of ['setupChecklist', 'chartTemplates', 'demo']) {
    assert.ok(en[key])
    assert.ok(ar[key])
  }
  const accountKeys = new Set(reviewedChartTemplates.flatMap(template => template.accounts.map(account => account.nameKey)))
  for (const key of accountKeys) {
    assert.equal(typeof en.chartTemplates.accounts[key], 'string')
    assert.equal(typeof ar.chartTemplates.accounts[key], 'string')
  }
})
