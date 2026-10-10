import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

/** Geometry assertions complement roles and interactions; screenshots are review evidence. */
export async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

export async function expectChromeFree(control: Locator) {
  await expect(control).toBeVisible()
  const geometry = await control.evaluate(element => {
    const style = getComputedStyle(element)
    return { width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
      shadow: style.boxShadow, defaultButton: element.classList.contains('ls-btn') }
  })
  expect(geometry.width).toBeGreaterThan(20)
  expect(geometry.height).toBeGreaterThan(20)
  expect(geometry.defaultButton).toBe(false)
  expect(geometry.shadow).toBe('none')
}

export async function captureFoundation(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
}

/** Client routing keeps synthetic sessions in-browser rather than asking SSR for an auth session. */
export async function navigateFixture(page: Page, path: string) {
  await page.locator('#__nuxt').evaluate(async (root, to) => {
    const app = (root as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
    if (!app?.config.globalProperties.$router) throw new Error('Fixture navigation requires a hydrated app')
    await app.config.globalProperties.$router.push(to)
  }, path)
  await expect.poll(() => new URL(page.url()).pathname).toBe(path.split('?')[0])
}
