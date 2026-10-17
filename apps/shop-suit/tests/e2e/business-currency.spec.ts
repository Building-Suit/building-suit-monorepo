import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en','ar']) test(`currency changes before history without converting catalog values: ${locale}`, async ({ page }) => {
  const ar=locale==='ar'
  await page.setViewportSize({ width: ar?390:1440,height:1000 })
  const state={currency:'EGP',locked:false,supportedCurrencies:['EGP','USD','EUR','GBP','SAR','AED']}
  const {calls}=await pilotFixture(page,locale,'owner',(name,args) => {
    if(name==='shop_permission_access') return {'settings.manage':true}
    if(name==='shops') return [{id:'shop-1',name:'Synthetic business',status:'active',business_mode:'service',business_currency:state.currency,created_at:'2026-01-01'}]
    if(name==='business_currency_settings') return {...state}
    if(name==='save_business_currency'){state.currency=String(args.p_currency);return {...state}}
    return undefined
  })
  await fixtureGoto(page,'/settings')
  const panel=page.locator('#currency-settings')
  await panel.getByRole('combobox',{name:ar?'عملة النشاط':'Business currency',exact:true}).click()
  await page.getByRole('option',{name:'USD',exact:true}).click()
  await panel.getByRole('button',{name:ar?'حفظ العملة':'Save currency',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:ar?'تأكيد':'Confirm',exact:true}).click()
  await expect(panel).toContainText(ar?'اتحفظت عملة النشاط.':'Business currency saved.')
  expect(calls.find(call=>call.name==='save_business_currency')?.args).toEqual({p_shop_id:'shop-1',p_currency:'USD'})
  await expect(panel.getByRole('combobox')).toContainText('USD')
  await fixtureGoto(page,'/pos')
  // The synthetic catalog's Haircut retains numeric100; only its business code changes.
  await expect(page.getByText('Haircut',{exact:true}).first()).toBeVisible()
  await expect(page.getByText(ar?/١٠٠٫٠٠.*US\$/u:/\$100\.00/u).first()).toBeVisible()
  expect(calls.filter(call=>call.name==='save_product'||call.name==='save_service')).toHaveLength(0)
  await expectNoPageOverflow(page)
})

for (const mode of ['locked','staff','race']) test(`currency server/permission boundary: ${mode}`,async({page})=>{
  const state={currency:'EGP',locked:mode==='locked',supportedCurrencies:['EGP','USD','EUR','GBP','SAR','AED']}
  const {calls}=await pilotFixture(page,'en','owner',(name)=>{
    if(name==='shop_permission_access')return {'settings.manage':mode!=='staff'}
    if(name==='business_currency_settings')return {...state}
    if(name==='save_business_currency'){state.locked=true;throw new Error('SHOP_CURRENCY_LOCKED')}
    return undefined
  })
  // Return an actual transport failure when another terminal finalizes first.
  if(mode==='race') await page.route('**/rest/v1/rpc/save_business_currency',route=>{
    state.locked=true
    return route.fulfill({status:400,json:{code:'55000',message:'SHOP_CURRENCY_LOCKED'}})
  })
  await fixtureGoto(page,'/settings')
  const panel=page.locator('#currency-settings')
  const selector=panel.getByRole('combobox',{name:'Business currency',exact:true})
  if(mode!=='race'){
    await expect(selector).toBeDisabled()
    await expect(panel.getByRole('button',{name:'Save currency',exact:true})).toBeDisabled()
    expect(calls.filter(call=>call.name==='save_business_currency')).toHaveLength(0)
  }else{
    await selector.click();await page.getByRole('option',{name:'USD',exact:true}).click()
    await panel.getByRole('button',{name:'Save currency',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click()
    await expect(panel).toContainText('Currency is fixed once financial history exists')
    await expect(selector).toBeDisabled()
    await expect(selector).toContainText('EGP')
  }
})
