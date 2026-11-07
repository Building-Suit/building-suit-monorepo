export function detectMeetingLanguage(
  logits: { data: Float32Array | Float64Array; dims: readonly number[] },
  langToId: Readonly<Record<string, number>>,
): { language: 'ar' | 'en'; probability: number }
/** Returns the exact input or rejects invalid length, empty text and obvious loops. */
export function validateMeetingTranscript(text: string): string
