import { readFile } from 'node:fs/promises'
import { requireDisposable, sql, suites } from './local-backend.mjs'

try {
  requireDisposable()
  for (const suite of suites) {
    const source = await readFile(new URL(`../../supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
    try {
      sql(`BEGIN;\n${source.replace(/\bshop_crm\b/g, 'public')}\nROLLBACK;`)
    } catch {
      throw new Error(`${suite}: failed; rerun this rollback-only fixture locally to inspect the SQL error. No migration/reset was attempted.`)
    }
    console.log(`${suite}: passed; fixtures rolled back`)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
