import { patientPrescriptionPreview, type PatientPrescriptionRequest } from './patientPrescriptionPreview.ts'
import type { PatientTimelineScope } from './patientReleasedTimeline.ts'
export interface PatientPreviewAvailability {
  scopeKey: string; network: 'online' | 'offline' | 'unknown'; foreground: boolean; revoked: boolean
  lastSuccessfulReadAt: number | null; notification: 'unknown' | 'unsupported' | 'denied' | 'permission_reported'
}
const copy = {
  en: { online: 'Online', offline: 'Offline; reconnect to refresh', unknown: 'Connection unknown', unavailable: 'Private preview unavailable', never: 'No successful refresh recorded', notice: 'Reminders are not guaranteed. Notification permission does not confirm delivery.', notification: { unknown: 'Notification status unknown', unsupported: 'Notifications unsupported', denied: 'Notification permission denied', permission_reported: 'Permission reported; delivery not confirmed' }, medicine: 'Medicine as entered', strength: 'Strength as entered', form: 'Form as entered', amount: 'Amount as entered', unit: 'Unit as entered', route: 'Route as entered', start: 'Start date as entered', end: 'End date as entered', instructions: 'Instructions as entered', kind: 'Segment type as entered', timezone: 'Timezone as entered', interval: 'Interval minutes as entered', weekdays: 'Weekdays as entered', times: 'Times as entered' },
  ar: { online: 'متصل', offline: 'غير متصل؛ أعد الاتصال للتحديث', unknown: 'حالة الاتصال غير معروفة', unavailable: 'المعاينة الخاصة غير متاحة', never: 'لم يُسجل تحديث ناجح', notice: 'التذكيرات غير مضمونة. إذن الإشعارات لا يؤكد وصولها.', notification: { unknown: 'حالة الإشعارات غير معروفة', unsupported: 'الإشعارات غير مدعومة', denied: 'إذن الإشعارات مرفوض', permission_reported: 'أُبلغ عن وجود الإذن؛ لم يُؤكد الوصول' }, medicine: 'الدواء كما أُدخل', strength: 'التركيز كما أُدخل', form: 'الشكل كما أُدخل', amount: 'الكمية كما أُدخلت', unit: 'الوحدة كما أُدخلت', route: 'طريقة الاستخدام كما أُدخلت', start: 'تاريخ البدء كما أُدخل', end: 'تاريخ الانتهاء كما أُدخل', instructions: 'التعليمات كما أُدخلت', kind: 'نوع المقطع كما أُدخل', timezone: 'المنطقة الزمنية كما أُدخلت', interval: 'الفاصل بالدقائق كما أُدخل', weekdays: 'أيام الأسبوع كما أُدخلت', times: 'الأوقات كما أُدخلت' }
} as const
/** Semantic content only: no renderer/text-size/contrast/device accessibility qualification. No private cache. */
export function patientAccessiblePrescription(raw: unknown, scope: PatientTimelineScope, request: PatientPrescriptionRequest, availability: PatientPreviewAvailability, locale: 'en' | 'ar', now: number) {
  if (!['en', 'ar'].includes(locale) || !availability || !['online', 'offline', 'unknown'].includes(availability.network) || !['unknown', 'unsupported', 'denied', 'permission_reported'].includes(availability.notification) || typeof availability.foreground !== 'boolean' || typeof availability.revoked !== 'boolean' || !Number.isSafeInteger(now) || now < 0 || availability.lastSuccessfulReadAt !== null && (!Number.isSafeInteger(availability.lastSuccessfulReadAt) || availability.lastSuccessfulReadAt < 0 || availability.lastSuccessfulReadAt > now)) throw Error('PATIENT_ACCESSIBLE_PREVIEW_INVALID')
  const labels = copy[locale], bound = availability.scopeKey === JSON.stringify(scope)
  const lastSuccessfulReadAt = bound ? availability.lastSuccessfulReadAt : null
  const status = availability.network === 'online' ? labels.online : availability.network === 'offline' ? labels.offline : labels.unknown
  let privateContent: { source: ReturnType<typeof patientPrescriptionPreview>['source']; state: string; instructionKind: string; readingOrder: readonly { key: string; label: string; value: string }[]; validUntil: number } | null = null
  if (bound && availability.network === 'online' && availability.foreground && !availability.revoked && lastSuccessfulReadAt !== null) {
    try {
      const preview = patientPrescriptionPreview(raw, scope, request, now), p = preview.prescription
      const fields: { key: string; label: string; value: string }[] = []
      const add = (key: string, label: string, value: string) => fields.push(Object.freeze({ key, label, value }))
      add('medicine', labels.medicine, p.medicine.label); add('strength', labels.strength, p.medicine.strength); add('form', labels.form, p.medicine.form)
      add('amount', labels.amount, p.dose.amount); add('unit', labels.unit, p.dose.unit); add('route', labels.route, p.dose.route)
      add('start', labels.start, p.start_date); add('end', labels.end, p.end_date); add('instructions', labels.instructions, p.instructions)
      p.segments.forEach((s, index) => {
        const prefix = `segment:${index}:`
        add(prefix + 'kind', labels.kind, s.kind); add(prefix + 'start', labels.start, s.start_date); add(prefix + 'end', labels.end, s.end_date); add(prefix + 'timezone', labels.timezone, s.timezone)
        add(prefix + 'interval', labels.interval, s.interval_minutes === null ? 'null' : String(s.interval_minutes)); add(prefix + 'weekdays', labels.weekdays, JSON.stringify(s.weekdays)); add(prefix + 'times', labels.times, JSON.stringify(s.times)); add(prefix + 'instructions', labels.instructions, s.instructions)
      })
      privateContent = Object.freeze({ source: preview.source, state: preview.state, instructionKind: preview.instructionKind, readingOrder: Object.freeze(fields), validUntil: preview.validUntil })
    } catch { privateContent = null }
  }
  return Object.freeze({ locale, direction: locale === 'ar' ? 'rtl' : 'ltr', status, lastSuccessfulReadAt, noRefreshLabel: labels.never, notificationStatus: labels.notification[availability.notification], notice: labels.notice, unavailableLabel: labels.unavailable, privateContent, privatePersistentCache: false, clinicalApproval: false, qualifiedAccessibility: false, qualifiedNative: false, externalNotifications: false, deliveryConfirmed: false })
}
