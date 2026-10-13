import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'

// Controlled UI coverage, separate from real disposable Auth/SQL acceptance.
for(const locale of ['en','ar']){
  test(`owner verifies invite and chooses their own password ${locale}`,async({page})=>{
    await page.setViewportSize({width:390,height:844})
    await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4325'}])
    const id=randomUUID(), tokenHash='a'.repeat(56), now=Math.floor(Date.now()/1000)
    const user={id,aud:'authenticated',role:'authenticated',email:'owner@example.invalid',email_confirmed_at:'2026-10-13T08:00:00Z',app_metadata:{provider:'email',bs_admin_provisioning_id:randomUUID()},user_metadata:{display_name:'Owner fixture'},identities:[],created_at:'2026-10-13T08:00:00Z'}
    const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',email:user.email,iat:now,exp:now+3600})).toString('base64url'),'controlled-test-signature'].join('.')
    let verified:unknown, password:unknown
    await page.route('**/auth/v1/verify',async route=>{verified=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify({access_token:jwt,refresh_token:'controlled-refresh-token',expires_in:3600,token_type:'bearer',user})})})
    await page.route('**/auth/v1/user',async route=>{if(route.request().method()==='PUT')password=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify(user)})})
    await page.route('**/rest/v1/rpc/shop_admin_provisioned_owner_claim',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({shopId:randomUUID(),subscription:{status:'active'}})}))
    const response=await page.goto(`/auth/owner-invitation?token_hash=${tokenHash}&type=invite`)
    expect(response?.headers()['cache-control']).toContain('no-store')
    await expect(page.locator('#owner-password')).toBeVisible()
    expect(verified).toMatchObject({token_hash:tokenHash,type:'invite'})
    expect(new URL(page.url()).search).toBe('')
    await page.locator('#owner-password').fill('Owner-chosen-password-123!')
    await page.locator('#owner-confirm').fill('Owner-chosen-password-123!')
    await page.getByRole('button',{name:locale==='en'?'Save password':'حفظ كلمة المرور',exact:true}).click()
    await expect(page.getByText(locale==='en'?'Your account is ready':'حسابك جاهز',{exact:true})).toBeVisible()
    expect(password).toMatchObject({password:'Owner-chosen-password-123!'})
    expect(password).not.toHaveProperty('role')
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr')
  })
}
test('an invalid invite never exposes password or ownership controls',async({page})=>{
  await page.goto('/auth/owner-invitation?token_hash=invalid&type=invite')
  await expect(page.getByText('This owner invitation is unavailable or expired.',{exact:true})).toBeVisible()
  await expect(page.locator('#owner-password')).toHaveCount(0)
  expect(new URL(page.url()).search).toBe('')
})
