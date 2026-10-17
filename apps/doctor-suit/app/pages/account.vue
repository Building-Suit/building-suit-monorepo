<script setup lang="ts">
import { doctorLocationsCopy } from '../utils/locationsPresentation'
import { doctorDelegationCopy } from '../utils/delegationPresentation'
definePageMeta({ layout: false, middleware: 'doctor-auth' })
const { auth, copy, product, error } = useDoctorAuthPresentation()
const { practice, copy: practiceCopy } = useDoctorPracticePresentation()
const personal = useDoctorAccountPresentation()
const { view: accountView,form: accountForm,editorOpen: accountEditorOpen } = personal
const context = useDoctorContext()
await context.refresh()
if (!context.state.options.length && !auth.state.identity?.practiceId) await practice.load()
const practiceLinks = computed(() => auth.state.identity?.practiceId || context.state.options.length ? [{ label: practiceCopy.value.workspace, to: '/workspace' }, ...(auth.state.identity?.practiceId ? [{ label: scopeCopy.value.title, to: '/locations' }] : [])] : practice.state.setup?.enrollment === 'owner' ? [{ label: practiceCopy.value.setupLink, to: '/onboarding' }] : [])
const { locale } = useI18n()
const scopeCopy = computed(() => doctorLocationsCopy(locale.value === 'ar'))
const teamCopy = computed(() => doctorDelegationCopy(locale.value === 'ar'))
const links = computed(() => [...(auth.state.identity?.practiceId || practice.state.setup?.enrollment==='owner'?[{label:locale.value==='ar'?'اشتراك Doctor Suit':'Doctor Suit subscription',to:'/subscription'}]:[]),{ label: locale.value==='ar' ? 'نشاط حسابي الشخصي' : 'My account activity',to: '/account-activity' },...practiceLinks.value, ...(auth.state.identity?.practiceId ? [{ label: teamCopy.value.teamLink, to: '/team' }] : []), { label: teamCopy.value.acceptLink, to: '/invitations/accept' }])
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const availability = computed(() => auth.state.phase !== 'authenticated' || !auth.state.identity ? { state: 'loading' as const, title: copy.value.checking, description: copy.value.checkingDescription } : undefined)
async function signOut() { await auth.signOut(); await navigateTo('/sign-in') }
watch(() => auth.state.phase, phase => { if ((phase === 'signed-out' || phase === 'unavailable') && !personal.reauthenticating.value) void navigateTo('/sign-in') })
</script>
<template>
  <BsAccountSessionPage v-model:account-form="accountForm" v-model:account-editor-open="accountEditorOpen" :settings="accountView" :availability="availability" :product="product" :title="copy.account" :description="copy.accountDescription" :status="copy.status" :status-description="auth.state.identity?.practiceId ? practiceCopy.boundaries : copy.statusDescription" :links="links" :sign-out="copy.signOut" :pending="auth.state.pending || !hydrated" :error="error" @edit-account="personal.edit" @save-account="personal.save" @reload-account="personal.account.load" @reauthenticate="personal.reauthenticate" @sign-out="signOut" />
</template>
