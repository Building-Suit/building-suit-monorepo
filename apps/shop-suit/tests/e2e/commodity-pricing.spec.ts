import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
test.use({actionTimeout:5000,navigationTimeout:30000})
const productId='product-commodity',quoteId='00000000-0000-4000-8000-000000000731',ruleId='00000000-0000-4000-8000-000000000732'
const measurement={baseUnitCode:'m',increment:'0.001',revision:1,saleUnits:['m'],baseUnitPrice:'35',packages:[]}
const product={id:productId,name:'Commodity cable',itemType:'product',unitPrice:35,discount:0,stock:20,sku:'COMMODITY-CABLE',barcode:null,measurement}
for(const locale of ['en','ar'])test(`approved source and exact commodity rule, retry, history and checkout ${locale}`,async({page})=>{
 test.setTimeout(120000);const ar=locale==='ar';await page.setViewportSize({width:ar?390:1440,height:1000});await page.addInitScript(dark=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),ar)
 const records:Record<string,unknown>[]=[],events:Record<string,unknown>[]=[],results=new Map<string,object>();let lose=true
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shops')return[{id:'shop-1',name:'Synthetic commodity merchant',business_mode:'product',status:'active'}]
  if(name==='shop_permission_access')return{'products.manage':true}
  if(name==='list_products')return{items:[{id:productId,name:product.name}],total:1}
  if(name==='product_measurement_options')return{...measurement,status:'active',locked:true}
  if(name==='commodity_pricing_context'){
   const quote=args.p_kind!=='rule',items=records.filter(r=>quote?'price_per_kg' in r:'product_id' in r),history=args.p_id?events.filter(e=>e.record_id===args.p_id):[]
   return{items,total:items.length,page:1,pageSize:20,record:args.p_id?items.find(r=>r.id===args.p_id)||null:null,history,historyTotal:history.length,historyPage:1,currency:'EGP',canManage:true}
  }
  if(name==='shop_catalog_media'&&args.p_action==='pos')return{items:[product],total:1,page:1,pageSize:30,businessMode:'product'}
  if(name==='pos_checkout_context')return{staff:[{id:'membership-1',name:'Counter operator'}],customers:[],appointments:[]}
  if(name==='quote_customer_sale')return{calculationEnabled:false,tradePricingEnabled:true,tradePricingApplied:true,tax:0,total:(args.p_lines as {quantity:string}[]).reduce((sum,line)=>sum+Number(line.quantity)*25,0),lines:(args.p_lines as {quantity:string}[]).map(line=>({total:Number(line.quantity)*25,net:Number(line.quantity)*25,tax:0,pricing:{source:'commodity'}})),offers:[]}
  if(name==='pos_catalog_offers')return[]
  if(name==='get_own_pos_receipt')return{version:1,invoiceId:'sale-1',invoiceNumber:'COMMODITY-SALE-1',issuedAt:new Date().toISOString(),currency:'EGP',business:{name:'Synthetic commodity merchant',address:null,phone:null},location:{name:'First branch',code:'01',address:null,phone:null},staffName:'Counter operator',customer:{name:null,phone:null},lines:[{id:'line-1',itemType:'product',name:product.name,sku:product.sku,quantity:1,unitPrice:25,discount:0,total:25}],payments:[{id:'payment-1',amount:25,method:'cash',reference:null,paidAt:new Date().toISOString()}],subtotal:25,discount:0,total:25,footer:null,paperSize:'thermal_80'}
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/commodity_pricing_command',async route=>{
  const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'commodity_pricing_command',args});const key=String(args.p_request_id),v=args.p_values as Record<string,unknown>
  if(!results.has(key)){
   const rule=args.p_kind==='rule',id=rule?ruleId:quoteId,old=records.find(r=>r.id===id),revision=Number(old?.revision||0)+1
   const record={id,shop_id:'shop-1',revision,active:v.active,evidence_reference:v.evidenceReference,approved_by:'profile-1',approved_at:new Date().toISOString(),currency_code:'EGP',...(rule?{product_id:v.productId,product_name:product.name,quote_id:v.quoteId,base_unit_code:v.baseUnitCode,measurement_revision:v.measurementRevision,current_measurement_revision:1,kg_per_base_unit:v.kgPerBaseUnit,premium_per_base_unit:v.premiumPerBaseUnit,commodity:'Copper fixture',source_name:'Synthetic supplier quote'}:{commodity:v.commodity,source_name:v.sourceName,price_per_kg:v.pricePerKg,effective_at:v.effectiveAt,expires_at:v.expiresAt})}
   const previous=old?structuredClone(old):null;if(old)records.splice(records.indexOf(old),1);records.push(record);events.push({id:'event-'+events.length,record_id:id,revision,snapshot:{previous,current:structuredClone(record)},reason:args.p_reason,actor_name:'Synthetic manager',created_at:new Date().toISOString()});results.set(key,{id,kind:args.p_kind,revision})
  }
  if(lose){lose=false;await route.fulfill({status:503,json:{message:'Synthetic committed approval reply lost'}})}else await route.fulfill({json:results.get(key)})
 })
 let losePayment=true
 await fixtureRoute(page,'**/rest/v1/rpc/checkout_pos_sale',async route=>{const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'checkout_pos_sale',args});if(losePayment){losePayment=false;await route.fulfill({status:503,json:{message:'Synthetic committed payment reply lost'}})}else await route.fulfill({json:'sale-1'})})
 await fixtureGoto(page,'/commodity-pricing');const add=ar?'إضافة':'Add',save=ar?'حفظ':'Save',reason=ar?'سبب التغيير':'Reason for change',evidence=ar?'مرجع الدليل':'Evidence reference',confirm=ar?'أؤكد مراجعة المصدر والسريان والعلاقة الخاصة بالصنف':'I confirm the source, validity and product-specific relationship were reviewed'
 await page.getByRole('button',{name:add,exact:true}).click();const editor=page.getByRole('dialog',{name:add,exact:true})
 await editor.getByLabel(ar?'المادة':'Commodity',{exact:true}).fill('Copper fixture');await editor.getByLabel(ar?'اسم جهة المصدر':'Source organization',{exact:true}).fill('Synthetic supplier quote');await editor.getByLabel(ar?'سعر المصدر لكل كيلوجرام':'Source price per kilogram',{exact:true}).fill(ar?'١٠٠':'100')
 const expires=new Date(Date.now()+2*86400000).toISOString().slice(0,16);await editor.getByLabel(ar?'نهاية السريان (الوقت المحلي)':'Expires at (local time)',{exact:true}).fill(expires)
 await editor.getByLabel(evidence,{exact:true}).fill('Synthetic quotation DOC-COPPER-001');await editor.getByLabel(reason,{exact:true}).fill('Approve synthetic source terms')
 await editor.getByRole('checkbox',{name:ar?'نشط':'Active',exact:true}).check();await editor.getByRole('checkbox',{name:confirm,exact:true}).check();await expect(editor.getByRole('button',{name:save,exact:true})).toBeInViewport();await editor.getByRole('button',{name:save,exact:true}).click()
 await expect(editor.getByRole('alert')).toContainText(ar?'لم تتأكد نتيجة الحفظ':'The save result is unconfirmed');await expect(editor.getByLabel(ar?'اسم جهة المصدر':'Source organization',{exact:true})).toBeDisabled();await editor.press('Escape');await expect(editor).toBeVisible();await editor.getByRole('button',{name:save,exact:true}).click();await expect(editor).toHaveCount(0)
 const approvals=calls.filter(c=>c.name==='commodity_pricing_command');expect(approvals[0]!.args).toEqual(approvals[1]!.args);expect(approvals[0]!.args.p_values).toMatchObject({currency:'EGP',pricePerKg:'100',active:true,confirmed:true})
 await page.getByRole('button',{name:ar?'مراجعة وتعديل':'Review and edit',exact:true}).click();const review=page.getByRole('dialog',{name:ar?'مراجعة وتعديل':'Review and edit',exact:true});await expect(review.getByLabel(ar?'سعر المصدر لكل كيلوجرام':'Source price per kilogram',{exact:true})).toBeDisabled();await review.getByRole('button',{name:ar?'إلغاء':'Cancel',exact:true}).click();await expect(review).toHaveCount(0)
 await page.getByRole('combobox',{name:ar?'نوع الإعداد':'Setup type',exact:true}).click();await page.getByRole('option',{name:ar?'قواعد الأصناف':'Product rules',exact:true}).click();await page.getByRole('button',{name:add,exact:true}).click()
 await editor.getByRole('combobox',{name:ar?'الصنف':'Product',exact:true}).click();await page.getByRole('option',{name:product.name,exact:true}).click();await expect(editor).toContainText(ar?'متر':'Meter')
 await editor.getByRole('combobox',{name:ar?'سعر مصدر معتمد وسارٍ':'Approved current source quote',exact:true}).click();await page.getByRole('option',{name:/Copper fixture/}).click();await expect(editor).toContainText('DOC-COPPER-001')
 await editor.getByLabel(ar?'كيلوجرامات المادة لكل وحدة مخزون':'Kilograms of commodity per stock unit',{exact:true}).fill(ar?'٠٫٢':'0.2');await editor.getByLabel(ar?'الإضافة السعرية لكل وحدة مخزون':'Price premium per stock unit',{exact:true}).fill(ar?'٥':'5');await editor.getByLabel(evidence,{exact:true}).fill('Synthetic verified copper content');await editor.getByLabel(reason,{exact:true}).fill('Approve exact material pricing')
 await editor.getByRole('checkbox',{name:ar?'نشط':'Active',exact:true}).check();await editor.getByRole('checkbox',{name:confirm,exact:true}).check();await expect(editor.getByRole('button',{name:save,exact:true})).toBeInViewport();await expectNoPageOverflow(page);await page.screenshot({path:test.info().outputPath('commodity-rule-approval.png'),fullPage:true});await editor.getByRole('button',{name:save,exact:true}).click();await expect(editor).toHaveCount(0)
 expect(calls.filter(c=>c.name==='commodity_pricing_command').at(-1)!.args.p_values).toMatchObject({productId,quoteId,baseUnitCode:'m',measurementRevision:1,kgPerBaseUnit:'0.2',premiumPerBaseUnit:'5',active:true,confirmed:true})
 await page.getByRole('button',{name:ar?'السجل':'History',exact:true}).click();const history=page.getByRole('dialog',{name:ar?'السجل':'History',exact:true});await expect(history).toContainText('Approve exact material pricing');await expect(history).toContainText('0.2 kg');await history.getByRole('button',{name:ar?'إغلاق':'Close',exact:true}).last().click()
 expect(calls.some(c=>['adjust_stock','create_supplier_purchase','save_pos_sale_draft'].includes(c.name))).toBe(false)
 await fixtureGoto(page,'/pos');await page.locator('.bs-catalog-tile').getByRole('button',{name:/Add:|إضافة:/}).first().click();if(ar)await page.getByRole('button',{name:/مراجعة البيع/}).click()
 const cart=page.locator('.bs-pos-cart');await expect(cart).toContainText(ar?'سعر مادة مرجعي معتمد':'Approved commodity price');await page.keyboard.press('F4');await page.getByRole('button',{name:ar?'بدون عميل — بيع كاونتر مسدد بالكامل':'No customer — fully paid counter sale',exact:true}).click();await expect(cart.getByRole('button',{name:ar?/^حصّل /:/^Pay /})).toBeEnabled();await page.keyboard.press('F8');await expect(page.getByRole('alert')).toBeVisible();await expect(cart.getByRole('button',{name:ar?/^حصّل /:/^Pay /})).toBeEnabled();await page.keyboard.press('F8');await expect(page.getByRole('dialog').locator('[data-receipt-document]')).toContainText('COMMODITY-SALE-1')
 const payments=calls.filter(c=>c.name==='checkout_pos_sale');expect(payments).toHaveLength(2);expect(payments[0]!.args).toEqual(payments[1]!.args);expect(payments[0]!.args.p_amount).toBe(25);expect(results.size).toBe(2)
})

test('commodity setup denies a cashier without approval controls',async({page})=>{
 test.setTimeout(60000);await pilotFixture(page,'en','cashier',name=>name==='shops'?[{id:'shop-1',name:'Denied commodity merchant',business_mode:'product',status:'active'}]:name==='shop_permission_access'?{'products.manage':false}:undefined)
 await fixtureRoute(page,'**/rest/v1/rpc/commodity_pricing_context',route=>route.fulfill({status:403,json:{code:'42501',message:'SHOP_PERMISSION_DENIED'}}));await fixtureGoto(page,'/commodity-pricing');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Add',exact:true})).toHaveCount(0)
})

test('malformed commodity source reads retain a clear retry path',async({page})=>{
 test.setTimeout(60000);let malformed=true
 await pilotFixture(page,'en','owner',name=>name==='shops'?[{id:'shop-1',name:'Malformed commodity merchant',business_mode:'product',status:'active'}]:name==='shop_permission_access'?{'products.manage':true}:undefined)
 await fixtureRoute(page,'**/rest/v1/rpc/commodity_pricing_context',route=>route.fulfill({json:malformed?{items:[{id:quoteId,price_per_kg:100}],total:1,history:[],currency:'EGP',canManage:true}:{items:[],total:0,page:1,pageSize:20,record:null,history:[],historyTotal:0,historyPage:1,currency:'EGP',canManage:true}}))
 await fixtureGoto(page,'/commodity-pricing');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Add',exact:true})).toHaveCount(0);malformed=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('button',{name:'Add',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a stale source approval retains the reason and explains reopening',async({page})=>{
 test.setTimeout(60000);const now=new Date(),record={id:quoteId,shop_id:'shop-1',commodity:'Copper stale fixture',source_name:'Synthetic source',price_per_kg:'100',evidence_reference:'Synthetic stale source evidence',currency_code:'EGP',effective_at:new Date(now.getTime()-86400000).toISOString(),expires_at:new Date(now.getTime()+86400000).toISOString(),active:false,revision:1,approved_by:'profile-1',approved_at:now.toISOString()}
 const {calls}=await pilotFixture(page,'en','owner',name=>name==='shops'?[{id:'shop-1',name:'Stale source merchant',business_mode:'product',status:'active'}]:name==='shop_permission_access'?{'products.manage':true}:name==='commodity_pricing_context'?{items:[record],total:1,page:1,pageSize:20,record:null,history:[],historyTotal:0,historyPage:1,currency:'EGP',canManage:true}:undefined)
 await fixtureRoute(page,'**/rest/v1/rpc/commodity_pricing_command',async route=>{calls.push({name:'commodity_pricing_command',args:route.request().postDataJSON()});await route.fulfill({status:400,json:{code:'55000',message:'COMMODITY_CONTEXT_CHANGED'}})})
 await fixtureGoto(page,'/commodity-pricing');await page.getByRole('button',{name:'Review and edit',exact:true}).click();const editor=page.getByRole('dialog',{name:'Review and edit',exact:true});await editor.getByLabel('Reason for change',{exact:true}).fill('Keep my attempted approval reason');await editor.getByRole('checkbox',{name:'Active',exact:true}).check();await editor.getByRole('checkbox',{name:'I confirm the source, validity and product-specific relationship were reviewed',exact:true}).check();await editor.getByRole('button',{name:'Save',exact:true}).click()
 await expect(editor.getByRole('alert')).toContainText('Reopen the record');await expect(editor.getByLabel('Reason for change',{exact:true})).toHaveValue('Keep my attempted approval reason');await expect(editor.getByLabel('Reason for change',{exact:true})).toBeEnabled();expect(calls.filter(c=>c.name==='commodity_pricing_command')).toHaveLength(1)
})

test('an unavailable source blocks POS payment with a readable review instruction',async({page})=>{
 test.setTimeout(60000)
 const {calls}=await pilotFixture(page,'en','owner',(name,args)=>{
  if(name==='shops')return[{id:'shop-1',name:'Expired source merchant',business_mode:'product',status:'active'}]
  if(name==='shop_catalog_media'&&args.p_action==='pos')return{items:[product],total:1,page:1,pageSize:30,businessMode:'product'}
  if(name==='pos_checkout_context')return{staff:[{id:'membership-1',name:'Counter operator'}],customers:[],appointments:[]}
  if(name==='pos_catalog_offers')return[]
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/quote_customer_sale',route=>route.fulfill({status:400,json:{code:'55000',message:'COMMODITY_QUOTE_UNAVAILABLE'}}));await fixtureGoto(page,'/pos');await page.locator('.bs-catalog-tile').getByRole('button',{name:/Add:/}).first().click();await expect(page.getByRole('alert')).toContainText('Ask a manager to review');await page.keyboard.press('F8');expect(calls.some(c=>['save_pos_sale_draft','checkout_pos_sale'].includes(c.name))).toBe(false)
})
