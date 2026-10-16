<script setup lang="ts">
definePageMeta({ layout: 'practice', middleware: 'doctor-auth' })
const { practice, copy, error } = useDoctorPracticePresentation()
await practice.load()
const denied = computed(() => practice.state.phase === 'denied' ? { title: copy.value.denied, description: copy.value.deniedDescription } : undefined)
const profile = computed(() => {
  const setup = practice.state.setup
  return setup?.practice && setup.profile ? { title: setup.practice.name, fields: [{ id: 'doctor', label: copy.value.name, value: setup.profile.displayName }, { id: 'verification', label: copy.value.verification, value: copy.value.unverified }] } : undefined
})
const location = computed(() => {
  const item = practice.state.setup?.location
  return item ? { title: copy.value.location, fields: [{ id: 'name', label: copy.value.locationName, value: item.name }, { id: 'timezone', label: copy.value.timezone, value: item.timezone }] } : undefined
})
</script>
<template>
  <BsPracticeOverviewPage :title="copy.workspace" :description="copy.workspaceDescription" :notice="{ title: copy.synthetic, description: copy.boundaries }" :loading="practice.state.phase === 'loading' || practice.state.phase === 'idle'" :loading-label="copy.loading" :error="error" :retry-label="copy.retry" :denied="denied" :profile="profile" :location="location" :actions="[{ label: profile ? copy.edit : copy.setupLink, to: '/onboarding' }]" @retry="practice.load()" />
</template>
