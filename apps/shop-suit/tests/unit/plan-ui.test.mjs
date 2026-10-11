import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const billing = await readFile(new URL('../../app/pages/billing.vue', import.meta.url), 'utf8')
const pricing = await readFile(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
const cards = await readFile(new URL('../../app/composables/useShopPlanPresentation.ts', import.meta.url), 'utf8')
const usage = await readFile(new URL('../../app/composables/useShopUsagePresentation.ts', import.meta.url), 'utf8')
const awaitSharedUsage = await readFile(new URL('../../../../packages/ui/src/molecules/BsUsageMeter.vue', import.meta.url), 'utf8')
const quota = await readFile(new URL('../../app/utils/planQuotaError.ts', import.meta.url), 'utf8')

test('inventory and purchase access notices describe subscription access in both locales', async () => {
  for (const page of ['inventory', 'purchases']) {
    const source = await readFile(new URL(`../../app/pages/${page}/index.vue`, import.meta.url), 'utf8')
    assert.match(source, /require an active subscription with inventory access\./)
    assert.match(source, /تتطلب اشتراكًا نشطًا يتيح إدارة المخزون\./)
    assert.doesNotMatch(source, /\b(?:Basic|Pro)\b/)
  }
})

test('owner billing uses the canonical purchasable catalog and effective server quote', () => {
  assert.match(billing, /usePlans\(\)/)
  assert.match(billing, /publicCatalogTerms/)
  assert.match(billing, /p_requested_catalog_terms_id: plan\.catalogTermsId/)
  assert.match(billing, /effectivePriceAmount/)
  assert.match(billing, /priceSource === 'override'/)
  assert.doesNotMatch(billing, /349|699|1099/)
  assert.match(pricing, /usePlans\(\)/)
  assert.match(pricing, /plan\.is_purchasable && !plan\.is_coming_soon/)
  assert.match(pricing, /<BsMarketingPricing/)
  assert.match(pricing, /pricing\.notes\.allPlansIncludeFreeTrial/)
  assert.doesNotMatch(pricing, /2847\.84|5703\.84|8151\.84|9783\.84/)
  assert.match(cards, /familyOrder = \['solo', 'team', 'multi'\]/)
  assert.match(cards, /offer\.effectivePriceAmount/)
  assert.match(cards, /monthlyOffer\(offer\)\?\.listPriceAmount/)
  assert.match(cards, /offer\.effectivePriceAmount \/ 12/)
  assert.doesNotMatch(pricing, /query: \{ plan: plan\.slug \}|pricing\.trial/)
})

test('plan cards expose Ledger-style term and Multi variant controls accessibly', () => {
  assert.match(billing, /<BsMarketingPricing/)
  assert.doesNotMatch(cards, /<article\b/)
  assert.doesNotMatch(cards, /<fieldset\b/)
  assert.match(billing, /value: 'monthly'/)
  assert.match(billing, /value: 'annual'/)
  assert.match(cards, /multi_2/)
  assert.match(cards, /multi_3/)
  assert.match(cards, /yearlyOriginal/)
  assert.match(cards, /yearlyDiscount/)
  assert.match(cards, /Founder \/ negotiated price/)
  assert.match(cards, /Public list price/)
})

test('all six quota resources have concise comparison and usage states', () => {
  for (const resource of ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers']) {
    assert.match(cards, new RegExp(resource))
    assert.match(billing, new RegExp(resource))
  }
  assert.match(usage, /ratio >= 80/)
  assert.match(usage, /valueLabel, status/)
  assert.match(awaitSharedUsage, /role="progressbar"/)
})

test('downgrades and manual payment requests communicate their safety boundary', () => {
  assert.match(cards, /offer\.blockers\.length/)
  assert.match(cards, /All data stays saved/)
  assert.match(cards, /cannot be used for new activity until you reduce usage or upgrade the plan/)
  assert.match(cards, /Nothing is deleted or archived automatically/)
  assert.match(cards, /تظل كل البيانات محفوظة/)
  assert.match(cards, /لن يُحذف أو يُؤرشف أي شيء تلقائيًا/)
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
