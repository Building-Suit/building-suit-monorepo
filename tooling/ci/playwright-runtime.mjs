import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'

export const playwrightImage = 'mcr.microsoft.com/playwright:v1.62.1-resolute@sha256:aebd85bce8056dcdc2269853fd94ea432b6a201da4f0ef125b509489ecd52ddb'

export function assertPlaywrightRuntime(runtime) {
  assert.equal(runtime.nodeVersion, runtime.requiredNodeVersion, 'Use the repository Node version')
  assert.match(runtime.expectedVersion, /^\d+\.\d+\.\d+$/, 'Pin an exact Playwright version')
  assert.equal(runtime.actualVersion, runtime.expectedVersion, 'Installed Playwright must match the manifest')
  assert.equal(runtime.imageInfo?.driverVersion, runtime.expectedVersion, 'Update the image and package together')
  assert.equal(runtime.imageInfo?.dockerImageName, `mcr.microsoft.com/playwright:v${runtime.expectedVersion}-resolute`, 'Use the official matching Resolute image')
  assert.equal(runtime.browsersPath, '/ms-playwright', 'Use the preinstalled image browsers')
  assert.equal(runtime.platform, 'linux')
  assert.equal(runtime.arch, 'x64')
  assert.equal(runtime.uid, 1001, 'Run as the GitHub workspace owner, never root')
  assert.equal(runtime.osId, 'ubuntu')
  assert.equal(runtime.osVersion, '26.04', 'Build and consume artifacts on the same Ubuntu release')
  return true
}

async function main() {
  const require = createRequire(import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
  const os = Object.fromEntries(readFileSync('/etc/os-release', 'utf8').trim().split('\n').map(line => {
    const [key, ...parts] = line.split('=')
    return [key, parts.join('=').replace(/^"|"$/g, '')]
  }))
  assertPlaywrightRuntime({
    nodeVersion: process.versions.node,
    requiredNodeVersion: readFileSync(new URL('../../.node-version', import.meta.url), 'utf8').trim(),
    expectedVersion: manifest.devDependencies['@playwright/test'],
    actualVersion: require('@playwright/test/package.json').version,
    imageInfo: JSON.parse(readFileSync('/ms-playwright/.docker-info', 'utf8')),
    browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    platform: process.platform,
    arch: process.arch,
    uid: process.getuid(),
    osId: os.ID,
    osVersion: os.VERSION_ID,
  })
  const { chromium } = await import('@playwright/test')
  assert.ok(realpathSync(chromium.executablePath()).startsWith(`/ms-playwright${sep}`), 'Chromium must come from the image')
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent('<html><body>Browser runtime ready</body></html>')
    assert.equal(await page.locator('body').textContent(), 'Browser runtime ready')
    console.log(`Verified Playwright ${manifest.devDependencies['@playwright/test']}, Chromium ${browser.version()}, Node ${process.versions.node} on Ubuntu ${os.VERSION_ID}`)
  } finally {
    await browser.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
