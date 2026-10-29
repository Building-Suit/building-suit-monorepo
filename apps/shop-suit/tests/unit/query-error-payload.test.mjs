import assert from 'node:assert/strict'
import test from 'node:test'
import { shopQueryError, queryErrorPayload, reviveQueryError } from '../../app/utils/shopQueryError.ts'
test('SSR errors retain SDK rejection semantics without retaining provider request secrets', () => {
 const provider = Object.assign(new Error('SHOP_PERMISSION_DENIED'), { code: '42501', request: { authorization: 'secret-test', body: { token: 'one-time-test' } } })
 const safe = shopQueryError(provider, { data: null, error: provider, status: 403, statusText: 'Forbidden' })
 const serialized = JSON.stringify(queryErrorPayload(safe))
 assert.ok(!serialized.includes('secret-test') && !serialized.includes('one-time-test') && !serialized.includes('stack'))
 const revived = reviveQueryError(JSON.parse(serialized))
 assert.equal(revived.message, 'SHOP_PERMISSION_DENIED')
 assert.equal(revived.code, '42501')
 assert.deepEqual(revived.shopResponse, { data: null, error: { message: 'SHOP_PERMISSION_DENIED', code: '42501' }, status: 403, statusText: 'Forbidden' })
})
