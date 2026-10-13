import type { Database } from '../types/database.types'
import { clearActivationAttempts } from '../utils/activation-attempt'
import type { AdminSession } from '../../server/utils/authorize'

export function useAdminSession() {
  const client = useSupabaseClient<Database>()
  const requestFetch = useRequestFetch()
  const session = useAsyncData('super-admin-session', () => requestFetch<AdminSession>('/api/session'), { dedupe: 'cancel' })
  const pending = ref(false)
  const actionError = ref(false)
  const action = ref<'sign-in' | 'sign-out' | null>(null)
  const nuxtApp = useNuxtApp()
  let revision = 0
  let checking: Promise<boolean> | null = null
  const state = computed<'success' | 'signed-out' | 'loading' | 'denied' | 'error'>(() => {
    if (pending.value) return action.value === 'sign-in' ? 'signed-out' : 'loading'
    const code = session.error.value?.statusCode
    if (code === 401) return 'signed-out'
    if (code === 403) return 'denied'
    if (session.data.value) return 'success'
    if (session.status.value === 'pending') return 'loading'
    return 'error'
  })
  function clear() {
    ++revision; checking = null
    clearNuxtData(key => key.startsWith('super-admin-registry:'))
    session.clear()
    actionError.value = false
  }
  function recheck(): Promise<boolean> {
    if (checking) return checking
    // Share only an in-flight check; a new event must revalidate authority.
    const expected = revision
    const task = (async () => {
      await session.refresh()
      if (expected !== revision) return false
      const code = session.error.value?.statusCode
      if (code === 401 || code === 403) {
        nuxtApp.runWithContext(() => clearNuxtData(key => key.startsWith('super-admin-registry:')))
      }
      const valid = !session.error.value && !!session.data.value
      return valid
    })().catch(() => false).finally(() => { if (checking === task) checking = null })
    checking = task
    return task
  }
  async function signIn(email: string, password: string) {
    if (pending.value) return
    pending.value = true
    action.value = 'sign-in'
    clear()
    try {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) {
        await recheck()
        actionError.value = true
      } else await recheck()
    } catch {
      actionError.value = true
    } finally { pending.value = false; action.value = null }
  }
  async function signOut() {
    if (pending.value) return
    pending.value = true
    action.value = 'sign-out'
    clear() // Remove sensitive state before waiting for network logout.
    if (import.meta.client) { try { clearActivationAttempts(sessionStorage) } catch { /* Storage may be disabled. */ } }
    try {
      const { error } = await client.auth.signOut()
      if (error) actionError.value = true
      else await recheck()
    } catch { actionError.value = true }
    finally { pending.value = false; action.value = null }
  }
  onMounted(() => {
    // Do not await Supabase operations inside its auth notification lock.
    let timer: ReturnType<typeof setTimeout> | undefined
    const { data: listener } = client.auth.onAuthStateChange((event, identity) => {
      if (event === 'SIGNED_OUT' || identity?.user.id) {
        try { clearActivationAttempts(sessionStorage, event === 'SIGNED_OUT' ? undefined : identity?.user.id) } catch { /* Storage may be disabled. */ }
      }
      const changed = event === 'SIGNED_OUT' || (!!identity?.user.id && identity.user.id !== session.data.value?.userId)
      // Supabase repeats SIGNED_IN on focus. Same-user notifications do not
      // change authority or destroy an in-progress review.
      if (!changed && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION') return
      if (changed) nuxtApp.runWithContext(clear)
      clearTimeout(timer)
      timer = setTimeout(() => { void recheck() }, 0)
    })
    const onFocus = () => { if (navigator.onLine && document.visibilityState === 'visible') void recheck() }
    window.addEventListener('focus', onFocus)
    onScopeDispose(() => {
      clearTimeout(timer)
      listener.subscription.unsubscribe()
      window.removeEventListener('focus', onFocus)
      clear()
    })
  })
  return { ready: session, state, pending, actionError, recheck, signIn, signOut }
}
