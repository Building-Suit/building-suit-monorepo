import {expect,test} from '@playwright/test'
import {pilotFixture,fixtureGoto} from './pilot-fixture'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
const membershipId='11111111-1111-4111-8111-111111111111'
for(const locale of ['en','ar'])test(`owner explicitly configures booking and staff, reminders require separate owner opt-in ${locale}`,async({page})=>{
 const ar=locale==='ar';await page.setViewportSize({width:ar?390:1440,height:1000})
 let settings={policy:{enabled:false,lead_minutes:60,horizon_days:30,change_notice_minutes:120,allow_reschedule:true,allow_cancel:true,reminder_lead_minutes:1440,reminders_enabled:false,reminder_channel:null},staff:[{membershipId,name:'Private staff identity',publicName:'',published:false}]}
 const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shop_permission_access')return{'settings.manage':true}
  if(name==='shop_booking_settings')return settings
  if(name==='shop_booking_settings_save'){settings={policy:{...args.p_policy as typeof settings.policy,reminders_enabled:Boolean((args.p_policy as {reminders_enabled?:boolean}).reminders_enabled),reminder_channel:(args.p_policy as {reminders_enabled?:boolean}).reminders_enabled?'email':null},staff:(args.p_staff as {membershipId:string;publicName:string}[]).map(s=>({...s,name:'Private staff identity',published:true}))};return null}
  return undefined
 })
 await fixtureGoto(page,'/settings/public-booking-settings');const panel=page.locator('#public-booking-settings')
 await expect(panel).toContainText(ar?'الحجز العام معطل':'Public booking disabled')
 await panel.getByRole('button',{name:ar?'تعديل سياسة الحجز':'Edit booking policy',exact:true}).click();const dialog=page.getByRole('dialog')
 await dialog.getByRole('checkbox',{name:ar?'تفعيل الحجز العام':'Enable public booking',exact:true}).check()
 await dialog.getByRole('checkbox',{name:(ar?'إظهار الموظف للحجز':'Show staff for booking')+': Private staff identity',exact:true}).check()
 await dialog.getByRole('textbox',{name:ar?'اسم الموظف العام':'Public staff name',exact:true}).fill('Public specialist')
 await dialog.getByRole('spinbutton',{name:ar?'مهلة التعديل والإلغاء بالدقائق':'Change and cancellation notice (minutes)',exact:true}).fill('180')
 await expectNoPageOverflow(page);await dialog.getByRole('button',{name:ar?'حفظ':'Save',exact:true}).click();await expect(dialog).toHaveCount(0)
 await expect(panel).toContainText(ar?'تم حفظ سياسة الحجز.':'Booking policy saved.')
 const saved=calls.find(c=>c.name==='shop_booking_settings_save')!;expect(saved.args.p_staff).toEqual([{membershipId,publicName:'Public specialist'}]);expect(saved.args.p_policy).toHaveProperty('reminders_enabled',false)
 await panel.getByRole('button',{name:ar?'تعديل سياسة الحجز':'Edit booking policy',exact:true}).click();await expect(dialog.getByRole('spinbutton',{name:ar?'مهلة التعديل والإلغاء بالدقائق':'Change and cancellation notice (minutes)',exact:true})).toHaveValue('180');await expect(dialog).toContainText(ar?'يتطلب الإرسال إعداداً معتمداً':'Sending requires approved operator configuration');await dialog.getByRole('checkbox',{name:ar?'السماح بتذكيرات المواعيد بالبريد بعد موافقة العميل':'Allow email appointment reminders after customer consent',exact:true}).check();await dialog.getByRole('button',{name:ar?'حفظ':'Save',exact:true}).click();await expect(dialog).toHaveCount(0);expect(calls.filter(c=>c.name==='shop_booking_settings_save').at(-1)?.args.p_policy).toHaveProperty('reminders_enabled',true)
})
test('ordinary staff cannot edit booking publication policy',async({page})=>{
 const {calls}=await pilotFixture(page,'en','staff',name=>name==='shop_permission_access'?{'settings.manage':false}:undefined)
 await fixtureGoto(page,'/settings/public-booking-settings');await expect(page.locator('#public-booking-settings')).toContainText('Only the owner can manage public booking.');expect(calls.some(c=>c.name==='shop_booking_settings')).toBe(false)
})
