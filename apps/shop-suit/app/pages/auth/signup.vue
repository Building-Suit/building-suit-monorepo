<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { BusinessMode } from '~/utils/businessMode'
import { BUSINESS_MODES } from '~/utils/businessMode'
import { classifyOtpFailure, createPendingOnboardingDraft, isExistingIdentityError, PENDING_ONBOARDING_STORAGE_KEY, restorePendingOnboarding } from '~/utils/pendingOnboarding'
definePageMeta({ layout: 'auth' })
const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale, t } = useI18n()
const { step, advance, back, reset: resetWizard } = useSignupWizard(2)
const verification = useShopVerificationTimer()
const { currentId, loadShops } = useShop()
const { data: plans, isLoading: plansPending, error: plansError, refresh: refreshPlans } = usePlans()
const route = useRoute()
const form = reactive({ displayName: '', email: '', password: '', shopName: '', plan: typeof route.query.plan === 'string' ? route.query.plan : '', businessMode: 'mixed' as BusinessMode })
const pending = ref(false)
const errorMessage = ref('')
const noticeMessage = ref('')
const awaitingOtp = ref(false)
const otp = ref('')
const existingAccount = ref(false)
const availablePlans = computed(() => plans.value?.filter(plan => !plan.is_coming_soon && plan.trial_days > 0) ?? [])
watch(availablePlans, value => { if (!value.some(plan => plan.slug === form.plan)) form.plan = value[0]?.slug ?? '' }, { immediate: true })
const copy = computed(() => locale.value === 'ar' ? {
  account: 'بيانات الحساب', accountBody: 'الاسم والبريد الإلكتروني', shop: 'بيانات المتجر', shopBody: 'اسم المتجر وطريقة التشغيل والخطة', shopName: 'اسم المتجر', plan: 'خطة التجربة', businessMode: 'طريقة تشغيل النشاط', businessModeHelp: 'تتحكم في ظهور مسارات العمل ولا تغيّر خطة الاشتراك.', productMode: 'منتجات ومخزون', serviceMode: 'خدمات فقط', mixedMode: 'منتجات وخدمات', next: 'متابعة', back: 'السابق', create: 'إنشاء المتجر', pending: 'جارٍ المتابعة…', verify: 'تأكيد البريد الإلكتروني', verifyBody: 'أدخل رمز التحقق المرسل إلى بريدك الإلكتروني.', code: 'رمز التحقق', resend: 'إرسال رمز جديد', required: 'أكمل الحقول المطلوبة واختر طريقة تشغيل وخطة متاحة.', failed: 'تعذّر إكمال التسجيل. تحقق من البيانات وحاول مجددًا.', invalid: 'الرمز غير صحيح. تحقق منه أو اطلب رمزًا جديدًا.', expired: 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.', resendFailed: 'تعذّر إرسال رمز جديد الآن. انتظر قليلًا ثم حاول مرة أخرى.', resent: 'أرسلنا رمز تحقق جديدًا إلى بريدك الإلكتروني.', existingPending: 'يوجد تسجيل لهذا البريد بالفعل. استخدم الرمز المرسل أو اطلب رمزًا جديدًا أو سجل الدخول.', stale: 'انتهت جلسة التسجيل المحفوظة. ابدأ مرة أخرى بأمان.', startOver: 'بدء التسجيل من جديد', changeEmail: 'تغيير البريد الإلكتروني', unavailable: 'لا توجد خطط متاحة الآن.', retry: 'إعادة المحاولة', wait: 'يمكنك طلب رمز جديد بعد', expires: 'ينتهي الرمز خلال', login: 'لديك حساب بالفعل؟ سجل الدخول', signIn: 'تسجيل الدخول بدلًا من ذلك',
} : {
  account: 'Account details', accountBody: 'Your name and email', shop: 'Shop details', shopBody: 'Shop name, operation mode, and plan', shopName: 'Shop name', plan: 'Trial plan', businessMode: 'Business operation mode', businessModeHelp: 'Controls workflow visibility without changing your subscription plan.', productMode: 'Products and stock', serviceMode: 'Services only', mixedMode: 'Products and services', next: 'Continue', back: 'Back', create: 'Create shop', pending: 'Continuing…', verify: 'Verify your email', verifyBody: 'Enter the verification code sent to your email.', code: 'Verification code', resend: 'Send another code', required: 'Complete the required fields and choose an operation mode and available plan.', failed: 'Could not complete signup. Check your details and try again.', invalid: 'That code is not valid. Check it or request a new code.', expired: 'This code has expired. Request another code.', resendFailed: 'A new code could not be sent yet. Wait a moment and try again.', resent: 'We sent a new verification code to your email.', existingPending: 'A signup already exists for this email. Use its code, request a new one, or sign in.', stale: 'Your saved signup session expired. Start again safely.', startOver: 'Start signup over', changeEmail: 'Change email', unavailable: 'No plans are available right now.', retry: 'Retry', wait: 'Request another code in', expires: 'Code expires in', login: 'Already have an account? Sign in', signIn: 'Sign in instead',
})
const modeOptions = computed(() => BUSINESS_MODES.map(value => ({
  value,
  label: value === 'product' ? copy.value.productMode : value === 'service' ? copy.value.serviceMode : copy.value.mixedMode,
})))
useHead({ title: () => `${t('auth.signupTitle')} · Shop Suit` })
function saveDraft() {
  if (!import.meta.client) return
  const draft = createPendingOnboardingDraft(form, { expiresAt: verification.expiresAt.value, resendAt: verification.resendAt.value })
  try { sessionStorage.setItem(PENDING_ONBOARDING_STORAGE_KEY, JSON.stringify(draft)) } catch { /* Signup still works without browser storage. */ }
}
function clearDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY) } catch { /* Storage may be unavailable. */ }
}
function showOtp(message = '') {
  awaitingOtp.value = true
  otp.value = ''
  verification.start()
  noticeMessage.value = message
  saveDraft()
}
function startOver() {
  clearDraft()
  awaitingOtp.value = false
  existingAccount.value = false
  otp.value = ''
  errorMessage.value = ''
  noticeMessage.value = ''
  verification.reset()
  form.displayName = ''
  form.email = ''
  form.password = ''
  form.shopName = ''
  form.businessMode = 'mixed'
  form.plan = typeof route.query.plan === 'string' ? route.query.plan : (availablePlans.value[0]?.slug ?? '')
  resetWizard()
}
async function provisionShop() {
  await loadShops({ force: true })
  if (!currentId.value) {
    const { error } = await shopRpc.rpc('create_owner_shop', { p_shop_name: form.shopName.trim(), p_plan_slug: form.plan, p_business_mode: form.businessMode })
    if (error) throw error
    await loadShops({ force: true })
    if (!currentId.value) throw new Error('Shop could not be loaded')
  }
  clearDraft()
  await navigateTo('/dashboard')
}
async function nextStep() {
  errorMessage.value = ''
  noticeMessage.value = ''
  await advance(() => {
    const valid = Boolean(form.displayName.trim() && form.email.trim() && (existingAccount.value || form.password.length >= 6))
    if (!valid) errorMessage.value = copy.value.required
    return valid
  })
}
async function submit() {
  if (pending.value) return
  if (step.value === 1) { await nextStep(); return }
  errorMessage.value = ''
  if (form.shopName.trim().length < 2 || form.shopName.trim().length > 120 || !BUSINESS_MODES.includes(form.businessMode) || !availablePlans.value.some(plan => plan.slug === form.plan)) { errorMessage.value = copy.value.required; return }
  pending.value = true
  try {
    if (existingAccount.value) { await provisionShop(); return }
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(), password: form.password,
      options: { data: { display_name: form.displayName.trim(), portal_key: 'shop_suit', pending_shop: { name: form.shopName.trim(), plan: form.plan, business_mode: form.businessMode } } },
    })
    if (error) {
      if (!isExistingIdentityError(error)) throw error
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: form.email.trim().toLowerCase() })
      showOtp(resendError ? copy.value.existingPending : copy.value.resent)
      return
    }
    form.password = ''
    if (data.session) { existingAccount.value = true; await provisionShop() }
    else {
      const identityAlreadyExists = Array.isArray(data.user?.identities) && data.user.identities.length === 0
      if (identityAlreadyExists) await supabase.auth.resend({ type: 'signup', email: form.email.trim().toLowerCase() })
      showOtp(identityAlreadyExists ? copy.value.existingPending : '')
    }
  } catch { errorMessage.value = copy.value.failed }
  finally { pending.value = false }
}
async function verify() {
  if (pending.value || (!existingAccount.value && (otp.value.length !== 6 || verification.expired.value))) return
  pending.value = true
  errorMessage.value = ''
  try {
    if (!existingAccount.value) {
      const { data, error } = await supabase.auth.verifyOtp({ email: form.email.trim().toLowerCase(), token: otp.value, type: 'email' })
      if (error || !data.session) throw error || new Error('Verification required')
      existingAccount.value = true
      otp.value = ''
    }
    await provisionShop()
  } catch (error) {
    if (existingAccount.value) errorMessage.value = copy.value.failed
    else {
      const kind = classifyOtpFailure(error, verification.expired.value)
      errorMessage.value = kind === 'expired' ? copy.value.expired : copy.value.invalid
      if (kind === 'invalid') otp.value = ''
    }
  }
  finally { pending.value = false }
}
async function resend() {
  if (pending.value || verification.resendIn.value > 0) return
  pending.value = true
  errorMessage.value = ''
  noticeMessage.value = ''
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email: form.email.trim().toLowerCase() })
    if (error) throw error
    otp.value = ''; verification.start(); saveDraft(); noticeMessage.value = copy.value.resent
  } catch { errorMessage.value = copy.value.resendFailed }
  finally { pending.value = false }
}
onMounted(async () => {
  try {
    const restored = restorePendingOnboarding(sessionStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY))
    if (restored.status === 'active' || restored.status === 'expired') {
      Object.assign(form, restored.draft.form)
      verification.restore(restored.draft.expiresAt, restored.draft.resendAt)
      awaitingOtp.value = true
      step.value = 2
    }
    else if (restored.status === 'invalid' || restored.status === 'stale') {
      clearDraft()
      noticeMessage.value = copy.value.stale
    }
  } catch { clearDraft() }
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  existingAccount.value = true; awaitingOtp.value = false
  form.email = data.user.email || form.email
  form.displayName = String(data.user.user_metadata.display_name || data.user.user_metadata.full_name || form.displayName)
  const draft = data.user.user_metadata.pending_shop
  if (typeof draft?.name === 'string') form.shopName ||= draft.name
  if (typeof draft?.plan === 'string') form.plan ||= draft.plan
  if (BUSINESS_MODES.includes(draft?.business_mode)) form.businessMode = draft.business_mode
  step.value = 2
  await loadShops({ force: true })
  if (currentId.value) await navigateTo('/dashboard')
})
</script>
<template>
  <form v-if="!awaitingOtp" class="ls-auth-card space-y-6 p-6 sm:p-8" @submit.prevent="submit">
    <div class="text-center"><p class="ls-auth-eyebrow">Shop Suit</p><h1 class="mt-2 text-xl font-extrabold">{{ t('auth.signupTitle') }}</h1><p class="mt-2 text-sm text-fg-muted">{{ t('auth.signupSubtitle') }}</p></div>
    <BsSignupWizard :step="step" :steps="[{ title: copy.account, body: copy.accountBody }, { title: copy.shop, body: copy.shopBody }]" :pending="pending" @back="back">
      <div v-if="step === 1" class="space-y-4">
        <FloatingField :label="t('auth.displayName')"><InputText id="signup-name" v-model="form.displayName" class="ls-input" autocomplete="name" required /></FloatingField>
        <FloatingField :label="t('auth.email')"><InputText id="signup-email" v-model="form.email" class="ls-input" type="email" autocomplete="email" dir="ltr" :readonly="existingAccount" required /></FloatingField>
        <FloatingField v-if="!existingAccount" :label="t('auth.password')"><InputText id="signup-password" v-model="form.password" class="ls-input" type="password" autocomplete="new-password" dir="ltr" minlength="6" required /></FloatingField>
      </div>
      <div v-else class="space-y-4">
        <FloatingField :label="copy.shopName"><InputText id="signup-shop" v-model="form.shopName" class="ls-input" minlength="2" maxlength="120" required /></FloatingField>
        <fieldset class="space-y-2">
          <legend class="text-sm font-bold">{{ copy.businessMode }}</legend>
          <p class="text-xs text-fg-muted">{{ copy.businessModeHelp }}</p>
          <label v-for="mode in modeOptions" :key="mode.value" class="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3">
            <input v-model="form.businessMode" type="radio" name="signup-business-mode" :value="mode.value">
            <span class="font-semibold">{{ mode.label }}</span>
          </label>
        </fieldset>
        <SectionSkeleton v-if="plansPending" :rows="2" />
        <div v-else-if="plansError" class="ls-error" role="alert"><p>{{ copy.failed }}</p><button type="button" class="ls-btn" @click="refreshPlans()">{{ copy.retry }}</button></div>
        <p v-else-if="!availablePlans.length" class="text-fg-muted">{{ copy.unavailable }}</p>
        <FloatingField v-else :label="copy.plan"><select id="signup-plan" v-model="form.plan" class="ls-input" required><option v-for="plan in availablePlans" :key="plan.id" :value="plan.slug">{{ plan.name }} · {{ t('pricing.trial', { trialDays: plan.trial_days }) }}</option></select></FloatingField>
      </div>
      <p v-if="noticeMessage" role="status" class="rounded-xl border border-border p-3 text-sm text-fg-muted">{{ noticeMessage }}</p>
      <p v-if="errorMessage" role="alert" class="ls-error">{{ errorMessage }}</p>
      <button type="submit" class="ls-btn ls-btn-primary w-full" :disabled="pending || (step === 2 && (!availablePlans.length || plansPending))">{{ pending ? copy.pending : step === 1 ? copy.next : copy.create }}</button>
    </BsSignupWizard>
    <p class="text-center text-sm text-fg-muted"><NuxtLink to="/auth/login" class="underline">{{ copy.login }}</NuxtLink></p>
  </form>
  <form v-else class="ls-auth-card space-y-6 p-6 text-center sm:p-8" @submit.prevent="verify">
    <AppIcon name="mail" :size="32" class="mx-auto" /><h1 class="text-xl font-black">{{ copy.verify }}</h1><p class="text-sm text-fg-muted">{{ copy.verifyBody }}</p><p class="break-all font-bold" dir="ltr">{{ form.email }}</p>
    <OtpInput v-if="!existingAccount" v-model="otp" :label="copy.code" :disabled="pending || verification.expired.value" />
    <template v-if="!existingAccount"><p v-if="verification.expired.value" class="text-sm text-danger">{{ copy.expired }}</p><p v-else class="text-sm text-fg-muted">{{ copy.expires }} {{ verification.format(verification.expiresIn.value) }}</p></template>
    <p v-if="noticeMessage" role="status" class="rounded-xl border border-border p-3 text-sm text-fg-muted">{{ noticeMessage }}</p>
    <p v-if="errorMessage" role="alert" class="ls-error">{{ errorMessage }}</p>
    <button class="ls-btn ls-btn-primary w-full" :disabled="pending || (!existingAccount && (otp.length !== 6 || verification.expired.value))">{{ pending ? copy.pending : existingAccount ? copy.retry : copy.verify }}</button>
    <button v-if="!existingAccount" type="button" class="text-sm font-bold underline disabled:opacity-50" :disabled="pending || verification.resendIn.value > 0" @click="resend">{{ verification.resendIn.value > 0 ? `${copy.wait} ${verification.format(verification.resendIn.value)}` : copy.resend }}</button>
    <button v-if="!existingAccount" type="button" class="text-sm font-bold underline" :disabled="pending" @click="startOver">{{ copy.changeEmail }} · {{ copy.startOver }}</button>
    <NuxtLink to="/auth/login" class="block text-sm font-bold underline" @click="clearDraft">{{ copy.signIn }}</NuxtLink>
  </form>
</template>
