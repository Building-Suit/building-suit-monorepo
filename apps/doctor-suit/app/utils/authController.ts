export type DoctorAuthError = 'unavailable' | 'credentials' | 'expired' | 'rate-limit' | 'network' | 'session' | 'password' | 'sign-out'
export interface DoctorIdentity { userId: string; sessionId: string; practiceId: string | null }
export interface DoctorAuthState {
  phase: 'checking' | 'unavailable' | 'signed-out' | 'verification' | 'authenticated'
  pending: boolean
  identity: DoctorIdentity | null
  error: DoctorAuthError | null
  providerReady: boolean
}
export interface DoctorAuthBackend {
  marker(): Promise<boolean>
  identity(): Promise<DoctorIdentity | null>
  signIn(email: string, password: string): Promise<void>
  signUp(name: string, email: string, password: string): Promise<void>
  verify(email: string, code: string): Promise<void>
  exchange(code: string, flowId?: string): Promise<void>
  resend(email: string): Promise<void>
  recover(email: string): Promise<void>
  password(password: string): Promise<void>
  signOut(): Promise<void>
}
export function doctorAuthState(): DoctorAuthState {
  return { phase: 'checking', pending: false, identity: null, error: null, providerReady: false }
}
export function authFailure(error: unknown): DoctorAuthError {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (['invalid_credentials', 'email_not_confirmed'].includes(code)) return 'credentials'
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'pkce_code_verifier_not_found'].includes(code)) return 'expired'
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) return 'rate-limit'
  if (['weak_password', 'same_password'].includes(code)) return 'password'
  if (code === 'DOCTOR_SESSION_REQUIRED') return 'session'
  return 'network'
}

export function createDoctorAuthController(backend: DoctorAuthBackend | null, state: DoctorAuthState, effects: {
  clear: () => void
  locked: () => boolean
  lock: () => void
  unlock: () => void
}) {
  let revision = 0
  let needsRefresh = false
  let refreshFlight: Promise<boolean> | null = null
  if (!backend) state.phase = 'unavailable'
  function invalidate() { revision++; state.identity = null; effects.clear() }
  async function provider(captured = revision) {
    if (!backend) { state.phase = 'unavailable'; state.providerReady = false; return false }
    if (state.providerReady) return true
    const ready = await backend.marker()
    if (captured !== revision) return false
    state.providerReady = ready
    if (!state.providerReady) state.phase = 'unavailable'
    return state.providerReady
  }
  async function reconcile(allowUnlock = false) {
    invalidate()
    const captured = revision
    state.phase = 'checking'
    try {
      if (!await provider(captured)) return false
      if (effects.locked() && !allowUnlock) { state.phase = 'signed-out'; return false }
      const identity = await backend!.identity()
      if (captured !== revision) return false
      if (!identity) { state.phase = 'signed-out'; return false }
      if (allowUnlock) effects.unlock()
      state.identity = identity
      state.phase = 'authenticated'
      state.error = null
      return true
    } catch (error) {
      if (captured === revision) { state.identity = null; state.phase = state.providerReady ? 'signed-out' : 'unavailable'; state.error = authFailure(error) }
      return false
    }
  }
  async function action(operation: () => Promise<void>, verifiedSession: boolean, verification = false) {
    if (state.pending) return false
    state.pending = true
    state.error = null
    const previousPhase = state.phase
    invalidate()
    const captured = revision
    try {
      if (!await provider(captured)) { if (captured === revision) state.error = 'unavailable'; return false }
      await operation()
      if (verifiedSession && await reconcile(true)) { needsRefresh = false; return true }
      if (verifiedSession && !state.error) state.error = 'session'
      state.phase = verification ? 'verification' : 'signed-out'
      return !verifiedSession
    } catch (error) { state.identity = null; state.phase = previousPhase === 'verification' ? 'verification' : 'signed-out'; state.error = authFailure(error); return false }
    finally {
      state.pending = false
      if (needsRefresh) { queueMicrotask(() => { void refresh() }) }
    }
  }
  function refresh(): Promise<boolean> {
    if (state.pending) { needsRefresh = true; return Promise.resolve(false) }
    if (refreshFlight) return refreshFlight
    refreshFlight = (async () => {
      let result: boolean
      do { needsRefresh = false; result = await reconcile() } while (needsRefresh && !state.pending)
      return result
    })().finally(() => { refreshFlight = null })
    return refreshFlight
  }
  return {
    state,
    refresh,
    providerChanged() {
      invalidate()
      state.phase = 'checking'
      needsRefresh = true
      if (!state.pending) queueMicrotask(() => { void refresh() })
    },
    signIn(email: string, password: string) { return action(() => backend!.signIn(email, password), true) },
    signUp(name: string, email: string, password: string) { return action(() => backend!.signUp(name, email, password), false, true) },
    verify(email: string, code: string) { return action(() => backend!.verify(email, code), true) },
    exchange(code: string, flowId?: string) { return action(() => backend!.exchange(code, flowId), true) },
    resend(email: string) { return action(() => backend!.resend(email), false, true) },
    recover(email: string) { return action(() => backend!.recover(email), false) },
    password(password: string) { return action(() => backend!.password(password), true) },
    async signOut() {
      if (state.pending) return false
      state.pending = true
      effects.lock()
      invalidate()
      state.phase = 'signed-out'
      try { if (backend) await backend.signOut(); state.error = null; return true }
      catch { state.error = 'sign-out'; return false }
      finally { state.pending = false; needsRefresh = false }
    },
  }
}
