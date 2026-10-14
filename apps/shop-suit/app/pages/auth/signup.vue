<script setup lang="ts">
import type { BsSignupForm, BsSignupFeatures, BsSignupView, BsSignupCopy, BsSignupVerificationCopy, BsSignupProduct, BsSignupChoices, BsSignupLinks } from '@building-suit/ui/types/signupPresentation'

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
  account: 'بيانات الحساب', accountBody: 'اسمك والإيميل', shop: 'بيانات المتجر', shopBody: 'اسم المتجر والفرع الرئيسي وطريقة شغلك', shopName: 'اسم المتجر', mainLocation: 'الفرع الرئيسي', mainLocationName: 'اسم الفرع الرئيسي', mainLocationCode: 'رمز الفرع (اختياري)', mainLocationAddress: 'عنوان الفرع (اختياري)', mainLocationPhone: 'تليفون الفرع (اختياري)', trial: 'تجربة كاملة 7 أيام', trialHelp: 'ابدأ بكل مميزات Shop Suit من غير ما تختار خطة مدفوعة. تقدر تختار خطتك وتدفع عبر X-Pay من أول يوم عند إتاحة الدفع، من غير انتظار السبعة أيام.', businessMode: 'طريقة شغل النشاط', businessModeHelp: 'تقدر تغيّرها بعدين من إعدادات النشاط، وبياناتك هتفضل محفوظة.', productMode: 'منتجات ومخزون', serviceMode: 'خدمات بس', mixedMode: 'منتجات ومخزون وخدمات', next: 'كمّل', back: 'رجوع', create: 'اعمل المتجر', pending: 'بنكمّل…', verify: 'أكّد الإيميل', verifyBody: 'اكتب كود التأكيد اللي بعتناه على إيميلك.', code: 'كود التأكيد', resend: 'ابعت كود جديد', required: 'كمّل البيانات المطلوبة واختار طريقة شغلك.', failed: 'مقدرناش نكمّل التسجيل. راجع بياناتك وحاول تاني.', invalid: 'الكود مش صحيح. راجعه أو اطلب كود جديد.', expired: 'صلاحية الكود خلصت. اطلب كود جديد.', resendFailed: 'مقدرناش نبعت كود جديد دلوقتي. استنى شوية وحاول تاني.', resent: 'بعتنا كود تأكيد جديد على إيميلك.', existingPending: 'كمّل بأمان: لو عندك حساب، سجّل دخول أو استرجع كلمة المرور. لو إيميلك لسه مش متأكد، اطلب كود تأكيد.', stale: 'جلسة التسجيل خلصت. ابدأ من جديد.', startOver: 'ابدأ التسجيل من جديد', changeEmail: 'غيّر الإيميل', retry: 'حاول تاني', wait: 'تقدر تطلب كود جديد بعد', expires: 'الكود هينتهي خلال', login: 'عندك حساب؟ سجّل دخول', signIn: 'سجّل دخول بدل كده', recover: 'استرجع كلمة المرور', recoveryTitle: 'كمّل التسجيل بأمان',
} : {
  account: 'Account details', accountBody: 'Your name and email', shop: 'Shop details', shopBody: 'Shop, main location and operation mode', shopName: 'Shop name', mainLocation: 'Main location', mainLocationName: 'Main location name', mainLocationCode: 'Location code (optional)', mainLocationAddress: 'Location address (optional)', mainLocationPhone: 'Location phone (optional)', trial: 'Full product access for 7 days', trialHelp: 'Start with every current Shop Suit feature and no paid-plan choice. Choose a plan and pay with X-Pay from day one when checkout is available; you do not need to wait seven days.', businessMode: 'Business operation mode', businessModeHelp: 'You can change this later in Business settings without losing data.', productMode: 'Products and stock', serviceMode: 'Services only', mixedMode: 'Products, stock and services', next: 'Continue', back: 'Back', create: 'Create shop', pending: 'Continuing…', verify: 'Verify your email', verifyBody: 'Enter the verification code sent to your email.', code: 'Verification code', resend: 'Send another code', required: 'Complete the required fields and choose an operation mode.', failed: 'Could not complete signup. Check your details and try again.', invalid: 'That code is not valid. Check it or request a new code.', expired: 'This code has expired. Request another code.', resendFailed: 'A new code could not be sent yet. Wait a moment and try again.', resent: 'We sent a new verification code to your email.', existingPending: 'Continue safely: if you have an account, sign in or reset your password. If your email still needs verification, request a code.', stale: 'Your saved signup session expired. Start again safely.', startOver: 'Start signup over', changeEmail: 'Change email', retry: 'Retry', wait: 'Request another code in', expires: 'Code expires in', login: 'Already have an account? Sign in', signIn: 'Sign in instead', recover: 'Reset password', recoveryTitle: 'Continue signup safely',
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

const signupConsent = ref(false)
const signupFeatures: BsSignupFeatures = { phone: false, jobTitle: false, organizationDetails: false, mainLocation: true, businessMode: true, passwordMinLength: 6, workspaceMinLength: 2, workspaceMaxLength: 120, locationMinLength: 2, locationMaxLength: 120, locationCodeMaxLength: 32, locationAddressMaxLength: 500, locationPhoneMaxLength: 80 }
const signupProduct: BsSignupProduct = { framed: false, name: 'Shop Suit', assetPrefix: '/brand/shop-suit', homeLabel: '', title: '', description: '' }
const signupForm = computed<BsSignupForm>({
  get: () => ({ name: form.displayName, email: form.email, password: form.password, workspaceName: form.shopName, businessMode: form.businessMode, locationName: form.mainLocationName, locationCode: form.mainLocationCode, locationAddress: form.mainLocationAddress, locationPhone: form.mainLocationPhone, phone: '', jobTitle: '', legalName: '', businessType: '', country: '', currency: '', timezone: '', fiscalMonth: 1, taxIdentifier: '' }),
  set: value => {
    form.displayName = value.name; form.email = value.email; form.password = value.password; form.shopName = value.workspaceName
    form.mainLocationName = value.locationName; form.mainLocationCode = value.locationCode; form.mainLocationAddress = value.locationAddress; form.mainLocationPhone = value.locationPhone
    if (BUSINESS_MODES.includes(value.businessMode as BusinessMode)) form.businessMode = value.businessMode as BusinessMode
  },
})
const signupView = computed<BsSignupView>(() => ({ stage: recovery.value ? 'recovery' : awaitingOtp.value ? 'verification' : step.value === 1 ? 'account' : 'workspace', step: step.value, pending: pending.value, error: errorMessage.value, notice: noticeMessage.value, existingAccount: existingAccount.value, hydrated: undefined, submitDisabled: false, submitLabel: step.value === 1 ? copy.value.next : copy.value.create, pendingLabel: copy.value.pending, expired: verification.expired.value, resendDisabled: verification.resendIn.value > 0, verified: existingAccount.value, canStartOver: !existingAccount.value }))
const signupCopy = computed<BsSignupCopy>(() => ({ eyebrow: 'Shop Suit', title: t('auth.signupTitle'), description: t('auth.signupSubtitle'), name: t('auth.displayName'), email: t('auth.email'), password: t('auth.password'), passwordHint: '', workspaceName: copy.value.shopName, mainLocation: copy.value.mainLocation, locationName: copy.value.mainLocationName, locationCode: copy.value.mainLocationCode, locationAddress: copy.value.mainLocationAddress, locationPhone: copy.value.mainLocationPhone, businessMode: copy.value.businessMode, businessModeHelp: copy.value.businessModeHelp, trialTitle: copy.value.trial, trialBody: copy.value.trialHelp, back: copy.value.back, formFooter: '', signIn: copy.value.signIn, recoveryTitle: copy.value.recoveryTitle, recoveryBody: copy.value.existingPending, recover: copy.value.recover, startOver: `${copy.value.changeEmail} · ${copy.value.startOver}`, phone: '', jobTitle: '', legalName: '', businessType: '', country: '', currency: '', timezone: '', fiscalMonth: '', taxIdentifier: '', optional: '', steps: [{ id: 'account', title: copy.value.account, body: copy.value.accountBody }, { id: 'shop', title: copy.value.shop, body: copy.value.shopBody }] }))
const signupVerificationCopy = computed<BsSignupVerificationCopy>(() => ({ title: copy.value.verify, description: copy.value.verifyBody, codeLabel: copy.value.code, expiryLabel: `${copy.value.expires} ${verification.format(verification.expiresIn.value)}`, expiredLabel: copy.value.expired, submitLabel: existingAccount.value ? copy.value.retry : copy.value.verify, pendingLabel: copy.value.pending, resendLabel: verification.resendIn.value > 0 ? `${copy.value.wait} ${verification.format(verification.resendIn.value)}` : copy.value.resend }))
const signupChoices = computed<BsSignupChoices>(() => ({ businessTypes: [], countries: [], currencies: [], fiscalMonths: [], businessModes: modeOptions.value }))
const signupLinks = computed<BsSignupLinks>(() => ({ signInTo: '/auth/login', recoveryTo: '/auth/forgot-password', formSignInLabel: copy.value.login, verificationFooter: true, legal: [] }))
async function signInFromRecovery() { clearDraft(); await navigateTo('/auth/login') }
</script>
<template>
  <BsSignupPage v-model:form="signupForm" v-model:otp="otp" v-model:consent="signupConsent" :product="signupProduct" :features="signupFeatures" :view="signupView" :copy="signupCopy" :verification-copy="signupVerificationCopy" :choices="signupChoices" :links="signupLinks" :legal-consent="null" @submit="submit" @back="back" @verify="verify" @resend="resend" @start-over="startOver" @sign-in="signInFromRecovery" @clear-draft="clearDraft" />
</template>
