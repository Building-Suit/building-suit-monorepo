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
  catch (error: any) {
    errorMessage.value = error?.message || (isArabic.value ? 'تعذّر تغيير كلمة المرور. افتح رابط الاستعادة مرة أخرى.' : 'Unable to update the password. Open the recovery link again.')
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
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ isArabic ? 'اختار كلمة مرور جديدة' : 'Choose a new password' }}</h1>
      <p class="text-sm leading-6 text-muted-foreground">{{ isArabic ? 'اكتب كلمة المرور الجديدة مرتين للتأكيد.' : 'Enter the new password twice to confirm it.' }}</p>
    </div>

    <div v-if="done" class="rounded-2xl border border-[var(--bs-success)]/30 bg-[var(--bs-success-bg)] p-5 dark:bg-[var(--bs-success-bg-dark)]">
      <Icon name="lucide:circle-check-big" class="mb-3 size-6 text-[var(--bs-success)]" />
      <h2 class="font-bold">{{ isArabic ? 'تم تغيير كلمة المرور' : 'Password updated' }}</h2>
      <NuxtLink to="/dashboard" class="mt-5 inline-flex h-11 items-center rounded-xl bg-[#141416] px-5 text-sm font-bold text-white dark:bg-[#d89b42] dark:text-[#0b0b0d]">{{ isArabic ? 'فتح Shop Suit' : 'Open Shop Suit' }}</NuxtLink>
    </div>

    <div v-else-if="!user" class="rounded-2xl border border-[var(--bs-warning)]/30 bg-[var(--bs-warning-bg)] p-5 dark:bg-[var(--bs-warning-bg-dark)]">
      <p class="font-bold">{{ isArabic ? 'رابط الاستعادة غير صالح أو انتهت صلاحيته.' : 'The recovery link is invalid or expired.' }}</p>
      <NuxtLink to="/auth/forgot-password" class="mt-4 inline-block text-sm font-bold underline">{{ isArabic ? 'اطلب رابط جديد' : 'Request a new link' }}</NuxtLink>
    </div>

    <form v-else class="space-y-5" @submit.prevent="onSubmit">
      <div v-if="errorMessage" class="rounded-xl border border-[var(--bs-error)]/30 bg-[var(--bs-error-bg)] px-4 py-3 text-sm text-[var(--bs-error-fg)] dark:bg-[var(--bs-error-bg-dark)] dark:text-[var(--bs-error-dark)]">{{ errorMessage }}</div>
      <div class="space-y-2">
        <label for="new-password" class="text-sm font-semibold">{{ isArabic ? 'كلمة المرور الجديدة' : 'New password' }}</label>
        <div class="relative">
          <Icon name="lucide:lock-keyhole" class="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input id="new-password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-12 text-sm outline-none focus:border-[#d89b42] focus:ring-2 focus:ring-[#d89b42]/20">
          <button type="button" class="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted" @click="showPassword = !showPassword"><Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" /></button>
        </div>
      </div>
      <div class="space-y-2">
        <label for="confirm-password" class="text-sm font-semibold">{{ isArabic ? 'تأكيد كلمة المرور' : 'Confirm password' }}</label>
        <input id="confirm-password" v-model="confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:border-[#d89b42] focus:ring-2 focus:ring-[#d89b42]/20">
      </div>
      <button type="submit" class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#141416] px-5 text-sm font-bold text-white dark:bg-[#d89b42] dark:text-[#0b0b0d]" :disabled="pending"><Icon v-if="pending" name="svg-spinners:180-ring" class="size-4" />{{ isArabic ? 'حفظ كلمة المرور' : 'Save password' }}</button>
    </form>
  </section>
</template>
