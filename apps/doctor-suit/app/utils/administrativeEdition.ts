export const doctorEditionModes = ['synthetic_preview', 'administrative_candidate'] as const
export type DoctorEditionMode = typeof doctorEditionModes[number]
export const doctorAdministrativeReasonCodes = ['admin.patient_request', 'admin.schedule_change', 'admin.booking_correction', 'admin.cancellation'] as const

export function doctorEditionMode(value: unknown): value is DoctorEditionMode {
  return typeof value === 'string' && doctorEditionModes.includes(value as DoctorEditionMode)
}
export function doctorAdministrativeReason(value: unknown): value is typeof doctorAdministrativeReasonCodes[number] {
  return typeof value === 'string' && doctorAdministrativeReasonCodes.includes(value as typeof doctorAdministrativeReasonCodes[number])
}

export function doctorAdministrativeReasonOptions(ar: boolean) {
  const labels = ar ? ['طلب المريض', 'تغيير الجدول', 'تصحيح الحجز', 'إلغاء إداري'] : ['Patient request', 'Schedule change', 'Booking correction', 'Administrative cancellation']
  return doctorAdministrativeReasonCodes.map((value, index) => ({ value, label: labels[index]! }))
}
export function doctorAdministrativeReasonLabel(value: unknown, ar: boolean): string {
  return doctorAdministrativeReasonOptions(ar).find(option => option.value === value)?.label || ''
}
