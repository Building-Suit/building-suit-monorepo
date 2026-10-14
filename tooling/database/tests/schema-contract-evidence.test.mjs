import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { createHash } from 'node:crypto'

test('schema evidence preserves generated TypeScript bytes and normalizes terminal whitespace only', async () => {
  const existing = 'apps/shop-suit/app/types/database.types.ts'
  const source = await readFile(existing)
  const dir = await mkdtemp(join(tmpdir(), 'shop-schema-evidence-'))
  const generated = join(dir, 'database.types.ts')
  await writeFile(generated, Buffer.concat([source, Buffer.from(' \n\n')]))
  const result = spawnSync(process.execPath, ['tooling/database/schema-contract-evidence.mjs', existing, generated], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await readFile(generated), source)
  const digests = JSON.parse(result.stdout.match(/SCHEMA_CONTRACT_DIGESTS (.+)/)[1])
  assert.equal(digests.after, createHash('sha256').update(source).digest('hex'))
  assert.ok(!result.stdout.includes('SCHEMA_CONTRACT_DELTA'))
})
