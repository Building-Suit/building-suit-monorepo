<script setup lang="ts">
// No layout: the app shell assumes a signed-in user with an organization.
definePageMeta({ layout: false })

const { t } = useI18n()
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
  else await navigateTo('/dashboard')
}
</script>

<template>
  <BsAuthLayout :product-name="t('app.name')" :home-label="t('marketing.home')" :title="t('auth.welcomeTitle')" :description="t('auth.welcomeBody')">
    <template #logo="{ tone }"><AppLogo :tone="tone" class="h-auto w-56" /></template>
        <form class="ls-auth-card w-full space-y-5 p-6 text-start sm:p-8" :data-hydrated="hydrated" @submit.prevent="signIn">
          <div class="text-center">
            <p class="ls-auth-eyebrow">{{ t('auth.welcomeEyebrow') }}</p>
            <h1 class="mt-2 text-xl font-extrabold tracking-[-.03em]" dir="ltr">{{ t('auth.signIn') }}</h1>
            <p class="mt-2 text-sm text-fg-muted">{{ t('auth.subtitle') }}</p>
          </div>
          <FloatingField :label="t('auth.email')">
            <input id="email" v-model="email" type="email" autocomplete="email" required dir="ltr" class="ls-input">
          </FloatingField>
          <FloatingField :label="t('auth.password')">
            <input id="password" v-model="password" type="password" autocomplete="current-password" required dir="ltr" class="ls-input">
          </FloatingField>
          <p v-if="error" role="alert" class="ls-error">{{ error }}</p>
          <button type="submit" :disabled="pending" class="ls-btn ls-btn-primary w-full">{{ pending ? t('auth.signingIn') : t('auth.signIn') }}</button>
          <p class="text-center text-sm text-fg-muted">{{ t('auth.needAccount') }} <NuxtLink to="/signup" class="font-bold text-fg underline underline-offset-4">{{ t('landing.startTrial') }}</NuxtLink></p>
        </form>
        <nav class="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-fg-muted" :aria-label="t('auth.legalNavigation')">
          <NuxtLink to="/privacy" class="hover:text-fg">{{ t('marketing.privacy') }}</NuxtLink>
          <NuxtLink to="/contact" class="hover:text-fg">{{ t('marketing.contact') }}</NuxtLink>
        </nav>
  </BsAuthLayout>
</template>
