// Exempt only owned local service DNS names from the managed Docker HTTP proxy.
// Preserve the proxy URLs, Docker selector and every credential/config entry.
import assert from 'node:assert/strict'
import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

assert.equal(process.env.LEDGER_RECOVERY_DISPOSABLE_TEST, '1')
const configPath = path.join(process.env.DOCKER_CONFIG || path.join(homedir(), '.docker'), 'config.json')
const original = readFileSync(configPath, 'utf8')
const config = JSON.parse(original)
const proxy = config.proxies?.default
if (proxy) {
  assert.ok(proxy.noProxy === undefined || typeof proxy.noProxy === 'string')
  const current = (proxy.noProxy || '').split(',').map(value => value.trim()).filter(Boolean)
  const additions = ['localhost', '127.0.0.1', '::1', ...['source', 'target'].flatMap(role =>
    ['kong', 'auth', 'rest', 'storage', 'inbucket', 'db'].map(service => `supabase_${service}_ledger-recovery-${role}-20261023`))]
  proxy.noProxy = [...new Set([...current, ...additions])].join(',')
  assert.equal(readFileSync(configPath, 'utf8'), original, 'Docker configuration changed concurrently; inspect before retrying')
  const temporary = `${configPath}.ledger-recovery-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: statSync(configPath).mode & 0o777, flag: 'wx' })
  renameSync(temporary, configPath)
  console.log('Owned local recovery DNS exemptions added; external proxy and credentials preserved.')
} else console.log('No Docker default HTTP proxy is configured; no network configuration changed.')
