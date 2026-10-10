import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { generatePlatform } from './generate.mjs'

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url))
const root = await mkdtemp(path.join(os.tmpdir(), 'bs-generator-verification-'))
const slug = 'generator-fixture-suit'

async function inventory(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await inventory(target))
    else files.push(path.relative(root, target).split(path.sep).join('/'))
  }
  return files.sort()
}

try {
  await writeFile(path.join(root, 'package.json'), await readFile(path.join(workspaceRoot, 'package.json')))
  const preview = await generatePlatform({ root, slug, title: 'Fixture Suit', dryRun: true })
  assert.deepEqual(await readdir(root), ['package.json'], 'Dry run must not create app files')
  const generated = await generatePlatform({ root, slug, title: 'Fixture Suit' })
  assert.deepEqual(generated, preview, 'Generated files must match the dry-run preview')
  assert.deepEqual(await inventory(path.join(root, 'apps')), preview.toSorted())
  console.log(`Disposable generator dry run verified: ${preview.length} files match the generated fixture.`)

  const result = spawnSync(process.execPath, [
    path.join(workspaceRoot, 'tooling/checks/suit-template-boundaries.mjs'), '--root', root, '--strict',
  ], { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Generated fixture boundary check failed (${result.signal || result.status})`)
} finally {
  await rm(root, { recursive: true, force: true })
}
