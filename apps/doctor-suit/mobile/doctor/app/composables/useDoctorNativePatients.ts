import type {createNativePatients} from '../utils/nativePatients'
export function useDoctorNativePatients() {
  const patients = useNuxtApp().$doctorNativePatients
  if (!patients) throw new Error('Native patients unavailable')
  return patients as ReturnType<typeof createNativePatients>
}
