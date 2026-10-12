import test from 'node:test'
import assert from 'node:assert/strict'
import { billingInstructionText } from '../../app/utils/billingInstructions.ts'
test('the exact reference sandbox paragraph is absent in Arabic and its existing English equivalent', () => {
  assert.equal(billingInstructionText('بيئة الاختبار: الطلبات الاصطناعية لا تمثل أموالًا مستلمة. يتم التحويل خارج التطبيق إلى building-suit@instapay. المرفق وحده لا يؤكد الدفع.'), '')
  assert.equal(billingInstructionText('Synthetic submissions do not represent received funds.'), '')
})
test('ordinary operator instructions and independent paragraphs are preserved', () => {
  const real = 'Transfer the quoted amount, then attach proof for manual review.'
  assert.equal(billingInstructionText(real), real)
  assert.equal(billingInstructionText(`${real}\n\nSynthetic submissions do not represent received funds.\n\nKeep your bank reference.`), `${real}\n\nKeep your bank reference.`)
  assert.equal(billingInstructionText('احتفظ بمرجع التحويل ثم أرفق صورة الإيصال.'), 'احتفظ بمرجع التحويل ثم أرفق صورة الإيصال.')
})
