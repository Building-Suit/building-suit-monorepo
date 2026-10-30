import { test,expect,type BrowserContext } from '@playwright/test'
import { practiceReportCopy } from '../../app/utils/practiceFinancialReportPresentation'
interface Fixture {origin:string;api:string;storageState:Awaited<ReturnType<BrowserContext['storageState']>>;billing:{reference:string;readonlyStorageState:Awaited<ReturnType<BrowserContext['storageState']>>;readonlyServiceLabel:string}}
for(const ar of[false,true])test(`DOS-M6-009-C02-${ar?'AR':'EN'}`,async({browser})=>{
 const phase=(description:string)=>test.info().annotations.push({type:'financial-stage',description});phase('fixture')
 if(process.env.DOCTOR_FINANCIAL_ACCEPTANCE!=='owned-actual-provider')throw Error('Owned financial fixture required')
 const f=JSON.parse(process.env.DOCTOR_FINANCIAL_FIXTURE??'{}') as Fixture,copy=practiceReportCopy(ar)
 if(f.origin!=='http://127.0.0.1:4341'||f.api!=='http://127.0.0.1:65321'||!Array.isArray(f.storageState?.cookies)||!Array.isArray(f.billing?.readonlyStorageState?.cookies)||!/^SYNTHETIC-BILLING-[a-f0-9-]{36}$/.test(f.billing.reference))throw Error('Owned financial report target rejected')
 const writes:string[]=[]
 async function context(storageState:Fixture['storageState']){const c=await browser.newContext({storageState,viewport:{width:ar?390:1280,height:1000},colorScheme:ar?'dark':'light'});await c.route('**/*',route=>[f.origin,f.api].includes(new URL(route.request().url()).origin)?route.continue():route.abort());await c.addCookies([{name:'building-suit-locale',value:ar?'ar':'en',url:f.origin}]);await c.addInitScript(({dark})=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),{dark:ar});c.on('request',r=>{const p=new URL(r.url()).pathname;if(p.startsWith('/rest/v1/rpc/')&&/doctor_(prepare|advance|write|activate)/.test(p))writes.push('unexpected-financial-write')});return c}
 const owner=await context(f.storageState);let readonly:BrowserContext|undefined
 try{
  phase('report_totals');const page=await owner.newPage();await page.goto(f.origin+'/financial-reports?metric=collections');await expect(page.getByRole('heading',{name:copy.title,exact:true})).toBeVisible()
  const service=f.billing.reference+'-'+(ar?'AR':'EN'),row=page.getByRole('row').filter({hasText:service});await expect(row).toContainText('100.00 EGP (2)')
  await expect(page.getByText(copy.basis,{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:copy.saas,exact:true})).toHaveAttribute('href','/payment-reconciliation')
  phase('report_source');await row.getByRole('link').click();const source=page.getByRole('dialog',{name:copy.sourceTitle,exact:true});await expect(source).toBeVisible();await expect(source.getByText('100.00 EGP (2)',{exact:true})).toBeVisible();await expect(source.getByText(/^SYN-[0-9]{8,16}$/)).toBeVisible()
  const frozen=page.url();await page.reload();await expect(page.getByRole('dialog',{name:copy.sourceTitle,exact:true})).toBeVisible();expect(page.url()).toBe(frozen);await page.getByRole('dialog',{name:copy.sourceTitle,exact:true}).getByRole('button',{name:copy.close,exact:true}).click()
  phase('report_refunds');await page.goto(f.origin+'/financial-reports?metric=refunds');const refund=page.getByRole('row').filter({hasText:service});await expect(refund).toContainText('30.00 EGP (2)');await refund.getByRole('link').click();const reversal=page.getByRole('dialog',{name:copy.sourceTitle,exact:true});await expect(reversal.getByText('30.00 EGP (2)',{exact:true})).toBeVisible();await expect(reversal.getByText(/^SYN-[0-9]{8,16}$/)).toHaveCount(2)
  phase('direction_and_viewport');await expect(page.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  phase('report_read_only');readonly=await context(f.billing.readonlyStorageState);const historical=await readonly.newPage();await historical.goto(f.origin+'/financial-reports?metric=collections');await expect(historical.getByRole('row').filter({hasText:f.billing.readonlyServiceLabel})).toContainText('50.00 EGP (2)');await expect(historical.getByRole('button',{name:/dispatch|refund|تحصيل|استرداد/i})).toHaveCount(0)
  expect(writes).toEqual([])
 }finally{await readonly?.close();await owner.close()}
})
