import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
test.describe.configure({timeout:60000})
test.beforeEach(({page})=>{page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(30000)})
const orderId='00000000-0000-4000-8000-000000000411',lineId='00000000-0000-4000-8000-000000000412',productId='product-po',vendorId='vendor-po',packId='package-po'
const invoiceIds=['00000000-0000-4000-8000-000000000413','00000000-0000-4000-8000-000000000414']
const originalInput={product_id:productId,quantity:'10',unit_cost:'2500.00',package_id:packId,package_version:1,measurement_revision:1}
const measurement={version:1,productRevision:1,baseUnitCode:'m',baseQuantity:'1000',quantityIncrement:'0.001',enteredQuantity:'10',enteredUnitCode:'reel',enteredUnitPrice:'2500',packageId:packId,packageVersion:1,packageName:'100m source reel',unitNameEn:'Reel',unitNameAr:'بكرة',reelTracking:true}
function context(created:boolean,status:string,revision:number,received:number,receipts:object[]=[],history:object[]=[],manage=true,detail=false){
 const record={id:orderId,order_number:'PO-00000001',status,revision,currency:'EGP',vendor_id:vendorId,vendor_name:'Agreed source supplier',expected_on:'2026-11-01',estimated_total:'25000',created_at:'2026-10-25T10:00:00Z',notes:'Ten source reels in two visits'}
 return{items:created?[record]:[],total:created?1:0,page:1,pageSize:20,canManage:manage,detail:detail&&created?{record,lines:[{id:lineId,line_order:1,product_id:productId,product_name:'Ordered blue cable',quantity:'1000',entered_quantity:'10',unit_cost:'25',estimated_total:'25000',measurement_snapshot:measurement,original_input:{...originalInput,unit_cost:'2500'},received_quantity:received===10?'1000':received===6?'600':'0',remaining_quantity:received===10?'0':received===6?'400':'1000',received_entered_quantity:String(received),remaining_entered_quantity:received===10?'0':received===6?'4':'10'}],history,historyTotal:history.length,historyPage:1,receipts,receiptTotal:receipts.length,receiptPage:1,canEdit:manage&&status==='draft',canIssue:manage&&status==='draft',canReceive:manage&&['issued','partially_received'].includes(status),canCancel:manage&&!['received','cancelled'].includes(status)}:null}
}
for(const locale of ['en','ar'])test(`supplier order ten reels received six then four with retained requests ${locale}`,async({page})=>{
 test.setTimeout(120000)
 const ar=locale==='ar';await page.setViewportSize({width:ar?390:1440,height:1000});await page.addInitScript(dark=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),ar)
 let created=false,status='draft',revision=0,received=0,loseSave=true,loseReceipt=true
 const orderResults=new Map<string,object>(),receiptResults=new Map<string,object>(),receipts:object[]=[],history:object[]=[]
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shops')return[{id:'shop-1',name:'Supplier ordering merchant',business_mode:'product',status:'active'}]
  if(name==='list_vendors')return{items:[{id:vendorId,name:'Agreed source supplier'}],total:1}
  if(name==='list_products')return{items:[{id:productId,name:'Ordered blue cable'}],total:1}
  if(name==='product_measurement_options')return{status:'active',revision:1,baseUnitCode:'m',increment:'0.001',saleUnits:['m'],locked:false,packages:[{id:packId,code:'PO100',name:'100m source reel',unitCode:'reel',baseQuantity:'100',containedQuantity:'100',containedUnitCode:'m',version:1,salePrice:null,barcode:null,canSell:true,canPurchase:true,defaultSale:false,defaultPurchase:true}]}
  if(name==='supplier_order_context')return context(created,status,revision,received,receipts,history,true,!!args.p_order_id)
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/supplier_order_command',async route=>{
  const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'supplier_order_command',args});const key=String(args.p_request_id)
  if(!orderResults.has(key)){
   expect(args.p_revision).toBe(revision)
   if(args.p_action==='save'){expect(args.p_values).toMatchObject({vendorId,expectedOn:'2026-11-01',lines:[originalInput]});expect(args.p_order_id).toBeNull();created=true;status='draft';revision=1}
   else if(args.p_action==='issue'){expect(args.p_order_id).toBe(orderId);status='issued';revision=2}
   else throw Error('Unexpected order action')
   history.unshift({id:'event-'+revision,revision,action:args.p_action,previous_status:null,status,reason:args.p_reason,actor_name:'Receiving owner',created_at:new Date().toISOString()});orderResults.set(key,{id:orderId,status,revision})
  }
  if(args.p_action==='save'&&loseSave){loseSave=false;await route.fulfill({status:503,json:{message:'Synthetic committed order response lost'}})}else await route.fulfill({json:orderResults.get(key)})
 })
 await fixtureRoute(page,'**/rest/v1/rpc/receive_supplier_order',async route=>{
  const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'receive_supplier_order',args});const key=String(args.p_request_id)
  if(!receiptResults.has(key)){
   expect(args.p_revision).toBe(revision);const first=received===0
   expect(args.p_items).toEqual([{lineId,quantity:first?'6':'4',...(first?{reel_barcodes:['SOURCE-1','SOURCE-2','SOURCE-3','SOURCE-4','SOURCE-5','SOURCE-6']}:{})}])
   expect(args.p_order_id).toBe(orderId);expect(args.p_invoice_number).toBe(first?'PO-FIRST-6':'PO-FINAL-4');expect(args.p_received_on).toBe('2026-10-25')
   received=first?6:10;status=first?'partially_received':'received';revision=first?3:4;const invoiceId=invoiceIds[first?0:1]!
   receipts.push({id:'receipt-'+revision,invoice_id:invoiceId,invoice_number:args.p_invoice_number,invoice_status:'posted',issued_at:'2026-10-25T10:00:00Z',total:first?'15000':'10000',reason:args.p_reason,actor_name:'Receiving owner',created_at:new Date().toISOString()})
   history.unshift({id:'event-'+revision,revision,action:'receive',previous_status:null,status,reason:args.p_reason,actor_name:'Receiving owner',created_at:new Date().toISOString()});receiptResults.set(key,{id:orderId,status,revision,invoiceId,receiptId:'receipt-'+revision})
  }
  if(loseReceipt){loseReceipt=false;await route.fulfill({status:503,json:{message:'Synthetic committed receipt response lost'}})}else await route.fulfill({json:receiptResults.get(key)})
 })
 await fixtureGoto(page,'/purchase-orders')
 const newName=ar?'أمر شراء جديد':'New purchase order',saveName=ar?'حفظ المسودة':'Save draft',issueName=ar?'إصدار أمر الشراء':'Issue purchase order',receiveName=ar?'تسجيل استلام وفاتورة':'Record receipt and invoice',reasonName=ar?'سبب الإجراء':'Reason for action'
 await page.getByRole('button',{name:newName,exact:true}).click();const editor=page.getByRole('dialog',{name:newName,exact:true})
 await editor.getByRole('combobox',{name:ar?'المورد':'Supplier',exact:true}).click();await page.getByRole('option',{name:'Agreed source supplier',exact:true}).click()
 await editor.getByLabel(ar?'تاريخ الوصول المتوقع':'Expected delivery date',{exact:true}).fill('2026-11-01')
 await editor.getByRole('combobox',{name:ar?'المنتج':'Product',exact:true}).click();await page.getByRole('option',{name:'Ordered blue cable',exact:true}).click()
 await expect(editor.getByRole('combobox',{name:ar?'وحدة الشراء أو العبوة':'Purchase unit or package',exact:true})).toContainText('100m source reel')
 await editor.getByLabel(ar?'الكمية المطلوبة':'Ordered quantity',{exact:true}).fill(ar?'١٠':'10')
 const cost=editor.getByLabel(ar?'التكلفة لكل وحدة أو عبوة مختارة':'Cost per selected unit or package',{exact:true});await cost.fill(ar?'٢٥٠٠٫٠٠':'2500.00')
 await editor.getByLabel(ar?'ملاحظات':'Notes',{exact:true}).fill('Ten source reels in two visits');await editor.getByLabel(reasonName,{exact:true}).fill('Order ten original source reels')
 await expect(editor.getByRole('button',{name:saveName,exact:true})).toBeInViewport();await editor.getByRole('button',{name:saveName,exact:true}).click();await expect(editor.getByRole('alert')).toContainText(ar?'لم تتأكد النتيجة':'The result is unconfirmed');await expect(cost).toBeDisabled();await editor.press('Escape');await expect(editor).toBeVisible()
 await editor.getByRole('button',{name:saveName,exact:true}).click();await expect(editor).toHaveCount(0)
 const detail=page.getByRole('dialog',{name:'PO-00000001',exact:true});await expect(detail).toContainText('10 100m source reel');await expect(detail).toContainText('2500 EGP')
 await detail.getByRole('button',{name:issueName,exact:true}).click();const issue=page.getByRole('dialog',{name:issueName,exact:true});await issue.getByLabel(reasonName,{exact:true}).fill('Approve supplier order for delivery');await issue.getByRole('button',{name:issueName,exact:true}).click();await expect(issue).toHaveCount(0)
 await detail.getByRole('button',{name:receiveName,exact:true}).click();const receipt=page.getByRole('dialog',{name:receiveName,exact:true}),quantity=receipt.getByLabel('Ordered blue cable (100m source reel)',{exact:true})
 await receipt.getByLabel(ar?'تاريخ الاستلام والفاتورة':'Receipt and invoice date',{exact:true}).fill('2026-10-25');await receipt.getByLabel(ar?'رقم فاتورة المورد لهذا الاستلام':'Supplier invoice number for this receipt',{exact:true}).fill('PO-FIRST-6');await quantity.fill(ar?'٦':'6')
 await receipt.getByLabel(ar?'باركود البكرات، باركود لكل سطر (اختياري) · Ordered blue cable':'Reel barcodes, one per line (optional) · Ordered blue cable',{exact:true}).fill('SOURCE-1\nSOURCE-2\nSOURCE-3\nSOURCE-4\nSOURCE-5\nSOURCE-6')
 await receipt.getByLabel(reasonName,{exact:true}).fill('Physically accept first six reels');await expect(receipt.getByRole('button',{name:receiveName,exact:true})).toBeInViewport();await expectNoPageOverflow(page);await page.screenshot({path:test.info().outputPath('six-reel-receipt.png'),fullPage:true})
 await receipt.getByRole('button',{name:receiveName,exact:true}).click();await expect(receipt.getByRole('alert')).toContainText(ar?'لم تتأكد النتيجة':'The result is unconfirmed');await expect(quantity).toBeDisabled();await receipt.press('Escape');await expect(receipt).toBeVisible();await receipt.getByRole('button',{name:receiveName,exact:true}).click();await expect(receipt).toHaveCount(0)
 await expect(detail).toContainText('4 100m source reel');await expect(detail.getByRole('link',{name:'PO-FIRST-6',exact:true})).toHaveAttribute('href',`/purchases/${invoiceIds[0]}`)
 await detail.getByRole('button',{name:receiveName,exact:true}).click();await quantity.fill(ar?'٤':'4');await receipt.getByLabel(ar?'تاريخ الاستلام والفاتورة':'Receipt and invoice date',{exact:true}).fill('2026-10-25');await receipt.getByLabel(ar?'رقم فاتورة المورد لهذا الاستلام':'Supplier invoice number for this receipt',{exact:true}).fill('PO-FINAL-4');await receipt.getByLabel(reasonName,{exact:true}).fill('Accept final four original reels');await receipt.getByRole('button',{name:receiveName,exact:true}).click();await expect(receipt).toHaveCount(0)
 await expect(detail.getByRole('link',{name:'PO-FINAL-4',exact:true})).toHaveAttribute('href',`/purchases/${invoiceIds[1]}`);await expect(detail.getByRole('button',{name:receiveName,exact:true})).toHaveCount(0)
 const printedWindow=page.waitForEvent('popup');await detail.getByRole('button',{name:ar?'طباعة / PDF':'Print / PDF',exact:true}).click();const printed=await printedWindow;await expect(printed.getByRole('heading',{name:'PO-00000001',exact:true})).toBeVisible();await expect(printed.locator('body')).toContainText('2500 EGP');await expect(printed.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr');await printed.close()
 const commands=calls.filter(c=>c.name==='supplier_order_command'),deliveries=calls.filter(c=>c.name==='receive_supplier_order')
 expect(commands).toHaveLength(3);expect(commands[0]!.args).toEqual(commands[1]!.args);expect(deliveries).toHaveLength(3);expect(deliveries[0]!.args).toEqual(deliveries[1]!.args);expect(orderResults.size).toBe(2);expect(receiptResults.size).toBe(2)
 expect(calls.some(c=>['create_supplier_purchase','record_supplier_payment','adjust_stock','record_purchase_return'].includes(c.name))).toBe(false)
 await expectNoPageOverflow(page);await page.screenshot({path:test.info().outputPath('completed-supplier-order.png'),fullPage:true})
})

test('supplier invoice reader sees history without ordering or receiving controls',async({page})=>{
 const {calls}=await pilotFixture(page,'en','employee',(name,args)=>name==='shops'?[{id:'shop-1',name:'Supplier history merchant',business_mode:'product',status:'active'}]:name==='supplier_order_context'?context(true,'issued',2,0,[],[],false,!!args.p_order_id):undefined)
 await fixtureGoto(page,`/purchase-orders?order=${orderId}`);const detail=page.getByRole('dialog',{name:'PO-00000001',exact:true})
 await expect(detail).toContainText('Ordered blue cable');await expect(page.getByRole('button',{name:'New purchase order',exact:true})).toHaveCount(0)
 await expect(detail.getByRole('button',{name:/Edit draft|Issue purchase order|Record receipt and invoice|Cancel remaining order/})).toHaveCount(0)
 expect(calls.some(c=>c.name==='supplier_order_command'||c.name==='receive_supplier_order')).toBe(false)
})

test('known stale receiving failure retains inputs and unlocks correction',async({page})=>{
 const {calls}=await pilotFixture(page,'en','owner',(name,args)=>name==='shops'?[{id:'shop-1',name:'Supplier history merchant',business_mode:'product',status:'active'}]:name==='supplier_order_context'?context(true,'issued',2,0,[],[],true,!!args.p_order_id):undefined)
 await fixtureRoute(page,'**/rest/v1/rpc/receive_supplier_order',async route=>{calls.push({name:'receive_supplier_order',args:route.request().postDataJSON()});await route.fulfill({status:409,json:{code:'55000',message:'SUPPLIER_ORDER_CONTEXT_CHANGED'}})})
 await fixtureGoto(page,`/purchase-orders?order=${orderId}`);await page.getByRole('dialog',{name:'PO-00000001',exact:true}).getByRole('button',{name:'Record receipt and invoice',exact:true}).click()
 const editor=page.getByRole('dialog',{name:'Record receipt and invoice',exact:true}),quantity=editor.getByLabel('Ordered blue cable (100m source reel)',{exact:true})
 await quantity.fill('6');await editor.getByLabel('Reason for action',{exact:true}).fill('Staff collecting an updated delivery');await editor.getByRole('button',{name:'Record receipt and invoice',exact:true}).click()
 await expect(editor.getByRole('alert')).toContainText('close and reopen');await expect(quantity).toHaveValue('6');await expect(quantity).toBeEnabled();expect(calls.filter(c=>c.name==='receive_supplier_order')).toHaveLength(1)
})

test('malformed supplier order read shows a recoverable directory error',async({page})=>{
 await pilotFixture(page,'en','owner',(name)=>name==='shops'?[{id:'shop-1',name:'Supplier read failure merchant',business_mode:'product',status:'active'}]:name==='supplier_order_context'?{items:[{estimated_total:25000}],total:1,page:1,pageSize:20,canManage:true,detail:null}:undefined)
 await fixtureGoto(page,'/purchase-orders');await expect(page.getByRole('heading',{name:'Supplier purchase orders',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('Check access and details');await expect(page.getByRole('button',{name:'New purchase order',exact:true})).toHaveCount(0)
})
