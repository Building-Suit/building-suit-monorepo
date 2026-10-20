import {createConsultationsController,consultationsState} from '../utils/consultationsController'
import {consultationsRepository} from '../utils/consultationsRepository'
import {clinicalReleaseRepository} from '../utils/clinicalReleaseRepository'
import {createClinicalReleaseController,clinicalReleaseState} from '../utils/clinicalReleaseController'
import{doctorManualReportRepository}from'../utils/manualReconciliationRepository'
import{createManualReportController,manualReportState}from'../utils/manualReconciliationController'
import{doctorManualPaymentRepository}from'../utils/manualPaymentRepository'
import{createManualPaymentController,manualPaymentState}from'../utils/manualPaymentController'
import{doctorPrivacyRepository}from'../utils/privacyRepository'
import{createDoctorPrivacyController,doctorPrivacyState}from'../utils/privacyController'
import{doctorSaasRepository}from'../utils/saasRepository'
import{createDoctorSubscriptionController,doctorSubscriptionState}from'../utils/saasController'
import { doctorScopeKey } from '../utils/contextScope'
import { doctorAuditRepository } from '../utils/auditRepository'
import { createDoctorAuditController,doctorAuditState } from '../utils/auditController'
import { doctorAccountRepository } from '../utils/accountRepository'
import { createDoctorAccountController,doctorAccountState } from '../utils/accountController'
import { doctorDashboardRepository } from '../utils/dashboardRepository'
import { createDoctorDashboardController,doctorDashboardState } from '../utils/dashboardController'
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
import { clinicalRepository } from '../utils/clinicalRepository'
import { createClinicalController,clinicalState } from '../utils/clinicalController'

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
  const registrationHandoff = useDoctorRegistrationHandoff()
  watch(() => state.identity?.userId, userId => { if (userId && registrationHandoff.value?.userId && registrationHandoff.value.userId !== userId) registrationHandoff.value = null })
  const preference = useCookie<DoctorContextPreference | null>(`bs-doctor-${settings.environment}-context`, { sameSite: 'lax', path: '/', secure: provider.origin.startsWith('https:') })
  const context = createDoctorContextController(client ? doctorContextRepository(client) : null, reactive(doctorContextState()), () => state.identity, provider.environment, { read: () => preference.value, write: value => { preference.value = value } },import.meta.client ? {
    now: () => performance.now(),set: (callback,delay) => window.setTimeout(callback,delay),clear: handle => window.clearTimeout(handle as number),
  } : undefined)
  const privacy=createDoctorPrivacyController(client?doctorPrivacyRepository(client):null,reactive(doctorPrivacyState()),()=>state.identity,provider.environment)
  const subscription=createDoctorSubscriptionController(client?doctorSaasRepository(client):null,reactive(doctorSubscriptionState()),()=>state.identity,()=>context.expire(),import.meta.client?{now:()=>performance.now(),set:(callback,delay)=>setTimeout(callback,delay),clear:handle=>clearTimeout(handle as ReturnType<typeof setTimeout>)}:undefined)
  const manualReport=createManualReportController(client?doctorManualReportRepository(client):null,reactive(manualReportState()),()=>state.identity,provider.environment)
  const manualPayment=createManualPaymentController(client?doctorManualPaymentRepository(client,provider.url,provider.key):null,reactive(manualPaymentState()),()=>state.identity,provider.environment,()=>{subscription.clear()})
  const account = createDoctorAccountController(client ? doctorAccountRepository(client) : null,reactive(doctorAccountState()),() => state.identity,provider.environment)
  const auditScope = () => {
    const selected = context.state.current
    if(selected?.capabilities.includes('audit.read'))return { key: doctorScopeKey(selected,'administrative-audit'),kind: 'practice' as const,practiceId: selected.practiceId,locationId: selected.portal==='doctor' ? null : selected.locationId }
    const actor = state.identity
    return actor?.practiceId && context.state.phase==='choosing' && !context.state.options.length ? { key: JSON.stringify(['doctor-suit',provider.environment,actor.userId,actor.sessionId,actor.practiceId,'owner-audit']),kind: 'practice' as const,practiceId: actor.practiceId,locationId: null } : null
  }
  const personalAuditScope = () => { const actor = state.identity;return actor ? { key: JSON.stringify(['doctor-suit',provider.environment,actor.userId,actor.sessionId,'personal-audit']),kind: 'personal' as const,practiceId: null,locationId: null } : null }
  const audit = createDoctorAuditController(client ? doctorAuditRepository(client) : null,reactive(doctorAuditState()),auditScope)
  const personalAudit = createDoctorAuditController(client ? doctorAuditRepository(client) : null,reactive(doctorAuditState()),personalAuditScope)
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
  const entitlementTimers=import.meta.client?{now:()=>performance.now(),set:(callback:()=>void,delay:number)=>setTimeout(callback,delay),clear:(handle:unknown)=>clearTimeout(handle as ReturnType<typeof setTimeout>)}:undefined
  const expiredOwnerScope=()=>context.expire()
  const locations = createDoctorLocationsController(client ? doctorLocationsRepository(client) : null, reactive(doctorLocationsState()), locationsScope,undefined,entitlementTimers,expiredOwnerScope)
  const patientsScope = () => {
    const selected = context.state.current
    return selected?.locationId && selected.capabilities.includes('patients.read') ? selected : null
  }
  const patients = createDoctorPatientsController(client ? doctorPatientsRepository(client) : null, reactive(doctorPatientsState()), patientsScope)
  const consultations=createConsultationsController(client?consultationsRepository(client):null,reactive(consultationsState()),patientsScope)
  const clinical=createClinicalController(client?clinicalRepository(client):null,reactive(clinicalState()),patientsScope)
  context.registerClear(clinical.clear)
  const clinicalRelease=createClinicalReleaseController(client?clinicalReleaseRepository(client,provider.url,provider.key):null,reactive(clinicalReleaseState()),()=>state.identity,provider.environment)
  context.registerClear(clinicalRelease.clear)
  const patientProfile = createDoctorProfileController(client ? doctorPatientProfileRepository(client,provider.url,provider.key) : null,reactive(doctorProfileState()),patientsScope)
  const availabilityScope = () => { const selected = context.state.current; return selected?.capabilities.some(cap => cap==='availability.manage' || cap==='appointments.read') ? selected : null }
  const availability = createDoctorAvailabilityController(client ? doctorAvailabilityRepository(client) : null,reactive(doctorAvailabilityState()),availabilityScope)
  const appointmentsScope = () => { const selected = context.state.current;return selected?.capabilities.includes('appointments.read') ? selected : null }
  const appointments = createDoctorAppointmentsController(client ? doctorAppointmentsRepository(client) : null,reactive(doctorAppointmentsState()),appointmentsScope)
  const dashboard = createDoctorDashboardController(client ? doctorDashboardRepository(client,provider.environment) : null,reactive(doctorDashboardState()),() => state.identity)
  const appointmentsLive = createDoctorAppointmentsRealtime(import.meta.client ? client ?? null : null,appointments.disconnected)
  const delegation = client ? doctorDelegationRepository(client) : null
  const teamScope = (): DoctorContextScope | null => {
    const selected = locationsScope()
    return selected?.portal === 'doctor' && selected.practiceId === state.identity?.practiceId ? selected : null
  }
  const team = createDoctorTeamController(delegation, reactive(doctorTeamState()), teamScope,undefined,undefined,entitlementTimers,expiredOwnerScope)
  const invitation = createDoctorInvitationController(delegation, reactive(doctorInvitationState()), () => state.identity)
  const controller = createDoctorAuthController(client ? doctorAuthBackend(client, settings.origin) : null, state, {
    clear: () => { manualReport.clear();manualPayment.clear();privacy.clear();subscription.clear();account.clear(); personalAudit.clear(); void context.clear() },
    locked: () => locked.value === '1', lock: () => { registrationHandoff.value = null; if (import.meta.client) { try { window.sessionStorage.removeItem(`doctor-suit.${settings.environment}.registration.v1`) } catch { /* Storage may be denied. */ } }; locked.value = '1'; context.forgetPreference() }, unlock: () => { locked.value = null },
  })
  context.registerClear(() => { consultations.clear();manualReport.clear();manualPayment.clear();audit.clear(); practice.clear(); locations.clear(); patients.clear(); patientProfile.clear(); availability.clear(); appointments.clear(); dashboard.clear(); void appointmentsLive.update(null,async () => {}); team.clear(); invitation.clear(); nuxtApp.runWithContext(() => clearNuxtData(key => key.startsWith('doctor-suit') || key.startsWith('["doctor-suit"'))) })
  if (import.meta.client && client) {
    const { data } = client.auth.onAuthStateChange(event => {
      // Never await SDK calls while its internal auth lock holds this callback.
      if (event !== 'INITIAL_SESSION') controller.providerChanged()
    })
    nuxtApp.vueApp.onUnmount(() => { data.subscription.unsubscribe(); client.auth.stopAutoRefresh();void context.clear(); void appointmentsLive.dispose() })
  }
  return { provide: { doctorConsultations:consultations,doctorClinicalRelease:clinicalRelease,doctorClinical:clinical,doctorManualReport:manualReport,doctorManualPayment:manualPayment,doctorPrivacy:privacy,doctorSubscription:subscription,doctorAudit: audit,doctorAuditScope: auditScope,doctorPersonalAudit: personalAudit,doctorPersonalAuditScope: personalAuditScope,doctorAccount: account,doctorDashboard: dashboard,doctorAuth: controller, doctorPractice: practice, doctorContext: context, doctorLocations: locations, doctorLocationsScope: locationsScope, doctorTeam: team, doctorTeamScope: teamScope, doctorInvitation: invitation, doctorAvailability: availability, doctorAvailabilityScope: availabilityScope, doctorAppointments: appointments,doctorAppointmentsScope: appointmentsScope,doctorAppointmentsLive: appointmentsLive,doctorPatientProfile: patientProfile, doctorPatients: patients, doctorPatientsScope: patientsScope } }
})
