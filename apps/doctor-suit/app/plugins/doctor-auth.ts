import { doctorAppointmentsRepository } from '../utils/appointmentsRepository'
import { createDoctorAppointmentsController,doctorAppointmentsState } from '../utils/appointmentsController'
import { createDoctorAppointmentsRealtime } from '../utils/appointmentsRealtime'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { Database } from '../types/database.types'
import { createDoctorAuthController, doctorAuthState } from '../utils/authController'
import { doctorAuthBackend } from '../utils/authBackend'
import { doctorProviderConfiguration } from '../utils/authConfiguration'
import { doctorPracticeRepository } from '../utils/practiceRepository'
import { createDoctorPracticeController, doctorPracticeState } from '../utils/practiceController'
import { createDoctorContextController, doctorContextState } from '../utils/contextController'
import { doctorContextRepository } from '../utils/contextRepository'
import type { DoctorContextPreference } from '../utils/locationContext'
import type { DoctorContextScope } from '../utils/contextScope'
import { createDoctorLocationsController, doctorLocationsState } from '../utils/locationsController'
import { doctorLocationsRepository } from '../utils/locationsRepository'
import { doctorAvailabilityRepository } from '../utils/availabilityRepository'
import { createDoctorAvailabilityController,doctorAvailabilityState } from '../utils/availabilityController'
import { doctorPatientProfileRepository } from '../utils/patientProfileRepository'
import { createDoctorProfileController,doctorProfileState } from '../utils/patientProfileController'
import { doctorPatientsRepository } from '../utils/patientsRepository'
import { createDoctorPatientsController, doctorPatientsState } from '../utils/patientsController'
import { doctorDelegationRepository } from '../utils/delegationRepository'
import { createDoctorTeamController, doctorTeamState } from '../utils/teamController'
import { createDoctorInvitationController, doctorInvitationState } from '../utils/invitationController'

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
  const preference = useCookie<DoctorContextPreference | null>(`bs-doctor-${settings.environment}-context`, { sameSite: 'lax', path: '/', secure: provider.origin.startsWith('https:') })
  const context = createDoctorContextController(client ? doctorContextRepository(client) : null, reactive(doctorContextState()), () => state.identity, provider.environment, { read: () => preference.value, write: value => { preference.value = value } })
  const practice = createDoctorPracticeController(client ? doctorPracticeRepository(client) : null, reactive(doctorPracticeState()), () => state.identity)
  const locationsScope = (): DoctorContextScope | null => {
    const selected = context.state.current
    if (selected) return selected.capabilities.some(cap => cap === 'locations.read' || cap === 'locations.manage') ? selected : null
    const actor = state.identity
    // Practice-wide owner settings remain available when every location is archived.
    if (actor?.practiceId && context.state.phase === 'choosing' && !context.state.options.length) return {
      environment: provider.environment, portal: 'doctor', userId: actor.userId, sessionId: actor.sessionId,
      practiceId: actor.practiceId, locationId: null, grantsVersion: 0,
    }
    return null
  }
  const locations = createDoctorLocationsController(client ? doctorLocationsRepository(client) : null, reactive(doctorLocationsState()), locationsScope)
  const patientsScope = () => {
    const selected = context.state.current
    return selected?.locationId && selected.capabilities.includes('patients.read') ? selected : null
  }
  const patients = createDoctorPatientsController(client ? doctorPatientsRepository(client) : null, reactive(doctorPatientsState()), patientsScope)
  const patientProfile = createDoctorProfileController(client ? doctorPatientProfileRepository(client,provider.url,provider.key) : null,reactive(doctorProfileState()),patientsScope)
  const availabilityScope = () => { const selected = context.state.current; return selected?.capabilities.some(cap => cap==='availability.manage' || cap==='appointments.read') ? selected : null }
  const availability = createDoctorAvailabilityController(client ? doctorAvailabilityRepository(client) : null,reactive(doctorAvailabilityState()),availabilityScope)
  const appointmentsScope = () => { const selected = context.state.current;return selected?.capabilities.includes('appointments.read') ? selected : null }
  const appointments = createDoctorAppointmentsController(client ? doctorAppointmentsRepository(client) : null,reactive(doctorAppointmentsState()),appointmentsScope)
  const appointmentsLive = createDoctorAppointmentsRealtime(import.meta.client ? client ?? null : null,appointments.disconnected)
  const delegation = client ? doctorDelegationRepository(client) : null
  const teamScope = (): DoctorContextScope | null => {
    const selected = locationsScope()
    return selected?.portal === 'doctor' && selected.practiceId === state.identity?.practiceId ? selected : null
  }
  const team = createDoctorTeamController(delegation, reactive(doctorTeamState()), teamScope)
  const invitation = createDoctorInvitationController(delegation, reactive(doctorInvitationState()), () => state.identity)
  const controller = createDoctorAuthController(client ? doctorAuthBackend(client, settings.origin) : null, state, {
    clear: () => { void context.clear() },
    locked: () => locked.value === '1', lock: () => { locked.value = '1'; context.forgetPreference() }, unlock: () => { locked.value = null },
  })
  context.registerClear(() => { practice.clear(); locations.clear(); patients.clear(); patientProfile.clear(); availability.clear(); appointments.clear(); void appointmentsLive.update(null,async () => {}); team.clear(); invitation.clear(); nuxtApp.runWithContext(() => clearNuxtData(key => key.startsWith('doctor-suit') || key.startsWith('["doctor-suit"'))) })
  if (import.meta.client && client) {
    const { data } = client.auth.onAuthStateChange(event => {
      // Never await SDK calls while its internal auth lock holds this callback.
      if (event !== 'INITIAL_SESSION') controller.providerChanged()
    })
    nuxtApp.vueApp.onUnmount(() => { data.subscription.unsubscribe(); client.auth.stopAutoRefresh(); void appointmentsLive.dispose() })
  }
  return { provide: { doctorAuth: controller, doctorPractice: practice, doctorContext: context, doctorLocations: locations, doctorLocationsScope: locationsScope, doctorTeam: team, doctorTeamScope: teamScope, doctorInvitation: invitation, doctorAvailability: availability, doctorAvailabilityScope: availabilityScope, doctorAppointments: appointments,doctorAppointmentsScope: appointmentsScope,doctorAppointmentsLive: appointmentsLive,doctorPatientProfile: patientProfile, doctorPatients: patients, doctorPatientsScope: patientsScope } }
})
