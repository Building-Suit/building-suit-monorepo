import {createDoctorMobileShell} from '../utils/mobileShell'
export function useDoctorMobile() {
  const app=useNuxtApp()
  if (!app.$doctorMobile) throw new Error('Doctor mobile shell unavailable')
  return app.$doctorMobile as ReturnType<typeof createDoctorMobileShell>
}
