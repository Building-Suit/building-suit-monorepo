import type { DoctorRegistrationDraft } from '../utils/registrationDraft'
/** Client-filled, request/app-scoped fallback when sessionStorage is denied. Never authority. */
export function useDoctorRegistrationHandoff() {
  const environment = useRuntimeConfig().public.doctorAuth.environment
  return useState<DoctorRegistrationDraft | null>(`doctor-${environment}-registration-handoff`, () => null)
}
