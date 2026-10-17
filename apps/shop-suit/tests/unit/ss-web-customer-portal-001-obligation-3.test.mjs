import assert from 'node:assert/strict'
import test from 'node:test'
import {parseCustomerPortal} from '../../shared/customerPortal.ts'
import {portalPayload} from '../fixtures/customer-portal.mjs'
test('payload adapters reconstruct only permitted fields, excluding identity/finance/private data',()=>{
 const raw=portalPayload(),privateFields={customerId:'PRIVATE',appointmentId:'PRIVATE',notes:'PRIVATE',sales:[1],invoices:[2],receipts:[3],payments:[4],balance:99,products:[5],audit:[6],phone:'PRIVATE',email:'PRIVATE'}
 Object.assign(raw,privateFields);Object.assign(raw.items[0],privateFields);Object.assign(raw.items[0].location,privateFields)
 const safe=parseCustomerPortal(raw)
 assert.ok(!JSON.stringify(safe).includes('PRIVATE'))
 assert.deepEqual(Object.keys(safe.items[0]).sort(),['startsAt','endsAt','timeZone','service','staff','status','location'].sort())
 assert.deepEqual(Object.keys(safe.items[0].location).sort(),['address','name'])
})
