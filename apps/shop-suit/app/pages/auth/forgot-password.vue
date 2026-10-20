<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useShopClient()
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
  <BsPasswordRecoveryPage
    v-model:email="email" mode="request"
    :copy="{ eyebrow: 'Shop Suit', title: t('auth.forgotTitle'), description: t('auth.forgotSubtitle'), submit: t('auth.resetAction'), pending: t('auth.resetAction'), success: t('auth.resetSent'), successDescription: isArabic ? 'لو البريد مسجّل عندنا، هتوصلك رسالة فيها رابط آمن لتغيير كلمة المرور.' : 'If the address is registered, you will receive a secure link to choose a new password.', email: t('auth.email'), emailPlaceholder: t('auth.emailPlaceholder'), back: t('auth.backToLogin') }"
    :pending="pending" :error="errorMessage" :complete="sent" back-to="/auth/login" @submit="onSubmit"
  />
</template>
