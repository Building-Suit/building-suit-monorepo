import { test,expect,type BrowserContext } from '@playwright/test'
import { practiceReportCopy } from '../../app/utils/practiceFinancialReportPresentation'
import { doctorSubscriptionCopy } from '../../app/utils/subscriptionPresentation'
interface Fixture{origin:string;api:string;storageState:Awaited<ReturnType<BrowserContext['storageState']>>;period:{id:string;ends_at:string};billing:{reference:string}}
for(const ar of[false,true])test(`DOS-M6-010-C01-${ar?'AR':'EN'}`,async({browser})=>{
 const phase=(description:string)=>test.info().annotations.push({type:'financial-stage',description});phase('fixture')
 if(process.env.DOCTOR_FINANCIAL_ACCEPTANCE!=='owned-actual-provider')throw Error('Owned financial fixture required')
 const f=JSON.parse(process.env.DOCTOR_FINANCIAL_FIXTURE??'{}') as Fixture,report=practiceReportCopy(ar),subscription=doctorSubscriptionCopy(ar)
 if(f.origin!=='http://127.0.0.1:4341'||f.api!=='http://127.0.0.1:65321'||!Array.isArray(f.storageState?.cookies)||! /^[a-f0-9-]{36}$/.test(f.period?.id)||! /^SYNTHETIC-BILLING-[a-f0-9-]{36}$/.test(f.billing?.reference))throw Error('Owned financial acceptance target required')
 const context=await browser.newContext({storageState:f.storageState,viewport:{width:ar?390:1280,height:1000},colorScheme:ar?'dark':'light'}),writes:string[]=[]
 try{
  await context.route('**/*',route=>[f.origin,f.api].includes(new URL(route.request().url()).origin)?route.continue():route.abort());await context.addCookies([{name:'building-suit-locale',value:ar?'ar':'en',url:f.origin}]);await context.addInitScript(({dark})=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),{dark:ar});context.on('request',r=>{if(/\/rest\/v1\/rpc\/doctor_(prepare|advance|write|activate|request_saas_lifecycle)/.test(new URL(r.url()).pathname))writes.push('unexpected-financial-command')})
  phase('acceptance_subscription');const page=await context.newPage();await page.goto(f.origin+'/subscription');await expect(page.getByRole('heading',{name:subscription.title,exact:true})).toBeVisible();await expect(page.getByText(f.period.id,{exact:true})).toBeVisible();await expect(page.getByText(new Date(f.period.ends_at).toISOString(),{exact:true})).toBeVisible();await expect(page.getByText(subscription.paymentUnavailable,{exact:true})).toBeVisible()
  phase('acceptance_practice_ledger');await page.goto(f.origin+'/financial-reports?metric=refunds');const row=page.getByRole('row').filter({hasText:f.billing.reference+'-'+(ar?'AR':'EN')});await expect(row).toContainText('30.00 EGP (2)');await row.getByRole('link').click();const source=page.getByRole('dialog',{name:report.sourceTitle,exact:true});await expect(source.getByText(/^SYN-[0-9]{8,16}$/)).toHaveCount(2);await source.getByRole('button',{name:report.close,exact:true}).click()
  phase('acceptance_saas_separation');await page.getByRole('link',{name:report.saas,exact:true}).click();await expect(page).toHaveURL(f.origin+'/payment-reconciliation');await page.goto(f.origin+'/subscription');await expect(page.getByText(f.period.id,{exact:true})).toBeVisible();await expect(page.getByText(new Date(f.period.ends_at).toISOString(),{exact:true})).toBeVisible();expect(writes).toEqual([])
  phase('direction_and_viewport');await expect(page.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await context.close()}
})
