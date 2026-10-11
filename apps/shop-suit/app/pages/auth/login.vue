<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const user = useSupabaseUser()
const route = useRoute()
const destination = computed(() => typeof route.query.invite === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(route.query.invite)
  ? `/auth/team-invitation?invite=${route.query.invite}` : '/dashboard')
const { t, locale } = useI18n()

useHead({
  title: () => `${t('auth.loginTitle')} · Shop Suit`,
})

const email = ref('')
const password = ref('')
const pending = ref(false)
const errorMessage = ref('')
const clientReady = ref(false)

onMounted(() => {
  clientReady.value = true
})

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

    await nuxtApp.runWithContext(() => navigateTo(destination.value))
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
      await nuxtApp.runWithContext(() => navigateTo(destination.value))
    }
  }
})
</script>

<template>
  <BsAuthForm eyebrow="Shop Suit" :title="t('auth.loginTitle')" :description="t('auth.loginSubtitle')" :pending="pending" :error="errorMessage" :submit-label="t('auth.loginAction')" :pending-label="t('auth.loginAction')" :data-client-ready="clientReady ? 'true' : 'false'" @submit="onSubmit">
    <BsField :label="t('auth.email')" required>
      <template #default="field">
        <BsInput :id="field.id" v-model="email" type="email" autocomplete="email" required dir="ltr"/>
      </template>
    </BsField>
    <BsField :label="t('auth.password')" required>
      <template #default="field">
        <BsInput :id="field.id" v-model="password" type="password" autocomplete="current-password" required dir="ltr"/>
      </template>
    </BsField>
    <BsLink to="/auth/forgot-password" variant="muted">{{ t('auth.forgotPassword') }}</BsLink>
    <template #footer>{{ t('auth.noAccount') }} <BsLink to="/auth/signup" variant="standalone">{{ t('auth.signupAction') }}</BsLink>
    </template>
  </BsAuthForm>
</template>
