import { expect, type Locator, type Page } from '@playwright/test'

export async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  await expect(target).toBeEnabled()
  for (let index = 0; index < 100; index++) {
    if (await target.evaluate(element => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

// Select publishes the model before its deferred close/focus return. A visible
// selected label alone does not make the next keyboard interaction ready.
export async function selected(picker: Locator, label: string) {
  await expect(picker).toContainText(label)
  await expect(picker).toHaveAttribute('aria-expanded', 'false')
  await expect(picker.page().getByRole('listbox')).toBeHidden()
}
