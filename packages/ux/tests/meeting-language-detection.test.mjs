import test from 'node:test'
import assert from 'node:assert/strict'
import { detectMeetingLanguage, validateMeetingTranscript } from '../src/controllers/meetingLanguageDetection.mjs'

const languages = { '<|en|>': 1, '<|ar|>': 2, '<|fr|>': 3 }
const logits = scores => ({ data: new Float32Array(scores), dims: [1, 1, scores.length] })

test('language detection masks ordinary tokens and reads the final decoder position', () => {
  const value = { data: new Float32Array([999, 8, 1, 0, 999, 1, 8, 0]), dims: [1, 2, 4] }
  const result = detectMeetingLanguage(value, languages)
  assert.equal(result.language, 'ar')
  assert.ok(result.probability > 0.99 && result.probability <= 1)
  assert.equal(detectMeetingLanguage(logits([999, 4, 1, 0]), languages).language, 'en')
})

test('dominant unrelated speech is not forced into the two supported languages', () => {
  assert.throws(() => detectMeetingLanguage(logits([999, 1, 2, 8]), languages), /recognition-language-unsupported/)
})

test('malformed vocabularies and decoder outputs fail closed', () => {
  for (const value of [
    { data: new Float32Array([0, 1, 2, 3]), dims: [1, 4] },
    { data: new Float32Array([0, 1, 2]), dims: [1, 1, 4] },
    logits([0, NaN, 2, 3]),
  ]) assert.throws(() => detectMeetingLanguage(value, languages), /recognition-language-invalid/)
  for (const mapping of [
    {}, { '<|en|>': 1 }, { '<|en|>': 1, '<|ar|>': 1 }, { '<|en|>': 1, '<|ar|>': 99 },
    { english: 1, '<|ar|>': 2 },
  ]) assert.throws(() => detectMeetingLanguage(logits([0, 1, 2, 3]), mapping), /recognition-language-invalid/)
})

test('obvious Arabic and English repetition loops are rejected without publishing a prefix', () => {
  for (const text of [
    Array(10).fill('نحن').join('، '),
    Array(6).fill('we should proceed').join('. '),
    Array(6).fill('this is the plan').join(' '),
    Array(6).fill('move forward').join(' '),
  ]) assert.throws(() => validateMeetingTranscript(text), /recognition-repetition/)
})

test('ordinary mixed-language text and bounded emphasis preserve their exact original text', () => {
  const text = '  نحن نراجع the plan today. ثم نتأكد من الموعد، تمام؟\n'
  assert.equal(validateMeetingTranscript(text), text)
  assert.equal(validateMeetingTranscript('No, no, no. We need to review the plan first.'), 'No, no, no. We need to review the plan first.')
  const belowThreshold = Array(9).fill('نحن').join(' ')
  assert.equal(validateMeetingTranscript(belowThreshold), belowThreshold)
})

test('empty and oversized transcript output is rejected rather than trimmed or truncated', () => {
  assert.throws(() => validateMeetingTranscript('  \n'), /recognition-no-speech/)
  assert.throws(() => validateMeetingTranscript(`${'x'.repeat(3_999)}😀`), /recognition-result-limit/)
})
