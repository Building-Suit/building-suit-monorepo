import {expect,test} from '@playwright/test'
import {pilotFixture,fixtureGoto} from './pilot-fixture'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
const item={id:'appointment-access',locationId:'location-1',staffMembershipId:'membership-1',serviceId:'service-1',customerId:null,identityKind:'walk_in',customerName:'Fixture access visitor',customerPhone:'01000000000',notes:'PRIVATE notes',status:'booked',startsAt:'2026-10-13T10:00:00Z',endsAt:'2026-10-13T10:30:00Z',serviceName:'Haircut',staffName:'Pilot barber',saleId:null,history:[]}
for(const locale of ['en','ar'])test(`staff issues once, rotates and revokes without caching secrets ${locale}`,async({page})=>{
 const ar=locale==='ar';let enabled=false,issues=0
 await page.setViewportSize({width:ar?390:1440,height:1000})
 const {calls}=await pilotFixture(page,locale,'owner',(name)=>{
  if(name==='appointment_calendar')return{appointments:[item],workingHours:[],blocks:[]}
  if(name==='appointment_access_status')return{enabled,usablePhone:true,issuedAt:enabled?'2026-10-16T00:00:00Z':null}
  if(name==='appointment_access_issue'){enabled=true;issues++;return{code:issues===1?'0123-ABCD-EFGH':'2345-BCDE-FGHJ'}}
  if(name==='appointment_access_revoke'){enabled=false;return null}
  return undefined
 })
 await fixtureGoto(page,'/appointments?from=2026-10-13')
 await page.getByRole('button',{name:new RegExp(item.customerName)}).first().click();const event=page.getByRole('dialog',{name:item.customerName,exact:true})
 await event.getByRole('button',{name:ar?'وصول العميل':'Customer access',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:(ar?'وصول العميل: ':'Customer access: ')+item.customerName,exact:true}),field=dialog.getByRole('textbox',{name:ar?'رمز الوصول':'Access code',exact:true})
 await expect(dialog).toContainText(ar?'الوصول غير مفعّل':'Access disabled')
 await dialog.getByRole('button',{name:ar?'إصدار رمز الوصول':'Issue access code',exact:true}).click()
 await expect(field).toHaveValue('0123-ABCD-EFGH')
 const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},nuxt:(window as Window & {__NUXT__?:unknown}).__NUXT__}))
 expect(stored.includes('0123-ABCD-EFGH')).toBe(false)
 await expectNoPageOverflow(page)
 await dialog.getByRole('button',{name:ar?'إغلاق':'Close',exact:true}).last().click();await expect(dialog).toHaveCount(0)
 await page.getByRole('button',{name:new RegExp(item.customerName)}).first().click();await page.getByRole('dialog',{name:item.customerName,exact:true}).getByRole('button',{name:ar?'وصول العميل':'Customer access',exact:true}).click()
 await expect(dialog).toContainText(ar?'الوصول مفعّل':'Access enabled');await expect(field).toHaveCount(0)
 await dialog.getByRole('button',{name:ar?'تغيير رمز الوصول':'Rotate access code',exact:true}).click()
 await expect(field).toHaveValue('2345-BCDE-FGHJ')
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})))
 await expect(dialog).toHaveCount(0)
 await page.getByRole('button',{name:new RegExp(item.customerName)}).first().click();await page.getByRole('dialog',{name:item.customerName,exact:true}).getByRole('button',{name:ar?'وصول العميل':'Customer access',exact:true}).click()
 await expect(dialog).toContainText(ar?'الوصول مفعّل':'Access enabled');await expect(field).toHaveCount(0)
 await dialog.getByRole('button',{name:ar?'إلغاء الوصول':'Revoke access',exact:true}).click()
 await expect(dialog).toContainText(ar?'الوصول غير مفعّل':'Access disabled');await expect(field).toHaveCount(0)
 expect(calls.filter(c=>c.name==='appointment_access_issue'||c.name==='appointment_access_revoke').every(c=>JSON.stringify(c.args)===JSON.stringify({p_shop_id:'shop-1',p_appointment_id:item.id}))).toBe(true)
})
test('unusable phone keeps access disabled',async({page})=>{
 const {calls}=await pilotFixture(page,'en','owner',name=>name==='appointment_calendar'?{appointments:[item],workingHours:[],blocks:[]}:name==='appointment_access_status'?{enabled:false,usablePhone:false,issuedAt:null}:undefined)
 await fixtureGoto(page,'/appointments?from=2026-10-13');await page.getByRole('button',{name:new RegExp(item.customerName)}).first().click();const event=page.getByRole('dialog',{name:item.customerName,exact:true});await event.getByRole('button',{name:'Customer access',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Customer access: '+item.customerName,exact:true});await expect(dialog).toContainText('Save a usable appointment phone');await expect(dialog.getByRole('button',{name:'Issue access code',exact:true})).toBeDisabled()
 expect(calls.some(c=>c.name==='appointment_access_issue')).toBe(false)
})

test('view-only staff cannot open credential controls',async({page})=>{
 const {calls}=await pilotFixture(page,'en','employee',name=>name==='appointment_calendar'?{appointments:[item],workingHours:[],blocks:[]}:name==='appointment_options'?{canManage:false,canManageSchedule:false,locations:[{id:'location-1',name:'First branch'}],staff:[{membershipId:'membership-1',name:'Pilot barber',locationIds:['location-1']}],services:[{id:'service-1',name:'Haircut',durationMinutes:30,cleanupMinutes:0,locationIds:['location-1'],staffMembershipIds:['membership-1']}],customers:[]}:undefined)
 await fixtureGoto(page,'/appointments?from=2026-10-13')
 await page.getByRole('button',{name:new RegExp(item.customerName)}).first().click()
 await expect(page.getByRole('dialog')).toContainText(item.customerName)
 await expect(page.getByRole('button',{name:'Customer access',exact:true})).toHaveCount(0)
 expect(calls.some(c=>c.name.startsWith('appointment_access_'))).toBe(false)
})
