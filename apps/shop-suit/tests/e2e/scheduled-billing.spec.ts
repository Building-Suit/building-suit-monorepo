import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
for(const locale of ['en','ar'] as const)test(`deferred change is no-charge, preserves paid access, and cancels: ${locale}`,async({page},testInfo)=>{
 await page.setViewportSize({width:locale==='ar'?390:1440,height:1000})
 await page.addInitScript(theme=>localStorage.setItem('building-suit.theme',theme),locale==='ar'?'dark':'light')
 const limits={active_locations:1,active_members:1,active_products:250,active_services:50,active_customers:500,active_suppliers:50}
 let change:Record<string,unknown>|null=null
 const fixture=await pilotFixture(page,locale,'owner',(name,args)=>{
  if(name==='shop_public_plan_catalog')return[{id:'public-1',name:'Solo',slug:'solo',catalog_terms_id:'terms-1',plan_variant:'solo_1',variant_name:'One member',price_amount:349,currency:'EGP',billing_interval:'monthly',trial_days:7,features:{},resource_limits:limits,is_purchasable:true,is_coming_soon:false}]
  if(name==='shop_billing_read')return{subscription:{planName:'Existing Team',planSlug:'team',planVariant:'standard',billingInterval:'annual',accessState:'active',status:'active',periodEnd:'2028-10-13T20:06:28Z',currency:'EGP',trialDaysRemaining:0},availablePlans:[{planId:'public-1',planSlug:'solo',planName:'Solo',catalogTermsId:'terms-1',planVariant:'solo_1',variantName:'One member',billingInterval:'monthly',currency:'EGP',listPriceAmount:349,effectivePriceAmount:349,priceSource:'catalog',resourceLimits:limits,blockers:[{resource:'active_members',used:3,limit:1,excess:2}]}],usage:{resources:[],limits},submissions:[]}
  if(name==='shop_xpay_proration_status')return{enabled:true}
  if(name==='shop-xpay-checkout'&&args.action==='status')return{ready:false,prorationEnabled:true,orders:[]}
  if(name==='shop_billing_change_preview')return{timing:'term_end',effectiveAt:'2028-10-13T20:06:28Z',scheduled:change}
  if(name==='shop_billing_change_read')return change
  if(name==='shop_billing_change_schedule'){change={id:'change-1',state:'scheduled',catalogTermsId:'terms-1',privateOfferId:null,planName:'Solo',billingInterval:'monthly',currency:'EGP',indicativePriceAmount:349,effectiveAt:'2028-10-13T20:06:28Z',createdAt:'2026-10-14T00:00:00Z',available:true,canPayNow:false,canCancel:true,blockers:[{resource:'active_members',used:3,limit:1,excess:2}]};return change}
  if(name==='shop_billing_change_cancel'){change={...change,state:'cancelled',canCancel:false};return change}
  return undefined
 })
 await fixtureGoto(page,'/billing');await page.locator('[data-plan="solo"]').getByRole('button').click()
 const dialog=page.getByRole('dialog',{name:locale==='en'?'Change at paid-term end':'التغيير عند انتهاء الفترة المدفوعة',exact:true})
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('img',{name:'X-Pay',exact:true})).toHaveCount(0)
 await dialog.getByRole('button',{name:locale==='en'?'Schedule change':'جدولة التغيير',exact:true}).click()
 const confirm=page.getByRole('dialog',{name:locale==='en'?'Confirm':'تأكيد',exact:true});await confirm.getByRole('button',{name:locale==='en'?'Confirm':'تأكيد',exact:true}).click()
 const panel=page.getByTestId('scheduled-plan-change');await expect(panel).toContainText(locale==='en'?'2028':'٢٠٢٨');await expect(panel.getByRole('link',{name:locale==='en'?'Manage team':'إدارة الفريق'})).toHaveAttribute('href','/team')
 await expect(page.locator('#current-plan')).toContainText('Existing Team');await expect(dialog).toBeHidden();await panel.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('pending-change.png'),animations:'disabled'})
 await panel.getByRole('button',{name:locale==='en'?'Cancel scheduled change':'إلغاء التغيير المجدول'}).click();await confirm.getByRole('button',{name:locale==='en'?'Confirm':'تأكيد',exact:true}).click()
 await expect(panel).toContainText(locale==='en'?'Cancelled':'ملغي');expect(fixture.calls.some(call=>call.name==='shop-xpay-checkout'&&call.args.action!=='status')).toBe(false)
})
