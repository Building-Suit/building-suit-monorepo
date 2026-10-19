<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: false })
const route = useRoute()
const { locale, t } = useI18n()
const supabase = useShopClient()
const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const user = useSupabaseUser()
const { reload, selectShop } = useShop()
const code = computed(() => typeof route.query.invite === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(route.query.invite) ? route.query.invite : '')
const form = reactive({ email: '', password: '', otp: '' })
const verifying = ref(false)
const pending = ref(false)
const error = ref('')
const notice = ref('')
const timer = useVerificationTimer()
const copy = computed(() => locale.value === 'ar' ? {
  switchAccount: 'تسجيل الدخول بحساب تاني', title: 'قبول دعوة الفريق', help: 'سجّل دخول بحساب البريد المدعو أو أنشئ حسابك هنا. اختار كلمة المرور بنفسك.',
  email: 'البريد الإلكتروني', password: 'كلمة المرور', create: 'إنشاء حسابي', login: 'عندي حساب — تسجيل الدخول',
  accept: 'قبول الدعوة', otp: 'كود تأكيد البريد', verify: 'تأكيد البريد', resend: 'إرسال كود جديد',
  sent: 'راجع بريدك لتأكيد الحساب. لو عندك حساب بالفعل، سجّل دخول أو استرجع كلمة المرور.',
  failed: 'مقدرناش نكمّل. راجع البريد والكود وصلاحية الدعوة وحاول تاني.', invalid: 'رابط الدعوة غير صالح.',
  expires: 'الكود هينتهي خلال', wait: 'تقدر تطلب كود جديد بعد', recover: 'استرجاع كلمة المرور',
} : {
  switchAccount: 'Sign in with another account', title: 'Accept team invitation', help: 'Sign in with the invited email or create your account here. Choose your own password.',
  email: 'Email', password: 'Password', create: 'Create my account', login: 'I have an account — sign in',
  accept: 'Accept invitation', otp: 'Email verification code', verify: 'Verify email', resend: 'Send another code',
  sent: 'Check your email to verify your account. If you already have an account, sign in or reset your password.',
  failed: 'Could not continue. Check the email, code and invitation validity and try again.', invalid: 'This invitation link is invalid.',
  expires: 'Code expires in', wait: 'Request another code in', recover: 'Reset password',
})
async function switchAccount() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
    if (signOutError) throw signOutError
    await navigateTo({ path: '/auth/login', query: { invite: code.value } })
  } catch { error.value = copy.value.failed }
  finally { pending.value = false }
}
async function accept() {
  const { data, error: acceptError } = await rpc.rpc('accept_shop_invitation', { p_request_id: crypto.randomUUID(), p_invitation_code: code.value })
  if (acceptError) throw acceptError
  await reload()
  if (data) await selectShop(data)
  await navigateTo('/team', { replace: true })
}
async function submit() {
  if (pending.value || !code.value) return
  pending.value = true
  error.value = ''
  try {
    if (user.value) { await accept(); return }
    const { data, error: signupError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(), password: form.password,
      options: { emailRedirectTo: `${window.location.origin}/auth/team-invitation?invite=${code.value}` },
    })
    form.password = ''
    if (signupError) throw signupError
    if (data.session && data.user?.email_confirmed_at) { await accept(); return }
    verifying.value = true
    timer.start()
    notice.value = copy.value.sent
  } catch { error.value = copy.value.failed }
  finally { pending.value = false }
}
async function verify() {
  if (pending.value || !form.otp) return
  pending.value = true
  error.value = ''
  try {
    const { error: otpError } = await supabase.auth.verifyOtp({ email: form.email.trim().toLowerCase(), token: form.otp, type: 'signup' })
    form.otp = ''
    if (otpError) throw otpError
    await accept()
  } catch { error.value = copy.value.failed }
  finally { pending.value = false }
}
async function resend() {
  if (pending.value || timer.resendIn.value > 0) return
  pending.value = true
  error.value = ''
  try {
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: form.email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/auth/team-invitation?invite=${code.value}` } })
    if (resendError) throw resendError
    timer.start()
    notice.value = copy.value.sent
  } catch { error.value = copy.value.failed }
  finally { pending.value = false }
}

const identityForm = computed({
  get: () => ({ email: form.email, password: form.password, confirmation: '', name: '', phone: '', jobTitle: '' }),
  set: (value: import('@building-suit/ui/types/invitationPresentation').BsInvitationIdentityForm) => { form.email = value.email; form.password = value.password },
})
const pageCopy = computed(() => ({
  eyebrow: 'Shop Suit', title: copy.value.title, description: copy.value.help, submit: user.value ? copy.value.accept : copy.value.create, pending: user.value ? copy.value.accept : copy.value.create, invalid: copy.value.invalid, email: copy.value.email, password: copy.value.password, switchAccount: copy.value.switchAccount, login: copy.value.login, recover: copy.value.recover,
  verification: { title: copy.value.title, description: copy.value.help, code: copy.value.otp, submit: copy.value.verify, pending: copy.value.verify, resend: timer.resendIn.value > 0 ? `${copy.value.wait} ${timer.format(timer.resendIn.value)}` : copy.value.resend, expired: copy.value.failed, expiry: `${copy.value.expires} ${timer.format(timer.expiresIn.value)}` },
}))
const pageStage = computed(() => verifying.value && !user.value ? 'verification' : user.value ? 'accept' : code.value ? 'signup' : 'unavailable')
</script>
<template>
  <BsInvitationAcceptancePage v-model:form="identityForm" v-model:code="form.otp" :product="{ name: 'Shop Suit', assetPrefix: '/brand/shop-suit', homeLabel: locale === 'ar' ? 'الرئيسية' : 'Home', title: `${t('hero.title')} ${t('hero.subtitle')}`, description: t('hero.description') }" :stage="pageStage" :copy="pageCopy" :email="user?.email ?? form.email" :pending="pending" :error="code ? error : copy.invalid" :submit-disabled="!code" :email-max-length="254" :login-to="{ path: '/auth/login', query: { invite: code } }" recover-to="/auth/forgot-password" :verification="{ resendDisabled: timer.resendIn.value > 0, expired: timer.expired.value, notice }" @submit="submit" @verify="verify" @resend="resend" @switch-account="switchAccount" />
</template>
