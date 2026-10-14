import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
const quoteId='11111111-1111-4111-8111-111111111111'
const orderId='22222222-2222-4222-8222-222222222222'
for (const locale of ['en', 'ar'] as const) test(`legacy two-term rejection stays a plan review, never a new payment confirmation: ${locale}`, async ({ page }) => {
 await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
 await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), locale === 'ar' ? 'dark' : 'light')
 const limits = { active_locations: 1, active_members: 8, active_products: 500, active_services: 50, active_customers: 500, active_suppliers: 50 }
 const paid = ['33333333-3333-4333-8333-333333333333', orderId].map((id, index) => ({ orderId: id, state: 'paid', currency: 'EGP', amountMinor: 284784, planName: 'Solo', createdAt: `2026-10-13T20:0${index}:00Z`, sessionId: `cs_test_Oldpaid${index}`, url: null }))
 const fixture = await pilotFixture(page, locale, 'owner', (name, args) => {
  if (name === 'shop_public_plan_catalog') return [{ id: 'public-1', name: 'Team', slug: 'team', catalog_terms_id: 'terms-1', plan_variant: 'standard', variant_name: 'Standard', price_amount: 5703.84, currency: 'EGP', billing_interval: 'annual', trial_days: 7, features: {}, resource_limits: limits, is_purchasable: true, is_coming_soon: false }]
  if (name === 'shop_billing_read') return { subscription: { planName: 'Solo', planSlug: 'solo', planVariant: 'standard', billingInterval: 'annual', accessState: 'active', status: 'active', periodStart: '2026-10-13T20:00:00Z', periodEnd: '2028-10-13T20:00:00Z', currency: 'EGP', trialDaysRemaining: 0 }, availablePlans: [{ planId: 'public-1', planSlug: 'team', planName: 'Team', catalogTermsId: 'terms-1', planVariant: 'standard', variantName: 'Standard', billingInterval: 'annual', currency: 'EGP', listPriceAmount: 5703.84, effectivePriceAmount: 5703.84, priceSource: 'catalog', resourceLimits: limits, blockers: [] }], usage: { resources: [], limits }, submissions: [] }
  if (name === 'shop_xpay_order_read') return paid.map(order => ({ ...order, id: order.orderId, description: order.planName }))
  if (name === 'shop-xpay-checkout' && args.action === 'status') return { ready: true, mode: 'test', prorationEnabled: true, orders: paid }
  if (name === 'shop-xpay-checkout' && args.action === 'quote') return { error: 'checkout_period_unsupported', retrySafe: false }
  return undefined
 })
 await fixtureGoto(page, '/billing')
 await page.locator('[data-plan="team"]').getByRole('button').click()
 const dialog = page.getByRole('dialog', { name: locale === 'en' ? 'Review plan change' : 'مراجعة تغيير الخطة', exact: true })
 await expect(dialog).toBeVisible()
 await dialog.getByRole('button', { name: locale === 'en' ? 'Review plan change' : 'مراجعة تغيير الخطة', exact: true }).click()
 await expect(dialog).toContainText(locale === 'en' ? 'multiple or custom billing terms' : 'عدة دورات')
 await expect(dialog).not.toContainText(locale === 'en' ? 'Payment confirmed' : 'تم تأكيد الدفع')
 await expect(dialog).toContainText(locale === 'en' ? 'Plan price per billing term' : 'سعر الخطة لكل فترة فوترة')
 await expect(dialog.getByRole('button', { name: locale === 'en' ? 'Review plan change' : 'مراجعة تغيير الخطة', exact: true })).toHaveCount(0)
 await expect(dialog.getByRole('link', { name: locale === 'en' ? 'Contact us' : 'تواصل معنا', exact: true })).toHaveAttribute('href', '/contact')
 await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')) })
 await expect(dialog).toContainText(locale === 'en' ? 'multiple or custom billing terms' : 'عدة دورات')
 expect(fixture.calls.some(call => call.name === 'shop-xpay-checkout' && (call.args.action === 'pay_quote' || (!call.args.action && call.args.requestId)))).toBe(false)
 await dialog.getByRole('button', { name: locale === 'en' ? 'Cancel' : 'إلغاء', exact: true }).click()
 await expect(page.locator('#current-plan')).toContainText('Solo')
})
function quote(due:number,locale:string,state='quoted') {
 const at=new Date().toISOString(),expiresAt=new Date(Date.now()+900000).toISOString()
 return {quoteId,shopId:'shop-1',catalogTermsId:'terms-1',privateOfferId:null,planName:locale==='ar'?'خطة الفريق المعتمدة':'Approved Team',state,createdAt:at,expiresAt,xpayOrderId:null,
 details:{planVariant:'multi_3',billingInterval:'monthly',listPriceAmount:799,effectivePriceAmount:699,priceSource:'override',resourceLimits:{active_locations:3,active_members:5,active_products:null,active_services:50,active_customers:500,active_suppliers:50},entitlements:{appointments:true}},
 calculation:{version:1,currency:'EGP',mode:'remaining_period',amountDueMinor:due,creditBeforeMinor:0,creditAfterMinor:due?0:23333,newTermMinor:69900,unusedPrepaidMinor:due?'23266.666666666667':'46600',serviceValueMinor:due?'46600':'23266.666666666667',newBillingInterval:'monthly',periodStart:at,periodEnd:new Date(Date.now()+20*86400000).toISOString(),periodMonths:1,periodStartPolicy:'frozen_quote',transition:due?'verified_xpay_payment':'explicit_credit_transition',quotedAt:at,expiresAt}}
}
async function setup(page:Parameters<typeof pilotFixture>[0],locale:'en'|'ar',due:number) {
 const limits={active_locations:1,active_members:5,active_products:250,active_services:50,active_customers:500,active_suppliers:50}
 let settled=false
 const fixture=await pilotFixture(page,locale,'owner',(name,args)=>{
 if(name==='shop_public_plan_catalog')return[{id:'public-1',name:'Team',slug:'team',catalog_terms_id:'terms-1',plan_variant:'standard',variant_name:'Standard',price_amount:699,currency:'EGP',billing_interval:'monthly',trial_days:7,features:{},resource_limits:limits,is_purchasable:true,is_coming_soon:false}]
 if(name==='shop_billing_read')return{subscription:{planName:settled?'Approved Team':'Existing paid plan',planSlug:settled?'team':'solo',planVariant:'standard',billingInterval:'monthly',accessState:'active',status:'active',currency:'EGP',trialDaysRemaining:7},availablePlans:[{planId:'public-1',planSlug:'team',planName:'Team',catalogTermsId:'terms-1',planVariant:'standard',variantName:'Standard',billingInterval:'monthly',currency:'EGP',listPriceAmount:699,effectivePriceAmount:699,priceSource:'catalog',resourceLimits:limits,blockers:[]}],usage:{resources:[],limits},submissions:[]}
 if(name==='shop-xpay-checkout'){
  if(args.action==='status')return{ready:true,mode:'test',prorationEnabled:true,creditBalanceMinor:0,orders:[]}
  if(args.action==='quote')return quote(due,locale)
  if(args.action==='read_quote')return quote(due,locale,settled?'settled':'quoted')
  if(args.action==='apply_credit'){settled=true;return quote(due,locale,'settled')}
  if(args.action==='abandon_quote')return quote(due,locale,'abandoned')
  if(args.action==='pay_quote')return{orderId,quoteId,state:'open',currency:'EGP',amountMinor:due,planName:'Approved Team',createdAt:new Date().toISOString(),sessionId:'cs_test_Prorationbrowser',url:'https://checkout.xpay.app/c/cs_test_Prorationbrowser'}
 }
 return undefined
 })
 return fixture
}
for(const locale of ['en','ar']as const)for(const due of [23333,0])test(`frozen ${due?'cash':'credit'} review and explicit confirmation: ${locale}`,async({page},testInfo)=>{
 await page.setViewportSize({width:locale==='ar'?390:1440,height:1000})
 await page.addInitScript(theme=>localStorage.setItem('building-suit.theme',theme),locale==='ar'?'dark':'light')
 const fixture=await setup(page,locale,due)
 const hosted='https://checkout.xpay.app/c/cs_test_Prorationbrowser'
 await page.route(hosted,route=>route.fulfill({contentType:'text/html',body:'<p>Provider fixture</p>'}))
 await fixtureGoto(page,'/billing')
 await page.locator('[data-plan="team"]').getByRole('button').click()
 const dialog=page.getByRole('dialog').first()
 await dialog.getByRole('button',{name:locale==='en'?'Review plan change':'مراجعة تغيير الخطة',exact:true}).click()
 const breakdown=page.getByTestId('proration-breakdown')
 await expect(breakdown).toContainText(locale==='en'?'3 branches':'٣ فروع')
 await expect(breakdown).toContainText(locale==='en'?'Plan rate discount':'خصم سعر الخطة')
 await expect(breakdown).toContainText(locale==='en'?'Appointments':'المواعيد')
 await expect(breakdown).toContainText(locale==='en'?'Unused prepaid value':'القيمة المدفوعة غير المستخدمة')
 await expect(breakdown).toContainText(due?(locale==='en'?'233.33':'٢٣٣٫٣٣'):(locale==='en'?'0.00':'٠٫٠٠'))
 await page.screenshot({path:testInfo.outputPath('frozen-quote.png'),animations:'disabled'})
 if(!due)await expect(dialog.getByRole('img',{name:'X-Pay',exact:true})).toHaveCount(0)
 await dialog.locator('button[type="submit"]').click()
 const confirmation=page.getByRole('dialog',{name:locale==='en'?'Confirm':'تأكيد',exact:true})
 await expect(confirmation).toBeVisible()
 await confirmation.getByRole('button',{name:locale==='en'?'Confirm':'تأكيد',exact:true}).click()
 if(due){await expect(page).toHaveURL(hosted);const pay=fixture.calls.find(call=>call.name==='shop-xpay-checkout'&&call.args.action==='pay_quote');expect(pay?.args.quoteId).toBe(quoteId);expect(pay?.args).not.toHaveProperty('amountMinor')}
 else{await expect(page).toHaveURL(/\/billing$/);await expect(page.locator('#current-plan')).toContainText('Approved Team');expect(fixture.calls.some(call=>call.name==='shop-xpay-checkout'&&call.args.action==='pay_quote')).toBe(false)}
})
