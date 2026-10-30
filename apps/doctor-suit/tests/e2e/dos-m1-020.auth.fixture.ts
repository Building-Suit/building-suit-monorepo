import { observeQueueActivation } from '../helpers/queue-activation-diagnostic'
import { installDoctorEntryValidity, readDoctorEntryValidity } from '../helpers/entry-validity.mjs'
import{doctorPasswordStep}from'../helpers/password-step.mjs'
import { test,expect,type Page,type BrowserContext,type JSHandle } from '@playwright/test'
import { doctorPatientsCopy } from '../../app/utils/patientsPresentation'
import { doctorAppointmentsCopy } from '../../app/utils/appointmentsPresentation'
import { doctorAvailabilityCopy } from '../../app/utils/availabilityPresentation'
import { doctorDelegationCopy } from '../../app/utils/delegationPresentation'
import { doctorAvailabilityToday } from '../../app/utils/availability'
import { localRealtimeProtocol } from './realtimeProtocol'
const fixture = 'http://127.0.0.1:4338/__fixture'
test.use({ actionTimeout: 10000 })
async function prepare(context: BrowserContext,ar: boolean) { await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: 'http://127.0.0.1:4337' }]);await context.addInitScript(theme => localStorage.setItem('building-suit.theme',theme),ar ? 'light' : 'dark');await context.route('**/*',route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()) }
async function login(page: Page,email: string,ar: boolean,path='/account') { await page.goto(path);await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill(email);await doctorPasswordStep(page);await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only');await page.getByRole('button',{ name: ar ? 'تسجيل الدخول' : 'Sign in',exact: true }).click();await expect(page).toHaveURL(url => url.pathname===path) }
async function choose(page: Page,name: string,ar: boolean) { const select = page.getByRole('combobox',{ name: ar ? 'الممارسة والموقع' : 'Practice and location',exact: true });await select.click();await page.getByRole('option',{ name: new RegExp(` · ${name}$`) }).click();await expect(select).toContainText(name);await expect(select).toBeEnabled() }
async function patient(page: Page,name: string,ar: boolean) { const copy = doctorPatientsCopy(ar);await page.goto('/patients');await page.getByRole('button',{ name: copy.create,exact: true }).click();const dialog = page.getByRole('dialog',{ name: copy.create,exact: true });await dialog.getByLabel(new RegExp(`^${copy.name}`)).fill(name);await dialog.getByRole('button',{ name: copy.save,exact: true }).click();await expect(dialog).toBeHidden();await expect(page.getByRole('link',{ name,exact: true })).toBeVisible() }
async function invite(page: Page,name: string,ar: boolean,capabilities: string[]) {
  const copy = doctorDelegationCopy(ar);await page.goto('/team');await choose(page,name,ar);await page.getByRole('button',{ name: copy.invite,exact: true }).click();const dialog = page.getByRole('dialog',{ name: copy.inviteTitle,exact: true });await dialog.getByLabel(copy.email,{ exact: true }).fill('synthetic-secretary@example.test');const group = dialog.getByRole('group',{ name: `${copy.permissions}: ${name}`,exact: true })
  for(const [key,label]of Object.entries(copy.capabilityLabels)) { const control = group.getByRole('checkbox',{ name: label,exact: true });if(capabilities.includes(key))await control.check();else await control.uncheck() }
  await dialog.getByRole('button',{ name: copy.create,exact: true }).click();const credential = await dialog.getByLabel(copy.credentialLabel,{ exact: true }).inputValue();expect(/^[0-9a-f-]{36}\.[0-9a-f]{64}$/.test(credential)).toBe(true);await dialog.getByRole('button',{ name: copy.cancel,exact: true }).filter({ hasText: copy.cancel }).click();return credential
}
async function accept(page: Page,credential: string,ar: boolean) { const copy = doctorDelegationCopy(ar);await page.goto('/invitations/accept');await page.getByLabel(copy.codeLabel,{ exact: true }).fill(credential);await page.getByRole('button',{ name: copy.review,exact: true }).click();await page.getByRole('button',{ name: copy.accept,exact: true }).click();await expect(page.getByText(copy.acceptedNotice,{ exact: true })).toBeVisible();await page.getByRole('button',{ name: copy.continue,exact: true }).click();await expect(page).toHaveURL(/\/workspace$/) }
for(const ar of [false,true])for(const interruptQueue of [false,true])test(`DOS-M1-020-C01/C02 ${ar ? 'AR mobile light' : 'EN desktop dark'}: doctor-alone setup through two-doctor secretary revocation${interruptQueue ? ' with queue pointer refresh' : ''}`,async ({ browser,request }) => {
  test.setTimeout(150000);await request.post(fixture,{ data: { reset: true } });await request.post(fixture,{ data: { delegation: true,milestone: true,patients: true,documents: true,availability: true,appointments: true } })
  const setupDiagnostic={saveRequests:0,saveAcknowledged:0,completeRequests:0,completeAcknowledged:0}
  const secretaryRpc:{rpc:string;status:number}[]=[]
  let queueActivation: JSHandle<ReturnType<typeof observeQueueActivation>> | null = null
  let releaseQueueRefresh: (() => void) | undefined
  const contexts: BrowserContext[] = [];const stage = (value: string) => console.info(`Doctor M1 combined stage: ${value}`)
  try {
    for(let n=0;n<4;n++) { const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 },reducedMotion: 'reduce' });contexts.push(context);await prepare(context,ar) }
    const [a,b,s,o] = await Promise.all(contexts.map(context => context.newPage()));await installDoctorEntryValidity(a);
    const rpcNames={doctor_identity:'identity',doctor_contexts:'contexts',doctor_appointment_board:'appointment_board',doctor_transition_appointment:'appointment_transition'} as const
    s.on('response',response=>{const name=Object.keys(rpcNames).find(name=>response.url().endsWith('/rpc/'+name));if(name)secretaryRpc.push({rpc:rpcNames[name as keyof typeof rpcNames],status:response.status()});if(secretaryRpc.length>16)secretaryRpc.shift()})
    a.on('request',request=>{if(request.method()!=='POST')return;const target=request.url().endsWith('/rpc/doctor_save_onboarding_draft')?'saveRequests':request.url().endsWith('/rpc/doctor_complete_onboarding')?'completeRequests':null;if(target)setupDiagnostic[target]=Math.min(5,setupDiagnostic[target]+1)})
    a.on('response',response=>{if(!response.ok()||response.request().method()!=='POST')return;const target=response.url().endsWith('/rpc/doctor_save_onboarding_draft')?'saveAcknowledged':response.url().endsWith('/rpc/doctor_complete_onboarding')?'completeAcknowledged':null;if(target)setupDiagnostic[target]=Math.min(5,setupDiagnostic[target]+1)})
    for(const page of [a,b,s,o])await localRealtimeProtocol(page)
    const appointments = doctorAppointmentsCopy(ar);const availability = doctorAvailabilityCopy(ar);const access = doctorDelegationCopy(ar)
    const offset = 12-new Date().getUTCHours();const zone = offset===0 ? 'Etc/UTC' : `Etc/GMT${offset>0 ? '-' : '+'}${Math.abs(offset)}`;const day = doctorAvailabilityToday(zone)
    stage('doctor-alone onboarding and two clinics');await login(a,'synthetic-doctor-a@example.test',ar);await a.getByRole('link',{ name: ar ? 'إكمال إعداد الممارسة' : 'Complete practice setup',exact: true }).first().click();await a.getByLabel(ar ? /^الاسم المعروض للطبيب/ : /^Doctor display name/).fill('Synthetic doctor A');await a.getByRole('button',{name:ar?'متابعة':'Continue',exact:true}).click();await a.getByLabel(ar ? /^اسم الممارسة/ : /^Practice name/).fill('Synthetic practice A');await a.getByLabel(ar ? /^اسم الموقع/ : /^Location name/).fill('Clinic A1');await a.getByRole('combobox',{name:ar?'المنطقة الزمنية':'Timezone',exact:true}).click();await a.getByRole('option',{name:zone,exact:true}).click();await a.getByRole('button',{ name: ar ? 'إنشاء الممارسة وفتح لوحة التحكم' : 'Create practice and open dashboard',exact: true }).click({ clickCount: 2 });await expect(a).toHaveURL(/\/workspace$/);await expect(a.getByText(ar ? 'المؤهلات المهنية غير متحقق منها' : 'Professional credentials unverified',{ exact: true })).toBeVisible()
    await a.goto('/locations');await a.getByRole('button',{ name: ar ? 'إضافة موقع' : 'Add location',exact: true }).click();const location = a.getByRole('dialog',{ name: ar ? 'إضافة موقع' : 'Add location',exact: true });await location.getByLabel(ar ? /^اسم الموقع/ : /^Location name/).fill('Clinic A2');await location.getByLabel(ar ? /^المنطقة الزمنية/ : /^IANA timezone/).fill('Europe/London');await location.getByRole('button',{ name: ar ? 'حفظ الموقع' : 'Save location',exact: true }).click();await expect(location).toBeHidden();await expect(a.getByRole('row',{ name: /Clinic A2/ })).toBeVisible();await choose(a,'Clinic A1',ar)
    // The shared table section wraps a same-named vendor scroll region;
    // bind queue assertions and commands to the complete outer table.
    stage('patient profile and current-day booking');await patient(a,'Synthetic combined A patient',ar);await a.getByRole('link',{ name: 'Synthetic combined A patient',exact: true }).click();await expect(a.getByRole('heading',{ name: 'Synthetic combined A patient',exact: true })).toBeVisible()
    await a.goto('/availability');await a.getByRole('button',{ name: availability.addWindow,exact: true }).click();const availabilityDialog = a.getByRole('dialog',{ name: availability.addWindow,exact: true });await availabilityDialog.getByRole('combobox',{ name: availability.weekday,exact: true }).click();await a.getByRole('option',{ name: availability.weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()],exact: true }).click();await availabilityDialog.getByRole('button',{ name: availability.save,exact: true }).click();await expect(availabilityDialog).toBeHidden()
    await a.goto('/appointments');await a.getByRole('button',{ name: appointments.create,exact: true }).click();const booking = a.getByRole('dialog',{ name: appointments.create,exact: true });await booking.getByRole('combobox',{ name: appointments.patient,exact: true }).click();await a.getByRole('option',{ name: 'Synthetic combined A patient',exact: true }).click();await booking.getByRole('combobox',{ name: appointments.slot,exact: true }).click();await a.getByRole('option',{ name: '14:00',exact: true }).click();await booking.getByRole('button',{ name: appointments.save,exact: true }).evaluate((button: HTMLButtonElement) => { button.click();button.click() });await expect(booking).toBeHidden();const card = a.locator('.bs-appointment-event').filter({ hasText: 'Synthetic combined A patient' });await expect(card).toHaveCount(1);await card.getByText(appointments.calendar.actions,{ exact: true }).click();await card.getByRole('button',{ name: appointments.actions.checked_in,exact: true }).click();const checkin = a.getByRole('dialog',{ name: appointments.actions.checked_in,exact: true });await checkin.getByRole('button',{ name: appointments.actions.checked_in,exact: true }).click();await expect(checkin).toBeHidden();await expect(a.getByRole('region',{ name: appointments.queue,exact: true }).first()).toContainText('Synthetic combined A patient')
    stage('independent invitations and shared secretary');await login(b,'synthetic-doctor-b@example.test',ar);await b.goto('/patients');await choose(b,'Clinic B1',ar);await patient(b,'Synthetic combined B patient',ar);const codeA = await invite(a,'Clinic A1',ar,['patients.read','appointments.read','queue.manage']);const codeB = await invite(b,'Clinic B1',ar,['patients.read','appointments.read'])
    await login(s,'synthetic-secretary@example.test',ar);await accept(s,codeA,ar);await accept(s,codeB,ar);await s.goto('/appointments');await choose(s,'Clinic A1',ar);await s.getByRole('combobox',{ name: ar ? 'الممارسة والموقع' : 'Practice and location',exact: true }).click();await expect(s.getByRole('option',{ name: /Clinic A2/ })).toHaveCount(0);await s.keyboard.press('Escape');await expect(s.getByRole('button',{ name: appointments.create,exact: true })).toHaveCount(0)
    const queue = s.getByRole('region',{ name: appointments.queue,exact: true }).first();const startAction = queue.getByRole('row').filter({ hasText: 'Synthetic combined A patient' }).getByRole('button',{ name: appointments.actions.in_progress,exact: true });queueActivation = await startAction.evaluateHandle(observeQueueActivation).catch(()=>null);
    if(interruptQueue) {
      let captured = 0
      const held = new Promise<void>(resolve => { releaseQueueRefresh = resolve })
      await s.route('**/rest/v1/rpc/doctor_appointment_board', async route => {
        const response = await route.fetch();captured++;await held;await route.fulfill({ response })
      })
      await expect(startAction).toBeEnabled();await startAction.scrollIntoViewIfNeeded()
      const bounds = await startAction.boundingBox();expect(bounds).not.toBeNull()
      await s.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);await s.mouse.down()
      await s.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect.poll(() => captured).toBeGreaterThan(0)
      await expect(s.locator('main').getByLabel(appointments.date,{exact:true})).toBeDisabled()
      await s.mouse.up()
    } else await startAction.click();const start = s.getByRole('dialog',{ name: appointments.actions.in_progress,exact: true });
    if(interruptQueue) {
      await expect(start).toBeVisible()
      const delivered = s.waitForResponse('**/rest/v1/rpc/doctor_appointment_board');releaseQueueRefresh!()
      const response = await delivered;expect(response.ok()).toBe(true);expect(await response.finished()).toBeNull()
      await expect(s.locator('main').getByLabel(appointments.date,{exact:true})).toBeEnabled()
      await expect(start).toBeVisible()
      await s.unrouteAll({behavior:'wait'})
    }
    await start.getByRole('button',{ name: appointments.actions.in_progress,exact: true }).click();await expect(start).toBeHidden()
    await s.goto('/patients');await choose(s,'Clinic B1',ar);await expect(s.getByRole('link',{ name: 'Synthetic combined B patient',exact: true })).toBeVisible();await expect(s.getByRole('link',{ name: 'Synthetic combined A patient',exact: true })).toHaveCount(0);await expect(s.getByRole('button',{ name: doctorPatientsCopy(ar).create,exact: true })).toHaveCount(0);await s.getByRole('link',{ name: 'Synthetic combined B patient',exact: true }).click();await expect(s.getByRole('heading',{ name: 'Synthetic combined B patient',exact: true })).toBeVisible()
    stage('revocation and explicit independent reselection');await s.goto('/appointments');await choose(s,'Clinic A1',ar);await a.reload();await a.getByRole('row',{ name: /synthetic-secretary@example.test/ }).getByRole('button',{ name: access.revoke,exact: true }).click();await a.getByRole('dialog',{ name: access.actionTitle,exact: true }).getByRole('button',{ name: access.confirm,exact: true }).click();await s.bringToFront();await s.evaluate(() => window.dispatchEvent(new Event('focus')));await expect(s.locator('.bs-appointment-event').filter({ hasText: 'Synthetic combined A patient' })).toHaveCount(0);await choose(s,'Clinic B1',ar);await s.goto('/patients');await expect(s.getByRole('link',{ name: 'Synthetic combined B patient',exact: true })).toBeVisible()
    await login(o,'synthetic-outsider@example.test',ar);await o.goto('/patients');await expect(o.getByRole('link',{ name: /Synthetic combined [AB] patient/ })).toHaveCount(0);await expect(o.getByRole('button',{ name: doctorPatientsCopy(ar).create,exact: true })).toHaveCount(0)
    const data = (await (await request.get(fixture)).json()).delegation;expect(data.milestoneCompleteCalls).toBe(1);expect(data.patientRows).toHaveLength(2);expect(data.appointmentRows).toHaveLength(1);expect(data.memberships).toHaveLength(2);expect(data.memberships.filter((item: { status: string }) => item.status==='revoked')).toHaveLength(1);expect(Object.values(data.appointmentHistory).flat().filter((item: unknown) => (item as { type: string }).type==='appointment.in_progress')).toHaveLength(1);expect(await s.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  } catch(error) {
    if(queueActivation)try{console.info('Doctor M1 queue activation diagnostic '+JSON.stringify(await queueActivation.evaluate(observer=>observer.read())))}catch{console.info('Doctor M1 queue activation diagnostic '+JSON.stringify({unavailable:true}))}
    console.info('Doctor M1 setup acknowledgement diagnostic '+JSON.stringify(setupDiagnostic))
    const entry=contexts[0]?.pages()[0];if(entry&&!entry.isClosed())try{console.info('Doctor M1 entry native validity '+JSON.stringify(await readDoctorEntryValidity(entry)))}catch{/* Fixed-state diagnostic unavailable. */}
    const page=contexts[0]?.pages()[0]
    if(page&&!page.isClosed())try{
      const cue=await page.evaluate(()=>{
        type Component={parent?:Component|null;props?:Record<string,unknown>}
        const record=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null
        let node=(document.querySelector('form') as (HTMLElement&{__vueParentComponent?:Component})|null)?.__vueParentComponent
        let form:Record<string,unknown>|null=null
        for(let n=0;node&&n<15;n++,node=node.parent??undefined){const candidate=record(node.props?.form);if(candidate){form=candidate;break}}
        const provided=(key:string)=>typeof form?.[key]==='string'&&String(form[key]).trim().length>0
        let timezoneValid=false
        try{timezoneValid=provided('timezone')&&Boolean(new Intl.DateTimeFormat('en',{timeZone:String(form?.timezone)}))}catch{/* Only report fixed validity. */}
        const root=document.getElementById('__nuxt') as (HTMLElement&{__vue_app__?:{config:{globalProperties:Record<string,unknown>}}})|null
        const globals=root?.__vue_app__?.config.globalProperties,auth=record(record(globals?.$doctorAuth)?.state),practice=record(record(globals?.$doctorPractice)?.state),setup=record(practice?.setup)
        const known=(value:unknown,choices:string[],fallback:string|null='unknown')=>typeof value==='string'&&choices.includes(value)?value:fallback
        return{knownOnboarding:location.pathname==='/onboarding',formModelFound:Boolean(form),nameProvided:provided('name'),practiceProvided:provided('workspaceName'),locationProvided:provided('locationName'),timezoneProvided:provided('timezone'),timezoneValid,invalidControlCount:document.querySelectorAll('form input:invalid,form select:invalid,form textarea:invalid').length,authPhase:known(auth?.phase,['checking','unavailable','signed-out','verification','authenticated']),identityPresent:Boolean(auth?.identity),practicePhase:known(practice?.phase,['idle','loading','ready','denied','error']),pending:Boolean(practice?.pending),setupPresent:Boolean(setup),serverDraftPresent:Boolean(setup?.draft),practiceError:known(practice?.error,['session','unavailable','denied','conflict','invalid','network'],null)}
      })
      console.info('Doctor M1 setup validity diagnostic '+JSON.stringify(cue))
    }catch{console.info('Doctor M1 setup validity diagnostic '+JSON.stringify({unavailable:true}))}
    console.info('Doctor M1 secretary fixed RPC diagnostic '+JSON.stringify(secretaryRpc))
    const secretary=contexts[2]?.pages()[0]
    if(secretary&&!secretary.isClosed())try{
      const cue=await secretary.evaluate(()=>{
        const record=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null
        const root=document.getElementById('__nuxt') as(HTMLElement&{__vue_app__?:{config:{globalProperties:Record<string,unknown>}}})|null
        const globals=root?.__vue_app__?.config.globalProperties,auth=record(record(globals?.$doctorAuth)?.state),context=record(record(globals?.$doctorContext)?.state),selected=record(context?.current),appointment=record(record(globals?.$doctorAppointments)?.state),board=record(appointment?.board)
        const known=(v:unknown,values:string[])=>typeof v==='string'&&values.includes(v)?v:'unknown'
        return{knownAppointmentsRoute:location.pathname==='/appointments',authPhase:known(auth?.phase,['checking','unavailable','signed-out','verification','authenticated']),authPending:Boolean(auth?.pending),identityPresent:Boolean(auth?.identity),contextPhase:known(context?.phase,['idle','loading','choosing','switching','ready','denied','error','expired']),selectedPresent:Boolean(selected),secretaryPortal:selected?.portal==='secretary',queueGranted:Array.isArray(selected?.capabilities)&&selected.capabilities.includes('queue.manage'),loading:Boolean(appointment?.loading),refreshing:Boolean(appointment?.refreshing),pending:Boolean(appointment?.pending),boardPresent:Boolean(board),canQueue:board?.canQueue===true,canWrite:board?.canWrite===true,error:known(appointment?.error,['denied','invalid','conflict','network','unavailable']),actionError:known(appointment?.actionError,['denied','invalid','conflict','network','unavailable']),dialogCount:Math.min(5,document.querySelectorAll('[role=dialog]').length)}
      })
      console.info('Doctor M1 secretary readiness diagnostic '+JSON.stringify(cue))
    }catch{console.info('Doctor M1 secretary readiness diagnostic '+JSON.stringify({unavailable:true}))}
    throw error
  } finally { releaseQueueRefresh?.();await contexts[2]?.pages()[0]?.unrouteAll({behavior:'wait'});if(queueActivation)try{await queueActivation.evaluate(observer=>observer.dispose());await queueActivation.dispose()}catch{/* Context teardown still owns final cleanup. */}await Promise.allSettled(contexts.map(async context => { try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() } })) }
})
