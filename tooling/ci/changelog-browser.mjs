import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { playwrightImage } from './playwright-runtime.mjs'

const exec = promisify(execFile)

export function serverArguments(workspace, nodeExecutable, name) {
  for (const path of [workspace, nodeExecutable]) assert.match(path, /^\/(?!.*[:,\n\r]).+$/, 'Expected an absolute mount path')
  assert.match(name, /^ci-changelog-[a-z0-9-]+$/)
  const nodeHome = dirname(dirname(nodeExecutable))
  return ['run', '--detach', '--name', name, '--user', '1001', '--init', '--shm-size=1g',
    '--publish', '127.0.0.1::3000',
    '--volume', `${workspace}:${workspace}:ro`, '--volume', `${nodeHome}:/ci-node:ro`,
    '--workdir', workspace,
    '--env', 'PATH=/ci-node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    playwrightImage, '/ci-node/bin/node', 'node_modules/@playwright/test/cli.js',
    'run-server', '--host', '0.0.0.0', '--port', '3000']
}

export function connectionEnvironment(mapping) {
  const match = /^127\.0\.0\.1:([1-9]\d{0,4})$/.exec(mapping.trim())
  assert.ok(match && Number(match[1]) <= 65535, 'Browser server must be published only on loopback')
  return { PW_TEST_CONNECT_WS_ENDPOINT: `ws://127.0.0.1:${match[1]}/`, PW_TEST_CONNECT_EXPOSE_NETWORK: '<loopback>' }
}

async function waitForServer(port) {
  const { chromium } = await import('@playwright/test')
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      const browser = await chromium.connect(`ws://127.0.0.1:${port}/`, { exposeNetwork: '<loopback>', timeout: Math.min(1000, deadline - Date.now()) })
      await browser.close()
      return
    } catch {
      // Docker's port proxy may be ready before the Playwright server. Only an
      // actual version-compatible protocol connection establishes readiness.
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('Pinned browser server did not become ready')
}

export async function runChangelog({ workspace, nodeExecutable, name, docker, wait, test }) {
  try {
    await docker(serverArguments(workspace, nodeExecutable, name))
    // The image itself proves browser/package/Node/UID/OS compatibility. Never
    // run this check against host browsers or install missing image dependencies.
    await docker(['exec', name, '/ci-node/bin/node', 'tooling/ci/playwright-runtime.mjs'])
    const { stdout } = await docker(['port', name, '3000/tcp'])
    const env = connectionEnvironment(stdout)
    await wait(Number(new URL(env.PW_TEST_CONNECT_WS_ENDPOINT).port))
    // The original globalSetup runs here on the host with its existing Docker
    // capability, real SQL assertions and cleanup. Only browser execution moves.
    return await test(env)
  } finally {
    await docker(['rm', '--force', name])
  }
}

async function main() {
  const workspace = realpathSync(fileURLToPath(new URL('../../', import.meta.url)))
  assert.equal(realpathSync(process.cwd()), workspace)
  assert.equal(process.versions.node, readFileSync(new URL('../../.node-version', import.meta.url), 'utf8').trim())
  assert.equal(process.platform, 'linux')
  assert.equal(process.arch, 'x64')
  assert.equal(process.getuid(), 1001)
  assert.match(readFileSync('/etc/os-release', 'utf8'), /^VERSION_ID="26\.04"$/m)
  const name = `ci-changelog-${randomUUID()}`
  // An always() workflow cleanup also handles runner cancellation/SIGKILL.
  if (process.env.GITHUB_ENV) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_ENV, `CI_CHANGELOG_CONTAINER=${name}\n`)
  }
  let child
  let interrupted
  const docker = args => exec('docker', args, { timeout: 120000, maxBuffer: 1024 * 1024 })
  const terminate = signal => {
    interrupted = signal === 'SIGINT' ? 130 : 143
    if (child?.pid) {
      try { process.kill(-child.pid, signal) } catch (error) { if (error.code !== 'ESRCH') throw error }
    }
    // The finally block and workflow cleanup remove the uniquely named server.
    process.exitCode = interrupted
  }
  const interrupt = () => terminate('SIGINT')
  const stop = () => terminate('SIGTERM')
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', stop)
  try {
    const code = await runChangelog({ workspace, nodeExecutable: realpathSync(process.execPath), name, docker, wait: waitForServer,
      test: env => new Promise((resolve, reject) => {
        if (interrupted) { reject(new Error('Changelog validation was cancelled')); return }
        child = spawn('pnpm', ['exec', 'playwright', 'test', '-c', 'apps/shop-suit/tests/e2e/public-changelog.config.ts', '--shard=1/1'], {
          cwd: workspace, stdio: 'inherit', detached: true, env: { ...process.env, ...env },
        })
        child.once('error', reject)
        child.once('exit', (code, signal) => signal ? reject(new Error(`Changelog tests terminated: ${signal}`)) : resolve(code ?? 1))
      }),
    })
    process.exitCode = interrupted ?? code
  } catch (error) {
    if (!interrupted) throw error
    process.exitCode = interrupted
  } finally {
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', stop)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
