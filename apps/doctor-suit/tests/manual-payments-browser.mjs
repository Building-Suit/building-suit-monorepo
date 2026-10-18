// CI only: actual Auth/PostgREST/Functions; synthetic users and bytes; no credential artifacts.
import{chromium,expect as browserExpect}from'@playwright/test'
import{spawn}from'node:child_process'
import{randomUUID}from'node:crypto'
import{doctorPasswordStep}from'./helpers/password-step.mjs'
export async function verifyManualPaymentBrowser({root,api,origin,key,serviceKey,a,b,expect,rpc,setStage}){
 let server,browser,owner,reviewer
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),reference='SYNTHETIC-WEB-'+randomUUID()
 try{
  setStage('actual manual-payment browser readiness')
  server=spawn(process.execPath,['apps/doctor-suit/.output/server/index.mjs'],{cwd:root,env:{...process.env,NITRO_HOST:'127.0.0.1',NITRO_PORT:'4341',APP_URL:origin,NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED:'true',NUXT_PUBLIC_DOCTOR_AUTH_ENVIRONMENT:'local',NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN:origin,NUXT_PUBLIC_DOCTOR_AUTH_URL:api,NUXT_PUBLIC_DOCTOR_AUTH_KEY:key,NUXT_DOCTOR_AUTH_EMAIL_LOOKUP_KEY:serviceKey},detached:true,stdio:'ignore'})
  let ready=false;for(let n=0;n<100;n++){try{if((await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{/* Owned process/readiness may already be unavailable. */}await wait(100)}expect(ready,'Payment browser app unavailable')
  browser=await chromium.launch({headless:true})
  async function signIn(actor){const context=await browser.newContext({viewport:{width:1280,height:1000}});await context.route('**/*',route=>[origin,api].includes(new URL(route.request().url()).origin)?route.continue():route.abort());const page=await context.newPage();page.setDefaultTimeout(20000);await page.goto(`${origin}/sign-in?next=${actor===a?'/payment-notices':'/payment-review'}`);await page.getByLabel(/^Email/).fill(actor.credentials.email);await doctorPasswordStep(page);await page.getByLabel(/^Password/).fill(actor.credentials.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await browserExpect(page).toHaveURL(new RegExp(actor===a?'/payment-notices$':'/payment-review$'));return{context,page}}
  owner=await signIn(a);const page=owner.page
  setStage('actual owner annual quote, immutable instructions and receipt browser')
  setStage('actual owner payment interval control');await page.getByLabel('Period',{exact:true}).click();setStage('actual owner annual period option');await page.getByRole('option',{name:'Yearly — 12 months, save 32%',exact:true}).click()
  setStage('actual owner version document acceptance');await page.getByRole('checkbox',{name:/I reviewed the version document/}).check();setStage('actual owner quote preparation');await page.getByRole('button',{name:'Show synthetic transfer instructions',exact:true}).click()
  setStage('actual owner bound instructions response');await page.getByRole('heading',{name:'Instructions bound to this request',exact:true}).waitFor()
  setStage('actual owner notice dialog open');await page.getByRole('button',{name:'Record transfer notice',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Record transfer notice',exact:true})
  setStage('actual owner notice reference field');await dialog.getByLabel(/^Transfer reference/).fill(reference);setStage('actual owner notice timestamp field');await dialog.getByLabel(/^Transfer time/).fill('2026-10-18T08:00')
  setStage('actual owner committed notice response loss and stable retry')
  let loseResponse=true
  await page.route(`${api}/rest/v1/rpc/doctor_submit_manual_payment`,async route=>{
   if(!loseResponse)return route.continue()
   loseResponse=false;const response=await route.fetch();expect(response.ok(),'Synthetic committed-response fixture failed');await response.dispose();await route.abort('failed')
  })
  await dialog.getByRole('button',{name:'Record transfer notice',exact:true}).click()
  await dialog.getByRole('button',{name:'Retry same operation',exact:true}).click();await dialog.waitFor({state:'hidden'})
  const claimed=(await rpc(a.client,'doctor_manual_payments')).items.filter(n=>n.transfer_reference===reference);expect(claimed.length===1&&claimed[0].billing_interval==='yearly'&&claimed[0].amount_minor==='243984','Lost response/retry changed annual quote or created duplicate notices')
  setStage('actual owner receipt file selection and upload');await page.locator('input[type=file]').setInputFiles({name:'synthetic-browser.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nSynthetic browser receipt only\n%%EOF\n')});await page.getByRole('button',{name:'Upload private receipt',exact:true}).click()
  const row=page.getByRole('row').filter({hasText:reference});await row.getByRole('button',{name:'View',exact:true}).click();await page.getByRole('button',{name:'synthetic-browser.pdf',exact:true}).waitFor()
  expect((await rpc(a.client,'doctor_manual_payments')).items.find(n=>n.transfer_reference===reference)?.status==='submitted','Browser receipt verified funds')
  setStage('actual owner reconciliation and authorized source link');await page.getByRole('link',{name:'Reconcile payments',exact:true}).click();await page.getByRole('heading',{name:'Manual payment reconciliation',exact:true}).waitFor();await page.getByRole('row').filter({hasText:claimed[0].id}).getByRole('link',{name:'Open source notice',exact:true}).click();await page.getByRole('button',{name:'synthetic-browser.pdf',exact:true}).waitFor()
  reviewer=await signIn(b);const review=reviewer.page
  setStage('actual independent reviewer browser and separate paid activation')
  setStage('actual reviewer opens submitted annual notice');await review.getByRole('row').filter({hasText:reference}).getByRole('button',{name:'View',exact:true}).click()
  setStage('actual reviewer reason field');await review.getByLabel('Review reason',{exact:true}).fill('Synthetic independently verified annual bank entry')
  setStage('actual reviewer bank reference field');await review.getByLabel(/^Received bank entry reference/).fill('SYNTHETIC-WEB-BANK-'+randomUUID())
  setStage('actual reviewer independent amount field');await review.getByLabel(/^Amount received in bank entry/).fill('2439.84');setStage('actual reviewer independent currency field');await review.getByLabel(/^Received entry currency/).fill('EGP')
  setStage('actual reviewer bank receipt time field');await review.getByLabel(/^Bank receipt time/).fill('2026-10-18T08:00');setStage('actual reviewer verification record field');await review.getByLabel(/^Independent verification record reference/).fill('SYNTHETIC_WEB_BANK_RECORD')
  setStage('actual reviewer independent-bank attestation');await review.getByRole('checkbox',{name:/I independently checked/}).check();setStage('actual reviewer records verified funds');await review.getByRole('button',{name:'Record verified funds',exact:true}).click()
  setStage('actual reviewer verified notice exposes separate activation');await review.getByRole('button',{name:'Activate synthetic paid period',exact:true}).waitFor()
  expect((await rpc(a.client,'doctor_saas_status')).state==='unconfigured','Review browser activated before the separate command')
  setStage('actual reviewer paid activation command');await review.getByRole('button',{name:'Activate synthetic paid period',exact:true}).click()
  setStage('actual reviewer activated notice response');await browserExpect(review.getByRole('row').filter({hasText:reference})).toContainText('Synthetic period activated')
  const paid=await rpc(a.client,'doctor_saas_status'),start=new Date(paid.period.started_at),end=new Date(paid.period.started_at);end.setUTCMonth(end.getUTCMonth()+12)
  expect(paid.state==='paid'&&Date.parse(paid.period.ends_at)===end.getTime()&&start<end,'Annual browser activation did not create twelve server calendar months')
  setStage('actual reviewer reconciliation status filter and source link');await review.getByRole('link',{name:'Reconcile payments',exact:true}).click();await review.getByRole('heading',{name:'Manual payment reconciliation',exact:true}).waitFor();await review.getByLabel('Review status',{exact:true}).click();await review.getByRole('option',{name:'Activated period',exact:true}).click();await review.getByRole('button',{name:'Apply filters',exact:true}).click();await browserExpect(review.getByRole('row').filter({hasText:claimed[0].id})).toContainText('Activated period');await review.getByRole('row').filter({hasText:claimed[0].id}).getByRole('link',{name:'Open source notice',exact:true}).click();await review.getByRole('button',{name:'synthetic-browser.pdf',exact:true}).waitFor()
  setStage('actual manual-payment Arabic mobile reload and private history')
  await owner.context.addCookies([{name:'building-suit-locale',value:'ar',url:origin}]);await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>localStorage.setItem('building-suit.theme','dark'));await page.reload()
  await page.getByRole('heading',{name:'إشعارات تحويل InstaPay',exact:true}).waitFor();await browserExpect(page.locator('html')).toHaveAttribute('dir','rtl')
  await page.getByRole('row').filter({hasText:reference}).getByRole('button',{name:'عرض',exact:true}).click();await page.getByRole('button',{name:'synthetic-browser.pdf',exact:true}).waitFor()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Manual payment mobile surface overflows')
  setStage('actual Arabic mobile reconciliation and source reload');await page.getByRole('link',{name:'مطابقة التحويلات',exact:true}).click();await page.getByRole('heading',{name:'مطابقة التحويلات اليدوية',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'مطابقة التحويلات اليدوية',exact:true}).waitFor();await browserExpect(page.locator('html')).toHaveAttribute('dir','rtl');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Reconciliation mobile surface overflows');await page.getByRole('row').filter({hasText:claimed[0].id}).getByRole('link',{name:'عرض الإشعار المصدر',exact:true}).click();await page.getByRole('button',{name:'synthetic-browser.pdf',exact:true}).waitFor()
  console.log('Actual manual-payment browser: owner annual quote/acceptance, bound instructions, submitted notice/private receipt, independent reviewer verification, separate twelve-month paid activation and Arabic RTL mobile dark reload/history passed.')
 }catch(error){
  // Fixed booleans/enums only: never emit credentials, IDs, form values or DOM text.
  const summary=[]
  for(const item of[owner,reviewer])if(item){try{summary.push(await item.page.evaluate(()=>{
   const app=document.getElementById('__nuxt')?.__vue_app__?.config.globalProperties,auth=app?.$doctorAuth?.state,payment=app?.$doctorManualPayment?.state
   return{knownRoute:['/payment-notices','/payment-review'].includes(location.pathname),auth:auth?{phase:['checking','unavailable','signed-out','verification','authenticated'].includes(auth.phase)?auth.phase:'unknown',pending:Boolean(auth.pending),identity:Boolean(auth.identity)}:null,payment:payment?{ready:Boolean(payment.ready),loading:Boolean(payment.loading),pending:Boolean(payment.pending),error:['denied','conflict','invalid','network'].includes(payment.error)?payment.error:null}:null}
  }))}catch{summary.push({unavailable:true})}}
  console.log('Actual manual-payment safe readiness diagnostic:',JSON.stringify(summary));throw error
 }finally{
  await owner?.context.close().catch(()=>{});await reviewer?.context.close().catch(()=>{});await browser?.close().catch(()=>{})
  if(server?.pid){try{process.kill(-server.pid,'SIGTERM')}catch{/* Owned process/readiness may already be unavailable. */}if(server.exitCode===null)await Promise.race([new Promise(resolve=>server.once('exit',resolve)),wait(5000)]);try{process.kill(-server.pid,'SIGKILL')}catch{/* Owned process/readiness may already be unavailable. */}server.unref()}
 }
}
