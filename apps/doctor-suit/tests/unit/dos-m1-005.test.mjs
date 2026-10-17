import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorPublicPreview } from '../../app/utils/publicPreview.ts'

test('DOS-M1-005: bilingual public projections describe current availability without production destinations', () => {
  for (const arabic of [false, true]) {
    const copy = doctorPublicPreview(arabic)
    assert.equal(copy.productName, 'Doctor Suit')
    assert.equal(copy.previewLink.to, '/preview')
    assert.equal(new Set(copy.features.map(row => row.id)).size, copy.features.length)
    assert.ok(copy.features.every(row => row.status === (arabic ? 'مخطط' : 'Planned')))
    assert.deepEqual(copy.workflow.map(row => row.id), ['alone', 'locations', 'staff'])
    assert.ok(copy.notice.includes(arabic ? 'بيانات تجريبية' : 'synthetic data'))
    assert.ok(copy.scopeNotice.includes(arabic ? 'غير متاحة' : 'remain unavailable'))
    assert.doesNotMatch(JSON.stringify(copy), /https?:|mailto:|tel:|\.supabase\.|\$\d/)
  }
})
