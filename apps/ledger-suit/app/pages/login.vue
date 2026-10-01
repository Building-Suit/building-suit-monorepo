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
  <BsAuthLayout :product-name="t('app.name')" :home-label="t('marketing.home')" :title="t('auth.welcomeTitle')" :description="t('auth.welcomeBody')">
    <template #logo="{ tone }"><BsProductLogo name="Ledger Suit" asset-prefix="/brand/ledger-suit" :tone="tone" class="h-auto w-56" /></template>
        <BsAuthForm
          :eyebrow="t('auth.welcomeEyebrow')" :title="t('auth.signIn')" :description="t('auth.subtitle')"
          :pending="pending" :error="error" :submit-label="t('auth.signIn')" :pending-label="t('auth.signingIn')"
          :data-hydrated="hydrated" @submit="signIn"
        >
          <FloatingField :label="t('auth.email')">
            <input id="email" v-model="email" type="email" autocomplete="email" required dir="ltr" class="ls-input">
          </FloatingField>
          <FloatingField :label="t('auth.password')">
            <input id="password" v-model="password" type="password" autocomplete="current-password" required dir="ltr" class="ls-input">
          </FloatingField>
          <template #footer>{{ t('auth.needAccount') }} <NuxtLink to="/signup" class="font-bold text-fg underline underline-offset-4">{{ t('landing.startTrial') }}</NuxtLink></template>
        </BsAuthForm>
        <nav class="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-fg-muted" :aria-label="t('auth.legalNavigation')">
          <NuxtLink to="/privacy" class="hover:text-fg">{{ t('marketing.privacy') }}</NuxtLink>
          <NuxtLink to="/contact" class="hover:text-fg">{{ t('marketing.contact') }}</NuxtLink>
        </nav>
  </BsAuthLayout>
</template>
