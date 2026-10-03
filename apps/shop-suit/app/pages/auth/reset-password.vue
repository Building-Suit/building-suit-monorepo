<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { locale } = useI18n()
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
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
  <BsAuthForm
    eyebrow="Shop Suit" :title="isArabic ? 'اختار كلمة مرور جديدة' : 'Choose a new password'"
    :description="isArabic ? 'اكتب كلمة المرور الجديدة مرتين للتأكيد.' : 'Enter the new password twice to confirm it.'"
    :pending="pending" :error="errorMessage" :submit-label="done || !user ? undefined : (isArabic ? 'حفظ كلمة المرور' : 'Save password')"
    :pending-label="isArabic ? 'جارٍ الحفظ…' : 'Saving…'" @submit="onSubmit"
  >
    <BsStateSurface v-if="done" state="success" :title="isArabic ? 'تم تغيير كلمة المرور' : 'Password updated'" :action-label="isArabic ? 'فتح Shop Suit' : 'Open Shop Suit'" @action="navigateTo('/dashboard')" />
    <BsStateSurface v-else-if="!user" state="error" :title="isArabic ? 'رابط الاستعادة غير صالح أو انتهت صلاحيته.' : 'The recovery link is invalid or expired.'" :action-label="isArabic ? 'اطلب رابط جديد' : 'Request a new link'" @action="navigateTo('/auth/forgot-password')" />
    <template v-else>
      <BsField :label="isArabic ? 'كلمة المرور الجديدة' : 'New password'"><template #default="field"><BsInput v-model="password" :id="field.id" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" /></template></BsField>
      <BsButton type="button" variant="link" :aria-label="isArabic ? 'إظهار أو إخفاء كلمة المرور' : 'Show or hide password'" @click="showPassword = !showPassword"><BsIcon :name="showPassword ? 'eyeOff' : 'eye'" />{{ isArabic ? 'إظهار أو إخفاء كلمة المرور' : 'Show or hide password' }}</BsButton>
      <BsField :label="isArabic ? 'تأكيد كلمة المرور' : 'Confirm password'"><template #default="field"><BsInput v-model="confirmPassword" :id="field.id" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" /></template></BsField>
    </template>
  </BsAuthForm>
</template>
