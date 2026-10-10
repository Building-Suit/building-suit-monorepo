import { expect,test,type Page,type WebSocketRoute } from '@playwright/test'
import { pilotFixture,fixtureGoto,fixtureReload } from './pilot-fixture'
test.setTimeout(60000)

// Protocol fixtures exercise the real rendered Shop and installed Supabase SDK.
// Actual trigger/RLS behavior is separately required by the SQL obligation.
async function realtimeBrowser(page:Page) {
 const joins: Array<{socket:WebSocketRoute;topic:string;ref:string;filters:Array<{id:number;filter:string;event:string}>}> = []
 let leaves=0
 await page.routeWebSocket('**/realtime/v1/websocket**',socket=>{
  socket.onMessage(raw=>{
   const [joinRef,ref,topic,event,payload]=JSON.parse(String(raw))
   if(event==='phx_join'){
    const filters=payload.config.postgres_changes.map((f:Record<string,unknown>,i:number)=>({...f,id:i+1}))
    joins.push({socket,topic,ref:joinRef,filters})
    socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:filters}}]))
   }else if(event==='phx_leave'){leaves++;socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]))}
   else if(event==='heartbeat')socket.send(JSON.stringify([null,ref,'phoenix','phx_reply',{status:'ok',response:{}}]))
  })
 })
 const fixture=await pilotFixture(page,'en','owner',(name)=>{
  if(name==='customer_access'||name==='sale_access')return [{can_view:true,can_manage:true,can_issue:true}]
  if(name==='list_customers')return {items:[],total:0,page:1,pageSize:20,canManage:true}
  if(name==='list_location_sales')return {items:[],total:0,page:1,pageSize:20,canManage:true,canIssue:true}
  if(name==='sale_catalog')return {customers:[],products:[],services:[],locations:[]}
  if(name==='shop_team_read')return {canManage:true,canManagePermissions:true,canViewAudit:true,permissionKeys:[],grantablePermissionKeys:[],members:[],roles:[],locations:[],invitations:[],events:[]}
 })
 const cookies=await page.context().cookies()
 const auth=cookies.find(c=>c.name==='bs-shop-local-auth-token')
 if(!auth)throw Error('Synthetic session cookie absent')
 const data=JSON.parse(Buffer.from(auth.value.replace(/^base64-/,''),'base64url').toString())
 const token=data.access_token.split('.');const claims=JSON.parse(Buffer.from(token[1],'base64url').toString())
 claims.session_id='synthetic-realtime-session'
 token[1]=Buffer.from(JSON.stringify(claims)).toString('base64url');data.access_token=token.join('.')
 await page.context().addCookies([{...auth,value:'base64-'+Buffer.from(JSON.stringify(data)).toString('base64url')}])
 await fixtureReload(page)
 return {...fixture,joins,get leaves(){return leaves},emit(feature:string,location='all'){
  const j=joins.at(-1)!;const matched=j.filters.filter(f=>f.event==='UPDATE'&&f.filter===`scope_key=eq.shop-1:${location}:${feature}`)
  if(!matched.length)throw Error('No matching scoped subscription')
  j.socket.send(JSON.stringify([j.ref,null,j.topic,'postgres_changes',{ids:matched.map(f=>f.id),data:{schema:'public',table:'shop_realtime_versions',type:'UPDATE',commit_timestamp:new Date().toISOString(),columns:[],record:{scope_key:`shop-1:${location}:${feature}`,revision:2},old_record:{}}}]))
 }}
}
for(const [feature,path,rpc] of [['appointments','/appointments','appointment_calendar'],['sales','/sales','list_location_sales'],['cash-shifts','/cash-shifts','cash_shift_dashboard'],['team','/team','shop_team_read'],['customers','/customers','list_customers'],['billing','/billing','shop_billing_read']] as const){
 test(`${feature}: two independent rendered browsers refresh scoped changes`,async({browser})=>{
  const a=await browser.newContext(),b=await browser.newContext();const pa=await a.newPage(),pb=await b.newPage()
  try{
   const fa=await realtimeBrowser(pa),fb=await realtimeBrowser(pb)
   await fixtureGoto(pa,path);await fixtureGoto(pb,path)
   await expect.poll(()=>fa.joins.length).toBeGreaterThan(0);await expect.poll(()=>fb.joins.length).toBeGreaterThan(0)
   await pa.waitForTimeout(700);const ca=fa.calls.filter(c=>c.name===rpc).length,cb=fb.calls.filter(c=>c.name===rpc).length
   expect(ca).toBeGreaterThan(0);expect(cb).toBeGreaterThan(0)
   fa.emit(feature);fb.emit(feature)
   await expect.poll(()=>fa.calls.filter(c=>c.name===rpc).length).toBeGreaterThan(ca)
   await expect.poll(()=>fb.calls.filter(c=>c.name===rpc).length).toBeGreaterThan(cb)
   expect(fa.joins.at(-1)!.filters.every(f=>f.filter.includes('shop-1:'))).toBe(true)
   await pa.screenshot({path:test.info().outputPath(`${feature}.png`),fullPage:true,animations:'disabled',timeout:10000})
  }finally{await Promise.all([a.close(),b.close()])}
 })
}
test('context switch removes old channel; dirty customer editor is not overwritten',async({page})=>{
 const f=await realtimeBrowser(page);await fixtureGoto(page,'/customers')
 await expect.poll(()=>f.joins.length).toBeGreaterThan(0)
 await page.waitForTimeout(700)
 await page.getByRole('button',{name:'Add customer',exact:true}).click()
 const input=page.locator('[role=dialog] input').first();await input.fill('Unsaved realtime draft')
 const before=f.calls.filter(c=>c.name==='list_customers').length;f.emit('customers');await page.waitForTimeout(700)
 expect(f.calls.filter(c=>c.name==='list_customers').length).toBe(before);await expect(input).toHaveValue('Unsaved realtime draft')
 // Closing with a dirty draft uses the existing shared confirmation controller.
 await fixtureGoto(page,'/appointments');const first=f.joins.length
 await page.locator('select[aria-label=Location]').selectOption('location-2')
 await expect.poll(()=>f.joins.length).toBeGreaterThan(first)
 expect(f.leaves).toBeGreaterThan(0)
 expect(f.joins.at(-1)!.filters.some(x=>x.filter.includes('location-2'))).toBe(true)
 expect(f.joins.at(-1)!.filters.some(x=>x.filter.includes('location-1'))).toBe(false)
})
