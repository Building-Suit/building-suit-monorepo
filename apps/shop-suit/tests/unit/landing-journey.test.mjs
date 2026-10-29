import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const layout = read('../../../../packages/ui/src/templates/BsLandingPage.vue')
const journey = read('../../../../packages/ui/src/organisms/BsShopLandingJourney.vue')
const motion = read('../../../../packages/ux/src/composables/useLandingMotion.ts')
const home = read('../../app/pages/index.vue')

// Guards intent and architecture, not a substitute for Playwright screenshot approval.
test('Shop-only cinematic story preserves original pricing and non-Shop fallback', () => {
  assert.match(layout, /v-if="journey"/)
  assert.match(layout, /<BsLandingHero v-else/)
  assert.match(layout, /<BsMarketingPricing/)
  assert.match(journey, /data-journey-stage/)
  assert.match(home, /:journey="journey"/)
})
test('Cinematic beats reflect real POS flow rather than fake functionality', () => {
  for (const beat of ['data-j-device','data-j-pos','data-j-cart-item','data-j-method','data-j-confirmation','data-j-receipt-view','data-j-sales-nav','data-j-dashboard-nav']) {
    assert.ok(journey.includes(beat), `Missing ${beat}`)
  }
  assert.match(home, /A saved receipt with the item, payment and staff details/)
  assert.match(home, /ابدأ الطباعة من المتصفح أو شارك صورة الإيصال/)
  assert.doesNotMatch(home, /AI (assistant|cashier)|loyalty rewards|fraud protection/)
})
test('GSAP is lazy, scoped, scrubbed, reversible, and mobile/reduced-motion safe', () => {
  assert.match(motion, /import\('gsap'\)/)
  assert.match(motion, /import\('gsap\/ScrollTrigger'\)/)
  assert.match(motion, /scrub: desktop \? [0-9.]+ : [0-9.]+/)
  assert.match(motion, /pin: stage/)
  assert.match(motion, /mm\.revert\(\)/)
  assert.match(motion, /prefers-reduced-motion: reduce/)
  assert.match(journey, /journey.chapters/); assert.match(layout, /noscript/)
})
