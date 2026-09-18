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
const showPassword = ref(false)
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
  catch (error: any) {
    errorMessage.value = normalizeAuthError(error?.message)
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
  <section class="space-y-8">
    <div class="space-y-2">
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#a86c1c]">
        Shop Suit
      </p>
      <h1 class="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {{ t('auth.loginTitle') }}
      </h1>
      <p class="max-w-md text-sm leading-6 text-muted-foreground">
        {{ t('auth.loginSubtitle') }}
      </p>
    </div>

    <form class="space-y-5" novalidate @submit.prevent="onSubmit">
      <div
        v-if="errorMessage"
        class="rounded-xl border border-[var(--bs-error)]/30 bg-[var(--bs-error-bg)] px-4 py-3 text-sm text-[var(--bs-error-fg)] dark:bg-[var(--bs-error-bg-dark)] dark:text-[var(--bs-error-dark)]"
        role="alert"
      >
        {{ errorMessage }}
      </div>

      <div class="space-y-2">
        <label for="login-email" class="text-sm font-semibold">
          {{ t('auth.email') }}
        </label>
        <div class="relative">
          <Icon name="lucide:mail" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-4 text-sm outline-none transition focus:border-[#d89b42] focus:ring-2 focus:ring-[#d89b42]/20"
            :placeholder="t('auth.emailPlaceholder')"
          >
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <label for="login-password" class="text-sm font-semibold">
            {{ t('auth.password') }}
          </label>
          <NuxtLink
            to="/auth/forgot-password"
            class="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            {{ t('auth.forgotPassword') }}
          </NuxtLink>
        </div>

        <div class="relative">
          <Icon name="lucide:lock-keyhole" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="login-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
            class="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-12 text-sm outline-none transition focus:border-[#d89b42] focus:ring-2 focus:ring-[#d89b42]/20"
            :placeholder="t('auth.passwordPlaceholder')"
          >
          <button
            type="button"
            class="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" />
          </button>
        </div>
      </div>

      <button
        type="submit"
        class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#141416] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#27272a] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d89b42] dark:text-[#0b0b0d] dark:hover:bg-[#ebb45a]"
        :disabled="pending"
      >
        <Icon v-if="pending" name="svg-spinners:180-ring" class="size-4" />
        {{ t('auth.loginAction') }}
      </button>
    </form>

    <div class="flex items-center gap-4">
      <div class="h-px flex-1 bg-border" />
      <span class="text-xs text-muted-foreground">Building Suit</span>
      <div class="h-px flex-1 bg-border" />
    </div>

    <p class="text-center text-sm text-muted-foreground">
      {{ t('auth.noAccount') }}
      <NuxtLink to="/auth/signup" class="font-bold text-foreground underline decoration-[#d89b42] decoration-2 underline-offset-4">
        {{ t('auth.signupAction') }}
      </NuxtLink>
    </p>
  </section>
</template>
