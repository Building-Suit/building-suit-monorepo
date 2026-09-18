<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const nuxtApp = useNuxtApp()
const { t, locale } = useI18n()

useHead({
  title: () => `${t('auth.signupTitle')} · Shop Suit`,
})

const displayName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const pending = ref(false)
const created = ref(false)
const errorMessage = ref('')

const successTitle = computed(() =>
  locale.value === 'ar' ? 'تم إنشاء حسابك' : 'Your account was created',
)

const successBody = computed(() =>
  locale.value === 'ar'
    ? 'لو تأكيد البريد الإلكتروني مفعّل في Supabase، افتح رسالة التأكيد أولاً ثم سجّل الدخول.'
    : 'If email confirmation is enabled in Supabase, confirm your email first, then sign in.',
)

function normalizeAuthError(message?: string) {
  if (!message) {
    return locale.value === 'ar'
      ? 'تعذّر إنشاء الحساب. حاول مرة أخرى.'
      : 'Unable to create the account. Try again.'
  }

  const value = message.toLowerCase()

  if (value.includes('already registered') || value.includes('already been registered')) {
    return locale.value === 'ar'
      ? 'يوجد حساب مسجّل بهذا البريد الإلكتروني بالفعل.'
      : 'An account already exists for this email.'
  }

  if (value.includes('password')) {
    return locale.value === 'ar'
      ? 'كلمة المرور لا تستوفي متطلبات الأمان.'
      : 'The password does not meet the security requirements.'
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

  if (!displayName.value.trim() || !email.value.trim() || password.value.length < 6) {
    errorMessage.value = locale.value === 'ar'
      ? 'اكتب الاسم والبريد الإلكتروني وكلمة مرور من 6 أحرف على الأقل.'
      : 'Enter your name, email, and a password with at least 6 characters.'
    return
  }

  pending.value = true

  try {
    const redirectTo = import.meta.client ? `${window.location.origin}/` : undefined

    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim().toLowerCase(),
      password: password.value,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          display_name: displayName.value.trim(),
          portal_key: 'shop_suit',
        },
      },
    })

    if (error) throw error

    // The authenticated shop-setup RPC creates the shop_crm profile on first use.
    if (data.session) {
      await nuxtApp.runWithContext(() => navigateTo('/dashboard'))
      return
    }

    created.value = true
  }
  catch (error: any) {
    errorMessage.value = normalizeAuthError(error?.message)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="space-y-8">
    <div class="space-y-2">
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#a86c1c]">
        Shop Suit
      </p>
      <h1 class="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {{ t('auth.signupTitle') }}
      </h1>
      <p class="max-w-md text-sm leading-6 text-muted-foreground">
        {{ t('auth.signupSubtitle') }}
      </p>
    </div>

    <div
      v-if="created"
      class="rounded-2xl border border-[var(--bs-success)]/30 bg-[var(--bs-success-bg)] p-5 dark:bg-[var(--bs-success-bg-dark)]"
    >
      <div class="mb-4 grid size-10 place-items-center rounded-xl bg-[var(--bs-success)]/15 text-[var(--bs-success)]">
        <Icon name="lucide:mail-check" class="size-5" />
      </div>
      <h2 class="font-bold text-foreground">{{ successTitle }}</h2>
      <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ successBody }}</p>
      <NuxtLink
        to="/auth/login"
        class="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#141416] px-5 text-sm font-bold text-white dark:bg-[#d89b42] dark:text-[#0b0b0d]"
      >
        {{ t('auth.loginAction') }}
      </NuxtLink>
    </div>

    <form v-else class="space-y-5" novalidate @submit.prevent="onSubmit">
      <div
        v-if="errorMessage"
        class="rounded-xl border border-[var(--bs-error)]/30 bg-[var(--bs-error-bg)] px-4 py-3 text-sm text-[var(--bs-error-fg)] dark:bg-[var(--bs-error-bg-dark)] dark:text-[var(--bs-error-dark)]"
        role="alert"
      >
        {{ errorMessage }}
      </div>

      <div class="space-y-2">
        <label for="signup-name" class="text-sm font-semibold">
          {{ t('auth.displayName') }}
        </label>
        <div class="relative">
          <Icon name="lucide:user-round" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="signup-name"
            v-model="displayName"
            type="text"
            autocomplete="name"
            required
            class="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-4 text-sm outline-none transition focus:border-[#d89b42] focus:ring-2 focus:ring-[#d89b42]/20"
            :placeholder="t('auth.displayNamePlaceholder')"
          >
        </div>
      </div>

      <div class="space-y-2">
        <label for="signup-email" class="text-sm font-semibold">
          {{ t('auth.email') }}
        </label>
        <div class="relative">
          <Icon name="lucide:mail" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="signup-email"
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
        <label for="signup-password" class="text-sm font-semibold">
          {{ t('auth.password') }}
        </label>
        <div class="relative">
          <Icon name="lucide:lock-keyhole" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="signup-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            minlength="6"
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
        <p class="text-xs text-muted-foreground">
          {{ t('auth.passwordHint') }}
        </p>
      </div>

      <button
        type="submit"
        class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#141416] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#27272a] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#d89b42] dark:text-[#0b0b0d] dark:hover:bg-[#ebb45a]"
        :disabled="pending"
      >
        <Icon v-if="pending" name="svg-spinners:180-ring" class="size-4" />
        {{ t('auth.signupAction') }}
      </button>
    </form>

    <p v-if="!created" class="text-center text-sm text-muted-foreground">
      {{ t('auth.haveAccount') }}
      <NuxtLink to="/auth/login" class="font-bold text-foreground underline decoration-[#d89b42] decoration-2 underline-offset-4">
        {{ t('auth.loginAction') }}
      </NuxtLink>
    </p>
  </section>
</template>
