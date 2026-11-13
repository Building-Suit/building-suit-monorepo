import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { MAX_DOC_BYTES, readApprovedDocs } from './model.mjs'

export async function publishApprovedDocs(source, target) {
  if (!source || !target || !isAbsolute(source) || !isAbsolute(target) || resolve(source) === resolve(target)) {
    throw new Error('distinct-absolute-Shop-docs-paths-required')
  }
  const docs = await readApprovedDocs(source)
  if (!docs.trim() || Buffer.byteLength(docs) > MAX_DOC_BYTES) throw new Error('invalid-Shop-docs-snapshot')
  const staging = await mkdtemp(join(dirname(target), '.shop-docs-'))
  try {
    const snapshot = join(staging, 'snapshot.txt')
    await writeFile(snapshot, docs, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await rename(snapshot, target)
  } finally {
    await rm(staging, { force: true, recursive: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  publishApprovedDocs(process.argv[2], process.argv[3]).catch(() => {
    console.error('[shop-hq-worker]', 'snapshot-publish-failed')
    process.exitCode = 1
  })
}
