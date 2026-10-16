<script setup lang="ts">
const { auth } = useDoctorAuthPresentation(false)
const { practice, copy } = useDoctorPracticePresentation()
const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const groups = computed(() => [{ key: 'practice', label: copy.value.workspace, links: [{ id: 'workspace', to: '/workspace', label: copy.value.workspace }, { id: 'profile', to: '/onboarding', label: copy.value.edit }, { id: 'account', to: '/account', label: copy.value.account }] }])
const context = computed(() => [practice.state.setup?.practice?.name, practice.state.setup?.location?.name, practice.state.setup?.location?.timezone].filter(Boolean).join(' · '))
const account = computed(() => ({ name: practice.state.setup?.profile?.displayName, label: copy.value.account, signOut: copy.value.signOut, pending: auth.state.pending || !hydrated.value, actions: [{ id: 'account', to: '/account', label: copy.value.account }] }))
async function signOut() { await auth.signOut(); await navigateTo('/sign-in') }
watch(() => auth.state.phase, phase => { if (phase === 'signed-out' || phase === 'unavailable') void navigateTo('/sign-in') })
</script>
<template>
  <BsWorkspaceShell home-path="/workspace" product-name="Doctor Suit" :groups="groups" :labels="{ open: copy.open, close: copy.close, navigation: copy.navigation, dashboard: copy.workspace }" :context="context" :scope-notice="{ title: copy.synthetic, description: context || copy.missing }" :account="account" :logo="{ kind: 'text' }" @sign-out="signOut"><slot /></BsWorkspaceShell>
</template>
