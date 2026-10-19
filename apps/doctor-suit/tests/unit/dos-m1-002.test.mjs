import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatePlatform } from '../../../../tooling/new-platform/generate.mjs'
import { assertLocalFixtureEnvironment } from '../e2e/safety.mjs'
import { workspaceGraphAt } from '../../../../tooling/releases/candidate.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const app = path.join(root, 'apps/doctor-suit')
const json = async file => JSON.parse(await readFile(file, 'utf8'))

test('DOS-M1-002-C01: recorded generator inventory matches a disposable dry run and generation', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'doctor-starter-'))
  try {
    await writeFile(path.join(fixture, 'package.json'), await readFile(path.join(root, 'package.json')))
    await mkdir(path.join(fixture, 'docs/shared'), { recursive: true })
    await writeFile(path.join(fixture, 'docs/shared/atomic-template-route-inventory.json'), await readFile(path.join(root, 'docs/shared/atomic-template-route-inventory.json')))
    const input = { slug: 'doctor-suit', title: 'Doctor Suit', root: fixture }
    const dryRun = await generatePlatform({ ...input, dryRun: true })
    const generated = await generatePlatform(input)
    assert.deepEqual(generated, dryRun)
    const receipt = await json(path.join(root, 'docs/work-packages/doctor-suit/scaffold-generation.json'))
    assert.equal(receipt.dry_run, true)
    assert.deepEqual(dryRun.map(file => file.replace('apps/doctor-suit/', '')).sort(), receipt.files)
    for (const file of dryRun) assert.ok((await readFile(path.join(fixture, file))).length)
  } finally { await rm(fixture, { recursive: true, force: true }) }
})

test('DOS-M1-002-C03: blank environment and isolated manifest retain shared runtime ownership', async () => {
  const manifest = await json(path.join(app, 'package.json'))
  assert.equal(manifest.name, '@building-suit/doctor-suit')
  assert.equal(manifest.dependencies['@building-suit/nuxt-layer'], 'workspace:*')
  assert.equal(manifest.dependencies.nuxt, (await json(path.join(root, 'package.json'))).devDependencies.nuxt)
  for (const line of (await readFile(path.join(app, '.env.example'), 'utf8')).split('\n').filter(line => line && !line.startsWith('#'))) assert.match(line, /^[A-Z_]+=$/)
  for (const file of ['AGENTS.md', 'README.md', 'tests/e2e/playwright.config.ts']) assert.ok((await readFile(path.join(app, file))).length)
})

test('DOS-M1-002-C04: app Git deployments are restricted to protected branches', async () => {
  const config = await json(path.join(app, 'vercel.json'))
  assert.deepEqual(config.git.deploymentEnabled, { '**': false, stg: true, main: true })
})

test('DOS-M1-002-C05: fixture harness rejects remote, credentialed and ambiguous backend targets', () => {
  for (const value of ['https://example.supabase.co', 'http://127.0.0.1.evil.test:65321', 'http://user:password@127.0.0.1:65321', 'http://127.0.0.1:65321/private', 'http://localhost:65321?token=x', 'file:///tmp/database', 'garbage']) {
    assert.throws(() => assertLocalFixtureEnvironment({ SUPABASE_URL: value }))
    assert.throws(() => assertLocalFixtureEnvironment({ NUXT_PUBLIC_SUPABASE_URL: value }))
  }
  for (const value of ['http://127.0.0.1:65321', 'http://localhost:65321', 'http://[::1]:65321', '']) assert.doesNotThrow(() => assertLocalFixtureEnvironment({ SUPABASE_URL: value }))
})

test('new scaffold does not retroactively add consumers to preserved release trees', () => {
  const historical = workspaceGraphAt('ecd74b1f5e3f6758bb618e67ca930b5f5f3eadd4')
  const current = workspaceGraphAt('HEAD')
  assert.equal(historical.some(row => row.suit === 'doctor-suit'), false)
  assert.equal(current.some(row => row.suit === 'doctor-suit'), true)
  assert.equal(current.find(row => row.suit === 'doctor-suit').dir, 'apps/doctor-suit')
})
