import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

// Exercise the dependencies actually loaded by Nuxt DevTools, not a separate
// direct dependency whose version could differ from the affected consumer.
const rootRequire = createRequire(new URL('../../package.json', import.meta.url))
const nuxtRequire = createRequire(rootRequire.resolve('nuxt/package.json'))
const devtoolsRequire = createRequire(nuxtRequire.resolve('@nuxt/devtools/package.json'))
const gitPath = devtoolsRequire.resolve('simple-git').replace(/index\.cjs$/, 'index.mjs')
const { simpleGit: Git } = await import(pathToFileURL(gitPath).href)
const editorRequire = createRequire(devtoolsRequire.resolve('launch-editor'))
const shellQuote = editorRequire('shell-quote')

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ledger-toolchain-security-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const env = { PATH: process.env.PATH, HOME: directory, XDG_CONFIG_HOME: directory, GIT_CONFIG_NOSYSTEM: '1', TERM: 'xterm' }
  const git = Git(directory, { allowEnvironment: ['GIT_CONFIG_NOSYSTEM'] }).env(env)
  await git.init()
  return { directory, env, git }
}
const absent = async file => { try { await access(file); return false } catch (error) { if (error.code === 'ENOENT') return true; throw error } }

test('Nuxt DevTools Git branch/status/revision calls remain compatible', async (t) => {
  const { directory, git } = await fixture(t)
  await git.addConfig('user.name', 'Toolchain fixture')
  await git.addConfig('user.email', 'toolchain@example.test')
  await git.commit('Synthetic initial commit', ['--allow-empty'])
  assert.equal((await git.status()).isClean(), true)
  assert.ok((await git.branch()).current)
  assert.match(await git.revparse(['--short', 'HEAD']), /^[a-f0-9]+$/)
  assert.equal(await git.revparse(['--show-toplevel']), directory)
})

test('Git rejects trailer-command configuration before executing it', async (t) => {
  const { directory, git } = await fixture(t)
  const marker = path.join(directory, 'trailer-command-executed')
  await writeFile(path.join(directory, 'input.txt'), 'Synthetic message\n')
  await assert.rejects(git.raw([
    '-c', `trailer.fixture.command=touch ${marker}`,
    'interpret-trailers', '--trailer', 'fixture=1', 'input.txt',
  ]), /unsafe|configuration|config|trailer/i)
  assert.equal(await absent(marker), true)
})

test('Git rejects a VISUAL editor command before starting the editor', async (t) => {
  const { directory, env } = await fixture(t)
  const marker = path.join(directory, 'visual-command-executed')
  const git = Git(directory, { allowEnvironment: ['GIT_CONFIG_NOSYSTEM'] }).env({ ...env, VISUAL: `touch ${marker}` })
  await assert.rejects(git.raw([
    '-c', 'user.name=Toolchain fixture', '-c', 'user.email=toolchain@example.test',
    'commit', '--allow-empty', '--edit', '-m', 'Synthetic message',
  ]), /unsafe|visual|environment|editor/i)
  assert.equal(await absent(marker), true)
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
