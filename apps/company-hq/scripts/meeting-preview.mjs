#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSyntheticMeetingRepository } from '../server/meetings/repository.mjs'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const app = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const pathIndex = args.indexOf('--database')
const database = pathIndex >= 0 ? args[pathIndex + 1] : resolve(root, '.local/hq-meeting-demo/meetings.sqlite')
const portIndex = args.indexOf('--port')
const port = portIndex >= 0 ? args[portIndex + 1] : '3101'
if (!database || !isAbsolute(database) || !/^\d{4,5}$/.test(port) || Number(port) > 65535) throw new Error('Use an absolute disposable database and valid local port')
mkdirSync(resolve(database, '..'), { recursive: true, mode: 0o700 })
// Establish schema before independent processes contend for their first lease.
createSyntheticMeetingRepository({ filename: database, synthetic: true }).close()
const env = { ...process.env, NUXT_HQ_MEETINGS_DEMO: 'true', NUXT_HQ_MEETINGS_DEMO_DATABASE: database, NUXT_HQ_MEETINGS_LIVE: 'false' }
// The isolated preview has no reason to contact live Auth, Brain or model APIs.
for (const key of Object.keys(env)) if (/^NUXT_HQ_(?:SUPABASE|BRAIN_GOOGLE)/.test(key)) env[key] = ''
const children = [
  spawn(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--host', '127.0.0.1', '--port', port], { cwd: app, env, stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/meeting-worker.mjs', '--synthetic', '--watch', '--database', database], { cwd: app, env, stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/meeting-reviewer.mjs', '--synthetic', '--watch', '--database', database], { cwd: app, env, stdio: 'inherit' }),
]
let stopping = false
function stop() { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM') }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
for (const child of children) child.on('exit', code => { if (code && !stopping) { process.exitCode = code; stop() } })
console.log(`Synthetic HQ preview on this host: http://127.0.0.1:${port}. Fixture workers run for at most 30 minutes; no live provider is enabled.`)
