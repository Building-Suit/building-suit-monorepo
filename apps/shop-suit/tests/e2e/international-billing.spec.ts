import { test, expect } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const limits = { active_locations: 1, active_members: 2, active_products: 250, active_services: 50, active_customers: 500, active_suppliers: 50 }
const variants = [
  ['solo','solo_1',349,2847.84,6.99,56.99],['solo','solo_2',499,4071.84,9.99,81.99],
  ['team','standard',699,5703.84,13.99,113.99],['multi','multi_2',999,8151.84,19.99,162.99],['multi','multi_3',1199,9783.84,23.99,195.99],
] as const
const catalog = (currency: 'EGP' | 'USD') => variants.flatMap(([slug,variant,egpMonthly,egpAnnual,usdMonthly,usdAnnual],i) => ['monthly','annual'].map((cadence,j) => ({
  id: `plan-${slug}`,name: slug === 'solo' ? 'Solo' : slug === 'team' ? 'Team' : 'Multi',slug,
  catalog_terms_id: `00000000-0000-4000-8000-00000000${currency === 'USD' ? '1' : '0'}${String(i*2+j).padStart(3,'0')}`,
  plan_variant: variant,variant_name: variant,currency,billing_interval: cadence,price_amount: currency === 'USD' ? j ? usdAnnual : usdMonthly : j ? egpAnnual : egpMonthly,
  trial_days:7,features:{},resource_limits:limits,is_purchasable:true,is_coming_soon:false,
})))
const offers = (currency: 'EGP' | 'USD') => catalog(currency).map(p => ({ planId:p.id,planName:p.name,planSlug:p.slug,catalogTermsId:p.catalog_terms_id,planVariant:p.plan_variant,variantName:p.variant_name,currency:p.currency,billingInterval:p.billing_interval,listPriceAmount:p.price_amount,effectivePriceAmount:p.price_amount,priceSource:'catalog',resourceLimits:p.resource_limits,blockers:[] }))
const amount = (locale: string,value: number,currency: string) => new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG',{style:'currency',currency,maximumFractionDigits:2}).format(value)
const planAmount = (locale: string,value: number,currency: string) => new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG',{style:'currency',currency,minimumFractionDigits:value % 1 === 0 ? 0 : 2,maximumFractionDigits:2}).format(value)
async function setup(page: import('@playwright/test').Page,locale: string,readyUSD = false, paid = false) {
  return pilotFixture(page,locale,'owner',(name,args) => {
    if(name === 'shop_public_plan_catalog')return catalog('EGP')
    if(name === 'shop_subscription_currency_catalog')return catalog('USD')
    if(name === 'shop_billing_currency_plans')return offers('USD')
    if(name === 'shop_billing_read')return {subscription:{id:'subscription-1',planName:'Solo',planSlug:'solo',planVariant:'solo_1',billingInterval:'monthly',accessState:paid?'active':'trialing',priceAmount:paid?6.99:349,listPriceAmount:paid?6.99:349,effectivePriceAmount:paid?6.99:349,currency:paid?'USD':'EGP',periodEnd:paid?new Date(Date.now()+86400000).toISOString():null,trialDaysRemaining:7},availablePlans:offers('EGP'),usage:{resources:[],limits},submissions:[]}
    if(name === 'shop-xpay-checkout'){
      const now=Date.now(),order={orderId:'11111111-1111-4111-8111-111111111111',state:paid?'paid':'open',amountMinor:699,currency:'USD',planName:'Server USD Solo',sessionId:'cs_test_international',url:paid?null:'https://checkout.xpay.app/c/cs_test_international',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+1800000).toISOString(),refundedAmountMinor:paid?200:0}
      if(args.action==='status')return {ready:true,mode:'test',currencies:readyUSD?['EGP','USD']:['EGP'],prorationEnabled:false,orders:paid?[order]:[]}
      return order
    }
    return undefined
  })
}
for(const locale of ['en','ar'] as const)for(const width of [390,1440])test(`fixed subscription currency matrix ${locale}/${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:width===390?'dark':'light',reducedMotion:'reduce'})
  const fixture=await setup(page,locale)
  await fixtureGoto(page,'/');await page.locator('#pricing').scrollIntoViewIfNeeded()
  const currency=page.getByRole('group',{name:locale==='ar'?'عملة الاشتراك':'Subscription currency',exact:true})
  await currency.getByRole('radio',{name:'EGP',exact:true}).focus();await page.keyboard.press('ArrowRight')
  await expect(currency.getByRole('radio',{name:'USD',exact:true})).toBeChecked()
  const cards=page.getByTestId('shop-plan-cards')
  for(const [slug,variant,,,monthly,annual]of variants){
    const card=cards.locator(`[data-plan="${slug}"]`)
    const variantRadio=card.locator(`input[type="radio"][value="${variant}"]`)
    if(await variantRadio.count())await variantRadio.check()
    await cards.getByRole('radio',{name:locale==='ar'?'شهري':'Monthly',exact:true}).check()
    await expect(card).toContainText(amount(locale,monthly,'USD'))
    await cards.getByRole('radio',{name:locale==='ar'?'سنوي':'Yearly',exact:true}).check()
    await expect(card).toContainText(amount(locale,annual,'USD'))
  }
  await expectNoPageOverflow(page)
  await cards.screenshot({path:info.outputPath('currency-pricing.png')})
  await currency.getByRole('radio',{name:'EGP',exact:true}).check()
  await cards.getByRole('radio',{name:locale==='ar'?'شهري':'Monthly',exact:true}).check()
  await cards.locator('[data-plan="solo"] input[value="solo_1"]').check()
  await expect(cards.locator('[data-plan="solo"]')).toContainText(planAmount(locale,349,'EGP'))
  await expectNoPageOverflow(page)
  expect(fixture.calls.some(c=>c.name==='shop-xpay-checkout'&&c.args.requestId)).toBe(false)
})
for(const locale of ['en','ar'] as const)test(`USD unavailable cannot silently start EGP checkout ${locale}`,async({page})=>{
  const fixture=await setup(page,locale)
  await fixtureGoto(page,'/billing')
  await page.getByRole('radio',{name:'USD',exact:true}).check()
  const solo=page.getByTestId('shop-plan-cards').locator('[data-plan="solo"]')
  await expect(solo).toContainText(amount(locale,6.99,'USD'))
  await solo.getByRole('button',{name:locale==='ar'?'اختيار الخطة':'Choose plan',exact:true}).click()
  const checkout=page.getByTestId('hosted-checkout')
  await expect(checkout).toContainText(amount(locale,6.99,'USD'))
  await expect(checkout).toContainText(locale==='ar'?'غير مفعّل':'not enabled')
  await expect(page.getByRole('dialog').locator('button[type="submit"]')).toBeDisabled()
  expect(fixture.calls.filter(c=>c.name==='shop-xpay-checkout'&&c.args.requestId)).toEqual([])
})
test('explicit currency overrides a foreign-country recommendation across reloads',async({page})=>{
  await page.setExtraHTTPHeaders({'x-vercel-ip-country':'US'})
  await setup(page,'en')
  await fixtureGoto(page,'/');await page.locator('#pricing').scrollIntoViewIfNeeded()
  await expect(page.getByRole('radio',{name:'USD',exact:true})).toBeChecked()
  await page.getByRole('radio',{name:'EGP',exact:true}).check()
  await fixtureGoto(page,'/');await page.locator('#pricing').scrollIntoViewIfNeeded()
  await expect(page.getByRole('radio',{name:'EGP',exact:true})).toBeChecked()
  await expect(page.getByTestId('shop-plan-cards').locator('[data-plan="solo"]')).toContainText(planAmount('en',349,'EGP'))
})
test('verified synthetic USD checkout uses the server amount and excludes client currency/amount authority',async({page})=>{
  const fixture=await setup(page,'en',true)
  await page.route('https://checkout.xpay.app/c/cs_test_international',route=>route.fulfill({contentType:'text/html',body:'<p>Synthetic USD checkout</p>'}))
  await fixtureGoto(page,'/billing')
  await page.getByRole('radio',{name:'USD',exact:true}).check()
  const solo=page.getByTestId('shop-plan-cards').locator('[data-plan="solo"]')
  await expect(solo).toContainText(amount('en',6.99,'USD'))
  await solo.getByRole('button',{name:'Choose plan',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Continue to X-Pay',exact:true}).click()
  const confirm=page.getByRole('dialog',{name:'Confirm',exact:true})
  await expect(confirm).toContainText(amount('en',6.99,'USD'))
  await confirm.getByRole('button',{name:'Confirm',exact:true}).click()
  await expect(page).toHaveURL('https://checkout.xpay.app/c/cs_test_international')
  const request=fixture.calls.find(c=>c.name==='shop-xpay-checkout'&&c.args.requestId)
  expect(request?.args).toHaveProperty('catalogTermsId',catalog('USD')[0].catalog_terms_id)
  expect(request?.args).not.toHaveProperty('amount')
  expect(request?.args).not.toHaveProperty('currency')
  expect(request?.args).not.toHaveProperty('country')
})
test('paid USD history retains its original currency and separately labels the refunded amount',async({page})=>{
  await setup(page,'en',false,true)
  await fixtureGoto(page,'/billing')
  await expect(page.getByRole('radio',{name:'USD',exact:true})).toBeChecked()
  await expect(page.getByRole('main')).toContainText(`Refunded ${amount('en',2,'USD')}`)
  await expect(page.getByRole('main')).toContainText(amount('en',6.99,'USD'))
})
