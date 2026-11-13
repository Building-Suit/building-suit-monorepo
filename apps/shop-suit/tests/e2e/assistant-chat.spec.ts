import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { fixtureGoto, pilotFixture } from './pilot-fixture'

const token = 'synthetic-expense-proposal'
const expense = { token, title: 'Coffee supplies', amount: 125.25, currency: 'EGP', date: '2026-11-12', category: 'Supplies', location: 'First branch' }

for (const { locale, theme, width } of [
  { locale: 'en', theme: 'light', width: 1440 },
  { locale: 'en', theme: 'dark', width: 390 },
  { locale: 'ar', theme: 'light', width: 768 },
  { locale: 'ar', theme: 'dark', width: 390 },
]) {
  test(`assistant conversation and exact expense review in ${locale}, ${theme}, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await pilotFixture(page, locale)
    const ar = locale === 'ar'
    const question = ar ? 'ممكن تسجل مصروف ١٢٥٫٢٥ جنيه للقهوة؟' : 'コーヒー用品の経費を125.25 EGPで記録して'
    const reply = ar ? 'راجع بيانات المصروف قبل التسجيل.' : '経費の内容を確認してください。 <img src=x>'
    let calls = 0
    let attempts = 0
    const { promise: waitForReply, resolve: finishChat } = Promise.withResolvers<undefined>()
    await page.route('**/api/assistant/chat', async route => {
      calls++
      expect(route.request().postDataJSON()).toEqual({ shopId: 'shop-1', locationId: 'location-1', messages: [{ role: 'user', content: question }] })
      await waitForReply
      await route.fulfill({ json: { text: reply, proposal: expense } })
    })
    await page.route('**/api/assistant/confirm', async route => {
      attempts++
      expect(route.request().postDataJSON()).toEqual({ shopId: 'shop-1', locationId: 'location-1', token })
      if (attempts === 1) return route.fulfill({ status: 503, json: {} })
      await route.fulfill({ json: { expenseId: 'expense-fixture-id' } })
    })
    await fixtureGoto(page, '/assistant')
    await expect(page.getByRole('heading', { name: ar ? 'مساعد المتجر' : 'Shop assistant', exact: true })).toBeVisible()
    await expect(page.getByText(ar ? 'تحب تعرف إيه عن متجرك؟' : 'What would you like to do?')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
    const composer = page.getByRole('textbox', { name: ar ? 'رسالتك' : 'Your message', exact: true })
    await composer.fill(question)
    await composer.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })
    expect(calls).toBe(0)
    await composer.press('Enter')
    await expect(page.getByText(ar ? 'المساعد بيجهّز الرد…' : 'Preparing a reply…')).toBeVisible()
    await expect(composer).toHaveAttribute('readonly', '')
    finishChat(undefined)
    await expect(page.getByRole('log').getByText(reply, { exact: true })).toHaveAttribute('dir', 'auto')
    await expect(page.getByRole('log').locator('img')).toHaveCount(0)
    const review = page.getByRole('region', { name: ar ? 'راجع المصروف قبل التسجيل' : 'Review expense' })
    await expect(review.getByRole('heading')).toBeFocused()
    await expect(review.getByText(expense.title)).toBeVisible()
    await expect(review.getByText(expense.category, { exact: true })).toBeVisible()
    await expect(review.getByText(ar ? /١٢٥٫٢٥/ : /125\.25/)).toBeVisible()
    await expect(review.getByText(expense.location)).toBeVisible()
    await expectNoPageOverflow(page)
    const evidence = '.local/atomic-template-evidence/screenshots'
    await mkdir(evidence, { recursive: true })
    await page.screenshot({ path: `${evidence}/assistant-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    expect(calls).toBe(1)
    expect(attempts).toBe(0)
    const confirm = review.getByRole('button', { name: ar ? 'سجّل المصروف' : 'Record expense', exact: true })
    await confirm.click()
    await expect(page.getByRole('alert').getByText(ar ? 'مقدرناش نتأكد' : 'Could not verify', { exact: false })).toBeVisible()
    await expect(review.getByText(expense.title)).toBeVisible()
    await confirm.click()
    await expect(review).toBeHidden()
    await expect(composer).toBeFocused()
    await expect(page.getByRole('log').getByRole('link', { name: ar ? 'افتح المصروفات' : 'Open Expenses' })).toHaveAttribute('href', '/expenses')
    expect(attempts).toBe(2)
  })
}

test('an employee cannot see the assistant navigation or composer', async ({ page }) => {
  await pilotFixture(page, 'en', 'employee')
  await fixtureGoto(page, '/assistant')
  await expect(page.getByText('The Shop assistant is available to shop owners.')).toBeVisible()
  await expect(page.getByRole('link', { name: /assistant/i })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveCount(0)
})

test('switching branches clears the conversation and pending proposal', async ({ page }) => {
  await pilotFixture(page, 'en')
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: { text: 'Review the first branch expense.', proposal: expense } }))
  await fixtureGoto(page, '/assistant')
  const composer = page.getByRole('textbox', { name: 'Your message' })
  await composer.fill('Record this expense')
  await composer.press('Enter')
  await expect(page.getByRole('region', { name: 'Review expense' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Location', exact: true }).click()
  await page.getByRole('option', { name: 'Second branch', exact: true }).click()
  await expect(page.getByRole('log').getByText('What would you like to do?')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Review expense' })).toHaveCount(0)
  await expect(composer).toHaveValue('')
})

test('a failed reply restores the draft for retry', async ({ page }) => {
  await pilotFixture(page, 'en')
  let requests = 0
  await page.route('**/api/assistant/chat', route => {
    const { messages } = route.request().postDataJSON()
    expect(messages).toEqual([{ role: 'user', content: 'Show me low stock' }])
    requests++
    return requests === 1
      ? route.fulfill({ status: 502, json: {} })
      : route.fulfill({ json: { text: 'Two items are below the threshold.', link: { destination: 'inventory' } } })
  })
  await fixtureGoto(page, '/assistant')
  const composer = page.getByRole('textbox', { name: 'Your message' })
  await composer.fill('Show me low stock')
  await composer.press('Enter')
  await expect(page.getByRole('alert').getByText('The assistant is temporarily unavailable.', { exact: false })).toBeVisible()
  await expect(composer).toHaveValue('Show me low stock')
  await composer.press('Enter')
  await expect(page.getByRole('log').getByRole('link', { name: 'Open Inventory' })).toHaveAttribute('href', '/inventory')
  await expect(composer).toHaveValue('')
  expect(requests).toBe(2)
})
