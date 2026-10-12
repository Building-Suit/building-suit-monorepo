import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick, ref } from 'vue'
import { useOptionalImage } from '../src/composables/useOptionalImage.ts'
test('missing, broken and unsafe optional images use a local fallback; changing sources clears failure', async () => {
  const scope = effectScope(), source = ref(null)
  try {
    const image = scope.run(() => useOptionalImage(() => source.value))
    assert.equal(image.image.value, null)
    source.value = 'https://example.test/item.png'; await nextTick()
    assert.equal(image.image.value, source.value)
    image.failed(); assert.equal(image.broken.value, true)
    source.value = 'https://example.test/service.png'; await nextTick()
    assert.equal(image.broken.value, false)
    for (const value of ['http://example.test/item.png', 'javascript:alert(1)', 'https://user:secret@example.test/item.png']) { source.value = value; await nextTick(); assert.equal(image.image.value, null) }
  } finally { scope.stop() }
})
