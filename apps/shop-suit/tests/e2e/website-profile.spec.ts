import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureReload, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { emptyWebsiteProfile, type WebsiteProfileSettings, type WebsiteProfileDraft } from '../../shared/websiteProfile'
const initial = (): WebsiteProfileSettings => ({ draft: {}, slug: 'public-profile', state: 'draft', logoDataUrl: null, catalog: { integration: 'pending', publishedItemCount: 0 }, missing: ['publicName','description','logo','contact','location','publishedItem'], ownerOptedIn: false })
for (const locale of ['en','ar']) for (const theme of ['light','dark']) test(`public profile explicit draft ${locale} ${theme}`, async ({ page }) => {
  const ar = locale === 'ar'
  await page.setViewportSize({ width: theme === 'dark' ? 390 : 1440, height: 950 })
  await page.addInitScript(v => localStorage.setItem('building-suit.theme',v), theme)
  let settings = initial()
  const { calls } = await pilotFixture(page,locale,'owner',(name,args) => {
    if (name === 'shop_permission_access') return { 'settings.manage': true }
    if (name === 'shop_website_profile') return settings
    if (name === 'shop_website_profile_save') { settings = { ...settings, draft: args.p_profile as WebsiteProfileDraft }; return settings }
    return undefined
  })
  await fixtureGoto(page,'/settings/website-profile')
  const panel = page.locator('#website-profile')
  await expect(panel).toContainText('https://public-profile.shops.building-suit.com')
  const publish = panel.getByRole('button',{name: ar ? 'نشر' : 'Publish',exact:true})
  await expect(publish).toBeDisabled()
  await panel.getByRole('checkbox').check()
  await expect(publish).toBeDisabled()
  await panel.getByRole('button',{name: ar ? 'تعديل المسودة' : 'Edit draft',exact:true}).click()
  const dialog = page.getByRole('dialog')
  const name = dialog.getByLabel(ar ? 'الاسم العام' : 'Public name',{exact:true}).first()
  await expect(name).toHaveValue('')
  await expect(dialog.getByLabel(ar ? 'هاتف عام' : 'Public phone',{exact:true})).toHaveValue('')
  for (const checkbox of await dialog.getByRole('checkbox').all()) await expect(checkbox).not.toBeChecked()
  await name.fill(ar ? 'المتجر العام' : 'Public workshop')
  await dialog.getByLabel(ar ? 'وصف قصير' : 'Short description',{exact:true}).fill('Independent public description')
  await dialog.getByRole('button',{name: ar ? 'حفظ المسودة' : 'Save draft',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(panel).toContainText(ar ? 'لم يتم نشر' : 'have not been published')
  expect(calls.find(v => v.name === 'shop_website_profile_save')?.args.p_profile).toEqual({ ...emptyWebsiteProfile(), publicName: ar ? 'المتجر العام' : 'Public workshop', description:'Independent public description' })
  expect(calls.some(v => v.name === 'shop_website_profile_publish')).toBe(false)
  await fixtureReload(page)
  await panel.getByRole('button',{name: ar ? 'تعديل المسودة' : 'Edit draft',exact:true}).click()
  await expect(name).toHaveValue(ar ? 'المتجر العام' : 'Public workshop')
  await expectNoPageOverflow(page)
  await page.screenshot({path:test.info().outputPath('profile-editor.png'),fullPage:true,animations:'disabled'})
})
test('public settings denial reads and writes no tenant profile', async ({page}) => {
  const {calls} = await pilotFixture(page,'en','owner',name => name === 'shop_permission_access' ? {'settings.manage':false} : undefined)
  await fixtureGoto(page,'/settings/website-profile')
  await expect(page.locator('#website-profile')).toContainText('Settings permission required.')
  expect(calls.some(v => v.name.startsWith('shop_website_profile'))).toBe(false)
})
test('unpublish revokes immediately and keeps draft; failures retain edits with safe feedback', async ({page}) => {
  let settings = {...initial(),state:'published' as WebsiteProfileSettings['state'],draft:{...emptyWebsiteProfile(),publicName:'Saved public name'}}
  await pilotFixture(page,'en','owner',(name) => {
    if(name==='shop_permission_access') return {'settings.manage':true}
    if(name==='shop_website_profile') return settings
    if(name==='shop_website_profile_unpublish') { settings={...settings,state:'draft'};return settings }
    return undefined
  })
  await fixtureRoute(page,'**/rest/v1/rpc/shop_website_profile_save',route=>route.fulfill({status:403,json:{message:'private raw SQL details'}}))
  await fixtureGoto(page,'/settings/website-profile')
  const panel=page.locator('#website-profile')
  await panel.getByRole('button',{name:'Unpublish',exact:true}).click()
  await expect(panel).toContainText('Unpublished. Your configuration is retained.')
  await expect(panel.getByRole('button',{name:'Unpublish',exact:true})).toBeDisabled()
  await panel.getByRole('button',{name:'Edit draft',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByLabel('Public name',{exact:true}).first()).toHaveValue('Saved public name')
  await dialog.getByLabel('Public name',{exact:true}).first().fill('Retained edit')
  await dialog.getByRole('button',{name:'Save draft',exact:true}).click()
  await expect(dialog).toContainText('Could not save the public profile.')
  await expect(dialog).not.toContainText('private raw')
  await expect(dialog.getByLabel('Public name',{exact:true}).first()).toHaveValue('Retained edit')
})
test('logo picker rejects SVG and oversized dimensions, decodes PNG/JPEG/WebP and scopes replacement', async ({page}) => {
  let settings = initial()
  const {calls} = await pilotFixture(page,'en','owner',(name,args) => {
    if(name==='shop_permission_access') return {'settings.manage':true}
    if(name==='shop_website_profile') return settings
    if(name==='shop_website_logo_replace') { settings={...settings,logoDataUrl:args.p_data_url as string|null};return settings }
    return undefined
  })
  await fixtureGoto(page,'/settings/website-profile')
  await page.locator('#website-profile').getByRole('button',{name:'Edit draft',exact:true}).click()
  const dialog=page.getByRole('dialog'), input=dialog.locator('input[type=file]')
  await input.setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="alert(1)"/>')})
  await expect(dialog).toContainText('Choose a valid PNG, JPEG or WebP')
  expect(calls.filter(v=>v.name==='shop_website_logo_replace')).toHaveLength(0)
  const fixtures=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=8;c.height=8;const x=c.getContext('2d')!;x.fillRect(0,0,8,8)
    const images=['image/png','image/jpeg','image/webp'].map(type=>({type,url:c.toDataURL(type)}))
    c.width=2049;c.height=1;return [...images,{type:'image/png',url:c.toDataURL('image/png')}]
  })
  for(const fixture of fixtures.slice(0,3)) {
    const before=calls.filter(v=>v.name==='shop_website_logo_replace').length
    await input.setInputFiles({name:'logo.'+fixture.type.split('/')[1],mimeType:fixture.type,buffer:Buffer.from(fixture.url.split(',')[1]!,'base64')})
    await expect.poll(()=>calls.filter(v=>v.name==='shop_website_logo_replace').length).toBe(before+1)
    expect(calls.filter(v=>v.name==='shop_website_logo_replace').at(-1)?.args).toMatchObject({p_shop_id:'shop-1',p_data_url:expect.stringMatching(/^data:image\/png;base64,/)})
  }
  await input.setInputFiles({name:'wide.png',mimeType:'image/png',buffer:Buffer.from(fixtures[3]!.url.split(',')[1]!,'base64')})
  await expect(dialog).toContainText('Choose a valid PNG, JPEG or WebP')
  expect(calls.filter(v=>v.name==='shop_website_logo_replace')).toHaveLength(3)
  await dialog.getByRole('button',{name:'Remove logo',exact:true}).click()
  await expect.poll(()=>calls.filter(v=>v.name==='shop_website_logo_replace').length).toBe(4)
  expect(calls.filter(v=>v.name==='shop_website_logo_replace').at(-1)?.args).toEqual({p_shop_id:'shop-1',p_data_url:null})
})
test('malformed profile read stays retryable and does not remove the address editor', async ({page}) => {
  let malformed=true
  await pilotFixture(page,'en','owner',name => {
    if(name==='shop_permission_access') return {'settings.manage':true}
    if(name==='shop_website_address') return {slug:'public-profile',state:'draft',aliases:[]}
    if(name==='shop_website_profile') return malformed ? [] : initial()
    return undefined
  })
  await fixtureGoto(page,'/settings/website-profile')
  await expect(page.locator('#website-profile')).toContainText('Could not load public profile.')
  await fixtureGoto(page,'/settings/website-address')
  await expect(page.locator('#website-address')).toContainText('https://public-profile.shops.building-suit.com')
  await fixtureGoto(page,'/settings/website-profile')
  malformed=false
  await page.locator('#website-profile').getByRole('button',{name:'Retry',exact:true}).click()
  await expect(page.locator('#website-profile').getByRole('button',{name:'Edit draft',exact:true})).toBeEnabled()
})
for (const locale of ['en','ar']) test(`archived public location can be hidden and saved without republishing: ${locale}`, async ({page}) => {
  test.setTimeout(90000)
  const ar=locale==='ar'
  const publicLocation={id:'location-2',visible:true,publicName:'Public branch two',address:'Public street two'}
  let archived=false
  let settings:WebsiteProfileSettings={...initial(),draft:{...emptyWebsiteProfile(),publicName:'Saved public shop',locations:[publicLocation]}}
  const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
    if(name==='shop_permission_access') return {'settings.manage':true}
    if(name==='list_shop_locations') return [
      {id:'location-1',shop_id:'shop-1',name:'First branch',status:'active',is_default:true},
      {id:'location-2',shop_id:'shop-1',name:'Second branch',status:archived?'archived':'active',is_default:false},
    ]
    if(name==='shop_website_profile') return settings
    if(name==='archive_shop_location') { expect(args).toEqual({p_shop_id:'shop-1',p_location_id:'location-2'});archived=true;return null }
    if(name==='shop_website_profile_save') {
      const draft=args.p_profile as WebsiteProfileDraft
      expect(args.p_shop_id).toBe('shop-1')
      expect(draft.locations).toEqual([{...publicLocation,visible:false}])
      settings={...settings,draft,missing:['location','publishedItem']};return settings
    }
    return undefined
  })
  await fixtureGoto(page,'/settings/website-profile')
  const panel=page.locator('#website-profile')
  await panel.getByRole('button',{name:ar?'تعديل المسودة':'Edit draft',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('checkbox',{name:/Second branch/})).toBeChecked()
  await page.getByRole('dialog').getByRole('button',{name:ar?'إلغاء':'Cancel',exact:true}).click()
  await fixtureGoto(page,'/settings/locations')
  await page.locator('#locations').getByRole('row').filter({hasText:'Second branch'}).getByRole('button',{name:ar?'أرشفة':'Archive',exact:true}).click()
  await page.getByRole('dialog',{name:ar?'تأكيد':'Confirm',exact:true}).getByRole('button',{name:ar?'تأكيد':'Confirm',exact:true}).click()
  await expect.poll(()=>archived).toBe(true)
  await fixtureGoto(page,'/settings/website-profile')
  await fixtureReload(page)
  await panel.getByRole('button',{name:ar?'تعديل المسودة':'Edit draft',exact:true}).click()
  const dialog=page.getByRole('dialog')
  const stale=dialog.getByRole('checkbox',{name:/Public branch two/})
  await expect(stale).toBeChecked()
  await stale.uncheck()
  await expect(stale).toBeDisabled()
  await dialog.getByLabel(ar?'الاسم العام':'Public name',{exact:true}).first().fill('Edited after archival')
  await dialog.getByRole('button',{name:ar?'حفظ المسودة':'Save draft',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(panel).toContainText(ar?'لم يتم نشر':'have not been published')
  await expect(panel.getByRole('button',{name:ar?'نشر':'Publish',exact:true})).toBeDisabled()
  expect(settings.state).toBe('draft')
  expect(calls.some(c=>c.name==='shop_website_profile_publish')).toBe(false)
  await fixtureReload(page)
  await panel.getByRole('button',{name:ar?'تعديل المسودة':'Edit draft',exact:true}).click()
  await expect(stale).not.toBeChecked()
  await expect(stale).toBeDisabled()
  await expect(dialog.getByLabel(ar?'العنوان العام':'Public address',{exact:true}).last()).toHaveValue('Public street two')
})
