import { test, expect } from '@playwright/test'

const docsBaseUrl = process.env.BS_E2E_DOCS_URL ?? 'http://127.0.0.1:4322'

for (const width of [390, 1280]) for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) {
  test(`dirty dialog retains Cancel focus after opening: ${width}, ${locale}, ${theme}`, async ({ page, context }, testInfo) => {
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`${docsBaseUrl}/components`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: unknown } | null)?.__vue_app__))
    // Hold the opening transition long enough to request dirty-close before
    // PrimeVue's after-enter hook chooses its initial focus target.
    await page.addStyleTag({ content: '.p-dialog-enter-active { transition: opacity 2s linear !important; } .p-dialog-enter-from { opacity: 0.99; }' })
    const toolbar = page.getByRole('toolbar', { name: locale === 'ar' ? 'أمثلة المكونات' : 'Component examples' })
    const opener = toolbar.getByRole('button', { name: locale === 'ar' ? 'إضافة' : 'Create', exact: true })
    await opener.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox').fill('Unsaved')
    await expect(dialog).toHaveClass(/p-dialog-enter-active/)
    await page.keyboard.press('Escape')
    const cancel = dialog.getByRole('alert').getByRole('button', { name: locale === 'ar' ? 'إلغاء' : 'Cancel', exact: true })
    await expect(cancel).toBeFocused()
    await expect(dialog).not.toHaveClass(/p-dialog-enter-active/)
    await expect(cancel).toBeFocused()
    const screenshot = testInfo.outputPath('dirty-close-focus.png')
    await page.screenshot({ path: screenshot })
    await testInfo.attach('dirty-close-focus', { path: screenshot, contentType: 'image/png' })
    await cancel.click()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.getByRole('textbox')).toHaveValue('Unsaved')
    await page.keyboard.press('Escape')
    await dialog.getByRole('alert').getByRole('button', { name: locale === 'ar' ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}
