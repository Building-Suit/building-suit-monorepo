import {expect,test,type Page} from '@playwright/test'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
async function transport(page:Page){await page.route('https://*.shops.building-suit.com/**',async route=>{
 const request=route.request(),url=new URL(request.url())
 const response=await route.fetch({url:'http://127.0.0.1:4329'+url.pathname+url.search,headers:{...request.headers(),host:url.host},maxRedirects:0})
 await route.fulfill({response})
})}
for(const locale of ['en','ar'])for(const width of [390,820,1440])for(const theme of ['light','dark'])test(`public showcase ${locale} ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(v=>localStorage.setItem('building-suit.theme',v),theme);await transport(page)
 const ar=locale==='ar';await page.goto(`https://alpha-tools.shops.building-suit.com/${ar?'':'?lang=en'}`)
 await expect(page.getByRole('heading',{name:'Alpha Tools',exact:true})).toBeVisible()
 await expect(page.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr')
 await expect(page.getByRole('heading',{name:ar?'المنتجات والخدمات':'Products and services'})).toBeVisible()
 await expect(page.getByRole('link',{name:'+201000000002',exact:true})).toHaveAttribute('href','tel:+201000000002')
 await expect(page.getByRole('link',{name:'WhatsApp',exact:true})).toHaveCount(0)
 await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
 await expectNoPageOverflow(page)
 await page.screenshot({path:test.info().outputPath('showcase.png'),fullPage:true,animations:'disabled'})
 // Wait for hydration before interacting with SSR controls.
 await page.waitForFunction(()=>{
  const root=document.getElementById('__nuxt') as HTMLElement & {__vue_app__?:{config:{globalProperties:{$nuxt:{isHydrating:boolean}}}}}
  return root?.__vue_app__?.config.globalProperties.$nuxt.isHydrating===false
 })
 if(width===390&&theme==='light'){
 await page.getByRole('textbox',{name:ar?'الاسم':'Name',exact:true}).fill('Visitor')
 await page.getByRole('textbox',{name:ar?'البريد الإلكتروني أو رقم الهاتف':'Email or phone',exact:true}).fill('visitor@example.invalid')
 await page.getByRole('textbox',{name:ar?'رسالتك':'Your message',exact:true}).fill('Please contact me')
 await page.getByRole('button',{name:ar?'إرسال الاستفسار':'Send inquiry',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:ar?'تم إرسال استفسارك إلى المتجر.':'Your inquiry has been sent to the shop.'})).toBeVisible()
 await expect(page.getByRole('textbox',{name:ar?'الاسم':'Name',exact:true})).toHaveValue('')
 }
 await page.goto(`https://beta-tools.shops.building-suit.com/${ar?'':'?lang=en'}`)
 await expect(page.getByRole('heading',{name:'Beta Services',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Alpha Tools',exact:true})).toHaveCount(0)
 await page.goto('https://unpublished-shop.shops.building-suit.com/')
 await expect(page.locator('body')).toHaveText('Not Found')
})
