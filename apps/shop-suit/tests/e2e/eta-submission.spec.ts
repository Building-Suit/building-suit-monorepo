import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en','ar']) test(`ETA setup and submitted status: ${locale}`,async({page})=>{
 const ar=locale==='ar'
 await page.setViewportSize({width:ar?390:1440,height:1000})
 let configuration:unknown=null
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='eta_settings')return {configuration,locations:[],items:[],documents:[{id:'job-1',invoice_id:'sale-1',state:'submitted',document_uuid:null,submission_uuid:'ETA-SUBMISSION-1',error_code:null}]}
  if(name==='save_eta_configuration'){configuration=args.p_configuration;return 'version-1'}
  return undefined
 })
 await fixtureGoto(page,'/eta')
 await expect(page.getByText(ar?'مُرسل؛ التحقق لم يكتمل':'Submitted; validation pending',{exact:true})).toBeVisible()
 await expect(page.getByText(ar?'بيانات التاجر غير مكتملة. احفظ الاسم القانوني ورقم التسجيل وكود النشاط أولًا.':'Merchant setup is missing. Save legal name, RIN and activity code first.',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:ar?'تعديل الإعدادات':'Edit setup',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('textbox',{name:ar?'الاسم القانوني':'Legal name',exact:true}).fill('Synthetic merchant')
 await dialog.getByRole('textbox',{name:ar?'رقم التسجيل الضريبي (٩ أرقام)':'Tax RIN (9 digits)',exact:true}).fill('123456789')
 await dialog.getByRole('textbox',{name:ar?'كود النشاط':'Activity code',exact:true}).fill('1234')
 await dialog.getByRole('textbox',{name:ar?'سبب التعديل':'Reason for change',exact:true}).fill('Synthetic merchant setup')
 await dialog.getByRole('button',{name:ar?'حفظ':'Save',exact:true}).click()
 await expect(dialog).not.toBeVisible()
 const saved=calls.find(call=>call.name==='save_eta_configuration')
 expect(saved?.args.p_configuration).toEqual({profile:{legalName:'Synthetic merchant',rin:'123456789',activityCode:'1234'},branches:[],items:[]})
 expect(saved?.args.p_shop_id).toBe('shop-1')
 await expect(page.getByText(ar?'اتحفظت الإعدادات.':'Configuration saved.',{exact:true})).toBeVisible()
 await expectNoPageOverflow(page)
})
