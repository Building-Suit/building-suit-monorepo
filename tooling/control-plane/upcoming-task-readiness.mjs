#!/usr/bin/env node
// Generates a review artifact only. No database connector or run launcher is used.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildReconciliation } from './lib/upcoming-task-reconciliation.mjs'
const root = new URL('../../', import.meta.url)
const file = name => new URL(`docs/shared/upcoming-task-readiness.${name}.json`, root)
const read = name => JSON.parse(readFileSync(file(name), 'utf8'))
const report = buildReconciliation(read('snapshot'), read('configuration'), { applied: existsSync(file('applied')) ? read('applied') : null })
const output = file('reconciliation')
const serialized = JSON.stringify(report, null, 2) + '\n'
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== serialized) throw new Error('stale_reconciliation_artifact')
} else writeFileSync(output, serialized)
console.log(JSON.stringify({ artifact: fileURLToPath(output), live_applied: report.status === 'APPLIED_METADATA_ONLY', tasks: report.changes.length, obligations_classified: report.plans.ready, first_n: report.first_n_after }))
