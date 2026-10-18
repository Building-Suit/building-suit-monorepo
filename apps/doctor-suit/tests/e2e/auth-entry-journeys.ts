import{expect,type Page}from'@playwright/test'
import{doctorAuthCopy}from'../../app/utils/authPresentation'
import{doctorMissingPage}from'../../app/utils/previewMetadata'
async function clientRoute(page:Page,path:string){
 await expect.poll(()=>page.evaluate(()=>Boolean((document.getElementById('__nuxt')as HTMLElement&{__vue_app__?:{config:{globalProperties:{$router?:unknown}}}})?.__vue_app__?.config.globalProperties.$router))).toBe(true)
 await page.evaluate(async target=>{const root=document.getElementById('__nuxt')as HTMLElement&{__vue_app__?:{config:{globalProperties:{$router:{push:(path:string)=>Promise<unknown>}}}}};await root.__vue_app__!.config.globalProperties.$router.push(target)},path)
}
export async function exerciseDoctorAuthEntries(page:Page,configured:boolean,ar:boolean){
 const copy=doctorAuthCopy(ar),email=ar?/^البريد الإلكتروني/:/^Email/
 async function surface(path:string){
  await expect(page).toHaveURL(url=>url.pathname===path)
  if(configured)await expect(page.getByLabel(email).first()).toBeVisible()
  else{await expect(page.getByRole('heading',{name:copy.unavailable,exact:true})).toBeVisible();await expect(page.locator('input[type="email"],input[type="password"]')).toHaveCount(0)}
  await expect(page.getByText(ar?'معاينة تجريبية · لا يوجد حساب أو ممارسة أو موقع نشط':'Synthetic preview · no active account, practice or location',{exact:true})).toHaveCount(0)
 }
 await page.goto('/')
 // Exercise the actual shared landing CTA through client navigation.
 await expect(page.locator('main a[href="/sign-up"]')).toBeVisible();await page.locator('main a[href="/sign-up"]').click();await surface('/sign-up')
 for(const path of['/sign-in','/sign-up','/recover']){
  await clientRoute(page,path);await surface(path);await page.reload();await surface(path)
  const direct=await page.goto(path);expect(direct?.status()).toBe(200);await surface(path)
 }
 for(const[legacy,canonical]of[['/auth/login','/sign-in'],['/auth/signup','/sign-up'],['/auth/forgot-password','/recover'],['/auth/reset-password','/recover']]){
  await page.goto(`${legacy}?next=%2Faccount&unsafe=DO_NOT_REFLECT_SENTINEL`);await surface(canonical!)
  expect(new URL(page.url()).searchParams.get('next')).toBe(canonical==='/recover'?null:'/account');expect(page.url()).not.toContain('DO_NOT_REFLECT_SENTINEL')
  await page.reload();await surface(canonical!);await clientRoute(page,legacy!);await surface(canonical!)
 }
 await page.goto('/auth/login?returnTo=https%3A%2F%2Fevil.example.test');await surface('/sign-in');expect(new URL(page.url()).searchParams.get('next')).toBe('/workspace')
 const missing=doctorMissingPage(ar),response=await page.goto('/auth/unknown?token=DO_NOT_REFLECT_SENTINEL');expect(response?.status()).toBe(404)
 await expect(page.getByRole('heading',{name:missing.title,exact:true})).toBeVisible();expect(await page.locator('body').innerText()).not.toContain('DO_NOT_REFLECT_SENTINEL')
 await expect(page.getByText(ar?'معاينة ببيانات تجريبية فقط':'Synthetic preview only',{exact:true})).toHaveCount(0)
 await page.reload();await expect(page.getByRole('heading',{name:missing.title,exact:true})).toBeVisible()
 await clientRoute(page,'/auth/another-unknown');await expect(page.getByRole('heading',{name:missing.title,exact:true})).toBeVisible()
 await expect(page.locator('input[type="email"],input[type="password"]')).toHaveCount(0)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
}
