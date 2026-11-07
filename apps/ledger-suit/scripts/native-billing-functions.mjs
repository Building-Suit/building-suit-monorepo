// Serve unchanged Edge handlers only in this owned local project.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { homedir } from 'node:os'
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { billingContext, readJson, root, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2, 'Accepts no connection or credential')
const context = billingContext()
const { directory, docker, env, credentials } = context
const provenance = readJson(path.join(directory, 'edge-image-provenance.json'))
assert.equal(provenance.source, 'public.ecr.aws/supabase/edge-runtime@sha256:cc355c3d0e9c063a351cad56d1c4c52a3c4d85aff4e1fad9d91688e75f9aad09')
assert.equal(JSON.parse(docker(['image', 'inspect', provenance.local]))[0].Id, provenance.image_id)
assert.equal(provenance.filesystem_and_process_match, true)
for (const route of ['/auth/v1/health', '/storage/v1/status', '/rest-admin/v1/ready']) assert.equal((await fetch(context.url + route, { headers: { apikey: credentials.anon }, signal: AbortSignal.timeout(5000) })).status, 200)
const cert = Buffer.concat([readFileSync('/etc/ssl/certs/ca-certificates.crt'), Buffer.from('\n'), process.env.CODEX_PROXY_CERT ? readFileSync(process.env.CODEX_PROXY_CERT) : Buffer.alloc(0)])
assert.match(cert.toString(), /-----BEGIN CERTIFICATE-----/)
writeFileSync(path.join(directory, 'supabase/functions/_shared/session-proxy-ca.pem'), cert, { mode: 0o644 })
const envFile = path.join(directory, 'edge.env')
const mountedCert = path.join(directory, 'supabase/functions/_shared/session-proxy-ca.pem')
const dockerConfig = readJson(path.join(process.env.DOCKER_CONFIG || path.join(homedir(), '.docker'), 'config.json'))
const exemptions = [...new Set(String(dockerConfig.proxies.default.noProxy).split(',').concat('kong'))].join(',')
writePrivate(envFile, `DENO_CERT=${mountedCert}\nSSL_CERT_FILE=${mountedCert}\nDENO_TLS_CA_STORE=mozilla,system\nNO_PROXY=${exemptions}\nno_proxy=${exemptions}\n`)
const output = openSync(path.join(directory, 'functions.log'), 'w', 0o600)
const child = spawn('pnpm', ['exec', 'supabase', '--workdir', directory, 'functions', 'serve', '--env-file', envFile], { cwd: root, env, stdio: ['ignore', output, output] })
writePrivate(path.join(directory, 'functions-process.json'), { task: 'LS-BILL-NATIVE-001', project: context.owner.project, pid: child.pid, supervisor_pid: process.pid })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (child.exitCode === null && child.signalCode === null) child.kill(signal) })
const [code] = await once(child, 'exit')
closeSync(output)
assert.ok(code === 0 || child.signalCode, 'Inspect owned private function log; no credential output')
