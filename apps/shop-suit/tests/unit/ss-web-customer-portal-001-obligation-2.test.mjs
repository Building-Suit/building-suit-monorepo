import assert from 'node:assert/strict'
import test from 'node:test'
import {parseCustomerPortal} from '../../shared/customerPortal.ts'
import {portalPayload} from '../fixtures/customer-portal.mjs'
test('denied, expired, malformed and broadened walk-in data fail closed',()=>{
 assert.equal(parseCustomerPortal({authenticated:false,items:[{notes:'PRIVATE'}]}),null)
 for(const patch of [{authenticated:'true'},{scope:['customer']},{bucket:['past']},{page:0},{pageSize:100},{total:-1},{expiresAt:new Date(Date.now()-1).toISOString()},{expiresAt:new Date(Date.now()+700000).toISOString()},{scope:'appointment',total:2}])assert.throws(()=>parseCustomerPortal({...portalPayload(),...patch}))
 for(const row of [{...portalPayload().items[0],status:'paid'},{...portalPayload().items[0],timeZone:'unsafe'},{...portalPayload().items[0],endsAt:'bad'}])assert.throws(()=>parseCustomerPortal({...portalPayload(),items:[row]}))
})
