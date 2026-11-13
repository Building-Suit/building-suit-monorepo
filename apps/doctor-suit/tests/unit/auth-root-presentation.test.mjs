import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorRootPresentation } from '../../app/utils/rootPresentation.ts'
test('auth entries share canonical route motion, while protected layout trees have distinct ownership', () => {
  const signIn = doctorRootPresentation('/sign-in', false), recovery = doctorRootPresentation('/recover', 'auth')
  assert.equal(signIn.layoutKey, recovery.layoutKey)
  assert.deepEqual(signIn.pageTransition, { name: 'bs-auth-route', mode: 'out-in' })
  assert.deepEqual(recovery.pageTransition, signIn.pageTransition)
  for (const [path,layout] of [['/payment-notices','auth'],['/account','auth'],['/workspace','practice'],['/','marketing']]) {
    const next = doctorRootPresentation(path, layout)
    assert.notEqual(next.layoutKey, signIn.layoutKey); assert.equal(next.pageTransition, false)
  }
  assert.notEqual(doctorRootPresentation('/payment-notices','auth').layoutKey, doctorRootPresentation('/workspace','practice').layoutKey)
})
