import {test,expect,type Page} from '@playwright/test'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
import {drainLoopbackRoutes} from '../fixtures/loopback-teardown'
import {websiteLaunchApiPorts} from './website-launch-fixture-server.mjs'
const hosts=/^https:\/\/(?:[a-z-]+(?:\.stg)?\.shops\.building-suit\.com|stg\.shop\.building-suit\.com)\//
test.afterEach(async({page},info)=>drainLoopbackRoutes(page,info,'**/*'))
async function mounted(page:Page){await page.waitForFunction(()=>{const root=document.getElementById('__nuxt') as HTMLElement&{__vue_app__?:{config:{globalProperties:{$nuxt:{isHydrating:boolean}}}}};return root?.__vue_app__?.config.globalProperties.$nuxt.isHydrating===false})}
test.beforeEach(async({request})=>{await request.post(`http://127.0.0.1:${websiteLaunchApiPorts.staging}/control`,{data:{reset:true}})})
for(const locale of ['en','ar'])for(const width of [390,1440])test(`staging suffix journey ${locale} ${width}`,async({page,context})=>{
 const ar=locale==='ar',seen:string[]=[],origin='https://alpha-tools.stg.shops.building-suit.com',query=ar?'':'?lang=en'
 await page.setViewportSize({width,height:1000})
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(!hosts.test(req.url())){await route.abort();return}seen.push(url.hostname);const response=await route.fetch({url:'http://127.0.0.1:4346'+url.pathname+url.search,headers:{...req.headers(),host:url.host},maxRedirects:0,maxRetries:req.method()==='GET'?1:0});if([301,302,303,307,308].includes(response.status())){await route.abort();throw Error('Unexpected redirect in canonical loopback browser journey')}await route.fulfill({response})})
 const response=await page.goto(origin+'/'+query);await mounted(page)
 expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');await expect(page).toHaveURL(origin+'/'+query)
 await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',origin+'/'+query)
 await expect(page.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr');await expectNoPageOverflow(page)
 const websiteLinks=await page.locator('a[href^="https://"]').evaluateAll(links=>links.map(link=>(link as HTMLAnchorElement).href))
 expect(websiteLinks.length).toBeGreaterThan(2);expect(websiteLinks.every(href=>new URL(href).hostname.endsWith('.stg.shops.building-suit.com'))).toBe(true)
 await page.getByRole('link',{name:ar?'حجز موعد':'Book an appointment',exact:true}).click();await mounted(page)
 await expect(page).toHaveURL(origin+'/book'+query);await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',origin+'/book'+query)
 await page.getByRole('combobox',{name:ar?'الخدمة والموقع والموظف':'Service, location and staff',exact:true}).click();await page.getByRole('option').first().click()
 await page.getByRole('button',{name:ar?'عرض الأوقات':'Show times',exact:true}).click();await page.getByRole('combobox',{name:ar?'الوقت المتاح':'Available time',exact:true}).click();await page.getByRole('option').first().click()
 await page.getByRole('textbox',{name:ar?'الاسم':'Name',exact:true}).fill('Staging guest');await page.getByRole('textbox',{name:ar?'رقم الهاتف':'Phone number',exact:true}).fill('+201000000002')
 await page.getByRole('button',{name:ar?'تأكيد الحجز':'Confirm booking',exact:true}).click();await expect(page.locator('output')).toHaveText('0123-ABCD-EFGH')
 expect((await context.cookies()).some(c=>c.name==='bs-shop-staging-appointment-access'&&c.domain==='alpha-tools.stg.shops.building-suit.com'&&c.httpOnly&&c.secure)).toBe(true)
 await page.getByRole('link',{name:ar?'مواعيدي والسجل':'My appointments and history',exact:true}).click();await mounted(page)
 await expect(page).toHaveURL(origin+'/my-appointments'+query);await expect(page.getByRole('heading',{name:'Alpha appointment',exact:true})).toBeVisible()
 await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',origin+'/my-appointments'+query);await expectNoPageOverflow(page)
 await page.getByRole('button',{name:ar?'إنهاء الوصول':'End access',exact:true}).click();await expect(page.locator('ol > li')).toHaveCount(0)
 expect(seen.every(host=>host.endsWith('.stg.shops.building-suit.com'))).toBe(true)
 await page.screenshot({path:test.info().outputPath('staging-portal.png'),fullPage:true})
})
