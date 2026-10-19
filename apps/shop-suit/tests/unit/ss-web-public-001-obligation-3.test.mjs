import assert from 'node:assert/strict'
import test from 'node:test'
import {Readable} from 'node:stream'
import {validateWebsiteInquiry} from '../../shared/publicWebsite.ts'
import {createInquiryRateLimit} from '../../server/utils/inquiryRateLimit.ts'
import {readBoundedInquiryBody} from '../../server/utils/readBoundedInquiryBody.ts'
const valid={name:'Visitor',contact:'visitor@example.invalid',message:'Please contact me',company:'',locale:'en'}
test('public inquiry validates bounded fields and rejects client tenant selection',()=>{
 assert.deepEqual(validateWebsiteInquiry(valid),valid)
 assert.equal(validateWebsiteInquiry({...valid,contact:'+20 (100) 000-0002',locale:'ar'}).locale,'ar')
 for(const patch of [{name:''},{name:'a'.repeat(121)},{name:'x\nY'},{contact:'javascript:alert(1)'},{contact:'1'.repeat(255)},{message:''},{message:'x'.repeat(2001)},{company:'x'.repeat(201)},{locale:'fr'},{shopId:'other-shop'},{slug:'other-shop'}])assert.throws(()=>validateWebsiteInquiry({...valid,...patch}))
 assert.equal(validateWebsiteInquiry({...valid,name:'',contact:'',message:'',company:'bot'}).company,'bot')
})
test('socket quota is bounded, expires and fails closed when the map is full',()=>{
 const allow=createInquiryRateLimit(2,100,2)
 assert.equal(allow('shop-a:ip',0),true);assert.equal(allow('shop-a:ip',0),true);assert.equal(allow('shop-a:ip',1),false)
 assert.equal(allow('shop-b:ip',1),true);assert.equal(allow('shop-c:ip',1),false)
 assert.equal(allow('shop-a:ip',100),true);assert.equal(allow('shop-c:ip',101),true)
})
test('JSON reader bounds declared and streamed bytes before parsing',async()=>{
 const event=(parts,headers={})=>({node:{req:Object.assign(Readable.from(parts),{headers})}})
 assert.deepEqual(await readBoundedInquiryBody(event(['{"ok":true}'])),{ok:true})
 await assert.rejects(readBoundedInquiryBody(event(['{}'],{'content-length':'12001'})),{statusCode:413})
 await assert.rejects(readBoundedInquiryBody(event([' '.repeat(7000),' '.repeat(6000)])),{statusCode:413})
 await assert.rejects(readBoundedInquiryBody(event(['not json'])))
})
