// Local verification image preparation only. Never starts or resets a database.
import { spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, writeFile, open, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const directory = path.join(root, '.local/ledger-native-images')
const crane = process.env.LEDGER_CRANE_BINARY || 'crane'
const postgresDigest = 'sha256:fc542c31f334749adbbd3c9e16b6be90f17d0fe6460d5196066d73f2723c9ecf'
const postgresRef = `docker.io/supabase/postgres@${postgresDigest}`
const postgresTag = 'ledger.local/supabase/postgres:17.6.1.165'
const providers = [
  ['realtime:v2.129.3', 'sha256:3211f8ebd59edcd0aa772186f1c8249c82c6b1ae5565f40dedb7aa93e951fe37'],
  ['gotrue:v2.196.0', 'sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232'],
  ['storage-api:v1.70.3', 'sha256:528ec49c3c32561908b07ee91bced7f8456f3b688164e341eaa422441767a0bd'],
]
const dockerEnv = { ...process.env }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key]

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 8 * 1024 * 1024, ...options })
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed; image preparation stopped (exit ${result.status ?? 'unavailable'})`)
  return result.stdout.trim()
}
const docker = args => run('docker', ['--host=unix:///var/run/docker.sock', ...args], { env: dockerEnv })
const inspect = tag => JSON.parse(docker(['image', 'inspect', tag]))[0]
const environment = values => Object.fromEntries((values ?? []).map(value => value.split(/=(.*)/s).slice(0, 2)).sort(([a], [b]) => a.localeCompare(b)))
function verifyConfig(expected, actual) {
  for (const key of ['Entrypoint', 'Cmd', 'WorkingDir', 'User', 'ExposedPorts', 'Volumes', 'StopSignal']) {
    if (JSON.stringify(expected[key] || null) !== JSON.stringify(actual[key] || null)) throw new Error(`Database image ${key} differs from its pinned source`)
  }
  if (JSON.stringify(environment(expected.Env)) !== JSON.stringify(environment(actual.Env))) throw new Error('Database image environment differs from its pinned source')
}
async function digest(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return `sha256:${hash.digest('hex')}`
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Prepare pinned native Ledger SQL verification images on the local Docker socket. Requires crane v0.20.7. Starts no services and accepts no hosted connection. See apps/ledger-suit/docs/native-financial-verification.md.')
    return
  }
  if (process.argv.length !== 2 || process.platform !== 'linux' || process.arch !== 'x64') throw new Error('This bounded preparation supports Linux amd64 only and accepts no arguments')
  if (run(crane, ['version']).replace(/^v/, '') !== '0.20.7') throw new Error('Use the checksum-verified crane v0.20.7 release')
  docker(['info', '--format', '{{.ServerVersion}}'])
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const config = JSON.parse(run(crane, ['config', postgresRef])).config
  const archive = path.join(directory, 'postgres.tar')
  const filesystem = path.join(directory, 'postgres-rootfs.tar')
  run(crane, ['pull', '--cache_path', path.join(directory, 'layers'), postgresRef, archive])
  const input = await open(archive, 'r')
  try { run(crane, ['export', '-', filesystem], { stdio: [input.fd, 'pipe', 'pipe'] }) }
  finally { await input.close() }
  const filesystemDigest = await digest(filesystem)
  const changes = []
  for (const key of ['Entrypoint', 'Cmd']) if (config[key]) changes.push(`${key.toUpperCase()} ${JSON.stringify(config[key])}`)
  for (const item of config.Env ?? []) {
    const separator = item.indexOf('=')
    changes.push(`ENV ${item.slice(0, separator)}=${JSON.stringify(item.slice(separator + 1))}`)
  }
  for (const [key, instruction] of [['WorkingDir', 'WORKDIR'], ['User', 'USER'], ['StopSignal', 'STOPSIGNAL']]) if (config[key]) changes.push(`${instruction} ${config[key]}`)
  for (const port of Object.keys(config.ExposedPorts ?? {})) changes.push(`EXPOSE ${port}`)
  for (const volume of Object.keys(config.Volumes ?? {})) changes.push(`VOLUME ${JSON.stringify([volume])}`)
  changes.push(`LABEL ledger.verification.source=${postgresDigest}`)
  docker(['image', 'import', ...changes.flatMap(change => ['--change', change]), filesystem, postgresTag])
  const image = inspect(postgresTag)
  verifyConfig(config, image.Config)
  if (image.RootFS.Layers.length !== 1 || image.RootFS.Layers[0] !== filesystemDigest) throw new Error('Imported database filesystem digest differs')
  const evidence = {
    postgres: { source: postgresRef, local_tag: postgresTag, image_id: image.Id, filesystem_digest: filesystemDigest, process_and_environment_match: true,
      image_healthcheck_copied: false, healthcheck: 'Supabase CLI supplies the container healthcheck' },
    providers: [],
  }
  // Provider schemas are initialized by the real CLI/provider migration jobs.
  // These images are not flattened or replaced with SQL/provider shims.
  for (const [name, sourceDigest] of providers) {
    const repository = name.split(':')[0]
    const source = `docker.io/supabase/${repository}@${sourceDigest}`
    docker(['pull', source])
    const tag = `ledger.local/supabase/${name}`
    docker(['tag', source, tag])
    evidence.providers.push({ source, local_tag: tag, image_id: inspect(tag).Id })
  }
  await writeFile(path.join(directory, 'provenance.json'), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  await unlink(filesystem)
  console.log('Pinned native database/provider images prepared. No database was started or reset. Provenance: .local/ledger-native-images/provenance.json')
}

try { await main() }
catch (error) { console.error(error.message); process.exitCode = 1 }
