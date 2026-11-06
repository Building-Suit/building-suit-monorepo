#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// The real room reuses HQ's configured Auth/database and the existing remote
// worker. The isolated synthetic preview has its own separate launcher.
const app = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const portIndex = args.indexOf('--port')
const port = portIndex < 0 ? '3101' : args[portIndex + 1]
if (!/^\d{4,5}$/.test(port ?? '') || Number(port) > 65535) throw new Error('Choose a valid local port')
const child = spawn(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--host', '127.0.0.1', '--port', port], {
  cwd: app,
  env: { ...process.env, NUXT_HQ_MEETINGS_LIVE: 'true', NUXT_HQ_MEETINGS_DEMO: 'false' },
  stdio: 'inherit',
})
let stopping = false
function stop() { if (!stopping) { stopping = true; child.kill('SIGTERM') } }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? (stopping ? 0 : 1) })
console.log(`HQ meeting room: http://127.0.0.1:${port}. Sign in with your existing HQ account. Meeting database setup and a compatible remote worker are required.`)
