// Extend only the local Docker client proxy exemptions for this owned project.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { billingProfile } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2)
const { owner } = billingProfile()
const directory = process.env.DOCKER_CONFIG || path.join(homedir(), '.docker')
const file = path.join(directory, 'config.json')
const before = existsSync(file) ? readFileSync(file, 'utf8') : '{}'
const config = JSON.parse(before)
assert.ok(config.proxies?.default?.httpProxy && config.proxies?.default?.httpsProxy, 'Preserve managed reachable proxy configuration')
const names = ['db', 'auth', 'storage', 'rest', 'kong', 'inbucket', 'edge_runtime'].map(service => `supabase_${service}_${owner.project}`)
const values = new Set(String(config.proxies.default.noProxy || '').split(',').filter(Boolean))
for (const value of ['127.0.0.1', 'localhost', 'kong', ...names]) values.add(value)
config.proxies.default.noProxy = [...values].join(',')
mkdirSync(directory, { recursive: true, mode: 0o700 })
assert.equal(existsSync(file) ? readFileSync(file, 'utf8') : '{}', before, 'Concurrent config change; inspect instead of overwriting')
writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 }); chmodSync(file, 0o600)
console.log(JSON.stringify({ project: owner.project, added_only_exact_local_service_exemptions: names.length, dedicated_edge_gateway_alias: 'kong', credentials_and_proxy_settings_preserved: true, daemon_changes: false }))
