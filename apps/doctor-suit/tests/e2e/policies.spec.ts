import {test,expect}from'@playwright/test'
const keys=['terms','privacy','subscription','payments','cancellation-refunds','health-data']
const names={en:['Draft terms of use','Draft privacy notice','Draft trial and subscription policy','Draft InstaPay payment policy','Draft cancellation and refund policy','Draft health-data and clinical-use safeguards'],ar:['مسودة شروط الاستخدام','مسودة إشعار الخصوصية','مسودة سياسة التجربة والاشتراك','مسودة سياسة الدفع عبر InstaPay','مسودة سياسة الإلغاء والاسترداد','مسودة ضوابط البيانات الصحية والاستخدام السريري']}
for(const locale of['en','ar']as const)for(const width of[390,1280])test(`public policy drafts ${locale} ${width}: internal links, exact version and closed approval`,async({page,context})=>{
 await page.setViewportSize({width,height:950});await context.addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4336'}])
 await page.addInitScript(theme=>localStorage.setItem('building-suit.theme',theme),width===390?'dark':'light')
 await page.goto('/policies/terms')
 const sentinel=await page.evaluate(()=>{const value=crypto.randomUUID();(window as Window&{doctorPolicyDocument?:string}).doctorPolicyDocument=value;return value})
 let documents=0;page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents++})
 for(const[index,key]of keys.entries()){
  await page.locator('footer').getByRole('link',{name:names[locale][index],exact:true}).click()
  await expect(page).toHaveURL(new RegExp(`/policies/${key}$`));await expect(page.getByRole('heading',{level:1,name:names[locale][index],exact:true})).toBeVisible()
  await expect(page.getByText(/doctor-preview-policies\/2026-10-18\.2/)).toBeVisible();await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await expect(page.locator('main input[type=checkbox]')).toHaveCount(0)
 }
 expect(documents).toBe(0);expect(await page.evaluate(()=>(window as Window&{doctorPolicyDocument?:string}).doctorPolicyDocument)).toBe(sentinel)
 await page.goto('/sign-up')
 for(const name of names[locale])await expect(page.getByRole('link',{name,exact:true})).toBeVisible()
 await page.getByRole('link',{name:names[locale][1],exact:true}).click();await expect(page).toHaveURL(/\/policies\/privacy$/)
 await expect(page.getByRole('heading',{level:1,name:names[locale][1],exact:true})).toBeVisible()
})
