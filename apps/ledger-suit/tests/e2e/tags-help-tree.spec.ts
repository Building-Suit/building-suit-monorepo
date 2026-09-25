import { mkdir } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel('Email').fill('owner@alpha.test')
  await page.getByLabel('Password').fill('ledgersuit')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
}

test('tags explain their purpose and support create, assign, filter and remove', async ({ page }) => {
  test.setTimeout(45_000)
  const name = `Cairo branch ${Date.now()}`
  await signIn(page)
  await page.getByRole('link', { name: 'Tags', exact: true }).first().click()

  await expect(page.getByRole('heading', { name: 'Find related transactions with Tags' })).toBeVisible()
  await expect(page.getByText('Tags do not change your accounts, balances or financial reports.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Add tag', exact: true }).first().click()
  const create = page.getByRole('dialog')
  await create.locator('#tag-name').fill(name)
  await create.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(create).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible()

  await page.getByRole('link', { name: 'Transactions', exact: true }).first().click()
  const transaction = page.getByRole('table').locator('tbody tr').first()
  await transaction.getByRole('button').first().click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByText('Group this transaction with related work', { exact: false })).toBeVisible()
  await detail.locator('#transaction-tag').selectOption({ label: name })
  await detail.getByRole('button', { name: 'Assign', exact: true }).click()
  await expect(detail.getByText(name, { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('#tag').selectOption({ label: name })
  await expect(page).toHaveURL(/tag=[0-9a-f-]+/)
  await expect(page.getByRole('table')).toContainText(name)
  await page.reload()
  await expect(page.locator('#tag')).toHaveValue(/^[0-9a-f-]+$/)
  await expect(page.getByRole('table')).toContainText(name)

  await page.getByRole('table').locator('tbody tr').first().getByRole('button').first().click()
  await page.getByRole('dialog').getByRole('button', { name: `Remove tag ${name}` }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: `Remove tag ${name}` })).toHaveCount(0)
  await mkdir('docs/evidence/as-ux-03', { recursive: true })
  await page.keyboard.press('Escape')
  await expect(page.getByText('Nothing matches those filters.')).toBeVisible()
  await page.screenshot({ path: 'docs/evidence/as-ux-03/en-tags-filter.png', fullPage: true })
})

test('financial help persists across routes and the account hierarchy remains readable', async ({ page }) => {
  await signIn(page)
  const help = page.getByTestId('financial-help')
  await expect(help).toHaveCSS('position', 'fixed')
  const handle = await help.elementHandle()
  await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
  expect(await handle!.evaluate(element => element.isConnected)).toBe(true)

  const tree = page.locator('#accounts-tree')
  await expect(tree).toContainText('Current assets')
  await expect(tree).toContainText('Fixed assets')
  const typeLabel = tree.getByText('Assets', { exact: true }).first()
  const sectionLabel = tree.getByText('Current assets', { exact: true }).first()
  expect(Number.parseFloat(await typeLabel.evaluate(element => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18)
  expect(Number.parseFloat(await sectionLabel.evaluate(element => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)

  await help.click()
  const dialog = page.getByRole('dialog', { name: 'How your financial system works' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help).toBeFocused()

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const helpBox = await help.boundingBox()
  expect(helpBox).not.toBeNull()
  expect(helpBox!.y + helpBox!.height).toBeLessThan(790)
  await mkdir('docs/evidence/as-ux-03', { recursive: true })
  await page.screenshot({ path: 'docs/evidence/as-ux-03/en-account-tree-mobile.png', fullPage: true })
})

test('Arabic guidance and chart hierarchy are visible in RTL', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Account menu', exact: true }).click()
  await page.getByRole('button', { name: 'العربية', exact: true }).click()
  await page.getByRole('button', { name: 'قائمة الحساب', exact: true }).click()
  await page.getByRole('link', { name: 'الوسوم', exact: true }).first().click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByText('لا تغيّر الوسوم الحسابات أو الأرصدة أو التقارير المالية.', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'الحسابات', exact: true }).first().click()
  await expect(page.locator('#accounts-tree')).toContainText('الأصول المتداولة')
  await expect(page.locator('#accounts-tree')).toContainText('الأصول الثابتة')
  await mkdir('docs/evidence/as-ux-03', { recursive: true })
  await page.screenshot({ path: 'docs/evidence/as-ux-03/ar-account-tree.png', fullPage: true })
})
