import{test,expect}from'@playwright/test'
import{doctorPrivacyView}from'../../app/utils/privacyPresentation'
import{doctorPrivacyState}from'../../app/utils/privacyController'
const fixture='http://127.0.0.1:4338/__fixture',base='http://127.0.0.1:4337'
for(const ar of[false,true])test(`DOS-AE-007 ${ar?'AR mobile dark':'EN desktop light'}: own-account intake, safe retry and independent account isolation`,async({browser,request})=>{
 await request.post(fixture,{data:{reset:true}});await request.post(fixture,{data:{delegation:true,edition:'administrative_candidate',editionRevision:2}})
 const context=await browser.newContext({viewport:{width:ar?390:1280,height:1000},colorScheme:ar?'dark':'light'})
 try{
  await context.addCookies([{name:'building-suit-locale',value:ar?'ar':'en',url:base}]);await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  const page=await context.newPage(),copy=doctorPrivacyView(doctorPrivacyState(),ar).copy
  async function signIn(email:string){await page.goto('/privacy');await page.getByLabel(ar?/^البريد الإلكتروني/:/^Email/).fill(email);await page.getByLabel(ar?/^كلمة المرور/:/^Password/).fill('synthetic-password-only');await page.getByRole('button',{name:ar?'تسجيل الدخول':'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:copy.title,exact:true})).toBeVisible()}
  await signIn('synthetic-doctor-a@example.test');await expect(page.getByText(copy.empty,{exact:true})).toBeVisible();await expect(page.getByText(copy.notice,{exact:true})).toBeVisible()
  await page.route('**/rest/v1/rpc/doctor_submit_privacy_request',async route=>{await route.fetch();await route.abort('failed')},{times:1});const submit=page.getByRole('button',{name:copy.submit,exact:true});await submit.click();await expect(page.getByText(copy.failed,{exact:true})).toBeVisible();await submit.click();await expect(page.getByText(copy.success,{exact:true})).toBeVisible();await expect(submit).toBeDisabled();await expect(page.getByRole('cell',{name:copy.pending,exact:true})).toHaveCount(1)
  const state=await(await request.get(fixture)).json(),records=state.delegation.privacyRequests;expect(Object.values(records).flat()).toHaveLength(1)
  await page.context().clearCookies();await context.addCookies([{name:'building-suit-locale',value:ar?'ar':'en',url:base}]);await page.reload();await signIn('synthetic-doctor-b@example.test');await expect(page.getByText(copy.empty,{exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:copy.pending,exact:true})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await context.unrouteAll({behavior:'ignoreErrors'});await context.close()}
})
