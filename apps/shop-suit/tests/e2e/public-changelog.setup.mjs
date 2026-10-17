import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

// One complete real SQL replay supplies both locales and both feed projections.
// Feed creation is setup work, independent of each browser assertion's budget.
export async function preparePublicChangelogFeeds(run = promisify(execFile)) {
  const directory = await mkdtemp(join(tmpdir(), 'shop-public-changelog-'))
  const dispose = () => rm(directory, { recursive: true, force: true })
  try {
    await run(process.execPath, ['tooling/releases/catalog-disposable.mjs', '--browser-feeds', directory], {
      cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
      timeout: 180000, killSignal: 'SIGTERM', maxBuffer: 1024 * 1024,
    })
    // An early file is not success: read only after every SQL assertion and
    // disposable-container cleanup has completed with a zero process exit.
    for (const name of ['released', 'candidate']) {
      const feed = JSON.parse(await readFile(join(directory, `${name}.json`), 'utf8'))
      if (!Array.isArray(feed.entries) || !feed.entries.length || !feed.serverNow) throw new Error('Missing real feed')
    }
    return { directory, dispose }
  } catch (error) {
    await dispose()
    // eslint-disable-next-line preserve-caught-error -- CLI causes contain raw SQL/process output and must stay private.
    throw new Error(error?.killed ? 'Public changelog SQL setup timed out' : 'Public changelog SQL setup failed; raw process output omitted')
  }
}

export default async function setup() {
  const started = Date.now()
  const { directory, dispose } = await preparePublicChangelogFeeds()
  process.env.SHOP_PUBLIC_CHANGELOG_FEEDS = directory
  console.log(`Public changelog SQL setup passed: one complete replay, two real anonymous feeds (${((Date.now() - started) / 1000).toFixed(1)}s)`)
  return dispose
}
