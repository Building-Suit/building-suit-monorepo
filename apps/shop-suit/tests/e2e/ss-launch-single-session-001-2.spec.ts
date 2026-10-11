import { expect, test, type Page } from '@playwright/test'

type NuxtTestApp = {
  isHydrating: boolean
  payload: { data: Record<string, unknown>, state: Record<string, unknown> }
  $supabase: { client: { auth: { refreshSession(): Promise<{ error: { name: string } | null }> } } }
}
async function login(page: Page, account: 'a' | 'b') {
  await page.goto('/auth/login')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config?: { globalProperties?: { $nuxt?: NuxtTestApp } } } }
    return root?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
  })
  await page.getByLabel('Email', { exact: true }).fill(`${account}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('banner').getByRole('combobox', { name: 'Shop', exact: true })).toContainText(`Private shop ${account}`)
}
async function refresh(page: Page) {
  return page.evaluate(async () => {
    const root = document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $nuxt: NuxtTestApp } } } }
    return (await root.__vue_app__.config.globalProperties.$nuxt.$supabase.client.auth.refreshSession()).error?.name ?? null
  })
}

test('synthetic native refresh contract: newest login wins, old session clears, new account remains isolated', async ({ browser, baseURL }) => {
  const contexts = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })])
  for (const context of contexts) await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
  const [old, newest] = await Promise.all(contexts.map(context => context.newPage()))
  try {
    await login(old, 'a')
    await old.evaluate(() => {
      const root = document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $nuxt: NuxtTestApp } } } }
      const app = root.__vue_app__.config.globalProperties.$nuxt
      app.payload.data['shop-data:session-test'] = { secret: 'account-a-data' }
      app.payload.data['platform-admin:session-test'] = { secret: 'account-a-admin' }
      sessionStorage.setItem('shop-suit.pending-onboarding', 'private-draft')
    })
    await login(newest, 'a')
    // Existing JWTs still work until refresh: no false instant-revocation claim.
    await expect(old).toHaveURL(/\/dashboard$/)
    expect(await refresh(newest)).toBeNull()
    expect(await refresh(old)).toBe('AuthSessionMissingError')
    await expect(old).toHaveURL(/\/dashboard$/)
    // The installed SDK preserves a still-valid JWT after proactive failure.
    await old.clock.setFixedTime(Date.now() + 3_601_000)
    expect(await refresh(old)).toBe('AuthSessionMissingError')
    await expect(old).toHaveURL(/\/auth\/login$/)
    await expect(old.getByText('Private shop a', { exact: true })).toHaveCount(0)
    const cleared = await old.evaluate(() => {
      const root = document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $nuxt: NuxtTestApp } } } }
      const app = root.__vue_app__.config.globalProperties.$nuxt
      return {
        shop: app.payload.data['shop-data:session-test'] ?? null,
        admin: app.payload.data['platform-admin:session-test'] ?? null,
        shops: app.payload.state['$sshop:shops'],
        current: app.payload.state['$sshop:current-id'],
        draft: sessionStorage.getItem('shop-suit.pending-onboarding'),
        cookies: document.cookie,
      }
    })
    expect(cleared.shop).toBeNull(); expect(cleared.admin).toBeNull()
    expect(cleared.shops).toEqual([]); expect(cleared.current).toBeNull(); expect(cleared.draft).toBeNull()
    expect(cleared.cookies).not.toContain('shop-suit.shop=')
    expect(cleared.cookies).not.toContain('shop-suit.location=')
    await old.clock.setFixedTime(Date.now())
    await login(old, 'b')
    await expect(old.getByText('Private shop a', { exact: true })).toHaveCount(0)
    expect(await refresh(newest)).toBeNull()
    await newest.getByRole('button', { name: 'Account', exact: true }).click()
    await newest.getByRole('menu').getByRole('menuitem', { name: 'Sign out', exact: true }).click()
    await expect(newest).toHaveURL(/\/auth\/login$/)
    expect(await refresh(old)).toBeNull()
    await old.reload()
    await expect(old.getByRole('banner').getByRole('combobox', { name: 'Shop', exact: true })).toContainText('Private shop b')
  } finally { await Promise.all(contexts.map(context => context.close())) }
})
