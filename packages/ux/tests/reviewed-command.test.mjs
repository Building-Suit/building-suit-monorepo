import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, ref, nextTick } from 'vue'
import { useReviewedCommand } from '../src/composables/useReviewedCommand.ts'
test('review invalidates on edit and ignores late quotes or scope changes', async () => {
 const scope = effectScope(), value = ref(1), tenant = ref('one')
 const review = scope.run(() => useReviewedCommand(() => ({ value: value.value }), () => tenant.value))
 let finish
 const loading = review.preview(() => new Promise(resolve => { finish = resolve }), String)
 value.value = 2; finish({ total: 10 }); await loading
 assert.equal(review.review.value, null)
 await review.preview(async input => ({ total: input.value * 10 }), String)
 assert.equal(review.review.value.total, 20)
 value.value = 3
 assert.equal(review.review.value, null)
 const late = review.preview(() => new Promise(resolve => { finish = resolve }), String)
 tenant.value = 'two'; await nextTick(); finish({ total: 30 }); await late
 assert.equal(review.review.value, null)
 scope.stop()
})
test('uncertain command keeps the exact reviewed payload and id for replay', async () => {
 const scope = effectScope(), value = ref(8)
 const review = scope.run(() => useReviewedCommand(() => ({ quantity: value.value }), () => 'tenant-location-sale'))
 await review.preview(async () => ({ refund: 20 }), String)
 const attempts = []
 assert.equal(await review.submit(async (id, input, quote) => { attempts.push({ id, input, quote }); throw new Error('network disconnected after server commit') }, String), false)
 assert.equal(review.locked.value, true)
 value.value = 9
 assert.equal(await review.submit(async (id, input, quote) => { attempts.push({ id, input, quote }) }, String), true)
 assert.deepEqual(attempts[0], attempts[1]); assert.equal(attempts[1].input.quantity, 8)
 assert.equal(review.requestId.value, null); assert.equal(review.review.value, null)
 scope.stop()
})
test('scope reset never restores an old command review after confirmation', async () => {
 const scope = effectScope(), tenant = ref('one')
 const review = scope.run(() => useReviewedCommand(() => ({ quantity: 1 }), () => tenant.value))
 await review.preview(async () => ({ refund: 10 }), String)
 let finish
 const posting = review.submit(() => new Promise(resolve => { finish = resolve }), String)
 tenant.value = 'two'; await nextTick(); finish(); await posting
 assert.equal(review.locked.value, false); assert.equal(review.review.value, null)
 scope.stop()
})
