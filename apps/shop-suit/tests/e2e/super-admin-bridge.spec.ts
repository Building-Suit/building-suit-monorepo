import { expect, test, type Page } from '@playwright/test'

async function publicBackend(page: Page) {
  await page.route('http://127.0.0.1:61321/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.includes('/auth/v1/')) {
      await route.fulfill({
        status: 401,
        json: { message: 'no public session' },
      })
      return
    }

    await route.fulfill({ json: [] })
  })
}

test('server administration bridge stays out of browser payloads and requests', async ({ page }) => {
  const requests: string[] = []

  page.on('request', (request) => {
    requests.push(JSON.stringify({
      url: request.url(),
      headers: request.headers(),
      body: request.postData(),
    }))
  })

  await publicBackend(page)

  for (const path of ['/', '/auth/login']) {
    await page.goto(path)
    await expect(page.locator('body')).toBeVisible()

    const browserPayload = await page.evaluate(() => JSON.stringify({
      html: document.documentElement.outerHTML,
      nuxt: (window as typeof window & { __NUXT__?: unknown }).__NUXT__,
      resources: performance
        .getEntriesByType('resource')
        .map(entry => entry.name),
    }))

    expect(browserPayload).not.toMatch(
      /SHOP_SUPER_ADMIN_BRIDGE_KEYS|SUPABASE_SERVICE_ROLE_KEY|x-bs-signature|shop-super-admin-bridge/i,
    )
  }

  expect(requests.join('\n')).not.toMatch(
    /x-bs-signature|shop-super-admin-bridge/i,
  )
})
