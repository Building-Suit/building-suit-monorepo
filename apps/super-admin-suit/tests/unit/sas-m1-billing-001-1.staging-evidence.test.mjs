import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SAS-D013: Owner-deferred manual acceptance, NOT actual paid-payment proof.
const decisionPath = resolve(import.meta.dirname, '../../docs/decisions/SAS-D013-defer-manual-prepublication-acceptance.md')

test('SAS-D013: external manual-payment evidence is DEFERRED, NOT PASSED; engineering checks still required', () => {
  const decision = readFileSync(decisionPath, 'utf8')
  assert.match(decision, /SAS-D013 — No manual external proof before SAS engineering continuation/)
  assert.match(decision, /Status:[*][*] APPROVED by product owner/)
  assert.match(decision, /SAS-M1-BILLING-001/)
  assert.match(decision, /SAS-M1-GATE-001/)
  assert.match(decision, /First-real-payment acceptance:[*][*] PENDING/)
  assert.match(decision, /Automated typecheck, lint, build/)
  assert.match(decision, /Actual Shop payment approval continues to require truthful manual inspection/)
  console.log('SAS-D013: MANUAL EXTERNAL GATE DEFERRED; NO FUNDS CLAIMED; ENGINEERING CHECKS REMAIN REQUIRED')
})
