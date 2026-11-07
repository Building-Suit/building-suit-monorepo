// Production frontend on the fixed owned local UI port; public key only.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { closeSync, existsSync, openSync } from 'node:fs'
import path from 'node:path'
import { billingContext, root, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2)
const c = billingContext()
const entry = path.join(root, 'apps/ledger-suit/.output/server/index.mjs')
assert.ok(existsSync(entry), 'Build the current Ledger app first')
const output = openSync(path.join(c.directory, 'ui.log'), 'w', 0o600)
const child = spawn(process.execPath, [entry], { cwd: root, env: { ...process.env, APP_ENV: 'local', APP_URL: 'http://127.0.0.1:60830', APP_BASE_URL: 'http://127.0.0.1:60830', HOST: '127.0.0.1', PORT: '60830', NITRO_HOST: '127.0.0.1', NITRO_PORT: '60830', NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-ledger-local-auth-token', NUXT_PUBLIC_SUPABASE_URL: c.url, NUXT_PUBLIC_SUPABASE_KEY: c.credentials.anon, SUPABASE_URL: c.url, SUPABASE_KEY: c.credentials.anon }, stdio: ['ignore', output, output] })
writePrivate(path.join(c.directory, 'ui-process.json'), { task: c.owner.task, project: c.owner.project, pid: child.pid, supervisor_pid: process.pid })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (child.exitCode === null && child.signalCode === null) child.kill(signal) })
const [code] = await once(child, 'exit'); closeSync(output)
assert.ok(code === 0 || child.signalCode, 'Inspect owned private UI log')
