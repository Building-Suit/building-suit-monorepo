import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
// Schema/type source only: no database values, environment variables or credentials.
// This evidence supplements the generated artifact when its blob download is unavailable.
const [existing, generated] = process.argv.slice(2)
if (existing !== 'apps/shop-suit/app/types/database.types.ts' || !generated) throw new Error('Expected Shop schema contract paths')
const before = await readFile(existing)
const after = await readFile(generated)
const result = spawnSync('git', ['diff', '--no-index', '--', existing, generated], { encoding: 'utf8' })
if (result.status !== 0 && result.status !== 1) throw new Error('Could not compare generated schema contracts')
let patch = result.stdout.replace(/^diff --git .+$/m, `diff --git a/${existing} b/${existing}`).replace(/^--- .+$/m, `--- a/${existing}`).replace(/^\+\+\+ .+$/m, `+++ b/${existing}`)
console.log('SCHEMA_CONTRACT_DIGESTS ' + JSON.stringify({ before: createHash('sha256').update(before).digest('hex'), after: createHash('sha256').update(after).digest('hex') }))
const encoded = Buffer.from(patch).toString('base64')
for (let offset = 0; offset < encoded.length; offset += 4096) console.log('SCHEMA_CONTRACT_DELTA ' + encoded.slice(offset, offset + 4096))
