import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSuitTemplateBoundaries } from '../../../tooling/checks/suit-template-boundaries.mjs'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
test('all existing Suits retain strict zero-native and shared ownership boundaries', async () => {
  const result = await validateSuitTemplateBoundaries({ root, requireStrict: true })
  assert.deepEqual(result.failures, [])
  await import('../../../tooling/checks/workspace.mjs')
  assert.notEqual(process.exitCode, 1, 'workspace ownership checker reported failures')
})
test('shell accepts descriptor inputs without product branches or data access', () => {
  const shell = readFileSync(new URL('../../ui/src/templates/BsAdministrationShell.vue', import.meta.url), 'utf8')
  assert.match(shell, /suits: BsSuitRailItem\[\]/)
  assert.match(shell, /groups: BsContextNavigationGroup\[\]/)
  assert.doesNotMatch(shell, /ledger-suit|shop-suit|inventory-suit|future-suit|supabase/)
})
