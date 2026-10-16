import assert from 'node:assert/strict'
import test from 'node:test'
import {emptyWebsiteCatalogEntry,parseWebsiteCatalogSettings} from '../../shared/websiteCatalog.ts'
test('public catalog configuration starts without images, description or price opt-in',()=>{
  assert.deepEqual(emptyWebsiteCatalogEntry(),{publicName:'',description:'',image:null,displayOrder:0,showPrice:false})
})
test('malformed catalog responses fail safely instead of breaking business settings',()=>{
  const valid={items:[{...emptyWebsiteCatalogEntry(),itemId:'p',kind:'product',operationalName:'Private item',price:1,active:true,configured:false,published:false}],page:1,pageSize:20,total:1,catalog:{integration:'ready',publishedItemCount:0}}
  assert.equal(parseWebsiteCatalogSettings(valid),valid)
  for(const bad of [null,[],{}, {...valid,catalog:null},{...valid,items:[{}]},{...valid,items:[{...valid.items[0],kind:['product']}]},{...valid,items:[{...valid.items[0],price:Infinity}]},{...valid,total:-1},{...valid,items:[{...valid.items[0],image:'https://foreign.invalid/private.jpg'}]}])assert.throws(()=>parseWebsiteCatalogSettings(bad),/INVALID_PUBLIC_CATALOG_RESPONSE/)
})
