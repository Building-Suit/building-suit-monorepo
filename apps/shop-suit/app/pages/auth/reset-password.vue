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
  <section class="space-y-8">
    <div class="space-y-2">
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bs-link)]">Shop Suit</p>
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ isArabic ? 'اختار كلمة مرور جديدة' : 'Choose a new password' }}</h1>
      <p class="text-sm leading-6 text-muted-foreground">{{ isArabic ? 'اكتب كلمة المرور الجديدة مرتين للتأكيد.' : 'Enter the new password twice to confirm it.' }}</p>
    </div>

    <div v-if="done" class="rounded-2xl border border-[var(--bs-status-success)]/30 bg-[var(--bs-status-success-bg)] p-5 dark:bg-[var(--bs-status-success-bg)]">
      <AppIcon name="check" class="mb-3 size-6 text-[var(--bs-status-success)]" />
      <h2 class="font-bold">{{ isArabic ? 'تم تغيير كلمة المرور' : 'Password updated' }}</h2>
      <NuxtLink to="/dashboard" class="mt-5 inline-flex h-11 items-center rounded-xl bg-[var(--bs-primary)] px-5 text-sm font-bold text-white dark:bg-[var(--bs-accent)] dark:text-[var(--bs-deep-structure-navy)]">{{ isArabic ? 'فتح Shop Suit' : 'Open Shop Suit' }}</NuxtLink>
    </div>

    <div v-else-if="!user" class="rounded-2xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-5 dark:bg-[var(--bs-status-warning-bg)]">
      <p class="font-bold">{{ isArabic ? 'رابط الاستعادة غير صالح أو انتهت صلاحيته.' : 'The recovery link is invalid or expired.' }}</p>
      <NuxtLink to="/auth/forgot-password" class="mt-4 inline-block text-sm font-bold underline">{{ isArabic ? 'اطلب رابط جديد' : 'Request a new link' }}</NuxtLink>
    </div>

    <form v-else class="space-y-5" @submit.prevent="onSubmit">
      <div v-if="errorMessage" class="rounded-xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] px-4 py-3 text-sm text-[var(--bs-status-error)] dark:bg-[var(--bs-status-error-bg)] dark:text-[var(--bs-status-error)]">{{ errorMessage }}</div>
      <div class="space-y-2">
        <label for="new-password" class="text-sm font-semibold">{{ isArabic ? 'كلمة المرور الجديدة' : 'New password' }}</label>
        <div class="relative">
          <AppIcon name="lock" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="new-password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="ls-input">
          <button type="button" class="ls-btn" @click="showPassword = !showPassword"><AppIcon :name="showPassword ? 'eyeOff' : 'eye'" class="size-4" /></button>
        </div>
      </div>
      <div class="space-y-2">
        <label for="confirm-password" class="text-sm font-semibold">{{ isArabic ? 'تأكيد كلمة المرور' : 'Confirm password' }}</label>
        <input id="confirm-password" v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="ls-input">
      </div>
      <button type="submit" class="ls-btn ls-btn-primary w-full" :disabled="pending"><AppIcon v-if="pending" name="automation" class="size-4" />{{ isArabic ? 'حفظ كلمة المرور' : 'Save password' }}</button>
    </form>
  </section>
</template>
