<script setup lang="ts">
const shopRequest = useShopRequest()
definePageMeta({ layout: false })

const supabase = useShopClient()
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
const rememberEmail = ref(false)
const pending = ref(false)
const passwordPending = ref(false)
const emailStepPending = ref(false)
const emailStepApproved = ref(false)
const emailStepError = ref<string | null>(null)
const passwordError = ref<string | null>(null)
const errorMessage = ref('')
const clientReady = ref(false)
const rememberKey = 'bs-shop-signin-remember-email'

onMounted(() => {
  // Only email is remembered. This does not change Supabase's session policy.
  try {
    const storedEmail = localStorage.getItem(rememberKey)
    if (storedEmail) {
      email.value = storedEmail
      rememberEmail.value = true
    }
  }
  catch { /* Storage may be disabled. Sign-in must continue to work. */ }
  clientReady.value = true
})

watch([email, rememberEmail], () => {
  if (!import.meta.client) return
  try {
    if (rememberEmail.value && email.value.trim()) localStorage.setItem(rememberKey, email.value.trim())
    else localStorage.removeItem(rememberKey)
  }
  catch { /* A storage quota/policy error must not block authentication. */ }
})

// The shop sign-in deliberately checks account registration in a server-only
// endpoint. This is a product decision: it exposes whether an address is
// registered, so the API must be throttled and its service-role key kept private.
const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

watch(email, () => {
  if (!emailStepApproved.value) emailStepError.value = null
})
watch(password, () => {
  // Editing the password removes stale feedback and the red outline.
  passwordError.value = null
})

async function validateEmailStep(value: string) {
  if (pending.value || emailStepPending.value) return
  emailStepError.value = null
  emailStepApproved.value = false
  errorMessage.value = ''
  passwordError.value = null

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    emailStepError.value = locale.value === 'ar'
      ? 'من فضلك اكتب بريدك الإلكتروني.'
      : 'Please enter your email address.'
    return
  }
  if (normalized.length > 254 || !emailFormat.test(normalized)) {
    emailStepError.value = locale.value === 'ar'
      ? 'من فضلك اكتب بريدًا إلكترونيًا صحيحًا.'
      : 'Please enter a valid email address.'
    return
  }

  emailStepPending.value = true
  try {
    const [result] = await Promise.all([
      shopRequest<{ canContinue: boolean }>('/api/auth/email-step', {
        method: 'POST',
        body: { email: normalized },
      }),
      // Long enough to make the spinner noticeable, not a simulated lookup.
      new Promise<void>(resolve => setTimeout(resolve, 320)),
    ])

    if (!result.canContinue) {
      emailStepError.value = locale.value === 'ar'
        ? 'هذا البريد الإلكتروني غير مسجل. راجع العنوان أو أنشئ حسابًا.'
        : 'No account found for this email. Check the address or create an account.'
      return
    }

    email.value = normalized
    emailStepApproved.value = true
  }
  catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined
    emailStepError.value = status === 429
      ? (locale.value === 'ar'
          ? 'محاولات كثيرة. حاول مرة أخرى بعد قليل.'
          : 'Too many attempts. Please try again later.')
      : (locale.value === 'ar'
          ? 'تعذّر التحقق من البريد حاليًا. حاول مرة أخرى.'
          : 'Unable to check the email right now. Please try again.')
  }
  finally {
    emailStepPending.value = false
  }
}

function editEmailStep() {
  emailStepApproved.value = false
  emailStepError.value = null
  errorMessage.value = ''
  passwordError.value = null
  password.value = ''
}

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

function isInvalidCredentials(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const authError = error as { code?: unknown; message?: unknown }
  const code = String(authError.code ?? '').toLowerCase()
  const message = String(authError.message ?? '').toLowerCase()
  return code === 'invalid_credentials' || message.includes('invalid login credentials')
}

async function onSubmit() {
  if (pending.value) return
  errorMessage.value = ''
  passwordError.value = null
  if (!email.value.trim()) {
    errorMessage.value = locale.value === 'ar'
      ? 'اكتب بريدك الإلكتروني أولاً.'
      : 'Enter your email address first.'
    return
  }
  if (!password.value) {
    passwordError.value = locale.value === 'ar'
      ? 'من فضلك اكتب كلمة المرور.'
      : 'Please enter your password.'
    return
  }

  pending.value = true
  passwordPending.value = true
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim().toLowerCase(),
      password: password.value,
    })
    if (error) throw error
    await nuxtApp.runWithContext(() => navigateTo(destination.value))
  }
  catch (error: unknown) {
    if (isInvalidCredentials(error)) {
      passwordError.value = locale.value === 'ar'
        ? 'كلمة المرور غير صحيحة. حاول مرة أخرى.'
        : 'Incorrect password. Please try again.'
    }
    else {
      // Network, email-confirmation and rate-limit errors remain form-level.
      errorMessage.value = normalizeAuthError(error instanceof Error ? error.message : undefined)
    }
  }
  finally {
    passwordPending.value = false
    pending.value = false
  }
}

async function onOAuth(provider: 'google') {
  if (pending.value || !import.meta.client) return
  errorMessage.value = ''
  passwordError.value = null
  pending.value = true
  try {
    // OAuth is an opt-in Supabase provider feature. Enable the corresponding
    // provider + redirect URL in Shop Suit's Supabase Auth settings first.
    const callback = new URL('/auth/google-callback', window.location.origin)
    if (typeof route.query.invite === 'string' && destination.value.startsWith('/auth/team-invitation')) {
      callback.searchParams.set('invite', route.query.invite)
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString(), scopes: 'openid email profile' },
    })
    if (error) throw error
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
    if (!pending.value && import.meta.client && window.location.pathname === '/auth/login') {
      await nuxtApp.runWithContext(() => navigateTo(destination.value))
    }
  }
})
</script>

<template>
  <BsSignInPage
    v-model:email="email"
    v-model:password="password"
    v-model:remember-email="rememberEmail"
    :product="{ name: 'Shop Suit', presentation: 'glass', assetPrefix: '/brand/shop-suit', homeLabel: locale === 'ar' ? 'الرئيسية' : 'Home', title: `${t('hero.title')} ${t('hero.subtitle')}`, description: t('hero.description') }"
    :copy="{
      eyebrow: 'Shop Suit',
      title: t('auth.loginTitle'),
      description: locale === 'ar' ? 'اكتب بياناتك لتسجيل الدخول.' : 'Please enter your details to sign in.',
      email: t('auth.email'),
      password: t('auth.password'),
      submit: t('auth.loginAction'),
      pending: locale === 'ar' ? 'جارٍ تسجيل الدخول…' : 'Signing in…',
      continue: locale === 'ar' ? 'التالي' : 'Continue',
      back: locale === 'ar' ? 'تعديل' : 'Edit',
      checkingEmail: locale === 'ar' ? 'جارٍ التحقق من البريد الإلكتروني' : 'Validating email',
      remember: locale === 'ar' ? 'تذكرني' : 'Remember me',
      or: locale === 'ar' ? 'أو' : 'OR',
      google: locale === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google',
      accountPrompt: t('auth.noAccount'),
      signup: t('auth.signupAction'),
    }"
    signup-to="/auth/signup"
    :forgot="{ to: '/auth/forgot-password', label: t('auth.forgotPassword') }"
    :oauth-providers="['google']"
    :pending="pending"
    :password-pending="passwordPending"
    :password-error="passwordError"
    :email-step-required="true"
    :email-step-pending="emailStepPending"
    :email-step-approved="emailStepApproved"
    :email-step-error="emailStepError"
    :error="errorMessage"
    :hydrated="clientReady"
    @submit="onSubmit"
    @validate-email="validateEmailStep"
    @edit-email="editEmailStep"
    @oauth="onOAuth"
  />
</template>
