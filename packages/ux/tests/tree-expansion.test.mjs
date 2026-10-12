import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'
import { useTreeExpansion } from '../src/composables/useTreeExpansion.ts'
test('tree expansion resets immediately when the tenant scope changes', () => {
 const scope = effectScope()
 const tenant = ref('first')
 const policy = scope.run(() => useTreeExpansion(tenant, ref(['root', 'branch'])))
 policy.collapseAll()
 assert.deepEqual(policy.expanded.value, [])
 policy.toggle('branch')
 assert.deepEqual(policy.expanded.value, ['branch'])
 tenant.value = 'second'
 assert.deepEqual(policy.expanded.value, ['root', 'branch'])
 scope.stop()
})
