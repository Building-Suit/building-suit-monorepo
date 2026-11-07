import assert from 'node:assert/strict'
import test from 'node:test'
import { estimateOfferDiscount } from '../../shared/catalogOffers.ts'
import { emptyStorefrontLayout, parsePublicStorefront } from '../../shared/storefrontBuilder.ts'
const bundle = { id:'bundle',name:'Two products and a service',revision:1,price:50,oldPrice:70,active:true,starts_at:null,ends_at:null,lines:[{kind:'product',sourceId:'p',quantity:2,unitPrice:20,discount:0,available:true},{kind:'service',sourceId:'s',quantity:1,unitPrice:30,discount:0,available:true}] }
test('repeated complete bundles consume each quantity once and preserve remainder pricing',()=>{
 const single={...bundle,id:'single',name:'Single product',price:15,lines:[bundle.lines[0]],oldPrice:40}
 const result=estimateOfferDiscount([bundle,{...single,lines:[{...single.lines[0],quantity:1}]}],[{itemType:'product',sourceId:'p',quantity:5},{itemType:'service',sourceId:'s',quantity:2}])
 assert.equal(result.discount,45)
 assert.deepEqual(result.offers.map(v=>[v.id,v.quantity]),[['bundle',2],['single',1]])
 assert.equal(estimateOfferDiscount([bundle],[{itemType:'product',sourceId:'p',quantity:2}]).discount,0)
})
test('offline estimates skip expired, inactive, unavailable and more expensive bundles',()=>{
 const lines=[{itemType:'product',sourceId:'p',quantity:2},{itemType:'service',sourceId:'s',quantity:1}]
 for(const offer of [{...bundle,active:false},{...bundle,ends_at:'2000-01-01T00:00:00Z'},{...bundle,starts_at:'2100-01-01T00:00:00Z'},{...bundle,price:80},{...bundle,lines:bundle.lines.map(l=>({...l,available:false}))}])assert.equal(estimateOfferDiscount([offer],lines,Date.parse('2026-10-20')).discount,0)
})
test('fractional recipes preserve five-decimal counter quantities without extra sets',()=>{
 const offer={...bundle,price:5,lines:[{...bundle.lines[0],quantity:.5}]}
 assert.equal(estimateOfferDiscount([offer],[{itemType:'product',sourceId:'p',quantity:1.00001}]).offers[0].quantity,2)
})
test('public layout excludes private staff identifiers and rejects unbounded or foreign images',()=>{
 const layout={...emptyStorefrontLayout(),offers:[],staff:[{name:'Public name',role:'Stylist',bio:'',image:null,profileId:'private',email:'private@example.invalid'}]}
 const parsed=parsePublicStorefront(layout)
 assert.deepEqual(parsed.staff,[{name:'Public name',role:'Stylist',bio:'',image:null}])
 assert.equal(parsed.banner,null)
 assert.deepEqual(parsePublicStorefront({...layout,showStaff:false}).staff,[])
 assert.throws(()=>parsePublicStorefront({...layout,banner:{image:'https://foreign.invalid/image.png',alt:'',title:'',subtitle:''}}))
 assert.throws(()=>parsePublicStorefront({...layout,staff:Array(21).fill(layout.staff[0])}))
})
