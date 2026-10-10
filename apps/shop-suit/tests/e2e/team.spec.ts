import { expect, test, type Page } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

async function goToTeam(page: Page, locale: string) {
  const link = page.getByRole('link', { name: locale === 'ar' ? 'الفريق' : 'Team', exact: true })
  if (!await link.isVisible()) {
    await page.getByRole('button', { name: locale === 'ar' ? 'فتح القائمة' : 'Open menu', exact: true }).click()
  }
  await link.click()
  await expect(page).toHaveURL(/\/team(?:[?#]|$)/)
}

const permissionKeys = ['products.view', 'products.manage', 'team.view', 'team.manage', 'team.permissions.manage']
for (const locale of ['en', 'ar']) for (const mobile of [false, true]) for (const theme of ['light', 'dark']) {
  test(`Team controls ${locale} ${mobile ? 'mobile' : 'desktop'} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: 900 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const team = {
      canManage: true, canManagePermissions: true, canViewAudit: true, permissionKeys, grantablePermissionKeys: permissionKeys,
      members: [{ id: 'member-2', name: 'Reception member', email: 'member@example.test', jobTitle: 'Receptionist', roleKey: 'staff', status: 'active', locationIds: ['location-1'], createdAt: '2026-10-01' }],
      roles: [{ key: 'staff', name: 'Staff', nameAr: 'موظف', isSystem: true, permissionKeys: ['products.view', 'team.view'] }],
      locations: [{ id: 'location-1', name: 'First branch', status: 'active' }], invitations: [], events: [],
    }
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shop_team_read') return team
      if (name === 'save_shop_team_role') {
        team.roles.push({ key: 'custom-reception', name: String(args.p_name), nameAr: String(args.p_name_ar), isSystem: false, permissionKeys: args.p_permission_keys as string[] })
        return 'custom-reception'
      }
      if (name === 'invite_shop_staff') return { kind: 'invited', invitationCode: '00000000-0000-4000-8000-000000000009' }
      return undefined
    })
    await goToTeam(page, locale)
    const ar = locale === 'ar'
    await expect(page.getByRole('heading', { name: ar ? 'الفريق والصلاحيات' : 'Team & permissions', exact: true })).toBeVisible()
    await expect(page.getByText('Reception member', { exact: true })).toBeVisible()
    const search = page.getByRole('searchbox', { name: ar ? 'بحث الأعضاء' : 'Search members' })
    await search.fill('missing member')
    await expect(page.getByText('Reception member', { exact: true })).toHaveCount(0)
    await search.fill('Reception')
    await expect(page.getByText('Reception member', { exact: true })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('members.png'), fullPage: true })
    await page.getByRole('tab', { name: ar ? 'الأدوار والصلاحيات' : 'Roles & permissions', exact: true }).click()
    await page.getByRole('button', { name: ar ? 'إضافة دور' : 'Add role', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: ar ? 'اسم الدور بالإنجليزية' : 'Role name in English' }).fill('Reception')
    await dialog.getByRole('textbox', { name: ar ? 'اسم الدور بالعربية' : 'Role name in Arabic' }).fill('الاستقبال')
    await dialog.getByRole('checkbox', { name: ar ? 'المنتجات · عرض' : 'products · view', exact: true }).check()
    await page.screenshot({ path: test.info().outputPath('role-dialog.png'), fullPage: true })
    await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText(ar ? 'الاستقبال' : 'Reception', { exact: true })).toBeVisible()
    expect(calls.find(call => call.name === 'save_shop_team_role')?.args.p_permission_keys).toEqual(['products.view'])
    await page.getByRole('button', { name: ar ? 'إضافة أو دعوة موظف' : 'Add or invite staff', exact: true }).click()
    await dialog.getByRole('textbox', { name: ar ? 'الاسم' : 'Name', exact: true }).fill('New colleague')
    await dialog.getByRole('textbox', { name: ar ? 'البريد الإلكتروني' : 'Email', exact: true }).fill('new@example.test')
    await dialog.getByRole('textbox', { name: ar ? 'المسمى الوظيفي' : 'Job title', exact: true }).fill('Receptionist')
    await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await expect(dialog.locator('input[readonly]')).toHaveValue(/\/auth\/team-invitation\?invite=/)
    const invite = calls.find(call => call.name === 'invite_shop_staff')!
    expect(invite.args.p_job_title).toBe('Receptionist')
    expect(invite.args.p_location_ids).toEqual(['location-1'])
    expect(Object.keys(invite.args).some(key => key.includes('password'))).toBe(false)
    await page.screenshot({ path: test.info().outputPath('invitation.png'), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const locale of ['en', 'ar']) {
  test(`Team denied and empty states ${locale}`, async ({ page }) => {
    let denied = true
    await pilotFixture(page, locale, 'cashier', async name => {
      if (name !== 'shop_team_read') return undefined
      return { canManage: false, canManagePermissions: false, canViewAudit: false, permissionKeys: [], grantablePermissionKeys: [], members: [], roles: [], locations: [], invitations: [], events: [] }
    })
    await page.route('**/rest/v1/rpc/shop_team_read', async route => {
      if (denied) await route.fulfill({ status: 403, json: { message: 'SHOP_PERMISSION_DENIED' } })
      else await route.fallback()
    })
    await goToTeam(page, locale)
    await expect(page.getByRole('alert')).toContainText(locale === 'ar' ? 'معندكش صلاحية' : 'You do not have permission')
    await expect(page.getByRole('button', { name: locale === 'ar' ? 'إضافة أو دعوة موظف' : 'Add or invite staff' })).toHaveCount(0)
    denied = false
    await page.getByRole('button', { name: locale === 'ar' ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.getByText(locale === 'ar' ? 'مفيش أعضاء في الفريق لسه.' : 'No team members yet.', { exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: locale === 'ar' ? 'الدعوات' : 'Invitations', exact: true })).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('empty-readonly.png'), fullPage: true })
  })

  test(`Existing identity explicitly accepts invitation ${locale}`, async ({ page }) => {
    const code = '00000000-0000-4000-8000-000000000009'
    const { calls } = await pilotFixture(page, locale, 'owner', name => {
      if (name === 'accept_shop_invitation') return 'shop-1'
      if (name === 'shop_team_read') return { canManage: false, canManagePermissions: false, canViewAudit: false, permissionKeys: [], grantablePermissionKeys: [], members: [], roles: [], locations: [], invitations: [], events: [] }
      return undefined
    })
    await page.goto(`/auth/team-invitation?invite=${code}`)
    await expect(page.getByText('pilot@example.test', { exact: true })).toBeVisible()
    await expect(page.locator('input[type=password]')).toHaveCount(0)
    await page.getByRole('button', { name: locale === 'ar' ? 'قبول الدعوة' : 'Accept invitation', exact: true }).click()
    await expect(page).toHaveURL(/\/team$/)
    expect(calls.find(call => call.name === 'accept_shop_invitation')?.args.p_invitation_code).toBe(code)
    expect(calls.some(call => call.name === 'create_owner_shop')).toBe(false)
  })
}
