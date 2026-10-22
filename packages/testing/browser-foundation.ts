import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

/** Geometry assertions complement roles and interactions; screenshots are review evidence. */
export async function expectNoPageOverflow(page: Page) {
  try {
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(1)
  } catch (error) {
    const boundaries = await page.evaluate(() => {
      const width = document.documentElement.clientWidth
      return [...document.querySelectorAll('*')].flatMap(element => {
        const box = element.getBoundingClientRect()
        if (!box.width || (box.left >= -1 && box.right <= width + 1)) return []
        const style = getComputedStyle(element)
        return [{ tag: element.tagName, class: element.getAttribute('class'), left: box.left, right: box.right,
          width: box.width, parentWidth: element.parentElement?.getBoundingClientRect().width,
          display: style.display, minimum: style.minWidth, columns: style.gridTemplateColumns }]
      }).slice(0, 20)
    }).catch(() => [])
    console.error('Overflow boundaries (no form values):', JSON.stringify(boundaries))
    throw error
  }
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
  trackRouteCoverage(page)
  await page.locator('#__nuxt').evaluate((root, to) => {
    const app = (root as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: { push: (path: string) => Promise<unknown> } } } } }).__vue_app__
    if (!app?.config.globalProperties.$router) throw new Error('Fixture navigation requires a hydrated app')
    // Router promises can lose their remote handle while Nuxt replaces the login tree.
    // Observe the resulting URL from Playwright instead of retaining that handle.
    void app.config.globalProperties.$router.push(to)
  }, path)
  await expect.poll(() => new URL(page.url()).pathname).toBe(path.split('?')[0])
}

const trackedPages = new WeakSet<Page>()
const routeProducts: Record<string, string> = { '4340': 'ledger-suit', '4341': 'shop-suit', '4320': 'ledger-suit', '4321': 'shop-suit', '4326': 'shop-suit', '4323': 'inventory-suit', '4324': 'automation-suit', '4325': 'super-admin-suit' }
/** Record actual main-frame routes. Acceptance counts only annotations from passing tests. */
export function trackRouteCoverage(page: Page) {
 if (trackedPages.has(page)) return
 trackedPages.add(page)
 const info = test.info()
 const record = () => {
  const url = new URL(page.url())
  const suit = routeProducts[url.port]
  if (!suit || url.hostname !== '127.0.0.1') return
  const description = JSON.stringify({ suit, path: url.pathname.replace(/\/$/, '') || '/' })
  if (!info.annotations.some(item => item.type === 'verified-route' && item.description === description)) info.annotations.push({ type: 'verified-route', description })
 }
 page.on('framenavigated', frame => { if (frame === page.mainFrame()) record() })
 record()
}

/** Compare shared chrome only; product content and branding remain configurable. */
export async function recordShellGeometry(page: Page, chrome: Locator = page.locator('header').first()) {
 const url = new URL(page.url())
 const suit = routeProducts[url.port]
 if (!suit) throw new Error('Unregistered Suit shell')
 const geometry = await chrome.evaluate(element => {
  const box = element.getBoundingClientRect(), style = getComputedStyle(element)
  return { width: Math.round(box.width), height: Math.round(box.height), background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius, font: style.fontFamily }
 })
 const state = await page.locator('html').evaluate(element => ({ locale: element.lang.split('-')[0], theme: element.dataset.theme }))
 test.info().annotations.push({ type: 'verified-shell', description: JSON.stringify({ suit, ...state, width: page.viewportSize()?.width, geometry }) })
}

/** Scoped auth runs use independent ports; the normal repository sweep uses its standard servers. */
export function atomicAuthPorts() {
 const base = Number(process.env.BS_ATOMIC_AUTH_PORT_BASE ?? 4320)
 return [base, base + 1] as const
}
