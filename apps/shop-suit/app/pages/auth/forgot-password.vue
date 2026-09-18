<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const { t, locale } = useI18n()
const email = ref('')
const pending = ref(false)
const sent = ref(false)
const errorMessage = ref('')
const isArabic = computed(() => locale.value === 'ar')

useHead({ title: () => `${t('auth.forgotTitle')} · Shop Suit` })

async function onSubmit() {
  if (pending.value) return
  errorMessage.value = ''
  if (!email.value.trim()) {
    errorMessage.value = isArabic.value ? 'اكتب البريد الإلكتروني أولاً.' : 'Enter your email address first.'
    return
  }

  pending.value = true
  try {
    const redirectTo = import.meta.client ? `${window.location.origin}/auth/reset-password` : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim().toLowerCase(), { redirectTo })
    if (error) throw error
    sent.value = true
  }
  catch (error: any) {
    errorMessage.value = error?.message || (isArabic.value ? 'تعذّر إرسال رسالة إعادة التعيين. حاول مرة أخرى.' : 'Unable to send the password-reset email. Try again.')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="space-y-8">
    <div class="space-y-2">
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#a86c1c]">Shop Suit</p>
      <h1 class="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{{ t('auth.forgotTitle') }}</h1>
      <p class="max-w-md text-sm leading-6 text-muted-foreground">{{ t('auth.forgotSubtitle') }}</p>
    </div>

    <div v-if="sent" class="rounded-2xl border border-[var(--bs-success)]/30 bg-[var(--bs-success-bg)] p-5 dark:bg-[var(--bs-success-bg-dark)]" role="status">
      <div class="mb-4 grid size-10 place-items-center rounded-xl bg-[var(--bs-success)]/15 text-[var(--bs-success)]"><Icon name="lucide:mail-check" class="size-5" /></div>
      <p class="font-bold text-foreground">{{ t('auth.resetSent') }}</p>
      <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ isArabic ? 'لو البريد مسجّل عندنا، هتوصلك رسالة فيها رابط آمن لتغيير كلمة المرور.' : 'If the address is registered, you will receive a secure link to choose a new password.' }}</p>
    </div>

    <form v-else class="space-y-5" novalidate @submit.prevent="onSubmit">
      <div v-if="errorMessage" class="rounded-xl border border-[var(--bs-error)]/30 bg-[var(--bs-error-bg)] px-4 py-3 text-sm text-[var(--bs-error-fg)] dark:bg-[var(--bs-error-bg-dark)] dark:text-[var(--bs-error-dark)]" role="alert">{{ errorMessage }}</div>

      <div class="space-y-2">
        <label for="reset-email" class="text-sm font-semibold">{{ t('auth.email') }}</label>
        <div class="relative">
          <Icon name="lucide:mail" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="reset-email" v-model="email" type="email" autocomplete="email" required class="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-4 text-sm outline-none transition focus:border-[#d89b42] focus:ring-2 focus:ring-[#d89b42]/20" :placeholder="t('auth.emailPlaceholder')">
        </div>
      </div>

      <button type="submit" class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#141416] px-5 text-sm font-bold text-white transition hover:bg-[#27272a] disabled:opacity-60 dark:bg-[#d89b42] dark:text-[#0b0b0d] dark:hover:bg-[#ebb45a]" :disabled="pending">
        <Icon v-if="pending" name="svg-spinners:180-ring" class="size-4" />
        {{ t('auth.resetAction') }}
      </button>
    </form>

    <p class="text-center text-sm"><NuxtLink to="/auth/login" class="font-bold text-foreground underline decoration-[#d89b42] decoration-2 underline-offset-4">{{ t('auth.backToLogin') }}</NuxtLink></p>
  </section>
</template>
