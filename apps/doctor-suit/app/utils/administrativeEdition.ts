export const doctorEditionModes = ['synthetic_preview', 'administrative_candidate'] as const
export type DoctorEditionMode = typeof doctorEditionModes[number]
export const doctorAdministrativeReasonCodes = ['admin.patient_request', 'admin.schedule_change', 'admin.booking_correction', 'admin.cancellation'] as const

export function doctorEditionMode(value: unknown): value is DoctorEditionMode {
  return typeof value === 'string' && doctorEditionModes.includes(value as DoctorEditionMode)
}
export function doctorAdministrativeReason(value: unknown): value is typeof doctorAdministrativeReasonCodes[number] {
  return typeof value === 'string' && doctorAdministrativeReasonCodes.includes(value as typeof doctorAdministrativeReasonCodes[number])
}
