<script setup lang="ts">
import { doctorLocationsCopy } from '../utils/locationsPresentation'
definePageMeta({ layout: 'practice', middleware: 'doctor-auth' })
const { copy } = useDoctorPracticePresentation()
const context = useDoctorContext()
const dashboard = useDoctorDashboardPage()
const { locale } = useI18n()
const scopeCopy = computed(() => doctorLocationsCopy(locale.value === 'ar'))
await context.refresh()
const denied = computed(() => !context.state.options.length ? { title: scopeCopy.value.choose, description: scopeCopy.value.chooseDescription } : undefined)
const profile = computed(() => {
  const selected = context.state.current
  return selected ? { title: selected.practiceName, fields: [{ id: 'doctor', label: copy.value.name, value: selected.doctorName }, { id: 'verification', label: copy.value.verification, value: copy.value.unverified }] } : undefined
})
const location = computed(() => {
  const item = context.state.current
  return item ? { title: scopeCopy.value.currentLocation, fields: [{ id: 'name', label: copy.value.locationName, value: item.locationName }, { id: 'timezone', label: copy.value.timezone, value: item.timezone }] } : undefined
})
const actions = computed(() => context.state.current?.portal === 'doctor' ? [{ label: copy.value.edit, to: '/onboarding' }, { label: scopeCopy.value.title, to: '/locations' }] : [])
</script>
<template>
  <BsPracticeOverviewPage :title="copy.workspace" :description="scopeCopy.workspaceDescription" :notice="{ title: copy.synthetic, description: copy.boundaries }" :loading="context.state.phase === 'loading' || context.state.phase === 'idle'" :loading-label="copy.loading" :error="null" :retry-label="copy.retry" :denied="denied" :profile="profile" :location="location" :actions="actions" :activity="dashboard.copy.value" :activity-sections="dashboard.sections.value" :activity-loading="dashboard.loading.value" :activity-pending="dashboard.pending.value" :activity-error="dashboard.error.value" :refreshed-at="dashboard.refreshedAt.value" @refresh="dashboard.refresh()" @page="dashboard.page" @source="dashboard.source" @retry="context.refresh()" />
</template>
