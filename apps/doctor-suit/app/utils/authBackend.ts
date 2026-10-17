import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorAuthBackend, DoctorIdentity } from './authController'

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
function sessionFailure(): never { throw Object.assign(new Error('Doctor session unavailable'), { code: 'DOCTOR_SESSION_REQUIRED' }) }
function checked(error: unknown) { if (error) throw error }

export function doctorAuthBackend(client: SupabaseClient<Database>, origin: string): DoctorAuthBackend {
  return {
    async marker() {
      const { data, error } = await client.rpc('doctor_runtime_contract').abortSignal(AbortSignal.timeout(8000))
      return !error && record(data) && data.product === 'doctor-suit' && data.version === 1 && data.data_mode === 'synthetic'
    },
    async identity(): Promise<DoctorIdentity | null> {
      const user = await client.auth.getUser()
      if (user.error || !user.data.user) return null
      const { data, error } = await client.rpc('doctor_session_context').abortSignal(AbortSignal.timeout(8000))
      if (error || !record(data) || data.product !== 'doctor-suit' || data.user_id !== user.data.user.id
        || !uuid(data.user_id) || !uuid(data.session_id) || !(data.practice_id === null || uuid(data.practice_id))) sessionFailure()
      return { userId: data.user_id, sessionId: data.session_id, practiceId: data.practice_id }
    },
    async signIn(email, password) { checked((await client.auth.signInWithPassword({ email, password })).error) },
    async signUp(name, email, password) {
      checked((await client.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/verify`, data: { display_name: name } } })).error)
    },
    async verify(email, code) { checked((await client.auth.verifyOtp({ email, token: code, type: 'signup' })).error) },
    async exchange(code, flowId) { checked((await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)).error) },
    async resend(email) { checked((await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/verify` } })).error) },
    async recover(email) { checked((await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/recover` })).error) },
    async password(password) { checked((await client.auth.updateUser({ password })).error) },
    async signOut() { checked((await client.auth.signOut({ scope: 'local' })).error) },
  }
}
