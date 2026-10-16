import {test,expect} from '@playwright/test'
import {pilotFixture,fixtureGoto} from './pilot-fixture'
for(const locale of ['en','ar'])test(`staging owner address, aliases and profile preview ${locale}`,async({page})=>{
 const {calls}=await pilotFixture(page,locale,'owner',name=>{
  if(name==='shop_permission_access')return{'settings.manage':true}
  if(name==='shop_website_address')return{slug:'alpha-tools',state:'draft',aliases:['old-tools']}
  if(name==='shop_website_profile')return{draft:{},slug:'alpha-tools',state:'draft',logoDataUrl:null,catalog:{integration:'pending',publishedItemCount:0},missing:['publicName','description','logo','contact','location','publishedItem'],ownerOptedIn:false}
  return undefined
 })
 await fixtureGoto(page,'/settings')
 await expect(page.locator('#website-address')).toContainText('https://alpha-tools.stg.shops.building-suit.com')
 await expect(page.locator('#website-address')).toContainText('https://old-tools.stg.shops.building-suit.com')
 await expect(page.locator('#website-profile')).toContainText('https://alpha-tools.stg.shops.building-suit.com')
 for(const id of ['#website-address','#website-profile'])expect(await page.locator(id).textContent()).not.toMatch(/https:\/\/[a-z-]+\.shops\.building-suit\.com/)
 expect(calls.some(call=>/shop_website_.*(save|publish|replace)$/.test(call.name))).toBe(false)
})
