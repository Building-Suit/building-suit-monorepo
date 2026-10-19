<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useShopClient()
const user = useSupabaseUser()
const { locale } = useI18n()
const password = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const done = ref(false)
const errorMessage = ref('')
const isArabic = computed(() => locale.value === 'ar')

useHead({ title: () => `${isArabic.value ? 'كلمة مرور جديدة' : 'New password'} · Shop Suit` })

async function onSubmit() {
  if (pending.value) return
  errorMessage.value = ''
  if (password.value.length < 6) {
    errorMessage.value = isArabic.value ? 'كلمة المرور لازم تكون 6 أحرف على الأقل.' : 'Password must contain at least 6 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = isArabic.value ? 'كلمتا المرور غير متطابقتين.' : 'The passwords do not match.'
    return
  }

  pending.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) throw error
    done.value = true
  }
  catch (error: unknown) {
    errorMessage.value = (error instanceof Error ? error.message : undefined) || (isArabic.value ? 'تعذّر تغيير كلمة المرور. افتح رابط الاستعادة مرة أخرى.' : 'Unable to update the password. Open the recovery link again.')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <BsPasswordRecoveryPage
    v-model:password="password" v-model:confirmation="confirmPassword" mode="reset"
    :copy="{ eyebrow: 'Shop Suit', title: isArabic ? 'اختار كلمة مرور جديدة' : 'Choose a new password', description: isArabic ? 'اكتب كلمة المرور الجديدة مرتين للتأكيد.' : 'Enter the new password twice to confirm it.', submit: isArabic ? 'حفظ كلمة المرور' : 'Save password', pending: isArabic ? 'جارٍ الحفظ…' : 'Saving…', success: isArabic ? 'تم تغيير كلمة المرور' : 'Password updated', successAction: isArabic ? 'فتح Shop Suit' : 'Open Shop Suit', invalid: isArabic ? 'رابط الاستعادة غير صالح أو انتهت صلاحيته.' : 'The recovery link is invalid or expired.', invalidAction: isArabic ? 'اطلب رابط جديد' : 'Request a new link', password: isArabic ? 'كلمة المرور الجديدة' : 'New password', confirmation: isArabic ? 'تأكيد كلمة المرور' : 'Confirm password', reveal: isArabic ? 'إظهار أو إخفاء كلمة المرور' : 'Show or hide password' }"
    :pending="pending" :error="errorMessage" :complete="done" :valid="Boolean(user)" @submit="onSubmit" @success-action="navigateTo('/dashboard')" @invalid-action="navigateTo('/auth/forgot-password')"
  />
</template>
