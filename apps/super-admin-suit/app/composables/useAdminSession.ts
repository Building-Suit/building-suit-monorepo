import type { Database } from '../types/database.types'
import type { AdminSession } from '../../server/utils/authorize'

export function useAdminSession() {
  const client = useSupabaseClient<Database>()
  const requestFetch = useRequestFetch()
  const session = useAsyncData('super-admin-session', () => requestFetch<AdminSession>('/api/session'), { dedupe: 'cancel' })
  const pending = ref(false)
  const actionError = ref(false)
  const action = ref<'sign-in' | 'sign-out' | null>(null)
  const state = computed(() => {
    if (pending.value) return action.value === 'sign-in' ? 'signed-out' : 'loading'
    if (session.status.value === 'pending') return 'loading'
    if (session.data.value) return 'success'
    const code = session.error.value?.statusCode
    if (code === 401) return 'signed-out'
    if (code === 403) return 'denied'
    return 'error'
  })
  function clear() {
    clearNuxtData(key => key.startsWith('super-admin-registry:'))
    session.clear()
    actionError.value = false
  }
  async function recheck() {
    clear()
    await session.refresh()
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
    const { data: listener } = client.auth.onAuthStateChange(() => {
      clear()
      clearTimeout(timer)
      timer = setTimeout(() => { void recheck() }, 0)
    })
    const onFocus = () => { void recheck() }
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
