import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const orderId = '00000000-0000-4000-8000-000000000311', lineId = '00000000-0000-4000-8000-000000000312', allocationId = '00000000-0000-4000-8000-000000000313'
const invoiceIds = ['00000000-0000-4000-8000-000000000314','00000000-0000-4000-8000-000000000315']
const snapshot = { quotationNumber: 'Q-COLLECT-1', version: 1, currency: 'EGP', customerId: 'customer-1', customerName: 'Collection contractor', projectReference: 'Site C', notes: '', validUntil: '2026-12-31T12:00:00Z', orderDiscount: '0', net: '17500', tax: '0', total: '17500', lines: [{ name: 'Agreed contractor cable', quantity: '500', unitPrice: '35', total: '17500', input: { item_type: 'product', source_id: 'product-1', quantity: '500', unit_code: 'm' }, measurement: { version: 1, productRevision: 1, baseUnitCode: 'm', baseUnitNameEn: 'Meter', baseUnitNameAr: 'متر', baseQuantity: '500', quantityIncrement: '0.001', enteredQuantity: '500', enteredUnitCode: 'm', enteredUnitPrice: '35', packageId: null, packageName: null, unitNameEn: 'Meter', unitNameAr: 'متر' } }] }
for (const locale of ['en','ar']) test(`deposit, invoice application, refund and partial collections ${locale}`,async ({page}) => {
 test.setTimeout(90000)
 const ar = locale === 'ar'
 await page.setViewportSize({width: ar ? 390 : 1440,height:1000})
 await page.addInitScript(dark=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),ar)
 let revision=2,collected=0,unapplied=0,received=false,applied=0,refunded=0,paidAt='2026-10-25T12:00:00Z',loseDeposit=true,loseCollection=true
 const fundingResults=new Map<string,object>(),collectionResults=new Map<string,object>()
 const invoices:{id:string;invoice_number:string;issued_at:string;total:string;outstanding:string}[]=[],financialHistory:object[]=[],orderEvents:object[]=[]
 const status=()=>collected===500?'fulfilled':collected?'partially_fulfilled':'open'
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shops')return[{id:'shop-1',name:'Electrical contractor merchant',business_mode:'product',status:'active'}]
  if(name==='trade_order_context'){
   const record={id:orderId,order_number:'O-COLLECT-1',status:status(),currency:'EGP',total_amount:'17500',revision,quotation_id:'quote-1',quotation_version:1,customer_name:snapshot.customerName,project_reference:'Site C',created_at:'2026-10-25T10:00:00Z',agreed_snapshot:snapshot}
   return{items:[record],total:1,page:1,pageSize:20,quotation:null,canManage:true,detail:args.p_order_id?{record,lines:[],events:orderEvents,eventCount:orderEvents.length,historyPage:1}:null}
  }
  if(name==='trade_order_reservation_context')return{items:[],total:0,page:1,pageSize:20,history:[],historyTotal:0,historyPage:1,revision,status:status(),serverNow:new Date().toISOString(),canManage:true,stock:[{lineId,productId:'product-1',name:'Agreed contractor cable',unitCode:'m',unitNameEn:'Meter',unitNameAr:'متر',orderedQuantity:'500',fulfilledQuantity:String(collected),remainingQuantity:String(500-collected),onHand:String(600-collected),reserved:String(500-collected),orderReserved:String(500-collected),available:'100',reelTracked:false}]}
  if(name==='trade_order_delivery_context')return{lines:[{id:lineId,name:'Agreed contractor cable',itemType:'product',unitCode:'m',packageName:null,orderedQuantity:'500',deliveredQuantity:String(collected),remainingQuantity:String(500-collected),heldQuantity:String(500-collected),heldLoss:'0',reelTracked:false,allowSplit:false}],history:invoices.map((i,index)=>({id:'delivery-'+index,invoice_id:i.id,invoice_number:i.invoice_number,invoice_status:'issued',total:i.total,reason:'Site C collection',created_at:i.issued_at,actor_name:'Counter operator'})),total:invoices.length,page:1,pageSize:20,revision,status:status(),currency:'EGP',canFulfill:collected<500,canApplyDeposits:true}
  if(name==='trade_order_funding_context'){
   const eligible=invoices.filter(i=>i.outstanding!=='0'&&(!args.p_invoice_search||i.invoice_number.includes(String(args.p_invoice_search))))
   return{items:received?[{id:allocationId,payment_id:'payment-original',amount:'5000',available:String(unapplied),applied:String(applied),method:'bank_transfer',reference:'BANK-5000',paid_at:paidAt,created_at:paidAt}]:[],total:received?1:0,page:1,pageSize:20,history:financialHistory,historyTotal:financialHistory.length,historyPage:1,invoices:eligible,invoiceTotal:eligible.length,invoicePage:1,revision,status:status(),currency:'EGP',depositsNet:received?String(5000-refunded):'0',unapplied:String(unapplied),depositCapacity:String(17500-(received?5000-refunded:0)),canReceive:true,canRefund:true,canReverse:true}
  }
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/trade_order_deposit',async route=>{
  const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'trade_order_deposit',args});const key=String(args.p_request_id)
  if(!fundingResults.has(key)){
   expect(args.p_revision).toBe(revision)
   if(args.p_action==='receive'){expect(args.p_amount).toBe('5000.00');received=true;unapplied=5000;paidAt=String(args.p_at)}
   else if(args.p_action==='apply'){expect(args.p_allocation_id).toBe(allocationId);expect(args.p_invoice_id).toBe(invoiceIds[0]);expect(args.p_amount).toBe('2000.00');unapplied-=2000;applied+=2000;invoices[0]!.outstanding='5000'}
   else if(args.p_action==='refund'){expect(args.p_amount).toBe('1000.00');unapplied-=1000;refunded+=1000}
   else throw Error('Unexpected funding action')
   revision++;fundingResults.set(key,{id:orderId,revision,status:status(),action:args.p_action,paymentId:'payment-original',resultId:args.p_action==='receive'?allocationId:'funding-event-'+revision})
   orderEvents.push({id:'order-event-'+revision,action:'deposit_'+args.p_action,reason:args.p_reason,actor_name:'Counter operator',created_at:new Date().toISOString()})
   if(args.p_action!=='receive')financialHistory.unshift({id:'finance-'+revision,kind:args.p_action,amount:args.p_amount,reason:args.p_reason,reference:null,effective_at:args.p_at,allocation_id:allocationId,invoice_id:args.p_action==='apply'?invoiceIds[0]:null,refund_payment_id:null,actor_name:'Counter operator'})
  }
  if(args.p_action==='receive'&&loseDeposit){loseDeposit=false;await route.fulfill({status:503,json:{message:'Synthetic committed deposit response lost'}})}
  else await route.fulfill({json:fundingResults.get(key)})
 })
 await fixtureRoute(page,'**/rest/v1/rpc/fulfill_trade_order',async route=>{
  const args=route.request().postDataJSON() as Record<string,unknown>;calls.push({name:'fulfill_trade_order',args});const key=String(args.p_request_id)
  if(!collectionResults.has(key)){
   expect(args.p_revision).toBe(revision)
   const first=collected===0;expect(args.p_lines).toEqual([{lineId,quantity:first?'200':'300',cuttingLoss:'0'}]);expect(args.p_apply_deposits).toBe(!first)
   collected=first?200:500;const used=first?0:unapplied,total=first?7000:10500
   unapplied-=used;applied+=used;revision++
   const id=invoiceIds[first?0:1]!,number='SALE-COLLECT-'+(first?1:2)
   invoices.push({id,invoice_number:number,issued_at:new Date().toISOString(),total:String(total),outstanding:String(total-used)})
   if(used)financialHistory.unshift({id:'finance-'+revision,kind:'apply',amount:String(used),reason:args.p_reason,reference:null,effective_at:new Date().toISOString(),allocation_id:allocationId,invoice_id:id,refund_payment_id:null,actor_name:'Counter operator'})
   orderEvents.push({id:'order-event-'+revision,action:'fulfill',reason:args.p_reason,actor_name:'Counter operator',created_at:new Date().toISOString()})
   collectionResults.set(key,{id:orderId,revision,status:status(),deliveryId:'delivery-'+revision,invoiceId:id,appliedDeposit:String(used)})
  }
  if(loseCollection){loseCollection=false;await route.fulfill({status:503,json:{message:'Synthetic committed collection response lost'}})}else await route.fulfill({json:collectionResults.get(key)})
 })
 await fixtureGoto(page,`/orders?order=${orderId}`)
 const detail=page.getByRole('dialog',{name:'O-COLLECT-1',exact:true}),receiveName=ar?'تسجيل عربون':'Record deposit',collectName=ar?'تسليم وإصدار فاتورة':'Collect and issue invoice'
 await detail.getByRole('button',{name:receiveName,exact:true}).click()
 const deposit=page.getByRole('dialog',{name:receiveName,exact:true}),amount=deposit.getByLabel(ar?'المبلغ':'Amount',{exact:true})
 await amount.fill(ar?'٥٠٠٠٫٠٠':'5000.00')
 await deposit.getByRole('combobox',{name:ar?'طريقة الدفع':'Payment method',exact:true}).click();await page.getByRole('option').filter({hasText:ar?'تحويل':'Bank transfer'}).click()
 await deposit.getByLabel(ar?'المرجع':'Reference',{exact:true}).fill('BANK-5000');await deposit.getByLabel(ar?'سبب العملية':'Reason',{exact:true}).fill('Advance for site C')
 await deposit.getByRole('button',{name:receiveName,exact:true}).click();await expect(deposit.getByRole('alert')).toContainText(ar?'لم تتأكد النتيجة':'The result is unconfirmed');await expect(amount).toBeDisabled()
 await deposit.press('Escape');await expect(deposit).toBeVisible();await deposit.getByRole('button',{name:receiveName,exact:true}).click();await expect(deposit).toHaveCount(0)
 await expect(detail).toContainText('BANK-5000')
 await detail.getByRole('button',{name:collectName,exact:true}).click()
 const collection=page.getByRole('dialog',{name:collectName,exact:true}),quantity=collection.getByLabel('Agreed contractor cable (m)',{exact:true})
 await quantity.fill(ar?'٢٠٠':'200');await collection.getByRole('checkbox',{name:ar?'تخصيص العربون المتاح لهذه الفاتورة':'Apply available deposits to this invoice',exact:true}).uncheck();await collection.getByLabel(ar?'سبب التسليم':'Collection reason',{exact:true}).fill('First 200m site C collection')
 await expectNoPageOverflow(page);await page.screenshot({path:test.info().outputPath('collection-editor.png'),fullPage:true})
 await collection.getByRole('button',{name:collectName,exact:true}).click();await expect(collection.getByRole('alert')).toContainText(ar?'لم تتأكد نتيجة التسليم':'The collection result is unconfirmed');await expect(quantity).toBeDisabled()
 await collection.press('Escape');await expect(collection).toBeVisible();await collection.getByRole('button',{name:collectName,exact:true}).click();await expect(collection).toHaveCount(0)
 await expect(detail.getByRole('link',{name:'SALE-COLLECT-1',exact:true})).toHaveAttribute('href',`/sales/${invoiceIds[0]}`)
 const applyName=ar?'تخصيص عربون لفاتورة':'Apply deposit to invoice';await detail.getByRole('button',{name:applyName,exact:true}).click()
 const apply=page.getByRole('dialog',{name:applyName,exact:true});await apply.getByRole('combobox',{name:ar?'الفاتورة':'Invoice',exact:true}).click();await page.getByRole('option').filter({hasText:'SALE-COLLECT-1'}).click()
 await apply.getByLabel(ar?'المبلغ':'Amount',{exact:true}).fill(ar?'٢٠٠٠٫٠٠':'2000.00');await apply.getByLabel(ar?'سبب العملية':'Reason',{exact:true}).fill('Apply existing advance to first invoice');await apply.getByRole('button',{name:applyName,exact:true}).click();await expect(apply).toHaveCount(0)
 const refundName=ar?'تسجيل رد عربون':'Record deposit refund';await detail.getByRole('button',{name:refundName,exact:true}).click()
 const refund=page.getByRole('dialog',{name:refundName,exact:true});await refund.getByLabel(ar?'المبلغ':'Amount',{exact:true}).fill(ar?'١٠٠٠٫٠٠':'1000.00');await refund.getByLabel(ar?'سبب العملية':'Reason',{exact:true}).fill('Customer receives part of unused advance');await refund.getByRole('button',{name:refundName,exact:true}).click();await expect(refund).toHaveCount(0)
 await detail.getByRole('button',{name:collectName,exact:true}).click();await quantity.fill(ar?'٣٠٠':'300');await expect(collection.getByRole('checkbox')).toBeChecked();await collection.getByLabel(ar?'سبب التسليم':'Collection reason',{exact:true}).fill('Final 300m site C collection');await collection.getByRole('button',{name:collectName,exact:true}).click();await expect(collection).toHaveCount(0)
 await expect(detail.getByRole('link',{name:'SALE-COLLECT-2',exact:true})).toHaveAttribute('href',`/sales/${invoiceIds[1]}`)
 await expect(detail.getByRole('button',{name:collectName,exact:true})).toHaveCount(0)
 const deposits=calls.filter(c=>c.name==='trade_order_deposit'),collections=calls.filter(c=>c.name==='fulfill_trade_order')
 expect(deposits).toHaveLength(4);expect(deposits[0]!.args).toEqual(deposits[1]!.args);expect(collections).toHaveLength(3);expect(collections[0]!.args).toEqual(collections[1]!.args)
 expect(fundingResults.size).toBe(3);expect(collectionResults.size).toBe(2);expect(collected).toBe(500);expect(unapplied).toBe(0);expect(refunded).toBe(1000)
 expect(deposits[0]!.args).toMatchObject({p_shop_id:'shop-1',p_location_id:'location-1',p_order_id:orderId,p_revision:2,p_amount:'5000.00',p_method:'bank_transfer'})
 expect(collections.at(-1)!.args).toMatchObject({p_revision:6,p_apply_deposits:true,p_lines:[{lineId,quantity:'300',cuttingLoss:'0'}]})
 expect(calls.some(c=>['save_sale_draft','save_pos_sale_draft','record_customer_receipt','issue_location_sale'].includes(c.name))).toBe(false)
 await expectNoPageOverflow(page);await page.screenshot({path:test.info().outputPath('completed-collections.png'),fullPage:true})
})

for (const canIssue of [false,true]) test(`collection permissions stay separate from payment access: issuer=${canIssue}`,async ({page})=>{
 const {calls}=await pilotFixture(page,'en','employee',(name,args)=>{
  if(name==='trade_order_context')return{items:[],total:0,page:1,pageSize:20,quotation:null,canManage:false,detail:args.p_order_id?{record:{id:orderId,order_number:'O-AUTH-1',status:'open',revision:2,currency:'EGP',agreed_snapshot:snapshot},lines:[],events:[],eventCount:0}:null}
  if(name==='trade_order_reservation_context')return{items:[],total:0,history:[],historyTotal:0,stock:[],revision:2,status:'open',canManage:false}
  if(name==='trade_order_delivery_context')return{lines:[{id:lineId,name:'Agreed contractor cable',itemType:'product',unitCode:'m',orderedQuantity:'500',deliveredQuantity:'0',remainingQuantity:'500',heldQuantity:'500',heldLoss:'0',reelTracked:false,allowSplit:false,packageName:null}],history:[],total:0,revision:2,status:'open',currency:'EGP',canFulfill:canIssue,canApplyDeposits:false}
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/trade_order_funding_context',route=>route.fulfill({status:403,json:{code:'42501',message:'SHOP_PERMISSION_DENIED'}}))
 await fixtureGoto(page,`/orders?order=${orderId}`)
 const detail=page.getByRole('dialog',{name:'O-AUTH-1',exact:true})
 await expect(detail.getByRole('heading',{name:'Collections',exact:true})).toBeVisible()
 await expect(detail.getByRole('button',{name:/Record deposit|Apply deposit to invoice|Record deposit refund|Correct mistaken deposit/})).toHaveCount(0)
 if(canIssue){
  await detail.getByRole('button',{name:'Collect and issue invoice',exact:true}).click()
  const editor=page.getByRole('dialog',{name:'Collect and issue invoice',exact:true})
  await expect(editor.getByRole('checkbox')).toHaveCount(0)
  await editor.getByLabel('Agreed contractor cable (m)',{exact:true}).fill('10')
  await editor.getByLabel('Collection reason',{exact:true}).fill('Authorized counter collection')
  await fixtureRoute(page,'**/rest/v1/rpc/fulfill_trade_order',async route=>{
   const args=route.request().postDataJSON();calls.push({name:'fulfill_trade_order',args})
   expect(args.p_apply_deposits).toBe(false)
   await route.fulfill({status:403,json:{code:'42501',message:'SHOP_PERMISSION_DENIED'}})
  })
  await editor.getByRole('button',{name:'Collect and issue invoice',exact:true}).click()
  await expect(editor.getByRole('alert')).toContainText('Check details and access')
  await expect(editor.getByLabel('Agreed contractor cable (m)',{exact:true})).toBeEnabled()
 }else{
  await expect(detail.getByRole('button',{name:'Collect and issue invoice',exact:true})).toHaveCount(0)
  expect(calls.some(call=>call.name==='fulfill_trade_order'||call.name==='trade_order_deposit')).toBe(false)
 }
})

test('malformed funding and collection reads leave the retained order usable',async ({page})=>{
 await pilotFixture(page,'en','owner',(name,args)=>{
  if(name==='trade_order_context')return{items:[],total:0,page:1,pageSize:20,quotation:null,canManage:false,detail:args.p_order_id?{record:{id:orderId,order_number:'O-READ-ERROR',status:'open',revision:2,currency:'EGP',agreed_snapshot:snapshot},lines:[],events:[],eventCount:0}:null}
  if(name==='trade_order_reservation_context')return{items:[],total:0,history:[],historyTotal:0,stock:[],revision:2,status:'open',canManage:false}
  if(name==='trade_order_funding_context')return{items:[],history:[],invoices:[],currency:'EGP',depositsNet:5000,unapplied:'5000',depositCapacity:'12500',canReceive:true}
  if(name==='trade_order_delivery_context')return{lines:[{remainingQuantity:'500'}],history:[],currency:'EGP',canFulfill:true}
  return undefined
 })
 await fixtureGoto(page,`/orders?order=${orderId}`)
 const detail=page.getByRole('dialog',{name:'O-READ-ERROR',exact:true})
 await expect(detail).toContainText('Agreed contractor cable')
 await expect(detail.getByRole('alert').filter({hasText:'Could not load or record this payment'})).toBeVisible()
 await expect(detail.getByRole('alert').filter({hasText:'Could not load or issue this collection'})).toBeVisible()
 await expect(detail.getByRole('button',{name:/Record deposit|Collect and issue invoice/})).toHaveCount(0)
 await detail.getByRole('button',{name:'Close',exact:true}).filter({hasText:/^Close$/}).click();await expect(detail).toHaveCount(0)
})
