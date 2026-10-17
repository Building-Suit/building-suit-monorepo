<script setup lang="ts">
// OAuth callback is a presentation-only bridge; it never grants a shop or trial.
// The Supabase Auth session and the existing create_owner_shop RPC remain authoritative.
definePageMeta({ layout: false })

const route = useRoute()
const supabase = useSupabaseClient()
const { loadShops, currentId, loadError } = useShop()
const { locale } = useI18n()
const failed = ref(false)
const processing = ref(true)
const empty = ref('')
const ar = computed(() => locale.value === 'ar')

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  const invite = typeof route.query.invite === 'string'
    && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(route.query.invite)
    ? route.query.invite : null

  // Remove single-use credentials from browser history before exchanging them.
  window.history.replaceState(window.history.state, '', window.location.pathname)
  try {
    if (!code || route.query.error) throw new Error('OAuth response was not successful')
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email || !user.email_confirmed_at) throw new Error('Verified user missing')
    // Check the authenticated Supabase identity, never untrusted query parameters.
    const googleIdentity = user.identities?.find(identity => identity.provider === 'google')
    const googleClaims = googleIdentity?.identity_data
    const identityEmail = typeof googleClaims?.email === 'string' ? googleClaims.email.trim().toLowerCase() : ''
    if (!googleIdentity || identityEmail !== user.email.trim().toLowerCase()) throw new Error('Google identity missing')

    // The existing create_owner_shop RPC initializes profiles from display_name.
    // Google provides full_name/name, so copy that trusted OAuth claim only when
    // no display name is already defined. No Google provider token is stored.
    const googleName = [googleClaims?.full_name, googleClaims?.name]
      .find(value => typeof value === 'string' && value.trim()) as string | undefined
    if (googleName && !String(user.user_metadata?.display_name ?? '').trim()) {
      const { error: metadataError } = await supabase.auth.updateUser({ data: { display_name: googleName.trim() } })
      if (metadataError) throw metadataError
    }

    await nextTick()
    // A confirmed Google identity does NOT grant a shop or subscription.
    // Existing shop = dashboard; no shop = complete the normal signup wizard.
    await loadShops({ force: true })
    if (loadError.value) throw new Error('Shop lookup unavailable')
    const next = invite
      ? { path: '/auth/team-invitation', query: { invite } }
      : currentId.value ? '/dashboard' : '/auth/signup'
    await navigateTo(next, { replace: true })
  }
  catch {
    failed.value = true
  }
  finally {
    processing.value = false
  }
})
</script>

<template>
  <BsSignInPage
    v-model:email="empty"
    v-model:password="empty"
    :product="{ name: 'Shop Suit', presentation: 'glass', assetPrefix: '/brand/shop-suit', homeLabel: ar ? 'الرئيسية' : 'Home', title: 'Shop Suit', description: '' }"
    :copy="{ title: ar ? 'تسجيل الدخول' : 'Sign in', description: '', email: '', password: '', submit: '', pending: '' }"
    :availability="{ state: failed ? 'error' : 'loading', title: failed ? (ar ? 'تعذّر تسجيل الدخول باستخدام Google' : 'Google sign-in failed') : (ar ? 'بنكمّل تسجيل الدخول…' : 'Completing Google sign-in…'), description: failed ? (ar ? 'ارجع لتسجيل الدخول وحاول تاني، أو راجع إعدادات Google في Supabase.' : 'Return to sign-in and try again, or check the Google provider configuration.') : (ar ? 'جارٍ تأكيد الحساب وتحميل المتجر.' : 'Verifying your account and finding your shop.') }"
    :legal="[{ to: '/auth/login', label: ar ? 'الرجوع لتسجيل الدخول' : 'Back to sign in' }]"
    :pending="processing"
  />
</template>
