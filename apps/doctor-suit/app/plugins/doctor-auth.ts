import type { SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { Database } from '../types/database.types'
import { createDoctorAuthController, doctorAuthState } from '../utils/authController'
import { doctorAuthBackend } from '../utils/authBackend'
import { doctorProviderConfiguration } from '../utils/authConfiguration'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const settings = config.public.doctorAuth
  const provider = doctorProviderConfiguration({ APP_ENV: settings.environment, APP_URL: settings.origin, DOCTOR_SUPABASE_URL: settings.url, DOCTOR_SUPABASE_PUBLISHABLE_KEY: settings.key })
  let client: SupabaseClient<Database> | undefined
  if (settings.configured && provider.enabled) {
    const options = {
      cookieOptions: { name: provider.cookiePrefix, sameSite: 'lax' as const, path: '/', secure: provider.origin.startsWith('https:') },
      auth: { flowType: 'pkce' as const, detectSessionInUrl: false },
    }
    if (import.meta.server) {
      const incoming = useRequestHeader('cookie') || ''
      const outgoing = useResponseHeader('set-cookie')
      client = createServerClient<Database>(provider.url, provider.key, { ...options, cookies: {
        getAll: () => parseCookieHeader(incoming).filter(cookie => cookie.name.startsWith(provider.cookiePrefix)).map(cookie => ({ name: cookie.name, value: cookie.value || '' })),
        setAll: cookies => {
          const previous = outgoing.value
          outgoing.value = [...(Array.isArray(previous) ? previous : previous ? [String(previous)] : []), ...cookies.map(({ name, value, options }) => serializeCookieHeader(name, value, options))]
        },
      } })
    } else {
      client = createBrowserClient<Database>(provider.url, provider.key, { ...options, isSingleton: false })
    }
  }
  const locked = useCookie<string | null>(`bs-doctor-${settings.environment}-locked`, { sameSite: 'lax', path: '/', secure: settings.origin.startsWith('https:') })
  const state = reactive(doctorAuthState())
  const controller = createDoctorAuthController(client ? doctorAuthBackend(client, settings.origin) : null, state, {
    clear: () => nuxtApp.runWithContext(() => clearNuxtData(key => key.startsWith('doctor-suit') || key.startsWith('["doctor-suit"'))),
    locked: () => locked.value === '1', lock: () => { locked.value = '1' }, unlock: () => { locked.value = null },
  })
  if (import.meta.client && client) {
    const { data } = client.auth.onAuthStateChange(event => {
      // Never await SDK calls while its internal auth lock holds this callback.
      if (event !== 'INITIAL_SESSION') controller.providerChanged()
    })
    nuxtApp.vueApp.onUnmount(() => { data.subscription.unsubscribe(); client.auth.stopAutoRefresh() })
  }
  return { provide: { doctorAuth: controller } }
})
