import test from 'node:test'
import assert from 'node:assert/strict'
import { access, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { preparePublicChangelogFeeds } from '../e2e/public-changelog.setup.mjs'
import { publicChangelogFixtureResponse } from '../e2e/public-changelog-fixture-server.mjs'

const feed = { serverNow: '2026-10-17T00:00:00Z', entries: [{ id: 'synthetic' }] }
async function writeFeeds(directory) {
  for (const name of ['released', 'candidate']) await writeFile(join(directory, `${name}.json`), JSON.stringify(feed))
}

test('changelog setup waits for the complete SQL process before sharing both feeds', async () => {
  let finish, directory, completed = false, calls = 0
  const pending = preparePublicChangelogFeeds(async (command, args, options) => {
    calls++
    assert.equal(command, process.execPath)
    assert.deepEqual(args.slice(0, 2), ['tooling/releases/catalog-disposable.mjs', '--browser-feeds'])
    assert.equal(options.timeout, 180000)
    assert.equal(options.killSignal, 'SIGTERM')
    directory = args[2]
    await writeFeeds(directory)
    await new Promise(resolve => { finish = resolve })
  }).then(value => { completed = true; return value })
  while (!finish) await new Promise(resolve => setImmediate(resolve))
  assert.equal(completed, false, 'Files written before later SQL assertions are not accepted')
  finish()
  const prepared = await pending
  assert.equal(calls, 1, 'Both locale journeys share one complete release-policy replay')
  await access(join(directory, 'released.json'))
  await access(join(directory, 'candidate.json'))
  await prepared.dispose()
  await assert.rejects(access(directory), { code: 'ENOENT' })
})

test('failed and timed-out SQL processes cannot publish even complete early feed files', async () => {
  for (const killed of [false, true]) {
    let directory
    await assert.rejects(preparePublicChangelogFeeds(async (_command, args) => {
      directory = args[2]
      await writeFeeds(directory)
      throw Object.assign(new Error('private-process-output-sentinel'), { killed })
    }), error => {
      assert.match(error.message, killed ? /timed out/ : /setup failed/)
      assert.doesNotMatch(error.stack, /private-process-output-sentinel/)
      return true
    })
    await assert.rejects(access(directory), { code: 'ENOENT' })
  }
})

test('a successful SQL exit with missing or malformed projections still fails setup', async () => {
  for (const contents of [undefined, 'not-json', '{"entries":[]}']) {
    let directory
    await assert.rejects(preparePublicChangelogFeeds(async (_command, args) => {
      directory = args[2]
      await writeFile(join(directory, 'released.json'), JSON.stringify(feed))
      if (contents !== undefined) await writeFile(join(directory, 'candidate.json'), contents)
    }), /setup failed/)
    await assert.rejects(access(directory), { code: 'ENOENT' })
  }
})

test('changelog transport isolates only unrelated public plans and rejects every other backend route', () => {
  assert.deepEqual(publicChangelogFixtureResponse('POST', '/rest/v1/rpc/shop_public_plan_catalog'), { status: 200, body: [] })
  for (const [method, pathname] of [
    ['GET', '/rest/v1/rpc/shop_public_plan_catalog'],
    ['POST', '/rest/v1/rpc/release_public_feed'],
    ['GET', '/auth/v1/user'], ['POST', '/rest/v1/rpc/shop_create'],
  ]) assert.equal(publicChangelogFixtureResponse(method, pathname).status, 404)
})
