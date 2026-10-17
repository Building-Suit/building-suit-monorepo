import { test,expect,type BrowserContext,type Page } from '@playwright/test'
import { doctorProfileCopy } from '../../app/utils/patientProfilePresentation'
import { doctorDelegationCopy } from '../../app/utils/delegationPresentation'
test.use({ actionTimeout: 10000 })
const fixture = 'http://127.0.0.1:4338/__fixture'; const base = 'http://127.0.0.1:4337'
const pdf = Buffer.from('%PDF-1.7\nSynthetic administrative test attachment\n%%EOF\n')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=','base64')
async function local(context: BrowserContext,ar: boolean) {
  await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: base }])
  await context.addInitScript(theme => localStorage.setItem('building-suit.theme',theme),ar ? 'light' : 'dark')
  await context.route('**/*',route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
}
async function login(page: Page,email: string,ar: boolean) {
  await page.goto('/patients'); await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill(email); await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only')
  await page.getByRole('button',{ name: ar ? 'تسجيل الدخول' : 'Sign in',exact: true }).click(); await expect(page).toHaveURL(/\/patients$/)
}
async function choose(page: Page,ar: boolean,clinic: string) {
  const select = page.getByRole('combobox',{ name: ar ? 'الممارسة والموقع' : 'Practice and location',exact: true }); await select.click(); await page.getByRole('option',{ name: new RegExp(` · ${clinic}$`) }).click(); await expect(select).toContainText(clinic); await expect(select).toBeEnabled()
}
async function openPatient(page: Page,ar: boolean,name = 'Synthetic A patient 02') {
  await page.getByRole('link',{ name,exact: true }).click(); await expect(page.getByRole('heading',{ name,exact: true })).toBeVisible(); await expect(page.getByText(doctorProfileCopy(ar).entered,{ exact: true })).toBeVisible()
}
async function close(contexts: BrowserContext[]) { await Promise.allSettled(contexts.map(async context => { try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() } })) }
test.beforeEach(async ({ request }) => { await request.post(fixture,{ data: { reset: true } }); await request.post(fixture,{ data: { delegation: true,patients: true,documents: true } }) })
for (const ar of [false,true]) test(`DOS-M1-012-C01/C02/C03/C04 ${ar ? 'AR mobile light' : 'EN desktop dark'}: private profile, validation, retry, immutable versions, preview disposal and archive`,async ({ browser,request }) => {
  test.setTimeout(90000)
  const copy = doctorProfileCopy(ar); const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } })
  try {
    await local(context,ar); const page = await context.newPage(); await login(page,'synthetic-doctor-a@example.test',ar); await choose(page,ar,'Clinic A1'); await openPatient(page,ar)
    await expect(page.locator('html')).toHaveAttribute('data-theme',ar ? 'light' : 'dark')
    await expect(page.getByText(copy.created,{ exact: true })).toBeVisible(); await expect(page.getByText(copy.notice,{ exact: true })).toBeVisible()
    await expect(page.getByRole('row',{ name: /synthetic-private.pdf/ })).toBeVisible()
    await page.getByRole('button',{ name: copy.upload,exact: true }).click(); const dialog = page.getByRole('dialog',{ name: copy.upload,exact: true })
    await dialog.locator('input[type=file]').setInputFiles({ name: 'spoof.html',mimeType: 'text/html',buffer: Buffer.from('<script>synthetic</script>') })
    await expect(dialog.getByText(copy.invalid,{ exact: true })).toBeVisible(); await expect(dialog.getByRole('button',{ name: copy.save,exact: true })).toBeDisabled()
    await dialog.locator('input[type=file]').setInputFiles({ name: 'synthetic-upload.pdf',mimeType: 'application/pdf',buffer: pdf })
    await page.route('**/functions/v1/doctor-documents?op=upload',async route => { await route.fetch(); await route.abort('failed') },{ times: 1 })
    await dialog.getByRole('button',{ name: copy.save,exact: true }).click(); await expect(dialog.getByText(copy.network,{ exact: true })).toBeVisible()
    await dialog.getByRole('button',{ name: copy.save,exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() }); await expect(dialog).toBeHidden()
    let data = (await (await request.get(fixture)).json()).delegation
    const item = data.documentRows.find((row: { current: { filename: string } }) => row.current.filename==='synthetic-upload.pdf'); expect(item).toBeTruthy()
    expect(data.documentVersions.filter((row: { filename: string }) => row.filename==='synthetic-upload.pdf')).toHaveLength(1)
    const firstUploader = item.current.uploaded_by; const firstTime = item.current.uploaded_at; const fileRow = page.getByRole('row',{ name: /synthetic-upload.pdf/ })
    const download = page.waitForEvent('download'); await fileRow.getByRole('button',{ name: copy.download,exact: true }).click(); expect((await download).suggestedFilename()).toBe('synthetic-upload.pdf')
    await fileRow.getByRole('button',{ name: copy.replace,exact: true }).click(); const replace = page.getByRole('dialog',{ name: copy.replace,exact: true })
    await replace.locator('input[type=file]').setInputFiles({ name: 'synthetic-replacement.png',mimeType: 'image/png',buffer: png }); await replace.getByRole('button',{ name: copy.save,exact: true }).click(); await expect(replace).toBeHidden()
    const replacementRow = page.getByRole('row',{ name: /synthetic-replacement.png/ }); await expect(replacementRow).toBeVisible()
    await replacementRow.getByRole('button',{ name: copy.preview,exact: true }).click(); const preview = page.getByRole('dialog',{ name: 'synthetic-replacement.png',exact: true }); await expect(preview.locator('img[src^="blob:"]')).toBeVisible()
    await preview.getByRole('button',{ name: copy.close,exact: true }).click(); await expect(page.locator('img[src^="blob:"]')).toHaveCount(0)
    await replacementRow.getByRole('button',{ name: 'synthetic-replacement.png',exact: true }).click(); const history = page.getByRole('dialog',{ name: copy.history,exact: true })
    await expect(history.getByRole('row',{ name: /synthetic-upload.pdf/ })).toBeVisible(); await expect(history.getByRole('row',{ name: /synthetic-replacement.png/ })).toBeVisible(); await expect(history.getByText(copy.replaced,{ exact: true })).toBeVisible()
    await history.getByRole('button',{ name: copy.close,exact: true }).click()
    await replacementRow.getByRole('button',{ name: copy.archive,exact: true }).click(); await page.getByRole('dialog',{ name: copy.archive,exact: true }).getByRole('button',{ name: copy.archive,exact: true }).click()
    await expect(replacementRow.getByText(copy.archived,{ exact: true })).toBeVisible(); await expect(replacementRow.getByRole('button',{ name: copy.replace,exact: true })).toHaveCount(0)
    data = (await (await request.get(fixture)).json()).delegation
    const versions = data.documentVersions.filter((row: { document_id: string }) => row.document_id===item.id); expect(versions).toHaveLength(2); expect(versions[0].uploaded_by).toBe(firstUploader); expect(versions[0].uploaded_at).toBe(firstTime); expect(versions.every((row: { provenance: string }) => row.provenance==='uploaded_unreviewed')).toBe(true)
    await page.getByRole('button',{ name: copy.upload,exact: true }).click(); const dirty = page.getByRole('dialog',{ name: copy.upload,exact: true }); await dirty.locator('input[type=file]').setInputFiles({ name: 'synthetic-discard.pdf',mimeType: 'application/pdf',buffer: pdf })
    await dirty.getByRole('button',{ name: copy.cancel,exact: true }).click(); await expect(dirty).toBeVisible(); await dirty.getByRole('button',{ name: ar ? 'تأكيد' : 'Confirm',exact: true }).click(); await expect(dirty).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  } finally { await close([context]) }
})
for (const ar of [false,true]) test(`DOS-M1-009/010/012 ${ar ? 'AR mobile' : 'EN desktop'}: independent document scopes, read-only clinic and open-file revocation`,async ({ browser,request }) => {
  test.setTimeout(90000)
  const copy = doctorProfileCopy(ar); const access = doctorDelegationCopy(ar); const staffContext = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } }); const ownerContext = await browser.newContext()
  try {
    await local(staffContext,ar); await local(ownerContext,ar); const staff = await staffContext.newPage(); const owner = await ownerContext.newPage()
    await login(staff,'synthetic-secretary@example.test',ar); await choose(staff,ar,'Clinic A1'); await openPatient(staff,ar); await expect(staff.getByRole('button',{ name: copy.upload,exact: true })).toBeVisible()
    await choose(staff,ar,'Clinic A2'); await expect(staff.getByRole('button',{ name: copy.upload,exact: true })).toHaveCount(0); await expect(staff.getByRole('row',{ name: /synthetic-private.pdf/ })).toBeVisible()
    await choose(staff,ar,'Clinic A1'); await staff.getByRole('button',{ name: copy.upload,exact: true }).click(); const dirty = staff.getByRole('dialog',{ name: copy.upload,exact: true }); await dirty.locator('input[type=file]').setInputFiles({ name: 'synthetic-revoked.pdf',mimeType: 'application/pdf',buffer: pdf })
    await login(owner,'synthetic-doctor-a@example.test',ar); await choose(owner,ar,'Clinic A1'); await owner.goto('/team'); await owner.getByRole('row',{ name: /synthetic-secretary@example.test/ }).getByRole('button',{ name: access.revoke,exact: true }).click(); await owner.getByRole('dialog',{ name: access.actionTitle,exact: true }).getByRole('button',{ name: access.confirm,exact: true }).click()
    await staff.bringToFront(); await staff.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(dirty).toBeHidden(); await expect(staff.getByRole('heading',{ name: 'Synthetic A patient 02',exact: true })).toHaveCount(0)
    await choose(staff,ar,'Clinic B1'); await staff.goto('/patients'); await openPatient(staff,ar,'Synthetic B patient 02'); await expect(staff.getByRole('row',{ name: /synthetic-private.pdf/ })).toBeVisible(); await expect(staff.getByRole('button',{ name: copy.upload,exact: true })).toHaveCount(0)
    const data = (await (await request.get(fixture)).json()).delegation; expect(data.documentVersions.some((item: { filename: string }) => item.filename==='synthetic-revoked.pdf')).toBe(false)
    expect(data.memberships.find((item: { practice_id: string }) => item.practice_id.endsWith('2')).status).toBe('active')
  } finally { await close([staffContext,ownerContext]) }
})
