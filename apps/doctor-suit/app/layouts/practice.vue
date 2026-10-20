<script setup lang="ts">
import { doctorContextId } from '../utils/locationContext'
import { doctorLocationsCopy } from '../utils/locationsPresentation'
import { doctorAppointmentsCopy } from '../utils/appointmentsPresentation'
import { doctorAvailabilityCopy } from '../utils/availabilityPresentation'
import { doctorPatientsCopy } from '../utils/patientsPresentation'
import { doctorDelegationCopy } from '../utils/delegationPresentation'
import { doctorWorkspaceNavigation } from '../utils/workspaceNavigation'
const brand = useDoctorBrand()
const { auth } = useDoctorAuthPresentation(false)
const { copy } = useDoctorPracticePresentation()
const { locale } = useI18n()
const context = useDoctorContext()
const scopeCopy = computed(() => doctorLocationsCopy(locale.value === 'ar'))
const patientsCopy = computed(() => doctorPatientsCopy(locale.value === 'ar'))
const availabilityCopy = computed(() => doctorAvailabilityCopy(locale.value === 'ar'))
const appointmentsCopy = computed(() => doctorAppointmentsCopy(locale.value === 'ar'))
const teamCopy = computed(() => doctorDelegationCopy(locale.value === 'ar'))
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const navigation = computed(() => doctorWorkspaceNavigation({capabilities:context.state.current?.capabilities??[],portal:context.state.current?.portal,ownsPractice:Boolean(auth.state.identity?.practiceId),hasCurrent:Boolean(context.state.current),hasOptions:Boolean(context.state.options.length),choosing:context.state.phase==='choosing'},
  {waitlist:locale.value==='ar'?'قائمة الانتظار':'Waitlist',appointmentTypes:locale.value==='ar'?'أنواع المواعيد':'Appointment types',clinical:locale.value==='ar'?'مساحة سريرية اصطناعية':'Synthetic clinical workspace',workspace:copy.value.workspace,patients:patientsCopy.value.title,appointments:appointmentsCopy.value.title,availability:availabilityCopy.value.title,audit:locale.value==='ar'?'سجل النشاط الإداري':'Administrative audit',locations:scopeCopy.value.title,practice:copy.value.edit,team:teamCopy.value.teamLink,account:copy.value.account}))
const caption = computed(() => {
  const selected = context.state.current
  return selected ? [selected.doctorName, selected.practiceName, selected.locationName, selected.timezone, selected.portal === 'doctor' ? scopeCopy.value.owner : scopeCopy.value.secretary].join(' · ') : scopeCopy.value.noContext
})
const scopes = computed(() => context.state.options.length ? [{ key: 'doctor-context', value: context.state.current ? doctorContextId(context.state.current) : null, label: scopeCopy.value.context, placeholder: scopeCopy.value.choose, disabled: !hydrated.value || context.state.phase === 'switching' || context.state.phase === 'loading', visibility: 'always' as const, options: context.state.options.map(item => ({ id: doctorContextId(item), label: `${item.doctorName} · ${item.locationName}`, description: `${item.practiceName} · ${item.timezone}` })) }] : [])
const account = computed(() => ({ name: context.state.current?.portal === 'doctor' ? context.state.current.doctorName : undefined, label: copy.value.account, signOut: copy.value.signOut, pending: auth.state.pending || !hydrated.value, actions: [...(context.state.current?.portal === 'doctor' || (!context.state.options.length && auth.state.identity?.practiceId) ? [{ to: '/team', label: teamCopy.value.teamLink }] : []), ...(context.state.current?.portal==='doctor' || (!context.state.options.length && auth.state.identity?.practiceId)?[{to:'/subscription',label:locale.value==='ar'?'اشتراك Doctor Suit':'Doctor Suit subscription'}]:[]), { to: '/account', label: copy.value.account }] }))
const state = computed(() => ({ loading: false, error: context.state.phase === 'error', title: context.state.error ? scopeCopy.value.contextErrors[context.state.error] : scopeCopy.value.choose, retry: scopeCopy.value.retry, titleLevel: 1 as const }))
async function selectScope(key: string, value: string | null) { if (key === 'doctor-context' && value) await context.choose(value) }
async function signOut() { await auth.signOut(); await navigateTo('/sign-in') }
watch(() => auth.state.phase, phase => { if (phase === 'signed-out' || phase === 'unavailable') void navigateTo('/sign-in') })
</script>
<template>
  <BsWorkspaceShell home-path="/workspace" product-name="Doctor Suit" :groups="navigation.groups" :mobile-links="navigation.mobileLinks" :labels="{ open: copy.open, close: copy.close, navigation: copy.navigation, dashboard: copy.workspace }" :context="caption" :scope-notice="{ title: copy.synthetic, description: caption }" :header-scopes="scopes" :state="state" :account="account" :logo="{ kind: 'product', assetPrefix: brand.assetPrefix }" @scope="selectScope" @retry="context.refresh()" @sign-out="signOut"><slot /></BsWorkspaceShell>
</template>
