import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928210000_migration_center_final_cutover.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/76_migration_center_final_cutover_test.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/migration-center.vue', import.meta.url), 'utf8')
const utility = await readFile(new URL('../../app/utils/migrationCenter.ts', import.meta.url), 'utf8')
const en = JSON.parse(await readFile(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'))
const ar = JSON.parse(await readFile(new URL('../../i18n/locales/ar.json', import.meta.url), 'utf8'))

test('final cutover serializes and delegates to existing trusted commands', () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('migration-final:'/)
  assert.match(migration, /public\.approve_opening_balance_batch/)
  assert.match(migration, /public\.accept_migration_open_items/)
  assert.match(migration, /public\.accept_migration_operational_cutover/)
  assert.match(migration, /unique \(project_id\)/)
  assert.match(databaseTest, /second final approval waits on the project advisory lock/)
  assert.match(databaseTest, /exactly one opening GL effect/)
})

test('approval evidence binds the source revision and remains immutable', () => {
  assert.match(migration, /source_revision_id uuid not null/)
  assert.match(migration, /migration_cutover_approvals_immutable before update or delete/)
  assert.match(migration, /source_archive_unless_separately_migrated/)
  assert.match(migration, /reviewed_reversal_or_replacement_only/)
})

test('Migration Center exposes bilingual resumable and fail-closed review states', () => {
  for (const state of ['complete', 'warning', 'blocked', 'not_applicable']) assert.match(utility, new RegExp(`'${state}'`))
  assert.match(page, /data-migration-progress/)
  assert.match(page, /data-final-review/)
  assert.match(page, /approvalAcknowledged/)
  assert.match(page, /migrationOpenItemsTemplate/)
  assert.match(page, /migrationOperationalTemplate/)
  assert.equal(en.migration.sections.final_review, 'Final Review')
  assert.equal(ar.migration.sections.final_review, 'المراجعة النهائية')
})
