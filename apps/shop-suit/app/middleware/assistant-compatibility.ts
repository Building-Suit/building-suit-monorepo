export default defineNuxtRouteMiddleware(() => {
  const config = useRuntimeConfig()
  if (config.public.shopAssistantMode === 'hq' && String(config.public.shopAssistantEnabled) === 'true') {
    return navigateTo({ path: '/dashboard', query: { assistant: 'open' } }, { replace: true })
  }
})
