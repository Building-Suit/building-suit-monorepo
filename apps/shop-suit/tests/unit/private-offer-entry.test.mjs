import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePrivateOfferLink } from '../../app/utils/private-offer.ts'
const id='11111111-1111-4111-8111-111111111111',token='A'.repeat(43),origin='https://shop.example.test'
const link=`${origin}/billing#offer=${id}&version=2&binding=${id}&environment=${id}&token=${token}`
test('entry keeps exact recipient-scoped opaque fields without a query-string token',()=>{
 assert.deepEqual(parsePrivateOfferLink(link,origin),{offerId:id,offerVersion:2,targetBindingId:id,targetEnvironmentId:id,redemptionToken:token})
 assert.equal(new URL(link).search,'')
})
test('cross-host, query leakage, duplicate fields, invalid versions and credentials fail closed',()=>{
 for(const input of [link.replace('shop.example','attacker.example'),link.replace('/billing#','/billing?token=leak#'),link+'&token='+token,link.replace('version=2','version=0'),link.replace('token='+token,'token=short'),link.replace('https://','https://user:password@'),link+'&unknown=1']) assert.throws(()=>parsePrivateOfferLink(input,origin))
})
