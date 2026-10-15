import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) {
 test(`optional recipe records an immutable material version: ${locale}`, async ({page}) => {
  const ar=locale==='ar';await page.setViewportSize({width:ar?390:1440,height:1000})
  const versions: unknown[]=[]
  const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
   if(name==='service_recipe_context')return {services:[{id:'service-1',name:'Haircut'}],materials:[{id:'cream-1',name:'Cream',unit:'mL',canDefineUnit:false}],totalCount:versions.length,versions}
   if(name==='save_service_recipe'){versions.push({id:'recipe-1',service_id:args.p_service_id,materials:[{productId:'cream-1',name:'Cream',unit:'mL',quantity:30}],effective_at:new Date().toISOString(),reason:args.p_reason});return 'recipe-1'}
   return undefined
  })
  await fixtureGoto(page,'/service-materials')
  await page.getByRole('button',{name:ar?'نسخة وصفة جديدة':'New recipe version',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('combobox',{name:ar?'الخدمة':'Service',exact:true}).click();await page.getByRole('option',{name:'Haircut',exact:true}).click()
  await dialog.getByRole('button',{name:ar?'إضافة مادة':'Add material',exact:true}).click()
  await dialog.getByRole('combobox',{name:ar?'المادة':'Material',exact:true}).click();await page.getByRole('option',{name:'Cream (mL)',exact:true}).click()
  await dialog.getByRole('spinbutton',{name:ar?'الكمية':'Quantity',exact:true}).fill('30')
  await dialog.getByRole('textbox',{name:ar?'السبب':'Reason',exact:true}).fill('Thirty mL recipe')
  await dialog.getByRole('button',{name:ar?'حفظ':'Save',exact:true}).click()
  await expect(dialog).not.toBeVisible()
  expect(calls.find(c=>c.name==='save_service_recipe')?.args).toMatchObject({p_shop_id:'shop-1',p_service_id:'service-1',p_effective_at:null,p_materials:[{productId:'cream-1',unit:'mL',quantity:30}],p_reason:'Thirty mL recipe'})
  await expect(page.getByText(/Thirty mL recipe/)).toBeVisible();await expectNoPageOverflow(page)
 })
 test(`walk-in fulfillment remains a server-confirmed queued command: ${locale}`,async({page})=>{
  const ar=locale==='ar'
  const {calls}=await pilotFixture(page,locale,'owner',(name)=>{
   if(name==='service_recipe_context')return {services:[],materials:[],versions:[],totalCount:0}
   if(name==='service_fulfillment_context')return {totalCount:0,lines:[{id:'line-1',name:'Haircut',quantity:2,completedQuantity:0,history:[]}]}
   if(name==='complete_service')return 'fulfillment-1'
   return undefined
  })
  await fixtureGoto(page,'/service-materials?sale=sale-1')
  await page.getByRole('button',{name:ar?'تسجيل تنفيذ':'Record fulfillment',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('combobox',{name:ar?'الخدمة':'Service',exact:true}).click();await page.getByRole('option',{name:'Haircut (0/2)',exact:true}).click()
  await dialog.getByRole('textbox',{name:ar?'السبب':'Reason',exact:true}).fill('One unit performed')
  await dialog.getByRole('button',{name:ar?'حفظ':'Save',exact:true}).click()
  await expect.poll(()=>calls.filter(c=>c.name==='complete_service').length).toBe(1)
  expect(calls.find(c=>c.name==='complete_service')?.args).toMatchObject({p_shop_id:'shop-1',p_location_id:'location-1',p_line_id:'line-1',p_quantity:1,p_appointment_id:null,p_materials:null,p_reason:'One unit performed'})
  await expect(page.getByText(ar ? 'التخزين المحلي غير متاح.' : 'Local storage is unavailable.', {exact:false})).not.toBeVisible()
  await expect(page.getByRole('paragraph').filter({hasText: ar ? /تنفيذ خدمة.*متزامن/ : /Service fulfillment.*Synced/})).toBeVisible()
 })
}

for (const locale of ['en', 'ar']) test(`material shortage stays failed across reload and retries the same request: ${locale}`, async ({page}) => {
 const ar=locale==='ar';let shortage=true;const requests: Record<string, unknown>[]=[]
 await pilotFixture(page,locale,'owner',name=>{
  if(name==='service_recipe_context')return {services:[],materials:[],versions:[],totalCount:0}
  if(name==='service_fulfillment_context')return {totalCount:0,lines:[{id:'line-1',name:'Haircut',quantity:1,completedQuantity:0,history:[]}]}
  return undefined
 })
 await fixtureRoute(page,/\/rest\/v1\/rpc\/complete_service$/,async route=>{
  requests.push(route.request().postDataJSON())
  await route.fulfill(shortage?{status:400,json:{code:'23514',message:'INSUFFICIENT_SERVICE_MATERIAL_STOCK'}}:{json:'fulfillment-1'})
 })
 await fixtureGoto(page,'/service-materials?sale=sale-1')
 await page.getByRole('button',{name:ar?'تسجيل تنفيذ':'Record fulfillment',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('combobox',{name:ar?'الخدمة':'Service',exact:true}).click();await page.getByRole('option',{name:'Haircut (0/1)',exact:true}).click()
 await dialog.getByRole('textbox',{name:ar?'السبب':'Reason',exact:true}).fill('Performed service requiring materials')
 await dialog.getByRole('button',{name:ar?'حفظ':'Save',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:ar?'المواد غير كافية':'Insufficient materials'})).toBeVisible()
 expect(requests).toHaveLength(1)
 await fixtureGoto(page,'/service-materials?sale=sale-1')
 await expect(page.getByRole('alert').filter({hasText:ar?'المواد غير كافية':'Insufficient materials'})).toBeVisible()
 expect(requests).toHaveLength(1)
 shortage=false
 await page.getByRole('button',{name:ar?'إعادة المحاولة بنفس معرف العملية':'Retry with the same request IDs',exact:true}).click()
 await expect(page.getByRole('paragraph').filter({hasText:ar?/تنفيذ خدمة.*متزامن/:/Service fulfillment.*Synced/})).toBeVisible()
 expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1])
})
