import type {createNativeContext} from '../utils/nativeContext'
export function useDoctorNativeContext() {
  const context = useNuxtApp().$doctorNativeContext
  if (!context) throw new Error('Native context unavailable')
  return context as ReturnType<typeof createNativeContext>
}
