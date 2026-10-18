import { test,expect } from '@playwright/test'
import { doctorMissingPage } from '../../app/utils/previewMetadata'
for(const ar of [false,true])for(const theme of ['light','dark'])for(const width of [390,1280])test(`DOS-M1-019-C01/C02/C03/C04 ${ar ? 'AR' : 'EN'} ${theme} ${width}: preview metadata and neutral missing-route handoff`,async ({ browser,request }) => {
  const context = await browser.newContext({ viewport: { width,height: 1000 } })
  try {
    await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: 'http://127.0.0.1:4336' }]);await context.addInitScript(value => localStorage.setItem('building-suit.theme',value),theme);await context.route('**/*',route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());const page = await context.newPage()
    for(const path of ['/','/preview']) {
      const response = await page.goto(path);expect(response?.status()).toBe(200);expect(response?.headers()['cache-control']).toContain('no-store');expect(response?.headers()['x-robots-tag']).toContain('noindex');await expect(page).toHaveTitle(/Doctor Suit/);await expect(page.locator('html')).toHaveAttribute('lang',ar ? 'ar-EG' : 'en-US');await expect(page.locator('html')).toHaveAttribute('dir',ar ? 'rtl' : 'ltr');await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/.+/);await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content',ar ? 'ar_EG' : 'en_US');await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content',await page.title());await expect(page.locator('link[rel="canonical"],meta[property="og:url"]')).toHaveCount(0)
      const destinations = await page.locator('a[href]').evaluateAll(elements => elements.map(element => element.getAttribute('href') || ''))
      expect(destinations.some(value => /^(https?:|mailto:|tel:|\/\/)/.test(value))).toBe(false)
      for(const hash of destinations.filter(value => value.startsWith('#') && value.length>1))expect(await page.evaluate(id => Boolean(document.getElementById(id)),decodeURIComponent(hash.slice(1)))).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    }
    const copy = doctorMissingPage(ar);const response = await page.goto('/missing-synthetic-destination?credential=DO_NOT_REFLECT_SENTINEL');expect(response?.status()).toBe(404);await expect(page.getByRole('heading',{ name: copy.title,exact: true })).toBeVisible();await expect(page.locator('meta[property^="og:"],meta[name^="twitter:"]')).toHaveCount(0);expect(await page.locator('body').innerText()).not.toContain('DO_NOT_REFLECT_SENTINEL');expect(await page.title()).not.toContain('missing-synthetic-destination');expect(await page.locator('meta').evaluateAll(elements => elements.map(element => element.getAttribute('content')).join(' '))).not.toContain('DO_NOT_REFLECT_SENTINEL')
    await page.getByRole('link',{ name: copy.links[0].label,exact: true }).click();await expect(page).toHaveURL(new URL('/',response!.url()).href);await page.goto('/another-missing-synthetic-destination');await page.getByRole('link',{ name: copy.links[1].label,exact: true }).click();await expect(page).toHaveURL(/\/preview$/)
    for(const path of ['/sitemap.xml','/sitemap_index.xml'])expect((await request.get(path)).status()).toBe(404)
  } finally { try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() } }
})
