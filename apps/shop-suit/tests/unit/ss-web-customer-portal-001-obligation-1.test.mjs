import assert from 'node:assert/strict'
import test from 'node:test'
import {parseCustomerPortal,websitePortalUrl} from '../../shared/customerPortal.ts'
import {portalPayload} from '../fixtures/customer-portal.mjs'
test('saved upcoming/history and walk-in projections preserve bounded paging and statuses',()=>{
 const upcoming=parseCustomerPortal(portalPayload());assert.equal(upcoming.items.length,20);assert.equal(upcoming.total,21)
 const past=parseCustomerPortal(portalPayload({bucket:'past'}));assert.deepEqual(past.items.map(i=>i.status),['completed','cancelled','no_show']);assert.equal(past.items[1].location,null)
 const walk=parseCustomerPortal(portalPayload({scope:'appointment'}));assert.equal(walk.total,1);assert.equal(walk.items.length,1)
 assert.equal(websitePortalUrl('alpha-tools','en'),'https://alpha-tools.shops.building-suit.com/my-appointments?lang=en')
 assert.equal(websitePortalUrl('alpha-tools','ar'),'https://alpha-tools.shops.building-suit.com/my-appointments')
})
