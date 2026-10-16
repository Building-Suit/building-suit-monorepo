export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useDoctorAuth()
  if (!await auth.refresh()) return navigateTo({ path: '/sign-in', query: { next: to.path } })
})
