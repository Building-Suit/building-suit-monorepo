import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scryptSync, createHash } from 'node:crypto'
const flags = process.argv.slice(2)
if (flags.some(flag => flag !== '--synthetic-ceo-worker') || flags.length > 1) throw new Error('Unknown browser fixture option')
const dir = mkdtempSync(join(tmpdir(), 'hq-browser-'))
const salt = 'a'.repeat(32), password = 'synthetic-browser-password'
const hash = value => createHash('sha256').update(value).digest('hex')
// Explicit test CLI opt-in; the ordinary server never imports or starts this fixture.
const worker = flags.includes('--synthetic-ceo-worker')
  ? (await import('./synthetic-ceo-worker.mjs')).startSyntheticCeoWorker(join(dir, 'hq.sqlite'))
  : undefined
// Synthetic test credentials only; never used by the ordinary runtime.
const child = spawn(process.execPath, ['.output/server/index.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOST: '127.0.0.1', PORT: '4337', HQ_ENVIRONMENT: 'local',
    HQ_BACKEND_SCOPE_VERIFIED: 'false', HQ_HOSTING_COST_VERIFIED: 'false',
    HQ_SUPABASE_URL: '', HQ_SUPABASE_SECRET_KEY: '',
    HQ_APP_ORIGIN: 'http://127.0.0.1:4337', HQ_DATA_PATH: join(dir, 'hq.sqlite'),
    HQ_FOUNDER_PASSWORD_HASH: salt + ':' + scryptSync(password, salt, 64).toString('hex'),
    HQ_CEO_TOKEN_SHA256: hash('synthetic-ceo-token-'.repeat(3)),
    HQ_HR_TOKEN_SHA256: hash('synthetic-hr-token-'.repeat(3)),
  },
})
const childExited = new Promise(resolve => child.once('exit', resolve))
let stopping
function stop(code = 0) {
  if (stopping) return stopping
  stopping = (async () => {
    // Settle the dispatcher and close its SQLite connection before deleting any files.
    const workerClosed = worker?.close()
    child.kill('SIGTERM')
    await childExited
    try { await workerClosed } catch { code = 1 }
    rmSync(dir, { recursive: true, force: true })
    process.exit(code)
  })()
  return stopping
}
process.on('SIGTERM', () => { void stop() }); process.on('SIGINT', () => { void stop() })
child.once('exit', code => { void stop(code ?? 0) })
worker?.done.catch(error => {
  process.stderr.write('[synthetic CEO browser fixture] failed: ' + (error.code || error.name) + '\n')
  void stop(1)
})
