// CI only: actual Auth/PostgREST/Functions; synthetic users and bytes; no credential artifacts.
import{chromium,expect as browserExpect}from'@playwright/test'
import{spawn}from'node:child_process'
import{randomUUID}from'node:crypto'
import{doctorPasswordStep}from'./helpers/password-step.mjs'
export async function verifyManualPaymentBrowser({root,api,origin,key,a,b,expect,rpc,setStage}){
 let server,browser,owner,reviewer
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),reference='SYNTHETIC-WEB-'+randomUUID()
 try{
  setStage('actual manual-payment browser readiness')
  server=spawn(process.execPath,['apps/doctor-suit/.output/server/index.mjs'],{cwd:root,env:{...process.env,NITRO_HOST:'127.0.0.1',NITRO_PORT:'4341',APP_URL:origin,NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED:'true',NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT:'local',NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN:origin,NUXT_PUBLIC_DOCTOR_AUTH_URL:api,NUXT_PUBLIC_DOCTOR_AUTH_KEY:key},detached:true,stdio:'ignore'})
  let ready=false;for(let n=0;n<100;n++){try{if((await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{/* Owned process/readiness may already be unavailable. */}await wait(100)}expect(ready,'Payment browser app unavailable')
  browser=await chromium.launch({headless:true})
  async function signIn(actor){const context=await browser.newContext({viewport:{width:1280,height:1000}});await context.route('**/*',route=>[origin,api].includes(new URL(route.request().url()).origin)?route.continue():route.abort());const page=await context.newPage();page.setDefaultTimeout(20000);await page.goto(`${origin}/sign-in?next=${actor===a?'/payment-notices':'/payment-review'}`);await page.getByLabel(/^Email/).fill(actor.credentials.email);await doctorPasswordStep(page);await page.getByLabel(/^Password/).fill(actor.credentials.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await browserExpect(page).toHaveURL(new RegExp(actor===a?'/payment-notices$':'/payment-review$'));return{context,page}}
  owner=await signIn(a);const page=owner.page
  setStage('actual owner annual quote, immutable instructions and receipt browser')
  setStage('actual owner payment interval control');await page.getByLabel('Period',{exact:true}).click();await page.getByRole('option',{name:'Yearly — 12 months for 10',exact:true}).click()
  setStage('actual owner version document acceptance');await page.getByRole('checkbox',{name:/I reviewed the version document/}).check();setStage('actual owner quote preparation');await page.getByRole('button',{name:'Show synthetic transfer instructions',exact:true}).click()
  setStage('actual owner bound instructions response');await page.getByRole('heading',{name:'Instructions bound to this request',exact:true}).waitFor()
  setStage('actual owner notice dialog open');await page.getByRole('button',{name:'Record transfer notice',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Record transfer notice',exact:true})
  setStage('actual owner notice reference field');await dialog.getByLabel(/^Transfer reference/).fill(reference);setStage('actual owner notice timestamp field');await dialog.getByLabel(/^Transfer time/).fill('2026-10-18T08:00')
  setStage('actual owner notice submission');await dialog.getByRole('button',{name:'Record transfer notice',exact:true}).click();await dialog.waitFor({state:'hidden'})
  setStage('actual owner receipt file selection and upload');await page.locator('input[type=file]').setInputFiles({name:'synthetic-browser.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nSynthetic browser receipt only\n%%EOF\n')});await page.getByRole('button',{name:'Upload private receipt',exact:true}).click()
  const row=page.getByRole('row').filter({hasText:reference});await row.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('button',{name:'synthetic-browser.pdf',exact:true}).waitFor()
  expect((await rpc(a.client,'doctor_manual_payments')).items.find(n=>n.transfer_reference===reference)?.status==='submitted','Browser receipt verified funds')
  reviewer=await signIn(b);const review=reviewer.page
  setStage('actual independent reviewer browser and separate paid activation')
  await review.getByRole('row').filter({hasText:reference}).getByRole('button',{name:'View',exact:true}).click()
  await review.getByLabel('Review reason',{exact:true}).fill('Synthetic independently verified annual bank entry')
  await review.getByLabel(/^Received bank entry reference/).fill('SYNTHETIC-WEB-BANK-'+randomUUID())
  await review.getByLabel(/^Amount received in bank entry/).fill('2990.00');await review.getByLabel(/^Received entry currency/).fill('EGP')
  await review.getByLabel(/^Bank receipt time/).fill('2026-10-18T08:00');await review.getByLabel(/^Independent verification record reference/).fill('SYNTHETIC_WEB_BANK_RECORD')
  await review.getByRole('checkbox',{name:/I independently checked/}).check();await review.getByRole('button',{name:'Record verified funds',exact:true}).click()
  await review.getByRole('button',{name:'Activate synthetic paid period',exact:true}).waitFor()
  expect((await rpc(a.client,'doctor_saas_status')).state==='unconfigured','Review browser activated before the separate command')
  await review.getByRole('button',{name:'Activate synthetic paid period',exact:true}).click()
  await browserExpect(review.getByRole('row').filter({hasText:reference})).toContainText('Synthetic period activated')
  const paid=await rpc(a.client,'doctor_saas_status'),start=new Date(paid.period.started_at),end=new Date(paid.period.started_at);end.setUTCMonth(end.getUTCMonth()+12)
  expect(paid.state==='paid'&&Date.parse(paid.period.ends_at)===end.getTime()&&start<end,'Annual browser activation did not create twelve server calendar months')
  setStage('actual manual-payment Arabic mobile reload and private history')
  await owner.context.addCookies([{name:'building-suit-locale',value:'ar',url:origin}]);await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>localStorage.setItem('building-suit.theme','dark'));await page.reload()
  await page.getByRole('heading',{name:'إشعارات تحويل InstaPay',exact:true}).waitFor();await browserExpect(page.locator('html')).toHaveAttribute('dir','rtl')
  await page.getByRole('row').filter({hasText:reference}).getByRole('button',{name:'عرض',exact:true}).click();await page.getByRole('button',{name:'synthetic-browser.pdf',exact:true}).waitFor()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Manual payment mobile surface overflows')
  console.log('Actual manual-payment browser: owner annual quote/acceptance, bound instructions, submitted notice/private receipt, independent reviewer verification, separate twelve-month paid activation and Arabic RTL mobile dark reload/history passed.')
 }finally{
  await owner?.context.close().catch(()=>{});await reviewer?.context.close().catch(()=>{});await browser?.close().catch(()=>{})
  if(server?.pid){try{process.kill(-server.pid,'SIGTERM')}catch{/* Owned process/readiness may already be unavailable. */}if(server.exitCode===null)await Promise.race([new Promise(resolve=>server.once('exit',resolve)),wait(5000)]);try{process.kill(-server.pid,'SIGKILL')}catch{/* Owned process/readiness may already be unavailable. */}server.unref()}
 }
}
