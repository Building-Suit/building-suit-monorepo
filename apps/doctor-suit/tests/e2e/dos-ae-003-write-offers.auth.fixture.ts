import{doctorPasswordStep}from'../helpers/password-step.mjs'
import{test,expect}from'@playwright/test'
import{doctorPatientsCopy}from'../../app/utils/patientsPresentation'
import{doctorLocationsCopy}from'../../app/utils/locationsPresentation'
import{doctorDelegationCopy}from'../../app/utils/delegationPresentation'
test.use({actionTimeout:10000})
const fixture='http://127.0.0.1:4338/__fixture',base='http://127.0.0.1:4337',practice='a3000000-0000-4000-8000-000000000001'
for(const ar of[false,true])test(`DOS-AE-003 ${ar?'AR mobile':'EN desktop'}: closed writes, retained history/security reductions and stale draft denial`,async({browser,request})=>{
 test.setTimeout(90000);await request.post(fixture,{data:{reset:true}});await request.post(fixture,{data:{delegation:true,patients:true,edition:'administrative_candidate',editionRevision:2}})
 const context=await browser.newContext({viewport:{width:ar?390:1280,height:1000}})
 try{
  await context.addCookies([{name:'building-suit-locale',value:ar?'ar':'en',url:base}]);await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  const page=await context.newPage(),patients=doctorPatientsCopy(ar),locations=doctorLocationsCopy(ar),team=doctorDelegationCopy(ar)
  await page.goto('/patients');await page.getByLabel(ar?/^البريد الإلكتروني/:/^Email/).fill('synthetic-doctor-a@example.test');await doctorPasswordStep(page);await page.getByLabel(ar?/^كلمة المرور/:/^Password/).fill('synthetic-password-only');await page.getByRole('button',{name:ar?'تسجيل الدخول':'Sign in',exact:true}).click()
  const picker=page.getByRole('combobox',{name:ar?'الممارسة والموقع':'Practice and location',exact:true});await picker.click();await page.getByRole('option',{name:/ · Clinic A1$/}).click()
  await expect(page.getByRole('row').filter({hasText:'Synthetic A patient 02'})).toBeVisible();await expect(page.getByRole('button',{name:patients.create,exact:true})).toHaveCount(0)
  await page.goto('/locations');await expect(page.getByRole('button',{name:locations.create,exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:locations.edit,exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:locations.archive,exact:true}).first()).toBeVisible()
  await page.goto('/team');await expect(page.getByRole('button',{name:team.invite,exact:true})).toHaveCount(0)
  const active={state:'trial',revision:1,writes_allowed:true,can_add_staff:false,can_add_clinic:false,over_limit:false,valid_until:new Date(Date.now()+3600000).toISOString()}
  await request.post(fixture,{data:{entitlements:{[practice]:active}}});await page.goto('/patients');await picker.click();await page.getByRole('option',{name:/ · Clinic A1$/}).click();await expect(picker).toBeEnabled();await page.getByRole('button',{name:patients.create,exact:true}).click()
  const editor=page.getByRole('dialog',{name:patients.create,exact:true});await editor.getByLabel(ar?/^الاسم المُدخل/:/^Entered name/).fill('Synthetic discarded subscription draft')
  await request.post(fixture,{data:{entitlements:{[practice]:{...active,state:'expired',writes_allowed:false,valid_until:new Date(Date.now()-1000).toISOString()}}}})
  await editor.getByRole('button',{name:patients.save,exact:true}).click();await expect(editor).toBeHidden();await expect(page.getByRole('button',{name:patients.create,exact:true})).toHaveCount(0);await expect(page.getByRole('row').filter({hasText:'Synthetic A patient 02'})).toBeVisible()
  const data=(await(await request.get(fixture)).json()).delegation;expect(data.patientRows.some((row:{name:string})=>row.name==='Synthetic discarded subscription draft')).toBe(false)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await context.unrouteAll({behavior:'ignoreErrors'});await context.close()}
})
