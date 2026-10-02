#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { inspectWorkflowSnapshot, validateControllerReplacements } from '../lib/n8n-workflows.mjs'

const directory = fileURLToPath(new URL('./artifacts/', import.meta.url))
const workflows = readdirSync(directory)
  .filter(file => file.endsWith('.json') && file !== 'manifest.json')
  .sort()
  .map(file => JSON.parse(readFileSync(path.join(directory, file), 'utf8')))
const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'))
const generatorSource = readFileSync(new URL('./generate-replacements.mjs', import.meta.url), 'utf8')
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

const errors = [
  ...validation.errors,
  ...compatibility.findings.map(finding => `compatibility:${finding.code}:${finding.workflow}`),
  ...forbiddenRuntimeOperations.map(operation => `forbidden_runtime_operation:${operation}`),
  ...generatorRuntimeOperations.map(operation => `generator_runtime_operation:${operation}`),
]
if (manifest.runtime_mutation_performed !== false) errors.push('manifest_must_record_no_runtime_mutation')

const result = {
  ok: errors.length === 0,
  errors,
  workflow_count: workflows.length,
  validation,
  compatibility,
  live_runtime_written: false,
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (!result.ok) process.exitCode = 1
