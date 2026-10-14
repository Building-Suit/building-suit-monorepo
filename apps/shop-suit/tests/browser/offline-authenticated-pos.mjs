// Real authenticated local POS + server writes; cloud network emulation, never physical-device evidence.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { makeFixture, localApi, localAnonKey, sql, actorSql } from './helpers/offline-fixture.mjs'
const root = new URL('../../../../',import.meta.url).pathname
const origin = 'http://127.0.0.1:4331'
const fixture = makeFixture()
const child = spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{ cwd:root,env:{...process.env,PORT:'4331',HOST:'127.0.0.1',APP_ENV:'local',NUXT_PUBLIC_SUPABASE_URL:localApi,NUXT_PUBLIC_SUPABASE_KEY:localAnonKey},stdio:['ignore','pipe','pipe'] })
let serverFailed = false
child.on('exit',code => { if(code) serverFailed=true })
child.stdout.resume(); child.stderr.resume()
let browser
try {
  for(let attempt=0;attempt<100;attempt++) {
    if(serverFailed) throw new Error('Local Shop server exited')
    try { if((await fetch(`${origin}/auth/login`)).ok) break } catch { /* server is still starting */ }
    if(attempt===99) throw new Error('Local Shop server did not start')
    await new Promise(resolve=>setTimeout(resolve,300))
  }
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']})
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies([{name:'building-suit-locale',value:'en',domain:'127.0.0.1',path:'/'}])
  const page=await context.newPage()
  await page.goto(`${origin}/auth/login`)
  await page.getByRole('textbox',{name:'Email',exact:true}).fill(fixture.email)
  await page.locator('input[type=password]').fill(fixture.password)
  await page.getByRole('button',{name:/Sign in|Log in/i}).click()
  await page.waitForURL('**/dashboard')
  await page.goto(`${origin}/pos`)
  await page.getByRole('button',{name:/Offline cloud product/}).waitFor()
  const source=await readFile(new URL('../../app/utils/offlineStore.js',import.meta.url),'utf8')
  await page.addScriptTag({content:source.replaceAll('export const ','const ').replaceAll('export function ','function ')+'\nwindow.offlineFixtureStore=createOfflineStore;'})
  const scope=JSON.stringify([localApi,fixture.userId,fixture.shopId,fixture.locationId])
  await page.evaluate(scope=>{window.counterProbe=window.offlineFixtureStore({scope})},scope)
  // Observe actual application cache; the test never populates it or enqueues business commands itself.
  for(let attempt=0;attempt<100;attempt++) {
    if(await page.evaluate(async()=>Boolean((await window.counterProbe.cached('context'))?.staff.length && (await window.counterProbe.cached('shift'))?.active && (await window.counterProbe.cached('catalog'))?.items.length))) break
    if(attempt===99) throw new Error('Authenticated POS did not prepare its bounded cache')
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  const cached=await page.evaluate(async()=>({context:await window.counterProbe.cached('context'),catalog:await window.counterProbe.cached('catalog')}))
  assert.equal(cached.context.customers.length,0);assert.equal(cached.context.appointments.length,0)
  assert.ok(cached.catalog.items.every(item=>!item.imageUrl))
  await context.setOffline(true)
  await page.getByRole('button',{name:/Offline cloud product/}).click()
  await page.getByRole('button',{name:/^Pay\b/}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click()
  for(let attempt=0;attempt<100;attempt++) {
    if((await page.evaluate(()=>window.counterProbe.list())).length===1) break
    if(attempt===99) throw new Error('Offline sale was not persisted')
    await new Promise(resolve=>setTimeout(resolve,50))
  }
  const queued=(await page.evaluate(()=>window.counterProbe.list()))[0]
  assert.equal(queued.state,'unsynced')
  assert.equal(sql(`select count(*) from public.invoices where shop_id='${fixture.shopId}';`),'0')
  await mkdir(`${root}.local/ss-offline`,{recursive:true})
  await page.screenshot({path:`${root}.local/ss-offline/authenticated-offline.png`,fullPage:true})
  const requests=[];const statuses=[];let drop=true
  await page.route('**/rest/v1/rpc/replay_offline_pos_sale',async route=>{
    requests.push(route.request().postDataJSON())
    if(drop) {const response=await route.fetch();statuses.push(response.status());assert.equal(response.status(),200);await route.abort('failed')}
    else await route.continue()
  })
  await context.setOffline(false)
  for(let attempt=0;attempt<100;attempt++) {
    const records=await page.evaluate(()=>window.counterProbe.list())
    if(records[0]?.state==='unsynced'&&records[0]?.error==='OFFLINE_NETWORK_UNAVAILABLE') break
    if(attempt===99) throw new Error(`Lost response state: ${JSON.stringify(records.map(record=>({state:record.state,error:record.error})))}; statuses=${statuses}; calls=${requests.length}`)
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert.equal(sql(`select count(*) from public.payments where shop_id='${fixture.shopId}';`),'1')
  drop=false
  await page.getByRole('button',{name:'Retry with the same request IDs',exact:true}).click()
  for(let attempt=0;attempt<100;attempt++) {
    if((await page.evaluate(()=>window.counterProbe.list()))[0]?.state==='synced') break
    if(attempt===99) throw new Error('Authenticated replay did not complete')
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  const synced=(await page.evaluate(()=>window.counterProbe.list()))[0]
  assert.equal(synced.envelope.localId,queued.envelope.localId)
  assert.ok(synced.originalCommandHash)
  assert.ok(!('p_customer_id' in synced.envelope.command.args) && !('p_notes' in synced.envelope.command.args) && !('p_lines' in synced.envelope.command.args))
  assert.ok(requests.length>=2)
  for(const request of requests) assert.deepEqual(request,requests[0])
  const effects=JSON.parse(sql(`select json_build_object('invoices',(select count(*) from public.invoices where shop_id='${fixture.shopId}'),'payments',(select count(*) from public.payments where shop_id='${fixture.shopId}'),'stockEffects',(select count(*) from public.inventory_movements where reference_id='${synced.result}'),'drawerEffects',(select count(*) from public.cash_drawer_events where shop_id='${fixture.shopId}' and event_kind='cash_sale'));`))
  assert.deepEqual(effects,{invoices:1,payments:1,stockEffects:1,drawerEffects:1})
  await page.screenshot({path:`${root}.local/ss-offline/authenticated-synced.png`,fullPage:true})
  // Price changed on another online terminal: retain rejection and reconcile explicitly in the actual UI.
  await context.setOffline(true)
  await page.getByRole('button',{name:/Offline cloud product/}).click()
  await page.getByRole('button',{name:/^Pay\b/}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click()
  for(let attempt=0;attempt<100;attempt++) {
    if((await page.evaluate(()=>window.counterProbe.list())).length===2) break
    await new Promise(resolve=>setTimeout(resolve,50))
  }
  actorSql(fixture.userId,`select public.save_product('${fixture.shopId}','${fixture.productId}','Offline cloud product','OFF-CLOUD',null,21);`)
  await context.setOffline(false)
  for(let attempt=0;attempt<100;attempt++) {
    if((await page.evaluate(()=>window.counterProbe.list()))[1]?.state==='failed') break
    if(attempt===99) throw new Error('Changed-price rejection not visible')
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  const rejected=(await page.evaluate(()=>window.counterProbe.list()))[1]
  assert.equal(rejected.error,'POS_CHECKOUT_REQUIRES_FULL_PAYMENT')
  assert.equal(sql(`select count(*) from public.invoices where shop_id='${fixture.shopId}';`),'1')
  await page.screenshot({path:`${root}.local/ss-offline/authenticated-price-rejection.png`,fullPage:true})
  await page.getByRole('button',{name:'Check outcome and reconcile',exact:true}).click()
  await page.getByRole('dialog').filter({hasText:'Stop replay and check'}).getByRole('button',{name:'Confirm',exact:true}).click()
  await page.getByRole('dialog').filter({hasText:'Confirm the goods'}).getByRole('button',{name:'Confirm',exact:true}).click()
  for(let attempt=0;attempt<100;attempt++) {
    if((await page.evaluate(()=>window.counterProbe.list()))[1]?.resolution?.phase==='reconciled') break
    if(attempt===99) throw new Error('Customer reconciliation acknowledgement not retained')
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert.equal(sql(`select count(*) from public.payments where shop_id='${fixture.shopId}';`),'1')
  await page.screenshot({path:`${root}.local/ss-offline/authenticated-reconciled.png`,fullPage:true})
  // POS preloads the critical drawer route. Enter it for the first time during the outage.
  await context.setOffline(true)
  await page.locator('a[href="/cash-shifts"]').first().click()
  await page.waitForURL('**/cash-shifts')
  await page.getByRole('button',{name:'Cash movement',exact:true}).waitFor()
  await page.getByRole('button',{name:'Cash movement',exact:true}).click()
  const movementEditor=page.getByRole('dialog').filter({hasText:'Record movement'})
  await movementEditor.getByRole('spinbutton',{name:'Amount',exact:true}).fill('5')
  await movementEditor.getByRole('textbox',{name:'Reason',exact:true}).fill('Offline cash fixture')
  await movementEditor.getByRole('textbox',{name:'Reference',exact:true}).fill('OFF-MOVE')
  await movementEditor.getByRole('button',{name:'Record movement',exact:true}).click()
  await page.getByRole('dialog').filter({hasText:'Confirm this drawer movement'}).getByRole('button',{name:'Confirm',exact:true}).click()
  await page.getByRole('button',{name:'Close shift',exact:true}).click()
  const closeEditor=page.getByRole('dialog').filter({hasText:'Confirm count and close'})
  await closeEditor.getByRole('spinbutton',{name:'Counted cash',exact:true}).fill('125')
  await closeEditor.getByRole('button',{name:'Confirm count and close',exact:true}).click()
  await page.getByRole('dialog').filter({hasText:'Close this shift with the counted amount'}).getByRole('button',{name:'Confirm',exact:true}).click()
  for(let attempt=0;attempt<100;attempt++) {
    if((await page.evaluate(()=>window.counterProbe.list())).length===4) break
    if(attempt===99) throw new Error('Offline cash commands were not retained')
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  const pendingCash=await page.evaluate(()=>window.counterProbe.list())
  assert.deepEqual(pendingCash.slice(2).map(record=>[record.envelope.command.kind,record.state]),[['movement','unsynced'],['close','unsynced']])
  assert.equal(sql(`select status from public.cash_sessions where id='${fixture.shiftId}';`),'open')
  await page.screenshot({path:`${root}.local/ss-offline/authenticated-offline-shift.png`,fullPage:true})
  await context.setOffline(false)
  for(let attempt=0;attempt<100;attempt++) {
    if((await page.evaluate(()=>window.counterProbe.list()))[3]?.state==='synced') break
    if(attempt===99) throw new Error('Offline cash replay did not finish')
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  const drawer=JSON.parse(sql(`select json_build_object('status',status,'expected',expected_amount,'counted',closing_amount,'variance',variance_amount) from public.cash_sessions where id='${fixture.shiftId}';`))
  assert.deepEqual(drawer,{status:'closed',expected:125,counted:125,variance:0})
  assert.equal(sql(`select count(*) from public.cash_drawer_events where session_id='${fixture.shiftId}' and event_kind='pay_in';`),'1')
  await page.screenshot({path:`${root}.local/ss-offline/authenticated-synced-shift.png`,fullPage:true})
  const evidence={mode:'cloud Chromium network emulation',physicalDeviceEvidence:false,authenticated:true,queuedState:queued.state,finalState:synced.state,stableRequestIds:true,lostResponseReplayed:true,rejectionReconciled:true,offlineCashMovementAndClose:true,drawer,effects}
  await writeFile(`${root}.local/ss-offline/authenticated-pos.json`,JSON.stringify(evidence,null,2)+'\n')
  console.log('PASS: authenticated loaded POS records sale while offline; persisted before reset; lost server response replays identical IDs; one invoice/payment/stock/drawer effect; bounded cache excludes contacts/media; changed-price rejection reconciled in UI; offline movement/close replay with exact cash/variance. Cloud emulation only.')
} finally {await browser?.close();child.kill('SIGTERM')}
