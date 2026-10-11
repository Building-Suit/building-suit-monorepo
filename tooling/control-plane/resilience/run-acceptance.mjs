#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderResilienceReport, runResilienceAcceptance } from './acceptance.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const artifactRoot = path.join(root, 'n8n/artifacts')
const reportRoot = path.join(root, 'resilience/reports')
const checkOnly = process.argv.includes('--check')
const workflows = readdirSync(artifactRoot)
  .filter(file => file.endsWith('.json') && file !== 'manifest.json')
  .sort()
  .map(file => JSON.parse(readFileSync(path.join(artifactRoot, file), 'utf8')))
const manifest = JSON.parse(readFileSync(path.join(artifactRoot, 'manifest.json'), 'utf8'))
const baselinePath = path.join(root, 'n8n/fixtures/live-2026-10-02.json')
const baselineFixture = readFileSync(baselinePath)
const report = runResilienceAcceptance({
  workflows,
  manifest,
  baselineFixture,
  baselineFixtureAfter: readFileSync(baselinePath),
})
const outputs = new Map([
  ['cutover-readiness.json', `${JSON.stringify(report, null, 2)}\n`],
  ['cutover-readiness.md', renderResilienceReport(report)],
])

if (checkOnly) {
  for (const [file, expected] of outputs) {
    const target = path.join(reportRoot, file)
    if (!existsSync(target) || readFileSync(target, 'utf8') !== expected) {
      throw new Error(`resilience_report_out_of_date:${file}`)
    }
  }
} else {
  mkdirSync(reportRoot, { recursive: true })
  for (const [file, contents] of outputs) writeFileSync(path.join(reportRoot, file), contents)
}

process.stdout.write(`${JSON.stringify({ ok: report.harness_ready, deployed_cutover_ready:report.cutover_ready, check: checkOnly, summary: report.summary, reports: [...outputs.keys()] }, null, 2)}\n`)
if (!report.harness_ready) process.exitCode = 1
