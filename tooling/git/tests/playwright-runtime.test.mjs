import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { assertPlaywrightRuntime } from '../../ci/playwright-runtime.mjs'

const manifest = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
const version = manifest.devDependencies['@playwright/test']
const nodeVersion = readFileSync(new URL('../../../.node-version', import.meta.url), 'utf8').trim()
const image = `mcr.microsoft.com/playwright:v${version}-resolute@sha256:aebd85bce8056dcdc2269853fd94ea432b6a201da4f0ef125b509489ecd52ddb`
const runtime = () => ({
  nodeVersion, requiredNodeVersion: nodeVersion, expectedVersion: version, actualVersion: version,
  imageInfo: { driverVersion: version, dockerImageName: `mcr.microsoft.com/playwright:v${version}-resolute` },
  browsersPath: '/ms-playwright', platform: 'linux', arch: 'x64', osId: 'ubuntu', osVersion: '26.04',
})

test('pinned runtime rejects mismatched packages, images, browsers, Node and platform', () => {
  assert.equal(assertPlaywrightRuntime(runtime()), true)
  for (const patch of [
    { nodeVersion: '24.22.1' }, { expectedVersion: `^${version}` }, { actualVersion: '1.61.0' },
    { imageInfo: undefined }, { imageInfo: { ...runtime().imageInfo, driverVersion: '1.61.0' } },
    { imageInfo: { ...runtime().imageInfo, dockerImageName: `mcr.microsoft.com/playwright:v${version}-noble` } },
    { browsersPath: '/tmp/browser-cache' }, { platform: 'darwin' }, { arch: 'arm64' },
    { osId: 'debian' }, { osVersion: '24.04' },
  ]) assert.throws(() => assertPlaywrightRuntime({ ...runtime(), ...patch }))
})

test('image, shell, runtime proof and immutable artifact contract cover all browser lanes and builder', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const jobs = Object.fromEntries([...workflow.matchAll(/^ {2}([a-z-]+):\n([\s\S]*?)(?=^ {2}[a-z-]+:|$(?![\s\S]))/gm)].map(match => [match[1], match[2]]))
  for (const id of ['unit-review', 'hq-browser', 'build', 'browser-tests']) {
    assert.ok(jobs[id].includes(`image: ${image}`), id)
    assert.match(jobs[id], /options: --init --shm-size=1g/)
    assert.match(jobs[id], /defaults:\n {6}run:\n {8}shell: bash/)
    assert.match(jobs[id], /node-version-file: \.node-version/)
    assert.match(jobs[id], /pnpm install --frozen-lockfile/)
    assert.match(jobs[id], /for tool in bash git openssl flock; do command -v "\$tool"; done/)
    assert.match(jobs[id], /node tooling\/ci\/playwright-runtime.mjs/)
    assert.ok(jobs[id].indexOf('pnpm install --frozen-lockfile') < jobs[id].indexOf('node tooling/ci/playwright-runtime.mjs'))
  }
  assert.doesNotMatch(workflow, /playwright install|apt-get|--privileged|--ipc=host|--cap-add|NODE_TLS_REJECT_UNAUTHORIZED|continue-on-error:/)
  assert.match(jobs['hq-browser'], /PLAYWRIGHT_USE_BUNDLED: '1'/)
  for (const id of ['hq-invariants', 'release-catalog', 'publish-hq-worker', 'publish-releases']) assert.doesNotMatch(jobs[id], /\n {4}container:/)
  assert.ok(jobs['browser-tests'].includes('[[ "$BUILD_ARTIFACT_ID" =~ ^[1-9][0-9]*$ ]]'))
  assert.match(jobs['browser-tests'], /artifact-ids: \$\{\{ needs.build.outputs.artifact-id \}\}/)
  assert.match(jobs['browser-tests'], /sha256sum --check workspace-build.tar.gz.sha256/)
})
