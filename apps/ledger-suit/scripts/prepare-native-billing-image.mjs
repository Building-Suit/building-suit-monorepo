// Exact official image filesystem/process import for the managed vfs driver.
// Avoid retaining cumulative copies of every upstream layer; no database action.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createReadStream, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { billingProfile, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2)
const { directory, docker, env } = billingProfile()
const crane = process.env.LEDGER_CRANE_BINARY || 'crane'
const run = args => {
  const result = spawnSync(crane, args, { env, encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024 })
  assert.equal(result.status, 0, 'Pinned image read/export failed; no service started')
  return result.stdout.trim()
}
assert.equal(run(['version']).replace(/^v/, ''), '0.20.7')
const source = 'public.ecr.aws/supabase/edge-runtime@sha256:cc355c3d0e9c063a351cad56d1c4c52a3c4d85aff4e1fad9d91688e75f9aad09'
const expected = JSON.parse(run(['config', source])).config
const archive = path.join(directory, 'edge-rootfs.tar')
run(['export', source, archive])
const hash = createHash('sha256')
for await (const chunk of createReadStream(archive)) hash.update(chunk)
const filesystem = `sha256:${hash.digest('hex')}`
const changes = []
for (const key of ['Entrypoint', 'Cmd']) if (expected[key]) changes.push(`${key.toUpperCase()} ${JSON.stringify(expected[key])}`)
for (const item of expected.Env || []) { const at = item.indexOf('='); changes.push(`ENV ${item.slice(0, at)}=${JSON.stringify(item.slice(at + 1))}`) }
for (const [key, instruction] of [['WorkingDir', 'WORKDIR'], ['User', 'USER'], ['StopSignal', 'STOPSIGNAL']]) if (expected[key]) changes.push(`${instruction} ${expected[key]}`)
for (const port of Object.keys(expected.ExposedPorts || {})) changes.push(`EXPOSE ${port}`)
for (const volume of Object.keys(expected.Volumes || {})) changes.push(`VOLUME ${JSON.stringify([volume])}`)
const local = 'ledger.local/supabase/edge-runtime:v1.74.3'
docker(['image', 'import', ...changes.flatMap(change => ['--change', change]), archive, local], { timeout: 180_000 })
const info = JSON.parse(docker(['image', 'inspect', local]))[0]
assert.equal(info.Architecture, 'amd64')
assert.deepEqual(info.RootFS.Layers, [filesystem])
for (const key of ['Entrypoint', 'Cmd', 'WorkingDir', 'User', 'StopSignal', 'ExposedPorts', 'Volumes']) assert.deepEqual(info.Config[key] || null, expected[key] || null, `Process configuration differs: ${key}`)
const environment = list => Object.fromEntries((list || []).map(value => value.split(/=(.*)/s).slice(0, 2)))
assert.deepEqual(environment(info.Config.Env), environment(expected.Env))
writePrivate(path.join(directory, 'edge-image-provenance.json'), { source, local, image_id: info.Id, source_filesystem_sha256: filesystem, filesystem_and_process_match: true, source_healthcheck_copied: false, database_actions: 'none' })
unlinkSync(archive)
console.log(JSON.stringify({ source, local, image_id: info.Id, filesystem_and_process_match: true }))
