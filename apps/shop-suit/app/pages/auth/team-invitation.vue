<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'auth' })
const route = useRoute()
const { locale } = useI18n()
const supabase = useSupabaseClient()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
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
    const { error: signOutError } = await supabase.auth.signOut()
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
</script>

<template>
  <BsVerificationForm v-if="verifying && !user" v-model="form.otp" :email="form.email" :code-label="copy.otp" :title="copy.title" :description="copy.help" :pending="pending" :error="error" :notice="notice" :submit-label="copy.verify" :pending-label="copy.verify" :resend-label="timer.resendIn.value > 0 ? `${copy.wait} ${timer.format(timer.resendIn.value)}` : copy.resend" :resend-disabled="timer.resendIn.value > 0" :expired="timer.expired.value" :expiry-label="`${copy.expires} ${timer.format(timer.expiresIn.value)}`" :expired-label="copy.failed" @submit="verify" @resend="resend">
    <template #secondary><BsLink :to="{ path: '/auth/login', query: { invite: code } }">{{ copy.login }}</BsLink></template>
  </BsVerificationForm>
  <BsAuthForm v-else eyebrow="Shop Suit" :title="copy.title" :description="copy.help" :pending="pending" :error="code ? error : copy.invalid" :submit-disabled="!code" :submit-label="user ? copy.accept : copy.create" :pending-label="user ? copy.accept : copy.create" @submit="submit">
    <template v-if="!user && code">
      <BsField v-slot="field" :label="copy.email" required><BsInput :id="field.id" v-model="form.email" type="email" autocomplete="email" required maxlength="254" /></BsField>
      <BsField v-slot="field" :label="copy.password" required><BsInput :id="field.id" v-model="form.password" type="password" autocomplete="new-password" required minlength="8" /></BsField>
    </template>
    <BsText v-if="user" size="sm">{{ user.email }}</BsText>
    <BsButton v-if="user" variant="secondary" :disabled="pending" @click="switchAccount">{{ copy.switchAccount }}</BsButton>
    <template #footer><BsStack gap="sm"><BsLink :to="{ path: '/auth/login', query: { invite: code } }">{{ copy.login }}</BsLink><BsLink to="/auth/forgot-password">{{ copy.recover }}</BsLink></BsStack></template>
  </BsAuthForm>
</template>
