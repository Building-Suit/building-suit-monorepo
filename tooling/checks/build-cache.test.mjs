import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))

test('Turbo restores Nuxt server and Vercel deployment artifacts without rebuilding or caching project secrets', async t => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'nuxt-build-cache-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const workspace = path.join(temporary, 'workspace')
  const app = path.join(workspace, 'apps/fixture')
  const counter = path.join(temporary, 'build-count')
  const cache = path.join(temporary, 'cache')
  await mkdir(app, { recursive: true })
  const configuration = JSON.parse(await readFile(path.join(root, 'turbo.json'), 'utf8'))
  await writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'cache-fixture', private: true, packageManager: 'pnpm@10.33.0' }))
  await writeFile(path.join(workspace, '.gitignore'), '.turbo/\n.output/\n.vercel/\n')
  await writeFile(path.join(workspace, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
  await writeFile(path.join(workspace, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  apps/fixture: {}\n")
  await writeFile(path.join(workspace, 'turbo.json'), JSON.stringify({ tasks: { build: { outputs: configuration.tasks.build.outputs } } }))
  await writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'nuxt-cache-fixture', private: true, scripts: { build: 'node build.mjs' } }))
  const artifacts = {
    '.output/server/index.mjs': 'export default "server"\n',
    '.vercel/output/config.json': '{"version":3}\n',
    '.vercel/output/functions/__fallback.func/index.mjs': 'export default "function"\n',
    '.vercel/output/static/_nuxt/app.js': 'console.log("fixture")\n',
  }
  const privateFiles = { '.vercel/project.json': '{"projectId":"synthetic"}', '.vercel/.env.test.local': 'SYNTHETIC_ONLY=not-a-secret' }
  await writeFile(path.join(app, 'build.mjs'), `
import { mkdir, writeFile, appendFile } from 'node:fs/promises'
import path from 'node:path'
await appendFile(${JSON.stringify(counter)}, 'build\\n')
for (const [file, bytes] of Object.entries(${JSON.stringify({ ...artifacts, ...privateFiles })})) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, bytes)
}
`)
  const run = () => {
    const result = spawnSync(path.join(root, 'node_modules/.bin/turbo'), ['run', 'build', '--cache=local:rw', `--cache-dir=${cache}`], {
      cwd: workspace, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' },
    })
    assert.ifError(result.error)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    return result.stdout
  }
  const verifyArtifacts = async () => {
    for (const [file, bytes] of Object.entries(artifacts)) assert.equal(await readFile(path.join(app, file), 'utf8'), bytes, file)
  }
  const removeOutputs = () => Promise.all(['.output', '.vercel'].map(directory => rm(path.join(app, directory), { recursive: true, force: true })))

  assert.match(run(), /cache miss/)
  await verifyArtifacts()
  await removeOutputs()
  assert.match(run(), /cache hit/)
  assert.equal(await readFile(counter, 'utf8'), 'build\n', 'a cache hit must restore artifacts without executing the build')
  await verifyArtifacts()
  for (const file of Object.keys(privateFiles)) await assert.rejects(access(path.join(app, file)), { code: 'ENOENT' })

  await removeOutputs()
  await rm(cache, { recursive: true, force: true })
  assert.match(run(), /cache miss/)
  assert.equal(await readFile(counter, 'utf8'), 'build\nbuild\n')
  await verifyArtifacts()
})
