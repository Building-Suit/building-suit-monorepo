import { test, expect } from '@playwright/test'

for (const app of [
  { name: 'Docs', port: 4322, path: '/templates' },
  { name: 'Automation', port: 4324, path: '/' },
]) test(`${app.name} mobile navigation waits for its handler before accepting the first click`, async ({ page, context }) => {
  let releaseScripts!: () => void
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve })
  const heldScripts = new Set<string>()
  let holding = true
  const denied: string[] = []
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || /n8n/i.test(url.pathname)) {
      denied.push('outside-owned-ui')
      return route.abort()
    }
    if (holding && route.request().resourceType() === 'script') {
      heldScripts.add(route.request().url())
      await scriptsReady
    }
    await route.continue()
  })
  await context.addCookies([{ name: 'building-suit-locale', value: 'en', url: `http://127.0.0.1:${app.port}` }])
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    await page.goto(`http://127.0.0.1:${app.port}${app.path}`, { waitUntil: 'commit' })
    const navigation = page.getByRole('button', { name: 'Open navigation', exact: true }).first()
    await expect(navigation).toBeVisible()
    const startupScripts = await page.locator('script[src], link[rel="modulepreload"][href]').evaluateAll(elements => [...new Set(elements.map(element => element instanceof HTMLScriptElement ? element.src : (element as HTMLLinkElement).href))])
    expect(startupScripts.length).toBeGreaterThan(0)
    await expect.poll(() => startupScripts.filter(url => heldScripts.has(url)).length).toBe(startupScripts.length)
    await expect(navigation).toBeDisabled()
    await expect(navigation).toHaveAttribute('aria-expanded', 'false')
    holding = false
    releaseScripts()
    await expect(navigation).toBeEnabled()
    await navigation.click()
    await expect(navigation).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: /^Theme:/ }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(navigation).toHaveAttribute('aria-expanded', 'false')
    await expect(navigation).toBeFocused()
    expect(denied).toEqual([])
  } finally {
    holding = false
    releaseScripts()
    await page.unrouteAll({ behavior: 'wait' })
  }
})
