#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { inspectWorkflowSnapshot, validateControllerReplacements } from '../lib/n8n-workflows.mjs'

const directory = fileURLToPath(new URL('./artifacts/', import.meta.url))
const workflows = readdirSync(directory)
  .filter(file => file.endsWith('.json') && file !== 'manifest.json')
  .sort()
  .map(file => JSON.parse(readFileSync(path.join(directory, file), 'utf8')))
const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
const fixture = readFileSync(new URL('./fixtures/live-2026-10-02.json', import.meta.url))
const generatorSource = readFileSync(new URL('./generate-replacements.mjs', import.meta.url), 'utf8')
const acceptanceSources = [
  readFileSync(new URL('../resilience/acceptance.mjs', import.meta.url), 'utf8'),
  readFileSync(new URL('../resilience/run-acceptance.mjs', import.meta.url), 'utf8'),
].join('\n')
const validation = validateControllerReplacements(workflows)
const compatibility = inspectWorkflowSnapshot(workflows)
const serialized = JSON.stringify({ workflows, manifest })
const forbiddenRuntimeOperations = [
  'n8n import:workflow',
  'n8n update:workflow',
  '/api/v1/workflows/',
  'activateWorkflow',
  'deactivateWorkflow',
].filter(operation => serialized.includes(operation))
const generatorRuntimeOperations = [
  [/node:child_process/, 'child_process'],
  [/\bfetch\s*\(/, 'network_fetch'],
  [/n8n\s+(?:import|update):workflow/, 'n8n_cli_mutation'],
  [/\/api\/v1\/workflows\//, 'n8n_api_mutation'],
].filter(([pattern]) => pattern.test(generatorSource)).map(([, operation]) => operation)
const acceptanceRuntimeOperations = [
  [/node:child_process/, 'child_process'],
  [/\bfetch\s*\(/, 'network_fetch'],
  [/n8n\s+(?:import|update):workflow/, 'n8n_cli_mutation'],
  [/\/api\/v1\/workflows\//, 'n8n_api_mutation'],
  [/(?:spawnSync|execFileSync)\s*\(\s*['"](?:psql|supabase)['"]/, 'database_command'],
].filter(([pattern]) => pattern.test(acceptanceSources)).map(([, operation]) => operation)

const errors = [
  ...validation.errors,
  ...compatibility.findings.map(finding => `compatibility:${finding.code}:${finding.workflow}`),
  ...forbiddenRuntimeOperations.map(operation => `forbidden_runtime_operation:${operation}`),
  ...generatorRuntimeOperations.map(operation => `generator_runtime_operation:${operation}`),
  ...acceptanceRuntimeOperations.map(operation => `acceptance_runtime_operation:${operation}`),
]
if (manifest.runtime_mutation_performed !== false) errors.push('manifest_must_record_no_runtime_mutation')
const sha256 = value => createHash('sha256').update(value).digest('hex')
if (manifest.source_snapshot?.sha256 !== sha256(fixture)) errors.push('source_snapshot_digest_mismatch')
for (const replacement of manifest.replacements ?? []) {
  const artifact = path.join(directory, replacement.artifact ?? '')
  try {
    if (replacement.sha256 !== sha256(readFileSync(artifact))) {
      errors.push(`replacement_digest_mismatch:${replacement.artifact}`)
    }
  }
  catch {
    errors.push(`replacement_artifact_missing:${replacement.artifact}`)
  }
}
if (manifest.acceptance_gate?.task_id !== 'CP-RES-009') errors.push('resilience_acceptance_gate_missing')

const result = {
  ok: errors.length === 0,
  errors,
  workflow_count: workflows.length,
  validation,
  compatibility,
  live_runtime_written: false,
  acceptance_runtime_operations: acceptanceRuntimeOperations,
  source_snapshot_sha256: sha256(fixture),
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (!result.ok) process.exitCode = 1
