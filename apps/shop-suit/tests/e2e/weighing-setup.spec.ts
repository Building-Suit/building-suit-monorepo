import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
test.use({actionTimeout:5000,navigationTimeout:30000})
const productId='product-factor',deviceId='00000000-0000-4000-8000-000000000721',factorId='00000000-0000-4000-8000-000000000722'
for(const locale of ['en','ar'])test(`device and exact product factor approvals retain retries and history ${locale}`,async({page})=>{
 test.setTimeout(120000);const ar=locale==='ar';await page.setViewportSize({width:ar?390:1440,height:1000});await page.addInitScript(dark=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),ar)
 const records:Record<string,unknown>[] = [],events:Record<string,unknown>[] = [],results=new Map<string,object>();let lose=true
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shops')return[{id:'shop-1',name:'Approval fixture merchant',business_mode:'product',status:'active'}]
  if(name==='shop_permission_access')return{'products.manage':true}
  if(name==='list_products')return{items:[{id:productId,name:'Approved conversion cable'}],total:1}
  if(name==='product_measurement_options')return{baseUnitCode:'m',increment:'0.001',revision:1,saleUnits:['m'],packages:[],status:'active',locked:true}
  if(name==='weighing_setup_context'){
   const items=records.filter(r=>args.p_kind==='factor'?'product_id' in r:'serial_number' in r),history=args.p_id?events.filter(e=>e.record_id===args.p_id):[]
   return{items,total:items.length,page:1,pageSize:20,record:args.p_id?items.find(r=>r.id===args.p_id)||null:null,history,historyTotal:history.length,historyPage:1,canManage:true}
  }
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/weighing_setup_command',async route=>{
  const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'weighing_setup_command',args});const key=String(args.p_request_id),values=args.p_values as Record<string,unknown>
  if(!results.has(key)){
   const factor=args.p_kind==='factor',id=factor?factorId:deviceId,old=records.find(r=>r.id===id),revision=Number(old?.revision||0)+1
   if(old)expect(args.p_revision).toBe(old.revision)
   const record={id,shop_id:'shop-1',location_id:'location-1',revision,active:values.active,evidence_reference:values.evidenceReference,approved_by:'profile-1',approved_at:new Date().toISOString(),...(factor?{product_id:values.productId,product_name:'Approved conversion cable',sku:'FACTOR-CABLE',base_unit_code:values.baseUnitCode,measurement_revision:values.measurementRevision,current_measurement_revision:1,kg_per_base_unit:values.kgPerBaseUnit}:{label:values.label,model:values.model,serial_number:values.serialNumber,protocol:'mt-sics-0-1',serial_options:values.serialOptions})}
   const previous=old?structuredClone(old):null;if(old)records.splice(records.indexOf(old),1);records.push(record)
   events.push({id:'approval-'+events.length,record_id:id,revision,snapshot:{previous,current:structuredClone(record)},reason:args.p_reason,actor_name:'Fixture manager',actor_profile_id:'profile-1',created_at:new Date().toISOString()});results.set(key,{id,kind:args.p_kind,revision})
  }
  if(lose){lose=false;await route.fulfill({status:503,json:{message:'Synthetic committed approval reply lost'}})}else await route.fulfill({json:results.get(key)})
 })
 await fixtureGoto(page,'/weighing-setup')
 const add=ar?'إضافة اعتماد':'Add approval',save=ar?'حفظ الاعتماد':'Save approval',reason=ar?'سبب التغيير':'Change reason',evidence=ar?'مرجع التحقق والاعتماد':'Verification and approval reference'
 await page.getByRole('button',{name:add,exact:true}).click();const editor=page.getByRole('dialog',{name:add,exact:true})
 await editor.getByLabel(ar?'اسم الميزان':'Scale label',{exact:true}).fill('Counter scale A');await editor.getByLabel(ar?'طراز الميزان':'Scale model',{exact:true}).fill('Synthetic MT-SICS profile');await editor.getByLabel(ar?'الرقم التسلسلي للجهاز':'Device serial number',{exact:true}).fill('TEST-MANAGER-SCALE')
 await editor.getByLabel(evidence,{exact:true}).fill('Synthetic protocol setup verification only');await editor.getByLabel(reason,{exact:true}).fill('Approve synthetic counter profile')
 await editor.getByRole('checkbox',{name:ar?'نشط':'Active',exact:true}).check();await editor.getByRole('checkbox',{name:ar?'تحققت من الجهاز وإعداداته ووضع القراءة عند الطلب قبل تفعيله':'I verified this device, its settings and on-demand operation before activation',exact:true}).check()
 await expect(editor.getByRole('button',{name:save,exact:true})).toBeInViewport();await editor.getByRole('button',{name:save,exact:true}).click();await expect(editor.getByRole('alert')).toContainText(ar?'لم تتأكد نتيجة الاعتماد':'The approval result is unconfirmed')
 await expect(editor.getByLabel(ar?'اسم الميزان':'Scale label',{exact:true})).toBeDisabled();await editor.press('Escape');await expect(editor).toBeVisible();await editor.getByRole('button',{name:save,exact:true}).click();await expect(editor).toHaveCount(0)
 await expect(page.getByText('Counter scale A',{exact:true})).toBeVisible();expect(calls.filter(c=>c.name==='weighing_setup_command')[0]!.args).toEqual(calls.filter(c=>c.name==='weighing_setup_command')[1]!.args)
 const mode=page.getByRole('combobox',{name:ar?'نوع الإعداد':'Setup type',exact:true});await mode.click();await page.getByRole('option',{name:ar?'معاملات الأصناف':'Product factors',exact:true}).click();await page.getByRole('button',{name:add,exact:true}).click()
 await editor.getByRole('combobox',{name:ar?'الصنف':'Product',exact:true}).click();await page.getByRole('option',{name:'Approved conversion cable',exact:true}).click()
 await expect(editor).toContainText(ar?'متر':'Meter');await editor.getByLabel(ar?'كيلوجرام لكل وحدة مخزون':'Kilograms per stock unit',{exact:true}).fill(ar?'٠٫٢':'0.2');await editor.getByLabel(evidence,{exact:true}).fill('Synthetic manufacturer factor reference');await editor.getByLabel(reason,{exact:true}).fill('Approve exact product relationship')
 await editor.getByRole('checkbox',{name:ar?'نشط':'Active',exact:true}).check();await editor.getByRole('checkbox',{name:ar?'تحققت من علاقة الوزن والطول لهذا الصنف ووحدة مخزونه الحالية':'I verified this product weight/length relationship and its current stock unit',exact:true}).check()
 await expectNoPageOverflow(page);await page.screenshot({path:test.info().outputPath('factor-approval.png'),fullPage:true});await editor.getByRole('button',{name:save,exact:true}).click();await expect(editor).toHaveCount(0)
 const factorWrite=calls.filter(c=>c.name==='weighing_setup_command').at(-1)!;expect(factorWrite.args.p_values).toMatchObject({productId,baseUnitCode:'m',measurementRevision:1,kgPerBaseUnit:'0.2',confirmed:true,active:true})
 await page.getByRole('button',{name:ar?'سجل الاعتماد':'Approval history',exact:true}).click();const history=page.getByRole('dialog',{name:ar?'سجل الاعتماد':'Approval history',exact:true});await expect(history).toContainText('0.2 kg');await expect(history).toContainText('Approve exact product relationship');await history.getByRole('button',{name:ar?'إغلاق':'Close',exact:true}).last().click()
 expect(results.size).toBe(2);expect(calls.some(c=>['adjust_stock','create_supplier_purchase','save_pos_sale_draft','record_scale_capture'].includes(c.name))).toBe(false)
})

test('manager setup rejects a denied reader without approval controls',async({page})=>{
 test.setTimeout(60000);await pilotFixture(page,'en','cashier',(name)=>name==='shops'?[{id:'shop-1',name:'Denied setup merchant',business_mode:'product',status:'active'}]:name==='shop_permission_access'?{'products.manage':false}:undefined)
 await fixtureRoute(page,'**/rest/v1/rpc/weighing_setup_context',route=>route.fulfill({status:403,json:{code:'42501',message:'SHOP_PERMISSION_DENIED'}}))
 await fixtureGoto(page,'/weighing-setup');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Add approval',exact:true})).toHaveCount(0)
})
