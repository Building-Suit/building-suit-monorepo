// Owned loopback-only browser against real GoTrue/Mailpit/PostgREST. No artifacts or error text.
import { chromium,expect as browserExpect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { spawn,spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
export async function verifyDoctorAccountProvider({ root,api,key,project,expect,setStage }) {
  const origin = 'http://127.0.0.1:4341';let server;let browser;let context;let token = '';let changedPolicy = false
  const pause = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds))
  function policy(seconds) {
    expect([20,900].includes(seconds),'Owned account policy fixture rejected')
    const result = spawnSync('docker',['exec','-i',`supabase_db_${project}`,'psql','-X','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{ input: `update doctor_private.account_security_policy set contact_reauthentication_seconds=${seconds} where singleton;`,encoding: 'utf8',timeout: 10000,maxBuffer: 65536 })
    expect(result.status===0,'Owned account policy fixture failed')
  }
  async function until(check,milliseconds=15000) { const deadline = Date.now()+milliseconds;while(!await check()) { expect(Date.now()<deadline,'Actual account stage timed out');await pause(100) } }
  async function messages() { const response = await fetch('http://127.0.0.1:65324/api/v1/messages',{ signal: AbortSignal.timeout(5000) });expect(response.ok,'Owned mail service unavailable');return (await response.json()).messages || [] }
  async function link(email,excluded=new Set()) {
    let result
    await until(async () => {
      const item = (await messages()).find(item => !excluded.has(item.ID) && item.To?.some(to => to.Address===email))
      if(!item)return false
      const response = await fetch(`http://127.0.0.1:65324/api/v1/message/${encodeURIComponent(item.ID)}`,{ signal: AbortSignal.timeout(5000) });expect(response.ok,'Owned mail read failed')
      const data = await response.json();const match = (data.HTML || data.Text || '').replaceAll('&amp;','&').match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)
      if(!match)return false
      const target = new URL(match[0]);expect(target.origin===api && target.pathname==='/auth/v1/verify','Captured mail must target owned GoTrue');result = target.href;return true
    });return result
  }
  function client(accessToken) { return createClient(api,key,{ global: { headers: { Authorization: `Bearer ${accessToken}` } },auth: { persistSession: false,autoRefreshToken: false,detectSessionInUrl: false } }) }
  async function settings(accessToken=token) { const result = await client(accessToken).rpc('doctor_account_settings');expect(!result.error,'Real account settings read rejected');return result.data }
  try {
    setStage('actual web app readiness')
    server = spawn(process.execPath,['apps/doctor-suit/.output/server/index.mjs'],{ cwd: root,env: { ...process.env,NITRO_HOST: '127.0.0.1',NITRO_PORT: '4341',APP_URL: origin,NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED: 'true',NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT: 'local',NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN: origin,NUXT_PUBLIC_DOCTOR_AUTH_URL: api,NUXT_PUBLIC_DOCTOR_AUTH_KEY: key },detached: true,stdio: 'ignore' })
    await until(async () => { try { return (await fetch(`${origin}/`,{ signal: AbortSignal.timeout(1000) })).ok } catch { return false } })
    browser = await chromium.launch({ headless: true });context = await browser.newContext({ viewport: { width: 1280,height: 1000 } })
    await context.route('**/*',route => [origin,api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
    const page = await context.newPage();page.setDefaultTimeout(15000)
    page.on('response',async response => { try { if(response.url().startsWith(`${api}/auth/v1/token`) && response.ok()) { const body = await response.json();if(typeof body.access_token==='string')token = body.access_token } } catch { /* No diagnostics from credential-bearing responses. */ } })
    const email = `synthetic-web-${randomUUID()}@example.test`;const password = `Synthetic-${randomUUID()}!9`;const newPassword = `Synthetic-${randomUUID()}!8`
    setStage('actual browser signup and PKCE confirmation');policy(20);changedPolicy = true
    await page.goto(`${origin}/sign-up`);await page.getByLabel(/^Display name/).fill('Synthetic personal web');await page.getByLabel(/^Email/).fill(email);await page.getByLabel(/^Password/).fill(password);await page.getByRole('button',{ name: 'Create synthetic account',exact: true }).click();await page.getByRole('heading',{ name: 'Verify account',exact: true }).waitFor()
    const unconfirmed = await createClient(api,key,{ auth: { persistSession: false,autoRefreshToken: false } }).auth.signInWithPassword({ email,password });expect(Boolean(unconfirmed.error) && !unconfirmed.data.session,'Actual unconfirmed account admitted')
    const confirmation = await link(email);await page.goto(confirmation);await page.waitForURL(`${origin}/onboarding`);expect(new URL(page.url()).search==='','Confirmation URL material was not scrubbed');await page.getByRole('link',{name:'Back to account',exact:true}).last().click();await page.waitForURL(`${origin}/account`);await page.getByRole('button',{ name: 'Edit account details',exact: true }).waitFor();await until(() => Boolean(token))
    const identity = await client(token).rpc('doctor_session_context');expect(!identity.error && identity.data.practice_id===null,'Account confirmation must not create professional authority')
    const firstToken = token;const firstSid = identity.data.session_id
    setStage('actual personal settings authoritative defaults');const initialSettings=await settings();expect(initialSettings.in_app_confirmations===false && initialSettings.version===0,'Actual personal settings must start unchanged and opted out')
    setStage('actual personal settings dialog opens');await page.getByRole('button',{ name: 'Edit account details',exact: true }).click();let dialog = page.getByRole('dialog',{ name: 'Edit account details',exact: true });setStage('actual personal preference checkbox mounted');const confirmations=dialog.getByRole('checkbox',{ name: 'Show in-app account update confirmations',exact: true });await browserExpect(confirmations).toBeAttached();setStage('actual personal preference defaults off');await browserExpect(confirmations).not.toBeChecked();setStage('actual personal settings input and save');await dialog.getByLabel('Personal name',{ exact: true }).fill('Synthetic private personal name');await dialog.getByRole('checkbox',{ name: 'Show in-app account update confirmations' }).check();await dialog.getByRole('button',{ name: 'Save account details',exact: true }).click();await dialog.waitFor({ state: 'hidden' });setStage('actual personal settings committed version');expect((await settings()).version===1,'Actual personal write was not persisted')
    setStage('actual expired sensitive contact and fresh sign-in')
    await until(async () => !(await settings()).can_change_contact,30000)
    await page.getByRole('button',{ name: 'Edit account details',exact: true }).click();dialog = page.getByRole('dialog',{ name: 'Edit account details',exact: true });await dialog.getByLabel('Unverified personal contact phone',{ exact: true }).fill('+12025550123');await dialog.getByRole('button',{ name: 'Save account details',exact: true }).click();await dialog.getByText('Sign in again, then re-enter and save the phone change. A fresh sign-in within 15 minutes is required.',{ exact: true }).waitFor();expect((await settings()).version===1,'Expired sensitive change mutated actual settings')
    await dialog.getByRole('button',{ name: 'Sign in again',exact: true }).click();await page.waitForURL(url => url.pathname==='/sign-in');await page.getByLabel(/^Email/).fill(email);await page.getByLabel(/^Password/).fill(password);await page.getByRole('button',{ name: 'Sign in',exact: true }).click();await page.waitForURL(`${origin}/account`);await page.getByRole('button',{ name: 'Edit account details',exact: true }).click();dialog = page.getByRole('dialog',{ name: 'Edit account details',exact: true });expect(await dialog.getByLabel('Unverified personal contact phone',{ exact: true }).inputValue()==='','Reauthentication retained sensitive draft');await dialog.getByLabel('Unverified personal contact phone',{ exact: true }).fill('+12025550123');await dialog.getByRole('button',{ name: 'Save account details',exact: true }).click();await dialog.waitFor({ state: 'hidden' })
    const currentIdentity = await client(token).rpc('doctor_session_context');expect(!currentIdentity.error && currentIdentity.data.session_id!==firstSid,'Reauthentication reused old provider SID');expect((await settings()).contact_phone==='+12025550123','Fresh actual sign-in did not admit sensitive change');expect((await client(firstToken).rpc('doctor_account_settings')).error?.code==='42501','Frozen signed-out SID retained account access');policy(900);changedPolicy = false
    setStage('actual recovery request and wrong-browser PKCE denial')
    await page.getByRole('button',{ name: 'Sign out',exact: true }).click();await page.waitForURL(`${origin}/sign-in`);const before = new Set((await messages()).map(item => item.ID));await page.goto(`${origin}/recover`);await page.getByLabel(/^Email/).fill(email);await page.getByRole('button',{ name: 'Recover password',exact: true }).click();await page.getByText('Request submitted',{ exact: true }).waitFor();const recovery = await link(email,before)
    // Fetch only the real verification redirect. Its one-use code remains in memory;
    // a separate browser lacks the verifier and must not consume it successfully.
    const response = await fetch(recovery,{ redirect: 'manual',signal: AbortSignal.timeout(15000) });expect(response.status>=300 && response.status<400,'Actual recovery verification failed');const callback = new URL(response.headers.get('location') || '',origin);expect(callback.origin===origin && callback.pathname==='/recover' && Boolean(callback.searchParams.get('code')),'Actual recovery redirect rejected')
    const other = await browser.newContext();try { await other.route('**/*',route => [origin,api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());const wrong = await other.newPage();await wrong.goto(callback.href);await wrong.getByText('The recovery link is invalid or expired. Request another link.',{ exact: true }).waitFor();expect(await wrong.getByLabel(/^Password/).count()===0,'Wrong browser exposed a valid reset form') } finally { await other.close() }
    setStage('actual same-browser recovery and password replacement')
    token = '';await page.goto(callback.href);await page.getByLabel('Password',{ exact: true }).waitFor();expect(new URL(page.url()).search==='','Recovery URL material was not scrubbed');await page.getByLabel('Password',{ exact: true }).fill(newPassword);await page.getByLabel('Confirm password',{ exact: true }).fill(newPassword);await page.getByRole('button',{ name: 'Set password',exact: true }).click();await page.getByText('Password updated',{ exact: true }).waitFor()
    const invalid = await createClient(api,key,{ auth: { persistSession: false,autoRefreshToken: false } }).auth.signInWithPassword({ email,password });expect(Boolean(invalid.error) && !invalid.data.session,'Old password survived actual reset');const valid = await createClient(api,key,{ auth: { persistSession: false,autoRefreshToken: false } }).auth.signInWithPassword({ email,password: newPassword });expect(!valid.error && Boolean(valid.data.session),'New password did not admit actual sign-in')
    setStage('actual reused recovery code denial');await page.goto(callback.href);await page.getByText('The recovery link is invalid or expired. Request another link.',{ exact: true }).waitFor();expect(await page.getByLabel('Password',{ exact: true }).count()===0,'Reused PKCE code exposed reset form')
    console.log('Actual browser Auth: signup PKCE, URL scrubbing, expired contact denial, new-SID reauthentication, frozen SID denial, same-browser recovery, wrong-browser/reused-code denial and password replacement passed')
  } finally {
    token = '';await context?.close().catch(() => {});await browser?.close().catch(() => {})
    if(server?.pid) { try { process.kill(-server.pid,'SIGTERM') } catch { /* owned process exited */ }await Promise.race([new Promise(resolve => server.once('exit',resolve)),pause(2000)]);try { process.kill(-server.pid,'SIGKILL') } catch { /* owned group exited */ }server.unref() }
    if(changedPolicy)policy(900)
  }
}
