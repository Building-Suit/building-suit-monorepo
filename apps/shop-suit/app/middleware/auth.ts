export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  if (!user.value) {
    if (to.path === '/team' && typeof to.query.invite === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(to.query.invite)) {
      return navigateTo({ path: '/auth/team-invitation', query: { invite: to.query.invite } })
    }
    return navigateTo('/auth/login')
  }
})
