import{doctorPasswordStep}from'../helpers/password-step.mjs'
import { test,expect,type BrowserContext,type Page,type WebSocketRoute } from '@playwright/test'
import { doctorAppointmentsCopy } from '../../app/utils/appointmentsPresentation'
import { doctorAdministrativeReasonOptions } from '../../app/utils/administrativeEdition'
import { doctorProfileCopy } from '../../app/utils/patientProfilePresentation'
import { doctorDelegationCopy } from '../../app/utils/delegationPresentation'
const fixture = 'http://127.0.0.1:4338/__fixture';const base = 'http://127.0.0.1:4337'
test.use({ actionTimeout: 10000 })
async function local(context: BrowserContext,ar: boolean) { await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: base }]);await context.addInitScript(theme => localStorage.setItem('building-suit.theme',theme),ar ? 'light' : 'dark');await context.route('**/*',route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()) }
async function login(page: Page,email: string,ar: boolean) { await page.goto('/appointments');await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill(email);await doctorPasswordStep(page);await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only');await page.getByRole('button',{ name: ar ? 'تسجيل الدخول' : 'Sign in',exact: true }).click();await expect(page).toHaveURL(url => url.pathname==='/appointments') }
async function choose(page: Page,ar: boolean,clinic: string) { const select = page.getByRole('combobox',{ name: ar ? 'الممارسة والموقع' : 'Practice and location',exact: true });await select.click();await page.getByRole('option',{ name: new RegExp(` · ${clinic}$`) }).click();await expect(select).toContainText(clinic);await expect(select).toBeEnabled() }
async function live(page: Page) {
  const joins: { socket: WebSocketRoute; topic: string; ref: string; filters: { id: number; filter: string }[] }[] = []
  await page.routeWebSocket('**/realtime/v1/websocket*',socket => {
    socket.onMessage(raw => {
      const [joinRef,ref,topic,event,payload] = JSON.parse(String(raw))
      if(event==='phx_join') { const filters = payload.config.postgres_changes.map((item: object,index: number) => ({ ...item,id: index+1 }));joins.push({ socket,topic,ref: joinRef,filters });socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{ status: 'ok',response: { postgres_changes: filters } }]));socket.send(JSON.stringify([joinRef,null,topic,'system',{ extension: 'postgres_changes',status: 'ok',message: 'Synthetic subscription ready' }])) }
      else if(event==='phx_leave')socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{ status: 'ok',response: {} }]))
      else if(event==='heartbeat')socket.send(JSON.stringify([null,ref,'phoenix','phx_reply',{ status: 'ok',response: {} }]))
    })
  })
  return { joins,send(locationId: string,index = joins.length-1) { const join = joins[index];const ids = join.filters.filter(item => item.filter===`location_id=eq.${locationId}`).map(item => item.id);join.socket.send(JSON.stringify([join.ref,null,join.topic,'postgres_changes',{ ids,data: { schema: 'public',table: 'appointment_queue_revisions',type: 'UPDATE',commit_timestamp: new Date().toISOString(),columns: [],record: { location_id: locationId,revision: 99 },old_record: {} } }])) },disconnect() { joins.at(-1)!.socket.close() } }
}
const card = (page: Page,name: string) => page.locator('.bs-appointment-event').filter({ hasText: name })
async function close(contexts: BrowserContext[]) { await Promise.allSettled(contexts.map(async context => { try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() } })) }
test.beforeEach(async ({ request }) => {
  await request.post(fixture,{ data: { reset: true } })
  await request.post(fixture,{ data: { delegation: true,patients: true,documents: true,availability: true,appointments: true,edition: 'administrative_candidate',editionRevision: 2,entitlements:Object.fromEntries([1,2].map(n=>[`a3000000-0000-4000-8000-${String(n).padStart(12,'0')}`,{state:'trial',revision:1,writes_allowed:true,can_add_staff:true,can_add_clinic:true,over_limit:false,valid_until:new Date(Date.now()+3600000).toISOString()}])) } })
})
for(const ar of [false,true])test(`DOS-AE-002 candidate ${ar ? 'AR mobile light RTL' : 'EN desktop dark'}: coded reasons, effective grants and omitted documents`,async ({ browser,request }) => {
  test.setTimeout(120000)
  const copy = doctorAppointmentsCopy(ar);const access = doctorDelegationCopy(ar);const profile = doctorProfileCopy(ar);const options = doctorAdministrativeReasonOptions(ar)
  const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } })
  try {
    await local(context,ar);const page = await context.newPage();await live(page);await login(page,'synthetic-doctor-a@example.test',ar);await choose(page,ar,'Clinic A1');await expect(page.getByText(copy.current,{ exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir',ar ? 'rtl' : 'ltr')
    const second = card(page,'Synthetic A patient 02');if(await second.locator('details').getAttribute('open')===null)await second.getByText(copy.calendar.actions,{ exact: true }).click();await second.getByRole('button',{ name: copy.actions.cancelled,exact: true }).click()
    const cancel = page.getByRole('dialog',{ name: copy.actions.cancelled,exact: true });await expect(cancel.getByRole('textbox')).toHaveCount(0);await expect(cancel.getByRole('button',{ name: copy.actions.cancelled,exact: true })).toBeDisabled()
    await cancel.getByRole('combobox',{ name: copy.reason,exact: true }).click();await expect(page.getByRole('option')).toHaveCount(4);await page.getByRole('option',{ name: options[3]!.label,exact: true }).click();await cancel.getByRole('button',{ name: copy.actions.cancelled,exact: true }).click();await expect(cancel).toBeHidden()
    const data = (await (await request.get(fixture)).json()).delegation
    const cancelled = data.appointmentRows.find((row: { state: string }) => row.state==='cancelled')
    expect(data.appointmentHistory[cancelled.id].at(-1).details.reason).toBe('admin.cancellation')
    await page.getByLabel(copy.date,{ exact: true }).fill(data.scheduleTestDay);await page.getByLabel(copy.date,{ exact: true }).press('Tab')
    await page.getByRole('button',{ name: copy.create,exact: true }).click();const editor = page.getByRole('dialog',{ name: copy.create,exact: true })
    await editor.getByRole('combobox',{ name: copy.patient,exact: true }).click();await page.getByRole('searchbox',{ name: `${ar ? 'بحث' : 'Search'} · ${copy.patient}`,exact: true }).fill('household');await page.getByRole('option',{ name: 'Synthetic household',exact: true }).click()
    await editor.getByRole('combobox',{ name: copy.slot,exact: true }).click();await page.getByRole('option',{ name: '09:00',exact: true }).click();await editor.getByRole('button',{ name: copy.save,exact: true }).click();await expect(editor).toBeHidden()
    const booked = card(page,'Synthetic household');if(await booked.locator('details').getAttribute('open')===null)await booked.getByText(copy.calendar.actions,{ exact: true }).click();await booked.getByRole('button',{ name: copy.calendar.reschedule,exact: true }).click();const move = page.getByRole('dialog',{ name: copy.reschedule,exact: true })
    await expect(move.getByRole('textbox',{ name: copy.reason,exact: true })).toHaveCount(0);await move.getByRole('combobox',{ name: copy.slot,exact: true }).click();await page.getByRole('option',{ name: '09:40',exact: true }).click();await move.getByRole('combobox',{ name: copy.reason,exact: true }).click();await page.getByRole('option',{ name: options[1]!.label,exact: true }).click();await move.getByRole('button',{ name: copy.save,exact: true }).click();await expect(move).toBeHidden()
    if(await booked.locator('details').getAttribute('open')===null)await booked.getByText(copy.calendar.actions,{ exact: true }).click();await booked.getByRole('button',{ name: copy.history,exact: true }).click();const history = page.getByRole('dialog',{ name: copy.history,exact: true });await expect(history).toContainText(options[1]!.label);await history.getByRole('button',{ name: ar ? 'إغلاق' : 'Close',exact: true }).click()
    await page.goto('/team');await page.getByRole('button',{ name: access.invite,exact: true }).click();const invitation = page.getByRole('dialog',{ name: access.inviteTitle,exact: true })
    await invitation.getByLabel(access.email,{ exact: true }).fill('synthetic-early-staff@example.test');await invitation.getByRole('combobox',{ name: access.preset,exact: true }).click();await page.getByRole('option',{ name: access.all,exact: true }).click()
    const group = invitation.getByRole('group',{ name: `${access.permissions}: Clinic A1`,exact: true });await expect(group.getByRole('checkbox')).toHaveCount(10);await expect(group.getByRole('checkbox',{ checked: true })).toHaveCount(10)
    for(const key of ['documents.read','documents.write'] as const)await expect(invitation.getByRole('checkbox',{ name: access.capabilityLabels[key],exact: true })).toHaveCount(0)
    await invitation.getByRole('button',{ name: access.create,exact: true }).click();await expect(invitation.getByLabel(access.credentialLabel,{ exact: true })).not.toHaveValue('')
    await invitation.getByRole('button',{ name: access.cancel,exact: true }).filter({ hasText: access.cancel }).click();await page.goto('/patients');await page.getByRole('link',{ name: 'Synthetic A patient 02',exact: true }).click()
    await expect(page.getByRole('heading',{ name: 'Synthetic A patient 02',exact: true })).toBeVisible();await expect(page.getByRole('heading',{ name: profile.attachments,exact: true })).toHaveCount(0);await expect(page.getByRole('button',{ name: profile.upload,exact: true })).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0)
    const final = await (await request.get(fixture)).json();expect(final.edition).toBe('administrative_candidate');expect(final.outbox).toEqual([])
    const created = final.delegation.invitations.find((row: { recipient_email: string }) => row.recipient_email==='synthetic-early-staff@example.test');expect(created.grants[0].capabilities).toHaveLength(10);expect(created.grants[0].capabilities.some((cap: string) => cap.startsWith('documents.'))).toBe(false)
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  } finally { await close([context]) }
})
