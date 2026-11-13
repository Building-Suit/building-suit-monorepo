import assert from 'node:assert/strict'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

// Exercise the actual Nuxt DevTools consumer. Current upstream removed the
// simple-git wrapper and only reads fixed Git metadata with tinyexec argv arrays.
const rootRequire = createRequire(new URL('../../package.json', import.meta.url))
const nuxtRequire = createRequire(rootRequire.resolve('nuxt/package.json'))
const devtoolsRequire = createRequire(nuxtRequire.resolve('@nuxt/devtools/package.json'))
const { x } = devtoolsRequire('tinyexec')
const editorRequire = createRequire(devtoolsRequire.resolve('launch-editor'))
const shellQuote = editorRequire('shell-quote')

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ledger-toolchain-security-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const env = { PATH: process.env.PATH, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', TERM: 'xterm' }
  return { directory, env }
}
const absent = async file => { try { await access(file); return false } catch (error) { if (error.code === 'ENOENT') return true; throw error } }

test('Nuxt DevTools cannot resolve the removed legacy Git command wrapper', () => {
  assert.equal(devtoolsRequire('./package.json').dependencies['simple-git'], undefined)
  assert.throws(() => devtoolsRequire.resolve('simple-git'), { code: 'MODULE_NOT_FOUND' })
})

test('current DevTools Git branch/status/revision calls remain compatible with fixed argv', async (t) => {
  const { directory, env } = await fixture(t)
  const setup = args => {
    const result = spawnSync('git', args, { cwd: directory, env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
  setup(['init'])
  setup(['-c', 'user.name=Toolchain fixture', '-c', 'user.email=toolchain@example.test', 'commit', '--allow-empty', '-m', 'Synthetic initial commit'])
  const git = async (...args) => (await x('git', args, { nodeOptions: { cwd: directory, env }, throwOnError: true })).stdout.trim()
  assert.equal(await git('status', '--porcelain'), '')
  assert.ok(await git('rev-parse', '--abbrev-ref', 'HEAD'))
  assert.match(await git('rev-parse', '--short', 'HEAD'), /^[a-f0-9]+$/)
  assert.equal(await git('rev-parse', '--show-toplevel'), directory)
})

test('shell quoting round-trips ordinary arguments and prevents a newline after a comment from executing', async (t) => {
  const { directory, env } = await fixture(t)
  const values = ['a b', 'Arabic العربية', '$HOME', "single'quote", 'line\nbreak']
  assert.deepEqual(shellQuote.parse(shellQuote.quote(values)), values)
  const marker = path.join(directory, 'quoted-command-executed')
  let command
  try { command = shellQuote.quote([{ comment: 'Synthetic comment' }, `\ntouch ${marker} #`]) }
  catch (error) {
    assert.ok(error instanceof TypeError)
    assert.equal(await absent(marker), true)
    return
  }
  const result = spawnSync('sh', ['-c', command], { cwd: directory, env, timeout: 5000, encoding: 'utf8' })
  assert.equal(result.error, undefined)
  assert.equal(await absent(marker), true, 'argument quoting must not execute the token after the comment')
})
