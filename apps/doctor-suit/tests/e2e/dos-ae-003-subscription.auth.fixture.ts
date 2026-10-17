import{doctorPasswordStep}from'../helpers/password-step.mjs'
import{test,expect}from'@playwright/test'
import{doctorSubscriptionCopy}from'../../app/utils/subscriptionPresentation'
const fixture='http://127.0.0.1:4338/__fixture',base='http://127.0.0.1:4337'
test.use({actionTimeout:10000})
for(const ar of[false,true])test(`DOS-AE-003 ${ar?'AR mobile':'EN desktop'}: configured synthetic terms, explicit acceptance, uncertain retry and retained period`,async({browser,request})=>{
 await request.post(fixture,{data:{reset:true}});await request.post(fixture,{data:{delegation:true,edition:'administrative_candidate',editionRevision:2}})
 const context=await browser.newContext({viewport:{width:ar?390:1280,height:1000}})
 try{
  await context.addCookies([{name:'building-suit-locale',value:ar?'ar':'en',url:base}]);await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  const page=await context.newPage(),copy=doctorSubscriptionCopy(ar);await page.goto('/subscription');await page.getByLabel(ar?/^البريد الإلكتروني/:/^Email/).fill('synthetic-doctor-a@example.test');await doctorPasswordStep(page);await page.getByLabel(ar?/^كلمة المرور/:/^Password/).fill('synthetic-password-only');await page.getByRole('button',{name:ar?'تسجيل الدخول':'Sign in',exact:true}).click()
  await expect(page.getByRole('heading',{name:copy.title,exact:true})).toBeVisible();await expect(page.getByText(copy.unconfigured,{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:copy.start,exact:true})).toHaveCount(0)
  await request.post(fixture,{data:{subscription:{configured:true,revision:2,documentAvailable:false}}});await page.getByRole('button',{name:copy.retry,exact:true}).click();await expect(page.getByText('12.34 USD',{exact:true})).toBeVisible()
  await expect(page.getByText(copy.documentUnavailable,{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:copy.start,exact:true})).toHaveCount(0);await request.post(fixture,{data:{subscription:{configured:true,revision:2,documentAvailable:true}}});await page.getByRole('button',{name:copy.retry,exact:true}).click();await expect(page.getByRole('heading',{name:copy.documentBody,exact:true})).toBeVisible();await expect(page.getByText(ar?'وثيقة اختبار اصطناعية فقط. لا تمنح هذه البيانات موافقة قانونية أو صلاحية بيع حي.':'Synthetic test document only. This fixture does not grant legal approval or live-sale authority.',{exact:true})).toBeVisible();for(const label of[copy.renewal,copy.grace,copy.expiry,copy.cancellation,copy.refund])await expect(page.getByText(label,{exact:true})).toBeVisible()
  const start=page.getByRole('button',{name:copy.start,exact:true});await expect(start).toBeDisabled();await page.getByRole('checkbox',{name:copy.accept,exact:true}).check()
  await page.route('**/rest/v1/rpc/doctor_start_saas_trial',async route=>{await route.fetch();await route.abort('failed')},{times:1});await start.click();await expect(page.getByText(copy.failed,{exact:true})).toBeVisible();await start.click()
  await expect(page.getByText(copy.states.trial,{exact:true})).toBeVisible();await expect(start).toHaveCount(0);let state=await(await request.get(fixture)).json();expect(state.subscription.starts).toBe(1);const period=state.subscription.trial.id
  state.subscription.configured=false;await request.post(fixture,{data:{subscription:state.subscription}});await page.getByRole('button',{name:copy.retry,exact:true}).click();await expect(page.getByText('12.34 USD',{exact:true})).toBeVisible();state=await(await request.get(fixture)).json();expect(state.subscription.trial.id).toBe(period);expect(state.subscription.starts).toBe(1)
  await expect(page.getByText(copy.paymentUnavailable,{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/^Pay$|^Purchase$|^ادفع$|^شراء$/})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await context.unrouteAll({behavior:'ignoreErrors'});await context.close()}
})
