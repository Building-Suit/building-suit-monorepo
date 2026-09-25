#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectWorkflowSnapshot, normalizeWorkflow, workflowGraphSummary } from '../lib/n8n-workflows.mjs'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const outputRoot = path.resolve(repoRoot, process.env.AUTOMATION_N8N_EXPORT_DIR ?? '.local/automation/n8n')
const sourceDirectory = process.argv.includes('--from-directory')
  ? path.resolve(process.argv[process.argv.indexOf('--from-directory') + 1] ?? '')
  : null

function readWorkflows(directory) {
  const files = readdirSync(directory).filter(file => file.endsWith('.json')).sort()
  const workflows = []
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(path.join(directory, file), 'utf8'))
    workflows.push(...(Array.isArray(parsed) ? parsed : [parsed]))
  }
  return workflows
}

async function apiWorkflows() {
  const baseUrl = String(process.env.N8N_API_URL ?? '').replace(/\/$/, '')
  const apiKey = process.env.N8N_API_KEY
  if (!baseUrl || !apiKey) return null
  const workflows = []
  let cursor = null
  do {
    const url = new URL(`${baseUrl}/api/v1/workflows`)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await fetch(url, { headers: { 'X-N8N-API-KEY': apiKey } })
    if (!response.ok) throw new Error(`n8n_api_failed:${response.status}`)
    const page = await response.json()
    workflows.push(...(page.data ?? []))
    cursor = page.nextCursor ?? null
  } while (cursor)
  return workflows
}

function containerWorkflows() {
  const container = process.env.N8N_CONTAINER_NAME ?? 'n8n'
  const containerDirectory = `/tmp/automation-suit-export-${process.pid}`
  const temporaryDirectory = path.join(outputRoot, '.raw')
  rmSync(temporaryDirectory, { recursive: true, force: true })
  mkdirSync(temporaryDirectory, { recursive: true })
  execFileSync('docker', ['exec', container, 'sh', '-lc', `rm -rf '${containerDirectory}' && mkdir -p '${containerDirectory}' && n8n export:workflow --all --separate --output='${containerDirectory}'`], { stdio: 'pipe' })
  execFileSync('docker', ['cp', `${container}:${containerDirectory}/.`, temporaryDirectory], { stdio: 'pipe' })
  execFileSync('docker', ['exec', container, 'rm', '-rf', containerDirectory], { stdio: 'pipe' })
  return readWorkflows(temporaryDirectory)
}

mkdirSync(outputRoot, { recursive: true })
let source = 'directory'
let workflows
if (sourceDirectory) {
  if (!existsSync(sourceDirectory)) throw new Error('n8n_export_directory_not_found')
  workflows = readWorkflows(sourceDirectory)
} else {
  workflows = await apiWorkflows()
  if (workflows) source = 'api'
  else {
    source = 'container-cli'
    workflows = containerWorkflows()
  }
}

const normalized = workflows.map(normalizeWorkflow).sort((a, b) => a.name.localeCompare(b.name))
const snapshot = {
  version: 1,
  exported_at: new Date().toISOString(),
  source,
  workflow_count: normalized.length,
  workflows: normalized,
}
writeFileSync(path.join(outputRoot, 'workflows.normalized.json'), `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 })
writeFileSync(path.join(outputRoot, 'workflows.graph.txt'), `${workflows.map(workflowGraphSummary).join('\n\n')}\n`, { mode: 0o600 })
const inspection = inspectWorkflowSnapshot(normalized)
writeFileSync(path.join(outputRoot, 'recommended-changes.json'), `${JSON.stringify(inspection, null, 2)}\n`, { mode: 0o600 })
rmSync(path.join(outputRoot, '.raw'), { recursive: true, force: true })
process.stdout.write(`${JSON.stringify({ ok: true, output_directory: outputRoot, source, workflow_count: normalized.length, inspection }, null, 2)}\n`)
