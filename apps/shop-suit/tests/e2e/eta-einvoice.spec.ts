import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for(const locale of ['en','ar']) test(`B2B invoice uses business receiver and needs no POS: ${locale}`,async({page})=>{
 const ar=locale==='ar'
 await page.setViewportSize({width:ar?390:1440,height:1100})
 let documents:unknown[]=[]
 const address={country:'EG',governate:'Cairo',regionCity:'Cairo',street:'Test street',buildingNumber:'1'}
 const configuration={profile:{legalName:'Synthetic merchant',rin:'123456789',activityCode:'1234'},branches:[{locationId:'location-1',branchCode:'0',deviceSerialNumber:'',address}],items:[]}
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='eta_settings')return {configuration,locations:[{id:'location-1',name:'Main'}],items:[],sales:[{id:'11111111-1111-4111-8111-111111111111',label:'SALE-001'}],documents}
  if(name==='queue_eta_invoice'){documents=[{id:'job-1',channel:'einvoice',invoice_id:args.p_invoice_id,invoice_number:'SALE-001',state:'submitted',document_uuid:'ETA-INVOICE-ID',submission_uuid:'ETA-SUBMISSION-ID',error_code:null}];return 'job-1'}
  return undefined
 })
 await fixtureGoto(page,'/eta')
 await page.getByRole('combobox',{name:ar?'نوع المستند':'Document channel',exact:true}).click()
 await page.getByRole('option',{name:ar?'فاتورة شركة B2B':'B2B eInvoice',exact:true}).click()
 await page.getByRole('button',{name:ar?'تعديل الإعدادات':'Edit setup',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await expect(dialog.getByRole('textbox',{name:ar?'الرقم التسلسلي لجهاز البيع':'POS serial number',exact:true})).toHaveCount(0)
 await dialog.getByRole('button',{name:ar?'إلغاء':'Cancel',exact:true}).click()
 await page.getByRole('combobox',{name:ar?'إيصال البيع':'Sale receipt',exact:true}).click()
 await page.getByRole('option',{name:'SALE-001',exact:true}).click()
 for(const [en,arabic,value] of [['Buyer business RIN (9 digits)','رقم تسجيل الشركة المشترية (٩ أرقام)','987654321'],['Buyer business legal name','الاسم القانوني للشركة المشترية','Synthetic business'],['Governorate','المحافظة','Cairo'],['City or region','المدينة أو المنطقة','Cairo'],['Street','الشارع','Buyer street'],['Building number','رقم المبنى','2'],['Business identity confirmation and export reason','تأكيد هوية الشركة وسبب التصدير','Confirmed original buyer']] as const){await page.getByRole('textbox',{name:ar?arabic:en,exact:true}).fill(value)}
 await page.getByRole('button',{name:ar?'إضافة فاتورة شركة لقائمة الإرسال':'Queue B2B invoice',exact:true}).click()
 await expect(page.getByText(ar?'مُرسل؛ التحقق لم يكتمل':'Submitted; validation pending',{exact:true})).toBeVisible()
 const queued=calls.find(call=>call.name==='queue_eta_invoice')
 expect(queued?.args.p_receiver).toEqual({type:'B',id:'987654321',name:'Synthetic business',address:{country:'EG',governate:'Cairo',regionCity:'Cairo',street:'Buyer street',buildingNumber:'2'}})
 expect(calls.some(call=>call.name==='queue_eta_receipt')).toBe(false)
 await expectNoPageOverflow(page)
})
