<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { BusinessMode } from '~/utils/businessMode'
import { BUSINESS_MODES } from '~/utils/businessMode'
import { classifyOtpFailure, createPendingOnboardingDraft, normalizeSignupEmail, signupNeedsRecovery, PENDING_ONBOARDING_STORAGE_KEY, restorePendingOnboarding } from '~/utils/pendingOnboarding'
definePageMeta({ layout: 'auth' })
const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale, t } = useI18n()
const { step, advance, back, reset: resetWizard } = useSignupWizard(2)
const verification = useVerificationTimer()
const { currentId, loadShops } = useShop()
const form = reactive({
  displayName: '', email: '', password: '', shopName: '', businessMode: 'mixed' as BusinessMode,
  mainLocationName: '', mainLocationCode: '', mainLocationAddress: '', mainLocationPhone: '',
})
const pending = ref(false)
const errorMessage = ref('')
const noticeMessage = ref('')
const awaitingOtp = ref(false)
const otp = ref('')
const existingAccount = ref(false)
const recovery = ref(false)
const copy = computed(() => locale.value === 'ar' ? {
  account: 'بيانات الحساب', accountBody: 'اسمك والإيميل', shop: 'بيانات المتجر', shopBody: 'اسم المتجر والفرع الرئيسي وطريقة شغلك', shopName: 'اسم المتجر', mainLocation: 'الفرع الرئيسي', mainLocationName: 'اسم الفرع الرئيسي', mainLocationCode: 'رمز الفرع (اختياري)', mainLocationAddress: 'عنوان الفرع (اختياري)', mainLocationPhone: 'تليفون الفرع (اختياري)', trial: 'تجربة كاملة 7 أيام', trialHelp: 'ابدأ بكل مميزات Shop Suit من غير ما تختار خطة مدفوعة. تقدر تختار خطتك بعدين من صفحة الاشتراك.', businessMode: 'طريقة شغل النشاط', businessModeHelp: 'تقدر تغيّرها بعدين من إعدادات النشاط، وبياناتك هتفضل محفوظة.', productMode: 'منتجات ومخزون', serviceMode: 'خدمات بس', mixedMode: 'منتجات ومخزون وخدمات', next: 'كمّل', back: 'رجوع', create: 'اعمل المتجر', pending: 'بنكمّل…', verify: 'أكّد الإيميل', verifyBody: 'اكتب كود التأكيد اللي بعتناه على إيميلك.', code: 'كود التأكيد', resend: 'ابعت كود جديد', required: 'كمّل البيانات المطلوبة واختار طريقة شغلك.', failed: 'مقدرناش نكمّل التسجيل. راجع بياناتك وحاول تاني.', invalid: 'الكود مش صحيح. راجعه أو اطلب كود جديد.', expired: 'صلاحية الكود خلصت. اطلب كود جديد.', resendFailed: 'مقدرناش نبعت كود جديد دلوقتي. استنى شوية وحاول تاني.', resent: 'بعتنا كود تأكيد جديد على إيميلك.', existingPending: 'كمّل بأمان: لو عندك حساب، سجّل دخول أو استرجع كلمة المرور. لو إيميلك لسه مش متأكد، اطلب كود تأكيد.', stale: 'جلسة التسجيل خلصت. ابدأ من جديد.', startOver: 'ابدأ التسجيل من جديد', changeEmail: 'غيّر الإيميل', retry: 'حاول تاني', wait: 'تقدر تطلب كود جديد بعد', expires: 'الكود هينتهي خلال', login: 'عندك حساب؟ سجّل دخول', signIn: 'سجّل دخول بدل كده', recover: 'استرجع كلمة المرور', recoveryTitle: 'كمّل التسجيل بأمان',
} : {
  account: 'Account details', accountBody: 'Your name and email', shop: 'Shop details', shopBody: 'Shop, main location and operation mode', shopName: 'Shop name', mainLocation: 'Main location', mainLocationName: 'Main location name', mainLocationCode: 'Location code (optional)', mainLocationAddress: 'Location address (optional)', mainLocationPhone: 'Location phone (optional)', trial: 'Full product access for 7 days', trialHelp: 'Start with every current Shop Suit feature and no paid-plan choice. Choose a plan later from Billing.', businessMode: 'Business operation mode', businessModeHelp: 'You can change this later in Business settings without losing data.', productMode: 'Products and stock', serviceMode: 'Services only', mixedMode: 'Products, stock and services', next: 'Continue', back: 'Back', create: 'Create shop', pending: 'Continuing…', verify: 'Verify your email', verifyBody: 'Enter the verification code sent to your email.', code: 'Verification code', resend: 'Send another code', required: 'Complete the required fields and choose an operation mode.', failed: 'Could not complete signup. Check your details and try again.', invalid: 'That code is not valid. Check it or request a new code.', expired: 'This code has expired. Request another code.', resendFailed: 'A new code could not be sent yet. Wait a moment and try again.', resent: 'We sent a new verification code to your email.', existingPending: 'Continue safely: if you have an account, sign in or reset your password. If your email still needs verification, request a code.', stale: 'Your saved signup session expired. Start again safely.', startOver: 'Start signup over', changeEmail: 'Change email', retry: 'Retry', wait: 'Request another code in', expires: 'Code expires in', login: 'Already have an account? Sign in', signIn: 'Sign in instead', recover: 'Reset password', recoveryTitle: 'Continue signup safely',
})
const modeOptions = computed(() => BUSINESS_MODES.map(value => ({
  value,
  label: value === 'product' ? copy.value.productMode : value === 'service' ? copy.value.serviceMode : copy.value.mixedMode,
})))
useHead({ title: () => `${t('auth.signupTitle')} · Shop Suit` })
function saveDraft() {
  if (!import.meta.client) return
  const draft = createPendingOnboardingDraft(form, { expiresAt: verification.expiresAt.value, resendAt: verification.resendAt.value })
  try { sessionStorage.setItem(PENDING_ONBOARDING_STORAGE_KEY, JSON.stringify({ ...draft, recovery: recovery.value })) } catch { /* Signup still works without browser storage. */ }
}
function clearDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(PENDING_ONBOARDING_STORAGE_KEY) } catch { /* Storage may be unavailable. */ }
}
function showRecovery() {
  form.password = ''
  recovery.value = true
  awaitingOtp.value = false
  verification.reset()
  saveDraft()
}
function showOtp(message = '') {
  recovery.value = false
  awaitingOtp.value = true
  otp.value = ''
  verification.start()
  noticeMessage.value = message
  saveDraft()
}
function startOver() {
  clearDraft()
  recovery.value = false
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
  form.mainLocationName = ''
  form.mainLocationCode = ''
  form.mainLocationAddress = ''
  form.mainLocationPhone = ''
  resetWizard()
}
async function provisionShop() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user?.email_confirmed_at
    || normalizeSignupEmail(data.user.email || '') !== normalizeSignupEmail(form.email)) {
    existingAccount.value = false
    showRecovery()
    return
  }
  await loadShops({ force: true })
  if (!currentId.value) {
    const { error } = await shopRpc.rpc('create_owner_shop', {
      p_shop_name: form.shopName.trim(), p_business_mode: form.businessMode,
      p_main_location_name: form.mainLocationName.trim(),
      p_main_location_code: form.mainLocationCode.trim() || null,
      p_main_location_address: form.mainLocationAddress.trim() || null,
      p_main_location_phone: form.mainLocationPhone.trim() || null,
    })
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
  if (form.shopName.trim().length < 2 || form.shopName.trim().length > 120
    || form.mainLocationName.trim().length < 2 || form.mainLocationName.trim().length > 120
    || form.mainLocationCode.trim().length > 32 || !BUSINESS_MODES.includes(form.businessMode)) { errorMessage.value = copy.value.required; return }
  form.email = normalizeSignupEmail(form.email)
  pending.value = true
  try {
    if (existingAccount.value) { await provisionShop(); return }
    const { data, error } = await supabase.auth.signUp({
      email: normalizeSignupEmail(form.email), password: form.password,
      options: { data: { display_name: form.displayName.trim(), portal_key: 'shop_suit', pending_shop: {
        name: form.shopName.trim(), business_mode: form.businessMode,
        main_location_name: form.mainLocationName.trim(),
        main_location_code: form.mainLocationCode.trim() || null,
        main_location_address: form.mainLocationAddress.trim() || null,
        main_location_phone: form.mainLocationPhone.trim() || null,
      } } },
    })
    if (signupNeedsRecovery(data.user, error)) {
      showRecovery()
      return
    }
    if (error) throw error
    form.password = ''
    if (data.session) { existingAccount.value = true; await provisionShop() }
    else showOtp()
  } catch { errorMessage.value = copy.value.failed }
  finally { pending.value = false }
}
async function verify() {
  if (pending.value || (!existingAccount.value && (otp.value.length !== 6 || verification.expired.value))) return
  pending.value = true
  errorMessage.value = ''
  try {
    if (!existingAccount.value) {
      const { data, error } = await supabase.auth.verifyOtp({ email: normalizeSignupEmail(form.email), token: otp.value, type: 'email' })
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
  verification.resendAt.value = Date.now() + 60_000
  saveDraft()
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email: normalizeSignupEmail(form.email) })
    if (error) throw error
    showOtp(copy.value.resent)
  } catch { errorMessage.value = copy.value.resendFailed }
  finally { pending.value = false }
}
onMounted(async () => {
  try {
    const restored = restorePendingOnboarding(sessionStorage.getItem(PENDING_ONBOARDING_STORAGE_KEY))
    if (restored.status === 'active' || restored.status === 'expired') {
      Object.assign(form, restored.draft.form)
      verification.restore(restored.draft.expiresAt, restored.draft.resendAt)
      recovery.value = restored.draft.recovery === true
      awaitingOtp.value = !recovery.value
      step.value = 2
    }
    else if (restored.status === 'invalid' || restored.status === 'stale') {
      clearDraft()
      noticeMessage.value = copy.value.stale
    }
  } catch { clearDraft() }
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  if (!data.user.email_confirmed_at) return
  // A restored draft must never be provisioned for a different signed-in identity.
  if (form.email && normalizeSignupEmail(form.email) !== normalizeSignupEmail(data.user.email || '')) startOver()
  recovery.value = false
  existingAccount.value = true; awaitingOtp.value = false
  form.email = normalizeSignupEmail(data.user.email || form.email)
  form.displayName = String(data.user.user_metadata.display_name || data.user.user_metadata.full_name || form.displayName)
  const draft = data.user.user_metadata.pending_shop
  if (typeof draft?.name === 'string') form.shopName ||= draft.name
  if (BUSINESS_MODES.includes(draft?.business_mode)) form.businessMode = draft.business_mode
  if (typeof draft?.main_location_name === 'string') form.mainLocationName ||= draft.main_location_name
  if (typeof draft?.main_location_code === 'string') form.mainLocationCode ||= draft.main_location_code
  if (typeof draft?.main_location_address === 'string') form.mainLocationAddress ||= draft.main_location_address
  if (typeof draft?.main_location_phone === 'string') form.mainLocationPhone ||= draft.main_location_phone
  if (!form.mainLocationName && form.shopName) form.mainLocationName = `${form.shopName} main location`
  step.value = 2
  await loadShops({ force: true })
  if (currentId.value) await navigateTo('/dashboard')
})
</script>
<template>
  <BsAuthForm
    v-if="recovery" eyebrow="Shop Suit" :title="copy.recoveryTitle" :description="copy.existingPending"
    :pending="pending" :error="errorMessage" :submit-label="copy.signIn" @submit="clearDraft(); navigateTo('/auth/login')"
  >
    <NuxtLink to="/auth/forgot-password" class="font-bold underline" @click="clearDraft">{{ copy.recover }}</NuxtLink>
    <BsButton type="button" variant="secondary" :disabled="pending || verification.resendIn.value > 0" @click="resend">{{ verification.resendIn.value > 0 ? `${copy.wait} ${verification.format(verification.resendIn.value)}` : copy.resend }}</BsButton>
    <template #footer><BsButton type="button" variant="link" :disabled="pending" @click="startOver">{{ copy.changeEmail }} · {{ copy.startOver }}</BsButton></template>
  </BsAuthForm>
  <BsAuthForm v-else-if="!awaitingOtp" eyebrow="Shop Suit" :title="t('auth.signupTitle')" :description="t('auth.signupSubtitle')" :pending="pending" @submit="submit">
    <BsSignupWizard
      :step="step" :steps="[{ id: 'account', title: copy.account, body: copy.accountBody }, { id: 'shop', title: copy.shop, body: copy.shopBody }]"
      :pending="pending" :error="errorMessage" :notice="noticeMessage" :back-label="copy.back"
      :submit-label="step === 1 ? copy.next : copy.create" :pending-label="copy.pending" @back="back"
    >
      <div v-if="step === 1" class="space-y-4">
        <FloatingField :label="t('auth.displayName')"><InputText id="signup-name" v-model="form.displayName" class="ls-input" autocomplete="name" required /></FloatingField>
        <FloatingField :label="t('auth.email')"><InputText id="signup-email" v-model="form.email" class="ls-input" type="email" autocomplete="email" dir="ltr" :readonly="existingAccount" required /></FloatingField>
        <FloatingField v-if="!existingAccount" :label="t('auth.password')"><InputText id="signup-password" v-model="form.password" class="ls-input" type="password" autocomplete="new-password" dir="ltr" minlength="6" required /></FloatingField>
      </div>
      <div v-else class="space-y-4">
        <FloatingField :label="copy.shopName"><InputText id="signup-shop" v-model="form.shopName" class="ls-input" minlength="2" maxlength="120" required /></FloatingField>
        <fieldset class="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
          <legend class="px-1 text-sm font-bold">{{ copy.mainLocation }}</legend>
          <FloatingField :label="copy.mainLocationName"><InputText id="signup-main-location" v-model="form.mainLocationName" class="ls-input" minlength="2" maxlength="120" required /></FloatingField>
          <FloatingField :label="copy.mainLocationCode"><InputText id="signup-main-location-code" v-model="form.mainLocationCode" class="ls-input" maxlength="32" /></FloatingField>
          <FloatingField :label="copy.mainLocationAddress"><InputText id="signup-main-location-address" v-model="form.mainLocationAddress" class="ls-input" maxlength="500" /></FloatingField>
          <FloatingField :label="copy.mainLocationPhone"><InputText id="signup-main-location-phone" v-model="form.mainLocationPhone" class="ls-input" maxlength="80" dir="auto" /></FloatingField>
        </fieldset>
        <div class="rounded-xl border border-border bg-muted/40 p-3"><p class="text-sm font-bold">{{ copy.trial }}</p><p class="mt-1 text-xs text-fg-muted">{{ copy.trialHelp }}</p></div>
        <fieldset class="space-y-2">
          <legend class="text-sm font-bold">{{ copy.businessMode }}</legend>
          <p class="text-xs text-fg-muted">{{ copy.businessModeHelp }}</p>
          <label v-for="mode in modeOptions" :key="mode.value" class="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3">
            <input v-model="form.businessMode" type="radio" name="signup-business-mode" :value="mode.value">
            <span class="font-semibold">{{ mode.label }}</span>
          </label>
        </fieldset>
      </div>
    </BsSignupWizard>
    <template #footer><NuxtLink to="/auth/login" class="underline">{{ copy.login }}</NuxtLink></template>
  </BsAuthForm>
  <BsVerificationForm
    v-else v-model="otp" :title="copy.verify" :description="copy.verifyBody" :email="form.email" :code-label="copy.code"
    :pending="pending" :error="errorMessage" :notice="noticeMessage" :expired="verification.expired.value" :verified="existingAccount"
    :expiry-label="`${copy.expires} ${verification.format(verification.expiresIn.value)}`" :expired-label="copy.expired"
    :submit-label="existingAccount ? copy.retry : copy.verify" :pending-label="copy.pending"
    :resend-label="verification.resendIn.value > 0 ? `${copy.wait} ${verification.format(verification.resendIn.value)}` : copy.resend"
    :resend-disabled="verification.resendIn.value > 0" @submit="verify" @resend="resend"
  >
    <template #secondary><BsButton v-if="!existingAccount" variant="link" type="button" :disabled="pending" @click="startOver">{{ copy.changeEmail }} · {{ copy.startOver }}</BsButton></template>
    <template #footer><NuxtLink to="/auth/login" class="font-bold underline" @click="clearDraft">{{ copy.signIn }}</NuxtLink> · <NuxtLink to="/auth/forgot-password" class="underline" @click="clearDraft">{{ copy.recover }}</NuxtLink></template>
  </BsVerificationForm>
</template>
