import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const billing = await readFile(new URL('../../app/pages/billing.vue', import.meta.url), 'utf8')
const pricing = await readFile(new URL('../../app/components/ShopPricing.vue', import.meta.url), 'utf8')
const usage = await readFile(new URL('../../app/components/PlanUsageMeter.vue', import.meta.url), 'utf8')
const limits = await readFile(new URL('../../app/components/PlanResourceLimits.vue', import.meta.url), 'utf8')
const quota = await readFile(new URL('../../app/utils/planQuotaError.ts', import.meta.url), 'utf8')

test('owner billing uses the canonical purchasable catalog and effective server quote', () => {
  assert.match(billing, /usePlans\(\)/)
  assert.match(billing, /publicCatalogTerms/)
  assert.match(billing, /p_requested_catalog_terms_id: plan\.catalogTermsId/)
  assert.match(billing, /effectivePriceAmount/)
  assert.match(billing, /priceSource === 'override'/)
  assert.doesNotMatch(billing, /349|699|1099/)
  assert.match(pricing, /usePlans\(\)/)
  assert.match(pricing, /family\.some\(plan => plan\.is_purchasable && !plan\.is_coming_soon\)/)
  assert.match(pricing, /v-for="family in families"/)
  assert.match(pricing, /pricing\.notes\.allPlansIncludeFreeTrial/)
  assert.doesNotMatch(pricing, /query: \{ plan: plan\.slug \}|pricing\.trial/)
})

test('all six quota resources have concise comparison and usage states', () => {
  for (const resource of ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers']) {
    assert.match(limits, new RegExp(resource))
    assert.match(billing, new RegExp(resource))
  }
  assert.match(usage, /ratio\.value >= 80/)
  assert.match(usage, /data-usage-state/)
  assert.match(usage, /role="progressbar"/)
})

test('downgrades and manual payment requests communicate their safety boundary', () => {
  assert.match(billing, /plan\.blockers\.length/)
  assert.match(billing, /You can select this plan and submit its payment notice now/)
  assert.match(billing, /All resources and data stay saved/)
  assert.match(billing, /Nothing is automatically deleted or archived/)
  assert.match(billing, /unavailable for new or active use until you reduce usage or upgrade the plan/)
  assert.match(billing, /تظل كل الموارد والبيانات محفوظة/)
  assert.match(billing, /لن يُحذف أو يُؤرشف أي شيء تلقائيًا/)
  assert.doesNotMatch(billing, /:disabled="plan\.blockers\.length > 0"/)
  assert.doesNotMatch(billing, /!plan \|\| plan\.blockers\.length/)
  assert.match(billing, /Your access will not change until an operator approves it/)
  assert.match(billing, /confirmation\.ask/)
  assert.match(billing, /submitted: 'Submitted for manual review/)
  assert.match(billing, /under_review: 'An operator is reviewing/)
  assert.match(billing, /approved: 'This request was approved/)
  assert.match(billing, /rejected: 'This request was rejected/)
})

test('quota errors identify the resource and safe owner actions', () => {
  assert.match(quota, /PRODUCT_LIMIT_REACHED/)
  assert.match(quota, /PLAN_RESOURCE_LIMIT_REACHED/)
  assert.match(quota, /Archive or deactivate something unused/)
  assert.match(quota, /Nothing will be deleted automatically/)
  assert.match(quota, /الاشتراك والفوترة/)
})
