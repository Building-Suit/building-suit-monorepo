import {expect,test} from '@playwright/test'
import {pilotFixture,fixtureGoto,fixtureReload} from './pilot-fixture'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
import {emptyWebsiteCatalogEntry,type WebsiteCatalogItem} from '../../shared/websiteCatalog'
for(const locale of ['en','ar']) for(const theme of ['light','dark']) test(`selective public catalog stays independent ${locale} ${theme}`,async({page})=>{
  test.setTimeout(90000)
  const ar=locale==='ar'
  await page.setViewportSize({width:theme==='dark'?390:1440,height:950})
  await page.addInitScript(v=>localStorage.setItem('building-suit.theme',v),theme)
  let items:WebsiteCatalogItem[]=[{...emptyWebsiteCatalogEntry(),itemId:'product-1',kind:'product',operationalName:'Private product',price:12.50,active:true,configured:false,published:false},{...emptyWebsiteCatalogEntry(),itemId:'service-1',kind:'service',operationalName:'Private service',price:99.88,active:true,configured:false,published:false}]
  const {calls}=await pilotFixture(page,locale,'owner',(name,args)=>{
    if(name==='shop_permission_access')return {'settings.manage':true}
    if(name==='shop_website_catalog')return {items:items.filter(i=>!args.p_search||i.operationalName.toLowerCase().includes(String(args.p_search).toLowerCase())),total:items.length,page:1,pageSize:20,catalog:{integration:'ready',publishedItemCount:items.filter(i=>i.published&&i.active).length}}
    if(name==='shop_website_profile')return {draft:{},slug:'catalog-shop',state:'draft',logoDataUrl:null,catalog:{integration:'ready',publishedItemCount:items.filter(i=>i.published&&i.active).length},missing:items.some(i=>i.published)?['logo']:['logo','publishedItem'],ownerOptedIn:false}
    if(name==='shop_website_catalog_save'){items=items.map(i=>i.itemId===args.p_item_id&&i.kind===args.p_kind?{...i,...args.p_entry as object,configured:true}:i);return null}
    if(name==='shop_website_catalog_publish'){items=items.map(i=>i.itemId===args.p_item_id&&i.kind===args.p_kind?{...i,published:args.p_published===true}:i);return null}
    return undefined
  })
  await fixtureGoto(page,'/settings/website-catalog')
  const panel=page.locator('#website-catalog'), row=panel.getByRole('row').filter({hasText:'Private product'})
  await expect(panel.getByRole('button',{name:ar?'نشر العنصر':'Publish item',exact:true})).toHaveCount(0)
  await expect(row).toContainText(ar?'تواصل لمعرفة السعر':'Contact for price')
  await row.getByRole('button',{name:ar?'تعديل البيانات العامة':'Edit public details',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByLabel(ar?'الاسم العام':'Public name',{exact:true})).toHaveValue('Private product')
  await expect(dialog.getByRole('checkbox')).not.toBeChecked()
  await dialog.getByLabel(ar?'الاسم العام':'Public name',{exact:true}).fill('Public product')
  await dialog.getByLabel(ar?'الوصف العام':'Public description',{exact:true}).fill('Public description only')
  await dialog.getByLabel(ar?'ترتيب العرض':'Display order',{exact:true}).fill('3')
  await expectNoPageOverflow(page)
  await page.screenshot({path:test.info().outputPath('catalog-editor.png'),fullPage:true,animations:'disabled'})
  await dialog.getByRole('button',{name:ar?'حفظ البيانات العامة':'Save public details',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  expect(items[0]?.published).toBe(false)
  expect(calls.find(c=>c.name==='shop_website_catalog_save')?.args).toEqual({p_shop_id:'shop-1',p_kind:'product',p_item_id:'product-1',p_entry:{publicName:'Public product',description:'Public description only',image:null,displayOrder:3,showPrice:false}})
  await row.getByRole('button',{name:ar?'نشر العنصر':'Publish item',exact:true}).click()
  await expect(row).toContainText(ar?'منشور':'Published')
  await row.getByRole('button',{name:ar?'تعديل البيانات العامة':'Edit public details',exact:true}).click()
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button',{name:ar?'حفظ البيانات العامة':'Save public details',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(row).not.toContainText(ar?'تواصل لمعرفة السعر':'Contact for price')
  expect(items[0]?.published).toBe(true)
  await row.getByRole('button',{name:ar?'تعديل البيانات العامة':'Edit public details',exact:true}).click()
  await dialog.getByRole('checkbox').uncheck()
  await dialog.getByRole('button',{name:ar?'حفظ البيانات العامة':'Save public details',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(row).toContainText(ar?'تواصل لمعرفة السعر':'Contact for price')
  await fixtureGoto(page,'/settings/website-profile')
  await expect(page.locator('#website-profile').getByRole('button',{name:ar?'تعديل المسودة':'Edit draft',exact:true})).toBeVisible()
  await expect(page.locator('#website-profile')).not.toContainText(ar?'يلزم منتج أو خدمة منشورة.':'A published product or service is required.')
  await fixtureGoto(page,'/settings/website-catalog')
  await panel.getByRole('searchbox').fill('product')
  await expect(row).toContainText(ar?'منشور':'Published')
  await panel.getByRole('searchbox').fill('')
  await expect(row).toContainText(ar?'منشور':'Published')
  await row.getByRole('button',{name:ar?'إلغاء نشر العنصر':'Unpublish item',exact:true}).click()
  await expect(row).toContainText(ar?'خاص':'Private')
  await panel.getByRole('searchbox').fill('product')
  await expect(row).toContainText(ar?'خاص':'Private')
  await expect(row.getByRole('button',{name:ar?'إلغاء نشر العنصر':'Unpublish item',exact:true})).toHaveCount(0)
  await panel.getByRole('searchbox').fill('')
  await fixtureGoto(page,'/settings/website-profile')
  await expect(page.locator('#website-profile')).toContainText(ar?'يلزم منتج أو خدمة منشورة.':'A published product or service is required.')
  expect(items[0]?.active).toBe(true)
  expect(items[0]?.publicName).toBe('Public product')
  expect(calls.some(c=>c.name==='shop_website_profile_publish')).toBe(false)
  await fixtureGoto(page,'/settings/website-catalog')
  await fixtureReload(page)
  await expect(row).toContainText(ar?'خاص':'Private')
  await expectNoPageOverflow(page)
})
test('settings manager cannot read or publish the owner public catalog',async({page})=>{
  const {calls}=await pilotFixture(page,'en','employee',name=>name==='shop_permission_access'?{'settings.manage':true}:undefined)
  await fixtureGoto(page,'/settings/website-catalog')
  await expect(page.locator('#website-catalog')).toContainText('Only the owner can manage the public catalog.')
  expect(calls.some(c=>c.name.startsWith('shop_website_catalog'))).toBe(false)
})
test('public image is an independent bounded raster and invalid uploads retain the editor',async({page})=>{
  const item:WebsiteCatalogItem={...emptyWebsiteCatalogEntry(),itemId:'service-image',kind:'service',operationalName:'Image service',active:true,configured:false,published:false,price:10}
  const {calls}=await pilotFixture(page,'en','owner',(name,args)=>{
    if(name==='shop_permission_access')return {'settings.manage':true}
    if(name==='shop_website_catalog')return {items:[item],total:1,page:1,pageSize:20,catalog:{integration:'ready',publishedItemCount:0}}
    if(name==='shop_website_catalog_save'){Object.assign(item,args.p_entry,{configured:true});return null}
    return undefined
  })
  await fixtureGoto(page,'/settings/website-catalog')
  await page.locator('#website-catalog').getByRole('button',{name:'Edit public details',exact:true}).click()
  const dialog=page.getByRole('dialog'),file=dialog.locator('input[type=file]')
  await file.setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="alert(1)"/>')})
  await expect(dialog).toContainText('Choose a valid PNG, JPEG or WebP')
  expect(calls.some(c=>c.name==='shop_website_catalog_save')).toBe(false)
  await file.setInputFiles({name:'public.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==','base64')})
  await expect(dialog.getByRole('img')).toBeVisible()
  await dialog.getByRole('button',{name:'Save public details',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  expect(item.image).toMatch(/^data:image\/png;base64,/)
  expect(item.published).toBe(false)
  expect(item.active).toBe(true)
})
