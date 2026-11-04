import type { HqFounderAccessPresentation, HqUserPresentation } from '@building-suit/ui/types/hqLayoutPresentation'
import type { HqFounderAccessResponse } from '../../shared/types/access'

export interface HqFounderAccessMessages {
  invalidCredentials: string
  denied: string
  unavailable: string
  signOutFailed: string
  confirmationRequired?: string
}

type AccessAction = 'check' | 'sign-in' | 'sign-out' | 'register'
type MessageReason = keyof HqFounderAccessMessages

function responseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } }
  const status = value.statusCode ?? value.status ?? value.response?.status
  return typeof status === 'number' ? status : undefined
}

function needsConfirmation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const data = (error as { data?: unknown }).data
  return data !== null && typeof data === 'object' && (data as { reason?: unknown }).reason === 'confirmation-required'
}

function displayUser(value: unknown): HqUserPresentation | undefined {
  if (!value || typeof value !== 'object') return undefined
  const user = value as Record<string, unknown>
  if (typeof user.displayName !== 'string' || !user.displayName.trim() || user.displayName.length > 256) return undefined
  return {
    displayName: user.displayName,
    ...(typeof user.detailLabel === 'string' && user.detailLabel.length <= 320 ? { detailLabel: user.detailLabel } : {}),
    ...(typeof user.avatarUrl === 'string' && user.avatarUrl.length <= 2_048 ? { avatarUrl: user.avatarUrl } : {}),
  }
}

/**
 * Product-scoped BFF access projection. The trusted founder membership check,
 * Supabase session validation and cookie rotation belong to the HQ server.
 */
export function useHqFounderAccess(messages?: () => HqFounderAccessMessages) {
  const status = ref<HqFounderAccessPresentation['status']>('loading')
  const user = shallowRef<HqUserPresentation | undefined>(undefined)
  const pending = ref(false)
  const messageReason = ref<MessageReason | null>(null)
  let request: AbortController | null = null
  let checking: Promise<boolean> | null = null
  let disposed = false
  const headers = { 'X-HQ-Access': '1', 'X-HQ-Brain': '1' }
  const access = computed<HqFounderAccessPresentation>(() => ({
    status: status.value,
    pending: pending.value,
    ...(status.value === 'founder' && user.value ? { user: user.value } : {}),
    ...(messageReason.value && messages ? { message: messages()[messageReason.value] } : {}),
  }))

  function clear(nextStatus: HqFounderAccessPresentation['status']) {
    // Remove identity before network transitions; never retain stale authority.
    user.value = undefined
    status.value = nextStatus
    messageReason.value = null
  }

  async function perform(action: AccessAction, credentials?: { email: string; password: string }): Promise<boolean> {
    if (disposed || pending.value || typeof window === 'undefined') return false
    pending.value = true
    clear(action === 'sign-in' ? 'anonymous' : 'loading')
    const controller = new AbortController()
    request = controller
    try {
      const endpoint = action === 'check' ? '/api/hq/access' : action === 'sign-in' ? '/api/hq/login' : action === 'register' ? '/api/hq/register' : '/api/hq/logout'
      const result = await $fetch<HqFounderAccessResponse>(endpoint, {
        method: action === 'check' ? 'GET' : 'POST',
        ...(action === 'sign-in' || action === 'register' ? { body: credentials } : {}),
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        retry: 0,
        timeout: 45_000,
        signal: controller.signal,
      })
      if (disposed || controller.signal.aborted) return false
      if (result.status !== 'anonymous' && result.status !== 'founder' && result.status !== 'denied' && result.status !== 'unavailable') throw new Error('Invalid HQ access response')
      if (result.status === 'unavailable') {
        clear('error')
        messageReason.value = action === 'sign-out' ? 'signOutFailed' : 'unavailable'
        return false
      }
      const identity = result.status === 'founder' ? displayUser(result.user) : undefined
      if (result.status === 'founder' && !identity) throw new Error('Missing HQ display identity')
      status.value = result.status
      user.value = identity
      if (result.reason === 'confirmation-required') messageReason.value = 'confirmationRequired'
      else if (result.status === 'denied') messageReason.value = 'denied'
      else if (action === 'sign-in' && result.status === 'anonymous') messageReason.value = 'invalidCredentials'
      return result.status === 'founder' || action === 'sign-out' && result.status === 'anonymous'
        || action === 'register' && result.reason === 'confirmation-required'
    }
    catch (error: unknown) {
      if (disposed || controller.signal.aborted) return false
      const code = responseStatus(error)
      if (code === 401 || code === 400 && (action === 'sign-in' || action === 'register')) {
        clear('anonymous')
        if (needsConfirmation(error)) messageReason.value = 'confirmationRequired'
        else if (action === 'sign-in' || action === 'register') messageReason.value = 'invalidCredentials'
        return action === 'sign-out'
      }
      if (code === 403) {
        clear('denied')
        messageReason.value = 'denied'
        return false
      }
      clear('error')
      messageReason.value = action === 'sign-out' ? 'signOutFailed' : 'unavailable'
      return false
    }
    finally {
      if (!disposed) pending.value = false
      if (request === controller) request = null
    }
  }

  function recheck(): Promise<boolean> {
    if (checking) return checking
    const task = perform('check').finally(() => { if (checking === task) checking = null })
    checking = task
    return task
  }

  function signIn(email: string, password: string): Promise<boolean> {
    // Passwords are neither cached nor transformed; the server validates input.
    return perform('sign-in', { email: email.trim(), password })
  }

  function signOut(): Promise<boolean> {
    return perform('sign-out')
  }

  function register(email: string, password: string): Promise<boolean> {
    return perform('register', { email: email.trim(), password })
  }

  function resume() {
    if (document.hidden || !navigator.onLine) return
    void recheck()
  }

  function goOffline() {
    request?.abort()
    clear('error')
    messageReason.value = 'unavailable'
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    window.addEventListener('offline', goOffline)
    void recheck()
  })
  onScopeDispose(() => {
    disposed = true
    request?.abort()
    request = null
    checking = null
    clear('anonymous')
    if (typeof window === 'undefined') return
    document.removeEventListener('visibilitychange', resume)
    window.removeEventListener('focus', resume)
    window.removeEventListener('online', resume)
    window.removeEventListener('offline', goOffline)
  })

  return { access, recheck, signIn, signOut, register }
}
