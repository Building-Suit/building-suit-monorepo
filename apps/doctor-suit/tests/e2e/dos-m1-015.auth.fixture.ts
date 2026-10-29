import{doctorPasswordStep}from'../helpers/password-step.mjs'
import { doctorPracticeCopy } from '../../app/utils/practicePresentation'
import { localRealtimeProtocol } from './realtimeProtocol'
import { test,expect,type BrowserContext,type Page } from '@playwright/test'
import { doctorDashboardCopy } from '../../app/utils/dashboardPresentation'
import { doctorAppointmentsCopy } from '../../app/utils/appointmentsPresentation'
const fixture = 'http://127.0.0.1:4338/__fixture';const base = 'http://127.0.0.1:4337'
test.use({ actionTimeout: 10000 })
async function local(context: BrowserContext,ar: boolean) { await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: base }]);await context.addInitScript(theme => localStorage.setItem('building-suit.theme',theme),ar ? 'light' : 'dark');await context.route('**/*',route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()) }
async function login(page: Page,email: string,ar: boolean) { await page.goto('/workspace');await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill(email);await doctorPasswordStep(page);await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only');await page.getByRole('button',{ name: ar ? 'تسجيل الدخول' : 'Sign in',exact: true }).click();await expect(page).toHaveURL(/\/workspace$/) }
const section = (page: Page,practice: string,clinic: string) => page.getByRole('heading',{ name: `Synthetic practice ${practice} · Clinic ${clinic}`,exact: true }).locator('..')
async function close(context: BrowserContext) { try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() } }
test.beforeEach(async ({ request }) => { await request.post(fixture,{ data: { reset: true } });await request.post(fixture,{ data: { delegation: true,patients: true,availability: true,appointments: true,dashboard: true } }) })
for(const ar of [false,true])test(`DOS-M1-015-C01/C03/C04 ${ar ? 'AR mobile light' : 'EN desktop dark'}: authoritative full totals, independent pages and permitted source history`,async ({ browser,request }) => {
  test.setTimeout(90000);const copy = doctorDashboardCopy(ar);const appointments = doctorAppointmentsCopy(ar);const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } })
  try {
    await local(context,ar);const page = await context.newPage();await localRealtimeProtocol(page);await login(page,'synthetic-doctor-a@example.test',ar)
    const a = section(page,'A','A1');await expect(a).toBeVisible();await expect(page.getByText(doctorPracticeCopy(ar).boundaries,{ exact: true })).toBeVisible();await expect(page.getByText(copy.description,{ exact: true })).toBeVisible();await expect(page.locator('dt').filter({ hasText: /Revenue|Income|Profit|Diagnosis|Prescription|الإيرادات|الدخل|الأرباح|التشخيص|الوصفات/ })).toHaveCount(0);await expect(section(page,'A','A2')).toBeVisible();await expect(section(page,'B','B1')).toHaveCount(0)
    await expect(a.getByText(copy.today,{ exact: true }).locator('..').locator('dd')).toHaveText('26');await expect(a.getByText(copy.queue,{ exact: true }).first().locator('..').locator('dd')).toHaveText('22')
    const picker = page.getByRole('combobox',{ name: ar ? 'الممارسة والموقع' : 'Practice and location',exact: true });await picker.click();await page.getByRole('option',{ name: / · Clinic A2$/ }).click();await expect(picker).toContainText('Clinic A2');await expect(a.getByText(copy.today,{ exact: true }).locator('..').locator('dd')).toHaveText('26')
    const day = a.getByRole('region',{ name: `Synthetic practice A · Clinic A1 · ${copy.appointments}`,exact: true });await expect(day.getByRole('button',{ name: copy.source,exact: true })).toHaveCount(20)
    await a.getByRole('navigation',{ name: `Synthetic practice A · Clinic A1 · ${copy.pages}`,exact: true }).getByRole('button',{ name: copy.next,exact: true }).click();await expect(day.getByRole('button',{ name: copy.source,exact: true })).toHaveCount(6)
    await expect(a.getByText(copy.today,{ exact: true }).locator('..').locator('dd')).toHaveText('26')
    const queue = a.getByRole('region',{ name: `Synthetic practice A · Clinic A1 · ${copy.queue}`,exact: true });await expect(queue.getByRole('button',{ name: copy.source,exact: true })).toHaveCount(20)
    await a.getByRole('navigation',{ name: `Synthetic practice A · Clinic A1 · ${copy.queuePages}`,exact: true }).getByRole('button',{ name: copy.next,exact: true }).click();await expect(queue.getByRole('button',{ name: copy.source,exact: true })).toHaveCount(2);await expect(day.getByRole('button',{ name: copy.source,exact: true })).toHaveCount(6)
    await day.getByRole('button',{ name: copy.source,exact: true }).first().click();await expect(page).toHaveURL(url => url.pathname==='/appointments' && Boolean(url.searchParams.get('appointment')) && url.searchParams.get('page')==='1' && url.searchParams.get('queuePage')==='1')
    const history = page.getByRole('dialog',{ name: appointments.sourceTitle,exact: true });await expect(history).toBeVisible();await expect(history.getByText(new URL(page.url()).searchParams.get('appointment')!,{ exact: true })).toBeVisible();await history.getByRole('button',{ name: appointments.loadHistory,exact: true }).click();await expect(history.getByText(appointments.booked,{ exact: true })).toBeVisible()
    const data = (await (await request.get(fixture)).json()).delegation;expect(data.appointmentRows.some((row: { id: string }) => row.id===new URL(page.url()).searchParams.get('appointment'))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  } finally { await close(context) }
})
for(const ar of [false,true])test(`DOS-M1-015-C02/C03 ${ar ? 'AR mobile' : 'EN desktop'}: exact secretary grants, foreign deep-link denial and stale multi-clinic read after revocation`,async ({ browser,request }) => {
  test.setTimeout(120000);const copy = doctorDashboardCopy(ar);const appointments = doctorAppointmentsCopy(ar);const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } })
  try {
    await local(context,ar);const page = await context.newPage();await localRealtimeProtocol(page);await login(page,'synthetic-secretary@example.test',ar)
    const data = (await (await request.get(fixture)).json()).delegation;const membership = data.memberships.find((item: { practice_id: string }) => item.practice_id===data.practices[0].id);const a1 = data.locations[0];const a2 = data.locations[1];const b1 = data.locations[2]
    await request.post(fixture,{ data: { delegationAction: { kind: 'grants',id: membership.id,grants: [{ location_id: a1.id,capabilities: ['dashboard.read','appointments.read'] },{ location_id: a2.id,capabilities: ['dashboard.read'] }] } } });await page.getByRole('button',{ name: copy.refresh,exact: true }).click()
    await expect(section(page,'A','A1')).toBeVisible();await expect(section(page,'A','A2')).toHaveCount(0);await expect(section(page,'B','B1')).toBeVisible();await expect(section(page,'A','A1').getByText('Synthetic household',{ exact: true })).toHaveCount(0);await expect(section(page,'A','A1').getByText(copy.restricted,{ exact: true }).first()).toBeVisible()
    const current = data.appointmentRows.filter((item: { location_id: string }) => item.location_id===a1.id).sort((a: { starts_at: string; id: string },b: { starts_at: string; id: string }) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id))[0]
    await request.post(fixture,{ data: { delegationAction: { kind: 'history-scope',id: current.id,locationId: a2.id } } })
    await section(page,'A','A1').getByRole('button',{ name: copy.source,exact: true }).first().click();const restrictedHistory = page.getByRole('dialog',{ name: appointments.sourceTitle,exact: true });await expect(restrictedHistory.getByText(current.id,{ exact: true })).toBeVisible();await expect(restrictedHistory.getByText(appointments.restricted,{ exact: true })).toBeVisible();await restrictedHistory.getByRole('button',{ name: appointments.loadHistory,exact: true }).click();await expect(restrictedHistory).toBeHidden()
    await page.goto('/workspace');await expect(section(page,'B','B1')).toBeVisible()
    await section(page,'B','B1').getByRole('button',{ name: copy.source,exact: true }).first().click();await expect(page.getByRole('dialog',{ name: appointments.sourceTitle,exact: true })).toBeVisible()
    const target = data.appointmentRows.find((item: { location_id: string }) => item.location_id===a1.id);await page.goto(`/appointments?appointment=${target.id}&day=${new Date().toISOString().slice(0,10)}&practice=${a1.practice_id}&location=${a1.id}`);await expect(page.getByText(appointments.denied,{ exact: true })).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goto('/workspace');await expect(section(page,'A','A1')).toBeVisible();await expect(section(page,'B','B1')).toBeVisible()
    let release!: () => void;let intercepted = false;let captured = false;let oldCompleted = false;const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/rest/v1/rpc/doctor_appointment_board',async route => { if(route.request().postDataJSON().p_location===a1.id && !intercepted) { intercepted = true;const response = await route.fetch();expect(response.status()).toBe(200);captured = true;await gate;await route.fulfill({ response }).catch(() => {});oldCompleted = true } else await route.continue() })
    await page.getByRole('button',{ name: copy.refresh,exact: true }).click();await expect.poll(() => captured).toBe(true)
    await request.post(fixture,{ data: { delegationAction: { kind: 'status',id: membership.id,status: 'revoked' } } });await page.evaluate(() => window.dispatchEvent(new Event('focus')));await expect(section(page,'A','A1')).toHaveCount(0);release();await expect.poll(() => oldCompleted).toBe(true)
    await expect(section(page,'B','B1')).toBeVisible();await expect(section(page,'A','A1')).toHaveCount(0);await expect(page.getByRole('combobox',{ name: ar ? 'الممارسة والموقع' : 'Practice and location',exact: true })).toContainText('Clinic B1');expect(b1.practice_id).not.toBe(a1.practice_id)
  } finally { await close(context) }
})
