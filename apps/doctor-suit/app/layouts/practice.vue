<script setup lang="ts">
import { doctorContextId } from '../utils/locationContext'
import { doctorLocationsCopy } from '../utils/locationsPresentation'
import { doctorAvailabilityCopy } from '../utils/availabilityPresentation'
import { doctorPatientsCopy } from '../utils/patientsPresentation'
import { doctorDelegationCopy } from '../utils/delegationPresentation'
const { auth } = useDoctorAuthPresentation(false)
const { copy } = useDoctorPracticePresentation()
const { locale } = useI18n()
const context = useDoctorContext()
const scopeCopy = computed(() => doctorLocationsCopy(locale.value === 'ar'))
const patientsCopy = computed(() => doctorPatientsCopy(locale.value === 'ar'))
const availabilityCopy = computed(() => doctorAvailabilityCopy(locale.value === 'ar'))
const teamCopy = computed(() => doctorDelegationCopy(locale.value === 'ar'))
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const canLocations = computed(() => context.state.current?.capabilities.some(cap => cap === 'locations.read' || cap === 'locations.manage') || (!context.state.current && Boolean(auth.state.identity?.practiceId)))
const groups = computed(() => [{ key: 'practice', label: copy.value.workspace, links: [{ to: '/workspace', label: copy.value.workspace }, ...(context.state.current?.capabilities.includes('patients.read') ? [{ to: '/patients', label: patientsCopy.value.title }] : []), ...(context.state.current?.capabilities.some(cap => cap === 'availability.manage' || cap === 'appointments.read') ? [{ to: '/availability', label: availabilityCopy.value.title }] : []), ...(canLocations.value ? [{ to: '/locations', label: scopeCopy.value.title }] : []), ...(auth.state.identity?.practiceId && (!context.state.current || context.state.current.portal === 'doctor') ? [{ to: '/onboarding', label: copy.value.edit }] : []), ...(context.state.current?.portal === 'doctor' || (!context.state.options.length && auth.state.identity?.practiceId) ? [{ to: '/team', label: teamCopy.value.teamLink }] : []), { to: '/account', label: copy.value.account }] }])
const caption = computed(() => {
  const selected = context.state.current
  return selected ? [selected.doctorName, selected.practiceName, selected.locationName, selected.timezone, selected.portal === 'doctor' ? scopeCopy.value.owner : scopeCopy.value.secretary].join(' · ') : scopeCopy.value.noContext
})
const scopes = computed(() => context.state.options.length ? [{ key: 'doctor-context', value: context.state.current ? doctorContextId(context.state.current) : null, label: scopeCopy.value.context, placeholder: scopeCopy.value.choose, disabled: !hydrated.value || context.state.phase === 'switching' || context.state.phase === 'loading', visibility: 'always' as const, options: context.state.options.map(item => ({ id: doctorContextId(item), label: `${item.doctorName} · ${item.locationName}`, description: `${item.practiceName} · ${item.timezone}` })) }] : [])
const account = computed(() => ({ name: context.state.current?.portal === 'doctor' ? context.state.current.doctorName : undefined, label: copy.value.account, signOut: copy.value.signOut, pending: auth.state.pending || !hydrated.value, actions: [...(context.state.current?.portal === 'doctor' || (!context.state.options.length && auth.state.identity?.practiceId) ? [{ to: '/team', label: teamCopy.value.teamLink }] : []), { to: '/account', label: copy.value.account }] }))
const state = computed(() => ({ loading: false, error: context.state.phase === 'error', title: context.state.error ? scopeCopy.value.contextErrors[context.state.error] : scopeCopy.value.choose, retry: scopeCopy.value.retry, titleLevel: 1 as const }))
async function selectScope(key: string, value: string | null) { if (key === 'doctor-context' && value) await context.choose(value) }
async function signOut() { await auth.signOut(); await navigateTo('/sign-in') }
watch(() => auth.state.phase, phase => { if (phase === 'signed-out' || phase === 'unavailable') void navigateTo('/sign-in') })
</script>
<template>
  <BsWorkspaceShell home-path="/workspace" product-name="Doctor Suit" :groups="groups" :labels="{ open: copy.open, close: copy.close, navigation: copy.navigation, dashboard: copy.workspace }" :context="caption" :scope-notice="{ title: copy.synthetic, description: caption }" :header-scopes="scopes" :state="state" :account="account" :logo="{ kind: 'text' }" @scope="selectScope" @retry="context.refresh()" @sign-out="signOut"><slot /></BsWorkspaceShell>
</template>
