export default defineNuxtPlugin({
  name: 'shop-session-loss',
  enforce: 'post',
  setup(nuxtApp) {
    const client = useSupabaseClient()
    const user = useSupabaseUser()
    const shop = useShop()
    const route = useRoute()
    const confirmation = useConfirmation()
    const { toasts } = useToasts()

    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      // Supabase emits SIGNED_OUT after permanent refresh rejection once the
      // JWT expires, including provider-native single-session enforcement.
      if (event !== 'SIGNED_OUT') return
      nuxtApp.runWithContext(() => {
        shop.resetSession()
        clearNuxtData(key => key.startsWith('shop-data:') || key.startsWith('platform-admin:'))
        user.value = null
        while (confirmation.current.value) confirmation.answer(false)
        toasts.value = []
        try { sessionStorage.removeItem('shop-suit.pending-onboarding') }
        catch { /* Storage restrictions must not prevent session-loss navigation. */ }
      })
      // Never await navigation/Auth operations inside the provider's locked callback.
      setTimeout(() => {
        if (!user.value && !route.path.startsWith('/auth/') && route.path !== '/') {
          void nuxtApp.runWithContext(() => navigateTo('/auth/login', { replace: true }))
        }
      }, 0)
    })
    nuxtApp.vueApp.onUnmount(() => subscription.unsubscribe())
  },
})
