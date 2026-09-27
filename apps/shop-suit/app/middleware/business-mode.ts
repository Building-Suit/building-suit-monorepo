import { businessAreaForPath, businessModeSupportsPath } from '~/utils/businessMode'

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  if (!user.value) return

  const { current, loadShops } = useShop()
  await loadShops()
  if (!current.value || businessModeSupportsPath(current.value.business_mode, to.path)) return

  return navigateTo({
    path: '/dashboard',
    query: { modeDisabled: businessAreaForPath(to.path) ?? undefined },
  })
})
