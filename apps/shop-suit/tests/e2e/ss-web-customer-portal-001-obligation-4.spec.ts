import {drainLoopbackRoutes} from '../fixtures/loopback-teardown'
import {expect,test,type Page} from '@playwright/test'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
// Drain background loopback prefetches before Playwright disposes responses.
test.afterEach(async({page},info)=>drainLoopbackRoutes(page,info,'https://*.shops.building-suit.com/**'))
async function transport(page:Page){await page.route('https://*.shops.building-suit.com/**',async route=>{const request=route.request(),url=new URL(request.url());const response=await route.fetch({url:'http://127.0.0.1:4333'+url.pathname+url.search,headers:{...request.headers(),host:url.host},maxRedirects:0,maxRetries:request.method()==='GET'?1:0});await route.fulfill({response})})}
async function mounted(page:Page){await page.waitForFunction(()=>{const root=document.getElementById('__nuxt') as HTMLElement & {__vue_app__?:{config:{globalProperties:{$nuxt:{isHydrating:boolean}}}}};return root?.__vue_app__?.config.globalProperties.$nuxt.isHydrating===false})}
async function login(page:Page,ar=false,code='0123ABCDEFGH'){
 await page.getByRole('textbox',{name:ar?'رمز الوصول':'Access code',exact:true}).fill(code)
 await page.getByRole('textbox',{name:ar?'الهاتف المحفوظ للموعد':'Phone saved with the appointment',exact:true}).fill('+201000000002')
 await page.getByRole('button',{name:ar?'عرض مواعيدي':'View my appointments',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Alpha haircut',exact:true}).first()).toBeVisible()
}
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:46923/control',{data:{}})})
for(const locale of ['en','ar'])for(const width of [390,820,1440])for(const theme of ['light','dark'])test(`scoped portal ${locale} ${width} ${theme}`,async({page,context})=>{
 const ar=locale==='ar';await page.setViewportSize({width,height:1000});await page.addInitScript(v=>localStorage.setItem('building-suit.theme',v),theme);await transport(page)
 await page.goto(`https://alpha-tools.shops.building-suit.com/${ar?'':'?lang=en'}`);await mounted(page)
 const portalLinks=page.getByRole('link',{name:ar?'مواعيدي':'My appointments',exact:true})
 await expect(portalLinks.first()).toBeVisible()
 for(const link of await portalLinks.all())await expect(link).toHaveAttribute('href',`https://alpha-tools.shops.building-suit.com/my-appointments${ar?'':'?lang=en'}`)
 const response=await page.goto(`https://alpha-tools.shops.building-suit.com/my-appointments${ar?'':'?lang=en'}`);await mounted(page)
 expect(response?.headers()['cache-control']).toBe('private, no-store');expect(await response?.text()).not.toContain('Alpha haircut')
 await expect(page.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr');await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow')
 await expect(page.getByRole('heading',{name:'Alpha haircut',exact:true})).toHaveCount(0)
 await login(page,ar);await expect(page.locator('ol > li')).toHaveCount(20);await expectNoPageOverflow(page)
 const cookies=await context.cookies();expect(cookies.some(c=>c.name==='bs-shop-production-appointment-access'&&c.httpOnly&&c.secure&&c.path==='/api/website')).toBeTruthy()
 expect(await page.locator('body').innerText()).not.toContain('PRIVATE')
 expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))).not.toContain('Alpha haircut')
 await page.getByRole('button',{name:ar?'التالي':'Next',exact:true}).click();await expect(page.getByRole('heading',{name:'Alpha haircut page two',exact:true})).toBeVisible()
 await page.getByRole('button',{name:ar?'السجل':'History',exact:true}).click();await expect(page.locator('ol > li')).toHaveCount(3)
 for(const label of ar?['مكتمل','ملغي','لم يحضر']:['Completed','Cancelled','No show'])await expect(page.getByText(label,{exact:true})).toBeVisible()
 await page.screenshot({path:test.info().outputPath('history.png'),fullPage:true})
 await page.getByRole('button',{name:ar?'إنهاء الوصول':'End access',exact:true}).click();await expect(page.getByRole('textbox',{name:ar?'رمز الوصول':'Access code',exact:true})).toBeVisible();await expect(page.locator('ol > li')).toHaveCount(0)
 if(width===390&&theme==='light'){await login(page,ar,'WXYZABCDEFGH');await expect(page.locator('ol > li')).toHaveCount(1)}
 await page.goto(`https://beta-tools.shops.building-suit.com/my-appointments${ar?'':'?lang=en'}`);await mounted(page);await expect(page.locator('ol > li')).toHaveCount(0)
})
test('revocation and absolute expiry clear history and return to verification',async({page,request})=>{
 await transport(page);await page.goto('https://alpha-tools.shops.building-suit.com/my-appointments?lang=en');await mounted(page);await login(page)
 await request.post('http://127.0.0.1:46923/control',{data:{}})
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('textbox',{name:'Access code',exact:true})).toBeVisible();await expect(page.locator('ol > li')).toHaveCount(0)
 await request.post('http://127.0.0.1:46923/control',{data:{ttl:3000}});await login(page)
 await expect(page.getByRole('textbox',{name:'Access code',exact:true})).toBeVisible({timeout:6000});await expect(page.locator('ol > li')).toHaveCount(0)
})

test('suspension clears history, focus revalidates and page exit removes the private view',async({page,request})=>{
 await transport(page);await page.goto('https://alpha-tools.shops.building-suit.com/my-appointments?lang=en');await mounted(page);await login(page)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(page.locator('ol > li')).toHaveCount(0)
 await request.post('http://127.0.0.1:46923/control',{data:{}})
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))})
 await expect(page.getByRole('textbox',{name:'Access code',exact:true})).toBeVisible();await expect(page.locator('ol > li')).toHaveCount(0)
 await login(page);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(page.locator('ol > li')).toHaveCount(0)
})

for(const operation of ['initial','verify'])for(const returnWhileBusy of [false,true])test(`delayed ${operation} cannot restore suspended history; return while busy ${returnWhileBusy}`,async({page})=>{
 // Emulate a transport that completes despite cancellation; generation checks
 // must protect the view even when AbortController cannot stop the response.
 await page.addInitScript(()=>{window.AbortController=class extends AbortController{override abort(){}}})
 let holdPath='',release=()=>{},started=()=>{},held=Promise.resolve(),requests=0
 const arrived=new Promise<void>(resolve=>{started=resolve})
 await page.route('https://*.shops.building-suit.com/**',async route=>{
  const request=route.request(),url=new URL(request.url())
  const response=await route.fetch({url:'http://127.0.0.1:4333'+url.pathname+url.search,headers:{...request.headers(),host:url.host},maxRedirects:0,maxRetries:request.method()==='GET'?1:0})
  if(url.pathname==='/api/website/customer-portal')requests++
  if(holdPath&&url.pathname===holdPath){
   holdPath='';const stale=operation==='initial'?await response.json():null
   if(stale)for(const row of stale.items)row.service='Stale suspended response'
   started();await held
   await route.fulfill(stale?{response,json:stale}:{response});return
  }
  await route.fulfill({response})
 })
 const hidden=async(value:boolean)=>page.evaluate(v=>{Object.defineProperty(document,'hidden',{configurable:true,value:v});document.dispatchEvent(new Event('visibilitychange'))},value)
 const url='https://beta-tools.shops.building-suit.com/my-appointments?lang=en'
 await page.goto(url);await mounted(page);await expect(page.getByRole('textbox',{name:'Access code',exact:true})).toBeVisible()
 if(operation==='initial'){
  expect(await page.evaluate(async()=>{const response=await fetch('/api/website/appointment-access/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'0123ABCDEFGH',phone:'+201000000002'})});return(await response.json()).ok})).toBe(true)
 }
 held=new Promise<void>(resolve=>{release=resolve});holdPath=operation==='initial'?'/api/website/customer-portal':'/api/website/appointment-access/verify'
 if(operation==='initial'){await page.reload();await mounted(page)}else{
  await page.getByRole('textbox',{name:'Access code',exact:true}).fill('0123ABCDEFGH')
  await page.getByRole('textbox',{name:'Phone saved with the appointment',exact:true}).fill('+201000000002')
  await page.getByRole('button',{name:'View my appointments',exact:true}).click()
 }
 await arrived;await hidden(true);await expect(page.locator('ol > li')).toHaveCount(0)
 const count=requests
 if(returnWhileBusy){await hidden(false);if(operation==='initial')await expect(page.getByRole('heading',{name:'Beta consultation',exact:true}).first()).toBeVisible()}
 release()
 if(!returnWhileBusy){
  // Give the held response time to commit if the visibility/generation guard is absent.
  await page.waitForTimeout(150);await expect(page.locator('ol > li')).toHaveCount(0)
  await expect(page.getByRole('textbox',{name:'Access code',exact:true})).toBeVisible()
  await hidden(false)
 }
 await expect(page.getByRole('heading',{name:'Beta consultation',exact:true}).first()).toBeVisible()
 expect(requests).toBe(count+1)
 await page.waitForTimeout(150);await expect(page.getByRole('heading',{name:'Stale suspended response',exact:true})).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'Alpha haircut',exact:true})).toHaveCount(0)
})
