<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const { t, locale } = useI18n()

useHead({
  title: () => `${t('auth.loginTitle')} · Shop Suit`,
})

const email = ref('')
const password = ref('')
const pending = ref(false)
const errorMessage = ref('')

function localizedFallback() {
  return locale.value === 'ar'
    ? 'تعذّر تسجيل الدخول. راجع البريد الإلكتروني وكلمة المرور وحاول مرة أخرى.'
    : 'Unable to sign in. Check your email and password and try again.'
}

function normalizeAuthError(message?: string) {
  if (!message) return localizedFallback()

  const value = message.toLowerCase()

  if (value.includes('invalid login credentials')) {
    return locale.value === 'ar'
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
      : 'The email or password is incorrect.'
  }

  if (value.includes('email not confirmed')) {
    return locale.value === 'ar'
      ? 'يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول.'
      : 'Confirm your email before signing in.'
  }

  if (value.includes('rate limit')) {
    return locale.value === 'ar'
      ? 'تمت محاولات كثيرة في وقت قصير. حاول مرة أخرى بعد قليل.'
      : 'Too many attempts. Try again shortly.'
  }

  return message
}

async function onSubmit() {
  if (pending.value) return

  errorMessage.value = ''

  if (!email.value.trim() || !password.value) {
    errorMessage.value = locale.value === 'ar'
      ? 'اكتب البريد الإلكتروني وكلمة المرور.'
      : 'Enter your email and password.'
    return
  }

  pending.value = true

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim().toLowerCase(),
      password: password.value,
    })

    if (error) throw error

    await nuxtApp.runWithContext(() => navigateTo('/dashboard'))
  }
  catch (error: unknown) {
    errorMessage.value = normalizeAuthError(error instanceof Error ? error.message : undefined)
  }
  finally {
    pending.value = false
  }
}

watchEffect(async () => {
  if (user.value) {
    // Do not force-navigation while a submit is executing.
    if (!pending.value && import.meta.client && window.location.pathname === '/auth/login') {
      await nuxtApp.runWithContext(() => navigateTo('/dashboard'))
    }
  }
})
</script>

<template>
  <form class="ls-auth-card w-full space-y-5 p-6 text-start sm:p-8" @submit.prevent="onSubmit">
    <div class="text-center"><p class="ls-auth-eyebrow">Shop Suit</p><h1 class="mt-2 text-xl font-extrabold tracking-[-.03em]">{{ t('auth.loginTitle') }}</h1><p class="mt-2 text-sm text-fg-muted">{{ t('auth.loginSubtitle') }}</p></div>
    <FloatingField :label="t('auth.email')"><InputText id="login-email" v-model="email" type="email" autocomplete="email" required dir="ltr" class="ls-input" /></FloatingField>
    <FloatingField :label="t('auth.password')"><InputText id="login-password" v-model="password" type="password" autocomplete="current-password" required dir="ltr" class="ls-input" /></FloatingField>
    <NuxtLink to="/auth/forgot-password" class="text-xs text-fg-muted underline">{{ t('auth.forgotPassword') }}</NuxtLink>
    <p v-if="errorMessage" role="alert" class="ls-error">{{ errorMessage }}</p>
    <button type="submit" :disabled="pending" class="ls-btn ls-btn-primary w-full">{{ t('auth.loginAction') }}</button>
    <p class="text-center text-sm text-fg-muted">{{ t('auth.noAccount') }} <NuxtLink to="/auth/signup" class="font-bold text-fg underline underline-offset-4">{{ t('auth.signupAction') }}</NuxtLink></p>
  </form>
</template>
