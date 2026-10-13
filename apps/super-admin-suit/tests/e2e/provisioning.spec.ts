import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'

// Controlled UI responses; real Auth/SQL is independently checked in disposable CI.
for(const locale of ['en','ar']){
  test(`provisioning lost response, reconciliation and acknowledged resend ${locale}`,async({page})=>{
    await page.setViewportSize({width:390,height:844})
    await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4324'}])
    await page.addInitScript(()=>localStorage.setItem('building-suit.theme','dark'))
    const ids={userId:randomUUID(),authorityEnvironmentId:randomUUID(),bindingId:randomUUID(),planId:randomUUID(),catalogTermsId:randomUUID(),provisioningId:randomUUID(),shopId:randomUUID(),subscriptionId:randomUUID()}
    await page.route('**/api/session',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({...ids,role:'owner'})}))
    await page.route('**/api/accounts/context',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({modules:[{bindingId:ids.bindingId,label:{en:'Accounts',ar:'الحسابات'},provisioningAvailable:true}]})}))
    const projection={provisioningId:ids.provisioningId,phase:'active',email:'owner@example.invalid',shopId:ids.shopId,subscriptionId:ids.subscriptionId,planId:ids.planId,invitationState:'unknown',ownerVerified:false,subscription:{id:ids.subscriptionId,planId:ids.planId,status:'active',periodStart:'2026-10-13T08:00:00Z',periodEnd:'2026-11-13T08:00:00Z',trialStartAt:'2026-10-13T08:00:00Z',trialEndAt:'2026-10-20T08:00:00Z'}}
    await page.route('**/api/accounts/provisioning?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({state:'success',requestId:randomUUID(),auditId:randomUUID(),data:new URL(route.request().url()).searchParams.has('provisioningId')?projection:{plans:[{id:ids.planId,catalogTermsId:ids.catalogTermsId,name:'Team fixture',billingInterval:'monthly',isActive:true,isPurchasable:true,isComingSoon:false}],businessModes:['product']}})}))
    const sent:Record<string,unknown>[]=[]
    await page.route('**/api/accounts/provision',async route=>{
      const input=route.request().postDataJSON();sent.push(input)
      await route.fulfill({contentType:'application/json',body:JSON.stringify(sent.length===1?{state:'outcome_unknown',requestId:input.requestId}:{state:'success',requestId:input.requestId,auditId:randomUUID(),data:projection})})
    })
    let invite:Record<string,unknown>|undefined
    await page.route('**/api/accounts/invitation',async route=>{invite=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify({state:'success',requestId:invite!.requestId,auditId:randomUUID(),data:{...projection,invitationState:'sent'}})})})
    await page.goto(`/account-provisioning?bindingId=${ids.bindingId}`)
    await page.locator('#provision-email').fill('owner@example.invalid')
    await page.locator('#provision-owner').fill('Owner fixture')
    await page.locator('#provision-shop').fill('Shop fixture')
    await page.locator('#provision-location').fill('Main fixture')
    await page.locator('#provision-mode').click();await page.getByRole('option',{name:locale==='en'?'Products':'منتجات',exact:true}).click()
    await page.locator('#provision-plan').click();await page.getByRole('option',{name:/Team fixture/}).click()
    await page.locator('#provision-reason').fill('Admin approved immediate access')
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await page.getByRole('button',{name:locale==='en'?'Create account and activate plan':'إنشاء الحساب وتفعيل الباقة',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await dialog.getByRole('button',{name:locale==='en'?'Confirm provisioning':'تأكيد إنشاء الحساب',exact:true}).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await page.reload()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button',{name:locale==='en'?'Retry the same request':'إعادة محاولة الطلب نفسه',exact:true}).click()
    await expect(dialog).toHaveCount(0)
    expect(sent).toHaveLength(2);expect(sent[1]).toEqual(sent[0]);expect(sent[0]).not.toHaveProperty('password');expect(sent[0]).not.toHaveProperty('email_confirm')
    await expect(page.getByText(locale==='en'?'Account created and plan activated':'تم إنشاء الحساب وتفعيل الباقة',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:locale==='en'?'Resend owner invitation':'إعادة إرسال دعوة المالك',exact:true}).click()
    await dialog.locator('#resend-reason').fill('Reviewed uncertain invitation send')
    const confirm=dialog.getByRole('button',{name:locale==='en'?'Confirm provisioning':'تأكيد إنشاء الحساب',exact:true})
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('checkbox').check()
    await confirm.click();await expect(dialog).toHaveCount(0)
    expect(invite).toMatchObject({provisioningId:ids.provisioningId,acknowledgeUncertainSend:true})
    expect(invite!.requestId).not.toEqual(sent[0]!.requestId)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr')
    await page.screenshot({path:`/tmp/sas-provisioning-${locale}.png`})
  })
}
