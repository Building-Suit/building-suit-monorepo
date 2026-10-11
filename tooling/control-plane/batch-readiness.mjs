#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildBatchAdmissionReport,
  buildGuardedRolloutPackage,
} from './lib/batch-readiness.mjs'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const [action, evidencePath, registryPath, outputPath] = process.argv.slice(2)

if (!['report', 'rollout'].includes(action) || !evidencePath) {
  process.stderr.write('usage: node tooling/control-plane/batch-readiness.mjs <report|rollout> <evidence.json> [registry-patch.json]\n')
  process.exit(64)
}

const rawEvidence = readFileSync(path.resolve(evidencePath))
const evidence = JSON.parse(rawEvidence)
const registry = registryPath ? JSON.parse(readFileSync(path.resolve(registryPath), 'utf8')) : {}
const report = buildBatchAdmissionReport({ evidence, rawEvidence, registry, repositoryRoot: repoRoot })
const result = action === 'rollout' ? buildGuardedRolloutPackage(report) : report

const serialized = `${JSON.stringify(result, null, 2)}\n`
if (outputPath) writeFileSync(path.resolve(outputPath), serialized, { mode:0o600 })
process.stdout.write(outputPath
  ? `${JSON.stringify({ ok:report.evidence.valid,action,output:path.resolve(outputPath),release:report.release.status },null,2)}\n`
  : serialized)
if (!report.evidence.valid) process.exitCode = 1
