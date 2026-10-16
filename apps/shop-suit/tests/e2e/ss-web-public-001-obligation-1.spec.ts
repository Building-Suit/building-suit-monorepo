import {expect,test} from '@playwright/test'
import {pilotFixture,fixtureGoto} from './pilot-fixture'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
for(const locale of ['en','ar'])test(`owner privately manages escaped inquiry status ${locale}`,async({page})=>{
 const ar=locale==='ar';let status='new'
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shop_permission_access')return {'settings.manage':true}
  if(name==='shop_website_inquiries')return {items:args.p_status==='all'||args.p_status===status?[{id:'inquiry-1',name:'Private visitor',contact:'visitor@example.invalid',message:'<script>window.inquiryInjected=true</script>',locale:'en',status,createdAt:'2026-10-16T00:00:00Z'}]:[],total:args.p_status==='all'||args.p_status===status?1:0,page:1,pageSize:20}
  if(name==='shop_website_inquiry_status'){status=String(args.p_status);return null}
  return undefined
 })
 await fixtureGoto(page,'/settings');const panel=page.locator('#website-inquiries')
 await expect(panel).toContainText('Private visitor')
 await panel.getByRole('button',{name:ar?'عرض الاستفسار':'Open inquiry',exact:true}).click()
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('<script>window.inquiryInjected=true</script>')
 expect(await page.evaluate(()=>(window as Window & {inquiryInjected?:boolean}).inquiryInjected)).toBeUndefined()
 await dialog.getByRole('combobox').click();await page.getByRole('option',{name:ar?'تمت قراءته':'Read',exact:true}).click()
 await dialog.getByRole('button',{name:ar?'حفظ الحالة':'Save status',exact:true}).click()
 await expect(dialog).toHaveCount(0);await expect(panel).toContainText(ar?'تمت قراءته':'Read')
 expect(calls.find(c=>c.name==='shop_website_inquiry_status')?.args).toEqual({p_shop_id:'shop-1',p_inquiry_id:'inquiry-1',p_status:'read'})
 await expectNoPageOverflow(page)
})
test('settings employee has no inquiry data or read/status calls',async({page})=>{
 const {calls}=await pilotFixture(page,'en','employee',name=>name==='shop_permission_access'?{'settings.manage':true}:undefined)
 await fixtureGoto(page,'/settings');await expect(page.locator('#website-inquiries')).toContainText('Website inquiries are available to the owner only.')
 expect(calls.some(c=>c.name.startsWith('shop_website_inquir'))).toBe(false)
})
