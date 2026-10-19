import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('.', import.meta.url))
const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8')
const layout = read('../../../../packages/ui/src/templates/BsLandingPage.vue')
const motion = read('../../../../packages/ux/src/composables/useLandingMotion.ts')
const home = read('../../app/pages/index.vue')

// Guards intent and architecture, not a substitute for Playwright screenshot approval.
test('Shop-only cinematic story preserves original pricing and non-Shop fallback', () => {
  assert.match(layout, /v-if="journey"/)
  assert.match(layout, /<BsLandingHero v-else/)
  assert.match(layout, /<BsMarketingPricing/)
  assert.match(layout, /data-journey-stage/)
  assert.match(home, /:journey="journey"/)
})
test('Cinematic beats reflect real POS flow rather than fake functionality', () => {
  for (const beat of ['data-j-device-frame','data-j-customer','data-j-cashier','data-j-pos','data-j-cart','data-j-confirm','data-j-payment','data-j-receipt','data-j-trust']) {
    assert.ok(layout.includes(beat), `Missing ${beat}`)
  }
  assert.match(home, /Open the saved receipt after checkout, then print or share it/)
  assert.match(home, /أطبع|واطبعه/)
  assert.doesNotMatch(home, /AI (assistant|cashier)|loyalty rewards|fraud protection/)
})
test('GSAP is lazy, scoped, scrubbed, reversible, and mobile/reduced-motion safe', () => {
  assert.match(motion, /import\('gsap'\)/)
  assert.match(motion, /import\('gsap\/ScrollTrigger'\)/)
  assert.match(motion, /scrub: 0\.8/)
  assert.match(motion, /pin: stage/)
  assert.match(motion, /mm\.revert\(\)/)
  assert.match(motion, /prefers-reduced-motion: reduce/)
  assert.match(layout, /bs-journey__mobile-story/)
})
