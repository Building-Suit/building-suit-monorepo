/** Hide the exact legacy sandbox paragraph shown in the owner's reference, without suppressing payment instructions. */
export function billingInstructionText(text: string): string {
  const prefixes = ['بيئة الاختبار: الطلبات الاصطناعية لا تمثل أموالًا مستلمة', 'Synthetic submissions do not represent received funds']
  return text.split(/\n\s*\n/).filter(paragraph => !prefixes.some(prefix => paragraph.trim().startsWith(prefix))).join('\n\n').trim()
}
