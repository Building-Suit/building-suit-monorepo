import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { connectionEnvironment, runChangelog, serverArguments } from '../../ci/changelog-browser.mjs'
import { playwrightImage } from '../../ci/playwright-runtime.mjs'

const workspace = '/home/runner/work/repository/repository'
const nodeExecutable = '/opt/hostedtoolcache/node/26.8.1/x64/bin/node'
const name = 'ci-changelog-fixture'

test('browser server has only read-only source/Node mounts and loopback publication', () => {
  const args = serverArguments(workspace, nodeExecutable, name)
  assert.ok(args.includes(playwrightImage))
  for (const [flag, value] of [['--user', '1001'], ['--publish', '127.0.0.1::3000'], ['--shm-size=1g', undefined]]) {
    assert.ok(args.includes(flag))
    if (value) assert.equal(args[args.indexOf(flag) + 1], value)
  }
  assert.deepEqual(args.filter((_, i) => args[i - 1] === '--volume'), [
    `${workspace}:${workspace}:ro`, '/opt/hostedtoolcache/node/26.8.1/x64:/ci-node:ro',
  ])
  assert.doesNotMatch(args.join(' '), /docker\.sock|--privileged|--cap-add|--network|--ipc=host|--unsafe/)
  assert.deepEqual(args.slice(-7), ['/ci-node/bin/node', 'node_modules/@playwright/test/cli.js', 'run-server', '--host', '0.0.0.0', '--port', '3000'])
  for (const path of ['relative', '/bad:path', '/bad,source', '/bad\npath']) assert.throws(() => serverArguments(path, nodeExecutable, name))
  assert.throws(() => serverArguments(workspace, nodeExecutable, 'unrelated-container'))
})

test('connection accepts only a valid loopback mapping and exposes only loopback', () => {
  assert.deepEqual(connectionEnvironment('127.0.0.1:32100\n'), {
    PW_TEST_CONNECT_WS_ENDPOINT: 'ws://127.0.0.1:32100/', PW_TEST_CONNECT_EXPOSE_NETWORK: '<loopback>',
  })
  for (const bad of ['0.0.0.0:32100', 'example.com:32100', '127.0.0.1:0', '127.0.0.1:65536', '127.0.0.1:3000\n0.0.0.0:3000']) assert.throws(() => connectionEnvironment(bad))
})

test('actual test result propagates and runtime proof precedes connection and tests', async () => {
  for (const code of [0, 1, 7]) {
    const calls = []
    const result = await runChangelog({ workspace, nodeExecutable, name,
      docker: async args => { calls.push(args); return { stdout: args[0] === 'port' ? '127.0.0.1:32100' : '' } },
      wait: async port => { calls.push(['wait', port]) },
      test: async env => { calls.push(['test', env]); return code },
    })
    assert.equal(result, code)
    assert.deepEqual(calls.map(call => call[0]), ['run', 'exec', 'port', 'wait', 'test', 'rm'])
    assert.deepEqual(calls[1], ['exec', name, '/ci-node/bin/node', 'tooling/ci/playwright-runtime.mjs'])
    assert.deepEqual(calls.at(-1), ['rm', '--force', name])
  }
})

test('startup, runtime, port, readiness and test failures still clean up and never pass', async () => {
  for (const failed of ['run', 'exec', 'port', 'wait', 'test']) {
    const calls = []
    await assert.rejects(runChangelog({ workspace, nodeExecutable, name,
      docker: async args => { calls.push(args[0]); if (args[0] === failed) throw new Error(failed); return { stdout: '127.0.0.1:32100' } },
      wait: async () => { calls.push('wait'); if (failed === 'wait') throw new Error(failed) },
      test: async () => { calls.push('test'); throw new Error('test') },
    }), new RegExp(failed))
    assert.equal(calls.at(-1), 'rm')
    if (failed !== 'test') assert.ok(!calls.includes('test'))
  }
})

test('original changelog SQL setup and command remain mandatory', () => {
  const source = readFileSync(new URL('../../ci/changelog-browser.mjs', import.meta.url), 'utf8')
  assert.match(source, /spawn\('pnpm', \['exec', 'playwright', 'test', '-c', 'apps\/shop-suit\/tests\/e2e\/public-changelog.config.ts', '--shard=1\/1'\]/)
  assert.doesNotMatch(source, /SHOP_PUBLIC_CHANGELOG_FEEDS|skip.*SQL|--pass-with-no-tests|continue-on-error/)
  assert.match(source, /assert.equal\(process.versions.node,/)
  assert.match(source, /assert.equal\(process.arch, 'x64'\)/)
  assert.match(source, /assert.equal\(process.getuid\(\), 1001\)/)
  const config = readFileSync(new URL('../../../apps/shop-suit/tests/e2e/public-changelog.config.ts', import.meta.url), 'utf8')
  const setup = readFileSync(new URL('../../../apps/shop-suit/tests/e2e/public-changelog.setup.mjs', import.meta.url), 'utf8')
  assert.match(config, /globalSetup: '.\/public-changelog.setup.mjs'/)
  assert.match(setup, /tooling\/releases\/catalog-disposable.mjs/)
  assert.match(setup, /const \{ directory, dispose \} = await preparePublicChangelogFeeds\(\)/)
})
