export const doctorMobileContractVersion = 1 as const
export const doctorMobileRoutes = ['/workspace', '/schedule', '/account'] as const
export type DoctorMobileRoute = typeof doctorMobileRoutes[number]
export interface DoctorMobileIdentity { userId: string; sessionId: string; environment: 'local' }
export interface DoctorMobileSelection {doctorId:string;practiceId:string;locationId:string}
export interface DoctorMobileContext extends DoctorMobileIdentity {
  contractVersion: 1; product: 'doctor-suit'; dataMode: 'synthetic'
  doctorId: string; practiceId: string; locationId: string
  portal: 'doctor' | 'secretary'; grantsVersion: number; locationVersion: number
  capabilities: string[]
}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export function decodeDoctorMobileContext(raw: unknown, expected: DoctorMobileIdentity, selection: DoctorMobileSelection): DoctorMobileContext {
  const value = raw as DoctorMobileContext
  if (!value || value.contractVersion !== doctorMobileContractVersion || value.product !== 'doctor-suit' || value.dataMode !== 'synthetic' || value.environment !== 'local' || expected.environment !== 'local' ||
      value.doctorId !== selection.doctorId || value.practiceId !== selection.practiceId || value.locationId !== selection.locationId || value.userId !== expected.userId || value.sessionId !== expected.sessionId || ![value.userId, value.sessionId, value.doctorId, value.practiceId, value.locationId].every(uuid) ||
      !['doctor', 'secretary'].includes(value.portal) || !Number.isSafeInteger(value.grantsVersion) || value.grantsVersion < 1 || !Number.isSafeInteger(value.locationVersion) || value.locationVersion < 1 ||
      !Array.isArray(value.capabilities) || value.capabilities.length > 100 || value.capabilities.some(item => typeof item !== 'string' || !/^[a-z][a-z._]{1,79}$/.test(item)) || new Set(value.capabilities).size !== value.capabilities.length ||
      Object.keys(value).some(key => !['contractVersion','product','dataMode','environment','userId','sessionId','doctorId','practiceId','locationId','portal','grantsVersion','locationVersion','capabilities'].includes(key))) throw new Error('DOCTOR_MOBILE_CONTEXT_UNAVAILABLE')
  return {...value, capabilities: [...value.capabilities]}
}
