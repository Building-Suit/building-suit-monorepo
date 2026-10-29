import { expect, test, type Page } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
test.use({actionTimeout:5000,navigationTimeout:30000})
const deviceId='00000000-0000-4000-8000-000000000711',factorId='00000000-0000-4000-8000-000000000712',captureId='00000000-0000-4000-8000-000000000713'
const measurement={baseUnitCode:'m',increment:'0.001',revision:1,saleUnits:['m','cm'],baseUnitPrice:'35',packages:[]}
const product={id:'product-scale',name:'Weighed cable',itemType:'product',unitPrice:35,discount:0,stock:5,sku:'SCALE-CABLE',barcode:null,measurement}
const serialOptions={baudRate:9600,dataBits:8,stopBits:1,parity:'none',flowControl:'none'}
const device={id:deviceId,revision:1,label:'Approved counter scale',model:'Synthetic MT-SICS fixture',serialNumber:'TEST-SCALE-001',serialOptions,protocol:'mt-sics-0-1'}
const factor={id:factorId,revision:1,active:true,productId:product.id,baseUnitCode:'m',measurementRevision:1,kgPerBaseUnit:'0.2',evidenceReference:'Synthetic product factor reference',approvedAt:'2026-10-25T12:00:00Z'}
async function serialFixture(page:Page){
 await page.addInitScript(()=>{
  const fixture={commands:[] as string[],closed:0,unstable:false}
  Object.assign(window,{scaleFixture:fixture})
  const access=new EventTarget() as EventTarget&{requestPort:()=>Promise<unknown>}
  access.requestPort=async()=>{
   let incoming:ReadableStreamDefaultController<Uint8Array>
   const frame=(id:string,status:string,value:string)=>`${id} ${status} ${value.padStart(10,' ')} kg\r\n`
   return{readable:new ReadableStream<Uint8Array>({start(controller){incoming=controller}}),writable:new WritableStream<Uint8Array>({write(bytes){
    const command=new TextDecoder().decode(bytes).trim();fixture.commands.push(command)
    const response=command==='I4'?'I4 A "TEST-SCALE-001"\r\n':command==='I0'?'I0 B 0 "S"\r\nI0 B 1 "TA"\r\nI0 A 1 "T"\r\n':command==='TA'?frame('TA','A','0.125'):command==='T'?frame('T','S','0.125'):frame('S',fixture.unstable?'D':'S','0.250')
    incoming.enqueue(new TextEncoder().encode(response))
   }}),async open(){},async close(){fixture.closed++}}
  }
  Object.defineProperty(navigator,'serial',{configurable:true,value:access})
 })
}
for(const locale of ['en','ar'])test(`approved scale capture, exact factor, uncertain retry and ordinary checkout ${locale}`,async({page})=>{
 test.setTimeout(120000);const ar=locale==='ar';await page.setViewportSize({width:ar?390:1440,height:1000});await page.addInitScript(dark=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),ar);await serialFixture(page)
 let snapshot:Record<string,unknown>|null=null,lose=true
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shops')return[{id:'shop-1',name:'Synthetic scale merchant',business_mode:'product',status:'active'}]
  if(name==='shop_catalog_media'&&args.p_action==='pos')return{items:[product],total:1,page:1,pageSize:30,businessMode:'product'}
  if(name==='scale_counter_context')return{profiles:[device],items:[{id:product.id,name:product.name,sku:product.sku,unitCode:'m'}],total:1,page:1,pageSize:20,selected:args.p_product_id?product:null,factor:args.p_product_id?factor:null,canConfigure:true}
  if(name==='get_scale_capture')return{item:product,id:captureId,quantity:'1.25',availableQuantity:'5',unitCode:'m',snapshot}
  if(name==='pos_checkout_context')return{staff:[{id:'membership-1',name:'Counter operator'}],customers:[],appointments:[]}
  if(name==='quote_customer_sale')return{calculationEnabled:false,tradePricingEnabled:false,tax:0,total:(args.p_lines as {quantity:string}[]).reduce((sum,line)=>sum+Number(line.quantity)*35,0),lines:[],offers:[]}
  if(name==='pos_catalog_offers')return[]
  if(name==='get_own_pos_receipt')return{version:1,invoiceId:'sale-1',invoiceNumber:'SCALE-SALE-1',issuedAt:new Date().toISOString(),currency:'EGP',business:{name:'Synthetic scale merchant',address:null,phone:null},location:{name:'First branch',code:'01',address:null,phone:null},staffName:'Counter operator',customer:{name:null,phone:null},lines:[{id:'line-1',itemType:'product',name:product.name,sku:product.sku,quantity:1.25,unitPrice:35,discount:0,total:43.75}],payments:[{id:'payment-1',amount:43.75,method:'cash',reference:null,paidAt:new Date().toISOString()}],subtotal:43.75,discount:0,total:43.75,footer:null,paperSize:'thermal_80'}
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/record_scale_capture',async route=>{
  const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'record_scale_capture',args})
  if(!snapshot)snapshot={id:captureId,kind:'scale',protocol:'mt-sics-0-1',productId:product.id,productRevision:1,baseQuantity:'1.25',baseUnitCode:'m',netQuantity:'0.25',tareQuantity:'0.125',grossQuantity:'0.375',unitCode:'kg',reading:args.p_reading,device:{...device,serial:device.serialNumber,evidenceReference:'Synthetic device approval reference',approvedBy:'profile-1',approvedAt:new Date().toISOString()},factor,actorProfileId:'profile-1',capturedAt:new Date().toISOString()}
  if(lose){lose=false;await route.fulfill({status:503,json:{message:'Synthetic committed capture reply lost'}})}else await route.fulfill({json:{id:captureId,quantity:'1.25',unitCode:'m',snapshot,createdAt:snapshot.capturedAt}})
 })
 await fixtureGoto(page,'/pos');await page.getByRole('button',{name:ar?'وزن صنف':'Weigh an item',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:ar?'وزن الصنف':'Weigh item',exact:true}),confirm=ar?'تأكيد الوزن وإضافة للبيع':'Confirm weight and add to sale'
 await expect(dialog).toBeVisible();await dialog.getByRole('combobox',{name:ar?'الصنف':'Product',exact:true}).click();await page.getByRole('option',{name:product.name,exact:true}).click()
 const connect=dialog.getByRole('button',{name:ar?'توصيل الميزان':'Connect scale',exact:true});await expect(connect).toBeEnabled();await connect.click()
 const read=dialog.getByRole('button',{name:ar?'قراءة وزن ثابت':'Read stable weight',exact:true});await expect(read).toBeEnabled()
 expect(await page.evaluate(()=>(window as unknown as {scaleFixture:{commands:string[]}}).scaleFixture.commands)).toEqual(['I4','I0'])
 await page.evaluate(()=>{(window as unknown as {scaleFixture:{unstable:boolean}}).scaleFixture.unstable=true})
 await read.click();await expect(dialog.getByRole('alert')).toContainText(ar?'انتظر ثبات الميزان':'Wait for the scale to stabilize')
 await expect(dialog.getByRole('button',{name:confirm,exact:true})).toBeDisabled();expect(calls.some(c=>c.name==='record_scale_capture')).toBe(false)
 await page.evaluate(()=>{(window as unknown as {scaleFixture:{unstable:boolean}}).scaleFixture.unstable=false})
 await dialog.getByRole('button',{name:ar?'تصفير وزن الوعاء':'Tare container',exact:true}).click()
 const approval=page.getByRole('dialog',{name:ar?'تأكيد':'Confirm',exact:true});await approval.getByRole('button',{name:ar?'تأكيد':'Confirm',exact:true}).click()
 await expect(read).toBeEnabled();await read.click();await expect(dialog).toContainText('0.375');await expect(dialog).toContainText('1.25');await expect(dialog).toContainText('0.2 kg')
 await expect(dialog.locator('dd').filter({hasText:/^1\.25 /})).toBeInViewport()
 await expectNoPageOverflow(page);await page.screenshot({path:test.info().outputPath('scale-confirmation.png'),fullPage:true})
 await dialog.getByRole('button',{name:confirm,exact:true}).click();await expect(dialog.getByRole('alert')).toContainText(ar?'لم تتأكد نتيجة':'The capture result is unconfirmed')
 await expect(dialog.getByRole('combobox',{name:ar?'الصنف':'Product',exact:true})).toBeDisabled();await dialog.press('Escape');await expect(dialog).toBeVisible()
 await dialog.getByRole('button',{name:ar?'إعادة نفس الطلب':'Retry same request',exact:true}).click();await expect(dialog).toHaveCount(0)
 if(ar)await page.getByRole('button',{name:/مراجعة البيع/}).click()
 const cart=page.locator('.bs-pos-cart');await expect(cart).toContainText(ar?'وزن مؤكد':'Confirmed weight');await expect(cart.getByRole('spinbutton')).toHaveValue('1.25');await expect(cart.getByRole('spinbutton')).toBeDisabled()
 await page.keyboard.press('F4');await page.getByRole('button',{name:ar?'بدون عميل — بيع كاونتر مسدد بالكامل':'No customer — fully paid counter sale',exact:true}).click();await expect(cart.getByRole('button',{name:ar?/^حصّل /:/^Pay /})).toBeEnabled();await page.keyboard.press('F8')
 await expect(page.getByRole('dialog').locator('[data-receipt-document]')).toContainText('SCALE-SALE-1')
 const captured=calls.filter(c=>c.name==='record_scale_capture');expect(captured).toHaveLength(2);expect(captured[0]!.args).toEqual(captured[1]!.args)
 expect(captured[0]!.args).toMatchObject({p_shop_id:'shop-1',p_location_id:'location-1',p_product_id:product.id,p_device_id:deviceId,p_device_revision:1,p_factor_id:factorId,p_factor_revision:1,p_reading:{confirmed:true,serial:'TEST-SCALE-001'}})
 expect(calls.find(c=>c.name==='save_pos_sale_draft')?.args.p_lines).toEqual([{item_type:'product',source_id:product.id,quantity:'1.25',unit_code:'m',measurement_revision:1,measurement_capture:{kind:'scale',id:captureId}}])
 expect(calls.find(c=>c.name==='checkout_pos_sale')?.args.p_amount).toBe(43.75)
 expect(await page.evaluate(()=>(window as unknown as {scaleFixture:{commands:string[];closed:number}}).scaleFixture)).toMatchObject({commands:['I4','I0','TA','S','T','TA','S','TA'],closed:1})
})

test('unsupported scale connection leaves ordinary manual measured entry available',async({page})=>{
 test.setTimeout(60000);await page.addInitScript(()=>Object.defineProperty(navigator,'serial',{configurable:true,value:undefined}))
 const {calls}=await pilotFixture(page,'en','owner',(name,args)=>{
  if(name==='shops')return[{id:'shop-1',name:'Manual scale fallback merchant',business_mode:'product',status:'active'}]
  if(name==='shop_catalog_media'&&args.p_action==='pos')return{items:[product],total:1,page:1,pageSize:30,businessMode:'product'}
  if(name==='scale_counter_context')return{profiles:[device],items:[],total:0,page:1,pageSize:20,selected:null,factor:null,canConfigure:false}
  if(name==='pos_checkout_context')return{staff:[{id:'membership-1',name:'Counter operator'}],customers:[],appointments:[]}
  if(name==='quote_customer_sale')return{calculationEnabled:false,tradePricingEnabled:false,tax:0,total:35,lines:[],offers:[]}
  if(name==='pos_catalog_offers')return[]
  return undefined
 })
 await fixtureGoto(page,'/pos');await page.getByRole('button',{name:'Weigh an item',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Weigh item',exact:true});await expect(dialog).toContainText('This browser cannot connect to the scale');await expect(dialog.getByRole('button',{name:'Connect scale',exact:true})).toBeDisabled()
 await dialog.getByRole('button',{name:'Close',exact:true}).last().click();await expect(dialog).toHaveCount(0);await page.locator('.bs-catalog-tile').getByRole('button',{name:/Add:/}).first().click()
 await expect(page.locator('.bs-pos-cart').getByRole('spinbutton')).toBeEnabled();expect(calls.some(c=>c.name==='record_scale_capture')).toBe(false)
})
