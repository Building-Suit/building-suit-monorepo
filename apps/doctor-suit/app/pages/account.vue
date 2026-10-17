<script setup lang="ts">
import { doctorLocationsCopy } from '../utils/locationsPresentation'
import { doctorDelegationCopy } from '../utils/delegationPresentation'
definePageMeta({ layout: false, middleware: 'doctor-auth' })
const { auth, copy, product, error } = useDoctorAuthPresentation()
const { practice, copy: practiceCopy } = useDoctorPracticePresentation()
const context = useDoctorContext()
await context.refresh()
if (!context.state.options.length && !auth.state.identity?.practiceId) await practice.load()
const practiceLinks = computed(() => auth.state.identity?.practiceId || context.state.options.length ? [{ label: practiceCopy.value.workspace, to: '/workspace' }, ...(auth.state.identity?.practiceId ? [{ label: scopeCopy.value.title, to: '/locations' }] : [])] : practice.state.setup?.enrollment === 'owner' ? [{ label: practiceCopy.value.setupLink, to: '/onboarding' }] : [])
const { locale } = useI18n()
const scopeCopy = computed(() => doctorLocationsCopy(locale.value === 'ar'))
const teamCopy = computed(() => doctorDelegationCopy(locale.value === 'ar'))
const links = computed(() => [...practiceLinks.value, ...(auth.state.identity?.practiceId ? [{ label: teamCopy.value.teamLink, to: '/team' }] : []), { label: teamCopy.value.acceptLink, to: '/invitations/accept' }])
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const availability = computed(() => auth.state.phase !== 'authenticated' || !auth.state.identity ? { state: 'loading' as const, title: copy.value.checking, description: copy.value.checkingDescription } : undefined)
async function signOut() { await auth.signOut(); await navigateTo('/sign-in') }
watch(() => auth.state.phase, phase => { if (phase === 'signed-out' || phase === 'unavailable') void navigateTo('/sign-in') })
</script>
<template>
  <BsAccountSessionPage :availability="availability" :product="product" :title="copy.account" :description="copy.accountDescription" :status="copy.status" :status-description="auth.state.identity?.practiceId ? practiceCopy.boundaries : copy.statusDescription" :links="links" :sign-out="copy.signOut" :pending="auth.state.pending || !hydrated" :error="error" @sign-out="signOut" />
</template>
