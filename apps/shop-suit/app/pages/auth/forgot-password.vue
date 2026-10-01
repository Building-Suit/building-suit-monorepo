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
  catch (error: unknown) {
    errorMessage.value = (error instanceof Error ? error.message : undefined) || (isArabic.value ? 'تعذّر إرسال رسالة إعادة التعيين. حاول مرة أخرى.' : 'Unable to send the password-reset email. Try again.')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <BsAuthForm
    eyebrow="Shop Suit" :title="t('auth.forgotTitle')" :description="t('auth.forgotSubtitle')"
    :pending="pending" :error="errorMessage" :submit-label="sent ? undefined : t('auth.resetAction')"
    :pending-label="t('auth.resetAction')" novalidate @submit="onSubmit"
  >
    <BsStateSurface
      v-if="sent" state="success" :title="t('auth.resetSent')"
      :description="isArabic ? 'لو البريد مسجّل عندنا، هتوصلك رسالة فيها رابط آمن لتغيير كلمة المرور.' : 'If the address is registered, you will receive a secure link to choose a new password.'"
    />
    <template v-else>
      <div class="space-y-2">
        <label for="reset-email" class="text-sm font-semibold">{{ t('auth.email') }}</label>
        <div class="relative">
          <AppIcon name="mail" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="reset-email" v-model="email" type="email" autocomplete="email" required class="ls-input" :placeholder="t('auth.emailPlaceholder')">
        </div>
      </div>
    </template>
    <template #footer><NuxtLink to="/auth/login" class="font-bold text-foreground underline decoration-[var(--bs-accent)] decoration-2 underline-offset-4">{{ t('auth.backToLogin') }}</NuxtLink></template>
  </BsAuthForm>
</template>
