// GENERATED deployment artifact from packages/ui/src/utils/appointmentReminderEmail.ts.
// Regenerate with node tooling/ui/build-appointment-reminder-email.mjs; do not edit.
// Pure private email presentation. No provider, database, browser or application imports.
const escape = (value: string) => String(value).replace(/[&<>"']/g, char => (({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[char]))
export interface AppointmentReminderEmailInput {shopName:string;startsAt:string;timeZone:string;locale:'en'|'ar'}
export function appointmentReminderEmail(input: AppointmentReminderEmailInput) {
  if (!['en','ar'].includes(input.locale) || typeof input.shopName !== 'string' || input.shopName.length > 200 || !Number.isFinite(Date.parse(input.startsAt))) throw Error('INVALID_REMINDER_PRESENTATION')
  const ar = input.locale === 'ar'
  const date = new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', {dateStyle:'full',timeStyle:'short',hourCycle:'h23',timeZone:input.timeZone}).format(new Date(input.startsAt))
  const subject = ar ? 'تذكير بموعدك' : 'Appointment reminder'
  const heading = ar ? 'موعدك القادم' : 'Your upcoming appointment'
  const explanation = ar ? 'طلبت تذكيراً بهذا الموعد. لإيقاف التذكيرات، افتح إدارة مواعيدك أو تواصل مع المتجر. قد تصلك رسالة بدأ إرسالها قبل الإلغاء.' : 'You requested a reminder for this appointment. To stop reminders, open your appointment management page or contact the shop. A message already being sent may arrive after cancellation.'
  // No remote assets/tracking, capability links, customer identity, service or notes.
  return {subject,text:`${heading}\n${input.shopName}\n${date} (${input.timeZone})\n\n${explanation}`,
    html:`<!doctype html><html lang="${input.locale}" dir="${ar?'rtl':'ltr'}"><head><meta charset="utf-8"><title>${subject}</title></head><body><main><h1>${heading}</h1><p>${escape(input.shopName)}</p><p>${escape(date)} <bdi>(${escape(input.timeZone)})</bdi></p><p>${explanation}</p></main></body></html>`}
}
