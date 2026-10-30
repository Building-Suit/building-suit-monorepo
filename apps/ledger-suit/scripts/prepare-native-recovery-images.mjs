// Additional pinned gateway/mail images for the owned native recovery drill.
// Starts no service, changes no daemon setting and touches no database volume.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const env = { ...process.env }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
const docker = args => {
  const result = spawnSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env, encoding: 'utf8', timeout: 180_000 })
  assert.equal(result.status, 0, `Docker ${args[0]} failed; native image preparation stopped`)
  return result.stdout.trim()
}
docker(['info', '--format', '{{.ServerVersion}}'])
const providers = []
for (const [tag, digest] of [
  ['kong:2.8.1', 'sha256:e21b0b793879ab96720ed4188f9441260273f4bf775bcbff8d435e019ffb759a'],
  ['mailpit:v1.30.2', 'sha256:f0b0ed33c8cf53aac0dd004abbe245c83420a7ae44914e25178f7791dec5723a'],
]) {
  const source = `public.ecr.aws/supabase/${tag.split(':')[0]}@${digest}`
  docker(['pull', '--platform', 'linux/amd64', source])
  const info = JSON.parse(docker(['image', 'inspect', source]))[0]
  assert.equal(info.Architecture, 'amd64')
  assert.ok(info.RepoDigests.includes(source))
  const local = `ledger.local/supabase/${tag}`
  docker(['image', 'tag', source, local])
  providers.push({ source, local, image_id: info.Id, unmodified: true })
}
// Existing native PostgREST image is the unmodified official v16.1 amd64 image.
const postgrest = 'sha256:eb4951a2f9ac02288100937995af3cb7fb64c296b1228405de5d77ca4dd3410d'
assert.equal(JSON.parse(docker(['image', 'inspect', postgrest]))[0].Id, postgrest)
docker(['image', 'tag', postgrest, 'ledger.local/supabase/postgrest:v16.1'])
providers.push({ source: 'postgrest/postgrest@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d',
  local: 'ledger.local/supabase/postgrest:v16.1', image_id: postgrest, unmodified: true })
const directory = path.join(root, '.local/verification/recovery')
mkdirSync(directory, { recursive: true })
writeFileSync(path.join(directory, 'runtime-image-provenance.json'), `${JSON.stringify({ providers, database_actions: 'none' }, null, 2)}\n`)
console.log('Pinned native gateway/mail/API image cache prepared; no database action.')
