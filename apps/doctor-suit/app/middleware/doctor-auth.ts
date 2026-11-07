import { doctorReturnPath } from '../utils/authConfiguration'
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useDoctorAuth()
  if (!await auth.refresh()) return navigateTo({ path: '/sign-in', query: { next: doctorReturnPath(to.fullPath) } })
})
