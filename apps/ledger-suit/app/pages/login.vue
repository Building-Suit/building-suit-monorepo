<script setup lang="ts">
// No layout: the app shell assumes a signed-in user with an organization.
definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
useHead({ title: () => `${t('auth.signIn')} · ${t('app.name')}` })

const supabase = useSupabaseClient()
const { restore } = useTheme()

const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref<string | null>(null)
const hydrated = ref(false)

function isUnconfirmedEmail(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const authError = error as Record<string, unknown>
  return [authError.message, authError.code, authError.error_code]
    .some(value => String(value ?? '').toLowerCase().includes('email_not_confirmed') || String(value ?? '').toLowerCase().includes('email not confirmed'))
}

onMounted(() => {
  restore()
  hydrated.value = true
})

async function signIn() {
  pending.value = true
  error.value = null

  const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })

  pending.value = false
  // Deliberately generic: the form must not reveal whether an address exists.
  if (isUnconfirmedEmail(signInError)) {
    // This route is only reached after a successful password check. Sending a
    // fresh code gives the account holder an immediate way to finish signup.
    await supabase.auth.resend({ type: 'signup', email: email.value.trim().toLowerCase() })
    await navigateTo({ path: '/verify-email', query: { email: email.value.trim().toLowerCase() } })
  }
  else if (signInError) error.value = t('auth.failed')
  else await navigateTo(route.query.operator === '1' ? '/platform-admin' : '/dashboard')
}
</script>

<template>
  <BsSignInPage
    v-model:email="email" v-model:password="password"
    :product="{ name: t('app.name'), assetPrefix: '/brand/ledger-suit', homeLabel: t('marketing.home'), title: t('auth.welcomeTitle'), description: t('auth.welcomeBody') }"
    :copy="{ eyebrow: t('auth.welcomeEyebrow'), title: t('auth.signIn'), description: t('auth.subtitle'), email: t('auth.email'), password: t('auth.password'), submit: t('auth.signIn'), pending: t('auth.signingIn'), accountPrompt: t('auth.needAccount'), signup: t('landing.startTrial') }"
    signup-to="/signup" :legal="[{ to: '/privacy', label: t('marketing.privacy') }, { to: '/contact', label: t('marketing.contact') }]"
    :pending="pending" :error="error" :hydrated="hydrated" @submit="signIn"
  />
</template>
