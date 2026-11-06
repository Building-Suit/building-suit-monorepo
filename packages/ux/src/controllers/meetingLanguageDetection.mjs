/**
 * Whisper's first decoder step predicts a language token. Limit the comparison
 * to the model's complete language-token vocabulary, rather than choosing only
 * between Arabic and English and forcing unrelated speech into either one.
 * Probability describes this language-token comparison, not transcript accuracy.
 */
export function detectMeetingLanguage(logits, langToId) {
  const data = logits?.data, dims = logits?.dims
  if (!(data instanceof Float32Array || data instanceof Float64Array)
    || !Array.isArray(dims) || dims.length !== 3 || dims[0] !== 1 || dims[1] < 1
    || !dims.every(value => Number.isSafeInteger(value) && value > 0)
    || data.length !== dims[0] * dims[1] * dims[2]
    || !langToId || typeof langToId !== 'object' || Array.isArray(langToId)) {
    throw new Error('recognition-language-invalid')
  }
  const vocabulary = dims[2], offset = (dims[1] - 1) * vocabulary
  const candidates = Object.entries(langToId).map(([token, id]) => {
    const language = /^<\|([a-z]{2,3})\|>$/.exec(token)?.[1]
    if (!language || !Number.isSafeInteger(id) || id < 0 || id >= vocabulary || !Number.isFinite(data[offset + id])) {
      throw new Error('recognition-language-invalid')
    }
    return { language, id, score: data[offset + id] }
  })
  if (!candidates.length || candidates.length > 200
    || new Set(candidates.map(candidate => candidate.id)).size !== candidates.length
    || !candidates.some(candidate => candidate.language === 'ar')
    || !candidates.some(candidate => candidate.language === 'en')) throw new Error('recognition-language-invalid')
  let selected = candidates[0]
  for (const candidate of candidates) if (candidate.score > selected.score) selected = candidate
  if (selected.language !== 'ar' && selected.language !== 'en') throw new Error('recognition-language-unsupported')
  const denominator = candidates.reduce((sum, candidate) => sum + Math.exp(candidate.score - selected.score), 0)
  return { language: selected.language, probability: 1 / denominator }
}

/** Reject obvious decoder loops; this is not a general hallucination detector. */
export function validateMeetingTranscript(text) {
  if (typeof text !== 'string' || text.length > 4_000) throw new Error('recognition-result-limit')
  if (!text.trim()) throw new Error('recognition-no-speech')
  const words = text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  for (let width = 1; width <= 4; width++) {
    const repetitions = width === 1 ? 10 : 6
    const span = width * repetitions
    for (let start = 0; start + span <= words.length; start++) {
      let repeated = true
      for (let offset = width; offset < span; offset++) {
        if (words[start + offset] !== words[start + offset % width]) { repeated = false; break }
      }
      if (repeated) throw new Error('recognition-repetition')
    }
  }
  return text
}
