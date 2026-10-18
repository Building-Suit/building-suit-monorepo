import { createEmailStepController, emailStepState, emailStepDelay, normalizedAuthEmail, validAuthEmail, useSignupWizard, useVerificationTimer } from '@building-suit/ux'
import { bindDoctorRegistrationDraft, newDoctorRegistrationDraft, readDoctorRegistrationDraft, saveDoctorRegistrationDraft, type DoctorRegistrationDraft } from '../utils/registrationDraft.ts'
import { validDoctorSetupForm } from '../utils/practiceSetup.ts'
import type { DoctorRegistrationIdentity } from '../utils/authController'

export function useDoctorRegistration() {
  const { auth, copy, error } = useDoctorAuthPresentation(false)
  const environment = useRuntimeConfig().public.doctorAuth.environment
  const handoff = useDoctorRegistrationHandoff()
  const route = useRoute()
  const wizard = useSignupWizard(2)
  const timer = useVerificationTimer()
  const form = ref({ name: '', phone: '', jobTitle: '', email: '', password: '', workspaceName: '', legalName: '', businessType: '', country: '', currency: '', timezone: '', fiscalMonth: 1, taxIdentifier: '', locationName: '', locationCode: '', locationAddress: '', locationPhone: '', businessMode: '' })
  const otp = ref(''), consent = ref(false), hydrated = ref(false), validation = ref(false), busy = ref(false), restored = ref(false)
  const identity = ref<DoctorRegistrationIdentity | null>(null)
  const identityUnavailable = ref(false)
  const draft = ref<DoctorRegistrationDraft | null>(null)
  let storage: Storage | null = null, disposed = false, generation = 0
  let identityFlight: Promise<void> | null = null
  const emailState = reactive(emailStepState())
  const emailStep = createEmailStepController(emailState, () => form.value.email, async (email, signal) => {
    const response = await $fetch<{ canContinue: boolean }>('/api/auth/email-step', { method: 'POST', body: { email, intent: 'sign-up' }, signal })
    return response.canContinue
  }, emailStepDelay)
  const stage = computed(() => draft.value?.stage === 'challenge' || draft.value?.stage === 'recovery' ? draft.value.stage : wizard.step.value === 2 ? 'workspace' as const : 'account' as const)
  const values = () => ({ displayName: form.value.name.trim(), practiceName: form.value.workspaceName.trim(), locationName: form.value.locationName.trim(), timezone: form.value.timezone.trim() })
  function persist(stageValue?: DoctorRegistrationDraft['stage']) {
    if (!draft.value) return
    draft.value = { ...draft.value, ...values(), email: normalizedAuthEmail(form.value.email), ...(stageValue ? { stage: stageValue } : {}) }
    saveDoctorRegistrationDraft(storage, environment, draft.value)
    handoff.value = { ...draft.value }
  }
  function clearSecrets() { form.value.password = ''; otp.value = '' }
  function validAccount() { return Boolean(form.value.name.trim() && form.value.name.length <= 120 && validAuthEmail(normalizedAuthEmail(form.value.email)) && (identity.value || form.value.password.length >= 12)) }
  const lookupError = computed(() => emailState.error === 'invalid' ? copy.value.invalidEmail : emailState.error === 'rejected' ? copy.value.errors.exists : emailState.error ? copy.value.errors[emailState.error] : '')
  const pending = computed(() => !hydrated.value || identityUnavailable.value || busy.value || auth.state.pending || emailState.pending || wizard.advancing.value)
  const availability = computed(() => identityUnavailable.value ? { state: 'error' as const, title: copy.value.errors.network, description: copy.value.resume, actionLabel: copy.value.continue } : undefined)
  const features = { profileNameMaxLength: 120, standaloneTimezone: true, locationContactFields: false, phone: false, jobTitle: false, organizationDetails: false, mainLocation: true, businessMode: false, passwordMinLength: 12, workspaceMinLength: 1, workspaceMaxLength: 160, locationMinLength: 1, locationMaxLength: 160, locationCodeMaxLength: null, locationAddressMaxLength: null, locationPhoneMaxLength: null }
  const view = computed(() => ({ stage: stage.value === 'challenge' ? 'verification' as const : stage.value, step: wizard.step.value, pending: pending.value, error: validation.value ? copy.value.invalid : lookupError.value || error.value || '', notice: stage.value === 'recovery' ? copy.value.uncertainSignup : restored.value ? copy.value.resume : '', existingAccount: Boolean(identity.value), nameLocked: identity.value?.providerNameVerified || false, hydrated: hydrated.value, submitDisabled: pending.value, submitLabel: wizard.isLastStep.value ? copy.value.signUp : copy.value.continue, pendingLabel: emailState.pending ? copy.value.checkingEmail : copy.value.pending, expired: timer.expired.value || auth.state.error === 'expired', resendDisabled: pending.value || Boolean(draft.value?.userId) || timer.resendIn.value > 0, verified: false, canStartOver: true }))
  const signupCopy = computed(() => ({ ...copy.value, eyebrow: '', title: copy.value.signUp, phone: '', jobTitle: '', workspaceName: copy.value.practice, legalName: '', businessType: '', country: '', currency: '', timezone: copy.value.timezone, fiscalMonth: '', taxIdentifier: '', optional: '', mainLocation: copy.value.practiceStep, locationName: copy.value.firstLocation, locationCode: '', locationAddress: '', locationPhone: '', businessMode: '', businessModeHelp: '', trialTitle: '', trialBody: '', formFooter: copy.value.description, recoveryTitle: copy.value.recovery, recoveryBody: copy.value.uncertainSignup, recover: copy.value.forgot, startOver: copy.value.signUp, steps: [{ id: 'account', title: copy.value.accountStep, body: '' }, { id: 'practice', title: copy.value.practiceStep, body: '' }] }))
  const verificationCopy = computed(() => ({ title: copy.value.verify, description: copy.value.verifyDescription, codeLabel: copy.value.code, expiryLabel: timer.format(timer.expiresIn.value), expiredLabel: copy.value.expired, submitLabel: copy.value.verify, pendingLabel: copy.value.pending, resendLabel: timer.resendIn.value ? `${copy.value.resend} (${timer.resendIn.value})` : copy.value.resend }))
  async function finish() {
    const verified = await auth.registrationIdentity().catch(() => { identityUnavailable.value = true; return null })
    if (disposed || !verified) return false
    const bound = draft.value ? bindDoctorRegistrationDraft(draft.value, verified) : null
    if (!bound) {
      identity.value = null; wizard.reset(); draft.value = newDoctorRegistrationDraft(); handoff.value = null; clearSecrets()
      Object.assign(form.value, { name: '', email: '', workspaceName: '', locationName: '', timezone: '' })
      persist('account'); identityUnavailable.value = true; return false
    }
    draft.value = bound
    identity.value = verified
    await wizard.advance()
    persist('practice')
    // Verification is not admission, enrollment, entitlement or clinical authority.
    if (await auth.refresh() && !disposed) { await navigateTo('/onboarding'); return true }
    return false
  }
  async function submit() {
    if (pending.value || disposed) return
    validation.value = false
    if (stage.value === 'account') {
      validation.value = !validAccount()
      if (validation.value) return
      if (await wizard.advance(() => identity.value ? true : emailStep.check())) { persist('practice'); await navigateTo({ path: '/sign-up', query: { step: '2' } }) }
      return
    }
    if (stage.value !== 'workspace') return
    validation.value = !validAccount() || !validDoctorSetupForm(values(), true)
    if (validation.value) { if (!validAccount()) { wizard.reset(); persist('account'); await navigateTo('/sign-up', { replace: true }) }; return }
    busy.value = true
    const captured = generation
    try {
      if (identity.value) { await finish(); return }
      if (!await emailStep.check() || disposed || captured !== generation) return
      // Persist uncertainty before the provider write. Resume never automatically repeats it.
      persist('recovery')
      const secret = form.value.password
      clearSecrets()
      const succeeded = await auth.signUp(form.value.name.trim(), normalizedAuthEmail(form.value.email), secret)
      if (disposed || captured !== generation || !succeeded) return
      if (auth.state.signupOutcome === 'verified') { await finish(); return }
      timer.start()
      if (draft.value) { draft.value.challengeAt = timer.expiresAt.value - 3600000; draft.value.resendAt = timer.resendAt.value - 60000 }
      persist('challenge')
    } finally { if (!disposed && captured === generation) busy.value = false }
  }
  async function verify() {
    if (pending.value || stage.value !== 'challenge' || timer.expired.value || !/^\d{6}$/.test(otp.value)) return
    busy.value = true
    const captured = generation, code = otp.value; otp.value = ''
    try { await auth.verify(form.value.email, code); if (!disposed && captured === generation) await finish() }
    finally { if (!disposed && captured === generation) busy.value = false }
  }
  async function resend() {
    if (pending.value || draft.value?.userId || !draft.value?.email || timer.resendIn.value > 0) return
    busy.value = true
    const captured = generation; otp.value = ''
    try {
      if (await auth.resend(form.value.email) && !disposed && captured === generation) {
        timer.start(); draft.value!.challengeAt = timer.expiresAt.value - 3600000; draft.value!.resendAt = timer.resendAt.value - 60000; persist('challenge')
      }
    } finally { if (!disposed && captured === generation) busy.value = false }
  }
  async function back() { if (pending.value) return; wizard.back(); validation.value = false; persist('account'); await navigateTo('/sign-up') }
  async function startOver() {
    if (pending.value) return
    generation++; clearSecrets(); emailStep.reset(); timer.reset(); wizard.reset(); validation.value = false; restored.value = false
    draft.value = newDoctorRegistrationDraft(); form.value.email = identity.value?.email || ''; form.value.name = identity.value?.name || ''
    form.value.workspaceName = ''; form.value.locationName = ''; form.value.timezone = ''; persist('account')
    await navigateTo('/sign-up', { replace: true })
  }
  watch(() => form.value.email, () => emailStep.reset())
  watch(() => [form.value.name, form.value.email, form.value.workspaceName, form.value.locationName, form.value.timezone], () => { if (hydrated.value) persist() })
  watch(() => route.query.step, value => {
    if (['challenge','recovery'].includes(stage.value)) return
    if (emailState.pending || wizard.advancing.value) { generation++; emailStep.reset(); wizard.reset(); busy.value = false; validation.value = false; persist('account'); return }
    if (pending.value) return
    if (value !== '2') { wizard.reset(); persist('account') }
    else if (validAccount() && (identity.value || emailState.approved)) { void wizard.advance().then(() => persist('practice')) }
  })
  async function resolveIdentity(captured: number) {
    if (auth.state.phase === 'checking') await auth.refresh()
    if (disposed || captured !== generation) return
    let verified: DoctorRegistrationIdentity | null
    try { verified = await auth.registrationIdentity() }
    catch { if (!disposed && captured === generation) identityUnavailable.value = true; return }
    if (disposed || captured !== generation) return
    identityUnavailable.value = false
    draft.value ||= newDoctorRegistrationDraft()
    if (verified) {
      if (draft.value.email && !bindDoctorRegistrationDraft(draft.value, verified)) { draft.value = newDoctorRegistrationDraft(); handoff.value = null; clearSecrets(); Object.assign(form.value, { name: '', workspaceName: '', locationName: '', timezone: '' }) }
      identity.value = verified; form.value.email = verified.email; if (verified.name) form.value.name = verified.name
      draft.value.userId = verified.userId; draft.value.stage = 'account'
      if (form.value.name.trim()) { await wizard.advance(); persist('practice') }
    } else if (draft.value.userId) {
      // A signed-out tab may still resume its own draft after explicit sign-in.
      // It must not submit registration again as a new account.
      draft.value.stage = 'recovery'
    }
    if (draft.value.stage === 'practice' && !verified) draft.value.stage = 'account' // Password/checks are intentionally not persisted.
    persist()
  }
  async function retryIdentity() {
    if (identityFlight) return identityFlight
    if (busy.value || auth.state.pending || disposed) return
    hydrated.value = false
    const captured = ++generation
    identityFlight = resolveIdentity(captured).finally(() => {
      identityFlight = null
      if (!disposed && captured === generation) hydrated.value = true
    })
    return identityFlight
  }
  let recheckIdentity = false
  watch(() => [auth.state.phase, auth.state.identity?.userId, busy.value, auth.state.pending] as const, ([phase, userId, working, authPending], previous) => {
    if (!hydrated.value || disposed) return
    const changed = phase !== previous[0] || userId !== previous[1]
    if (changed && (identity.value || working)) {
      identity.value = null; clearSecrets(); emailStep.reset(); recheckIdentity = true
    }
    if (!working && !authPending && phase !== 'checking' && recheckIdentity) { recheckIdentity = false; void retryIdentity() }
  }, { flush: 'sync' })
  onMounted(async () => {
    const captured = generation
    try { storage = window.sessionStorage } catch { /* Continue without persistence. */ }
    draft.value = readDoctorRegistrationDraft(storage, environment) || (handoff.value && handoff.value.createdAt <= Date.now() && Date.now() - handoff.value.createdAt < 86400000 ? handoff.value : null) || newDoctorRegistrationDraft()
    Object.assign(form.value, { name: draft.value.displayName, email: draft.value.email, workspaceName: draft.value.practiceName, locationName: draft.value.locationName, timezone: draft.value.timezone })
    restored.value = Boolean(form.value.email)
    timer.restore(draft.value.challengeAt ? draft.value.challengeAt + 3600000 : 0, draft.value.resendAt ? draft.value.resendAt + 60000 : 0)
    try { await resolveIdentity(captured) } finally { if (!disposed && captured === generation) hydrated.value = true }
  })
  onBeforeUnmount(() => { disposed = true; generation++; emailStep.reset(); persist(); clearSecrets() })
  return { form, otp, consent, hydrated, features, view, signupCopy, verificationCopy, submit, verify, resend, startOver, back, clearSecrets, availability, retryIdentity }
}
