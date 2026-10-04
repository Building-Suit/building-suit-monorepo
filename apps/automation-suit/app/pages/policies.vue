<script setup lang="ts">
import type { RetryPolicyRow } from '../../types/operations'
const { data, error, refresh } = await useFetch<{ policies: RetryPolicyRow[] }>('/api/policies')
const { data: operator } = await useFetch<{ writesEnabled: boolean }>('/api/operator/status')
const form = reactive({ policy_id: '', display_name: '', max_attempts: 3, attempt_profiles: 'standard,standard,deep', active: true })
const action = useRecordAction(() => form)
const { visible, dirty, pending, error: actionError, mode } = action
const { success } = useToasts()
function create() {
  Object.assign(form, { policy_id: '', display_name: '', max_attempts: 3, attempt_profiles: 'standard,standard,deep', active: true })
  action.create()
}
function edit(policy: RetryPolicyRow) {
  Object.assign(form, { policy_id: policy.policy_id, display_name: policy.display_name, max_attempts: policy.max_attempts, attempt_profiles: policy.attempt_profiles.join(','), active: policy.active })
  action.edit()
}
async function save() {
  const profiles = form.attempt_profiles.split(',').map(value => value.trim()).filter(Boolean)
  const saved = await action.run(async () => {
    if (profiles.length !== form.max_attempts) throw new Error('invalid profile count')
    await $fetch('/api/operator/policies', { method: 'POST', body: { ...form, attempt_profiles: profiles, metadata: {} } })
    await refresh()
  }, () => profiles.length !== form.max_attempts
    ? `Expected ${form.max_attempts} profiles; received ${profiles.length}.`
    : 'The policy could not be saved.')
  if (saved) success('Policy saved and audited.')
}
</script>
<template>
  <main class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><p class="text-xs font-bold uppercase tracking-widest text-fg-muted">Routing</p><h1 class="mt-2 text-3xl font-black">Retry policies</h1><p class="mt-1 text-sm text-fg-muted">Every attempt has an explicit profile. Assignments inherit global → project → workstream → task.</p></div>
      <BsButton variant="primary" @click="create">Create policy</BsButton>
    </div>
    <p v-if="error" class="text-danger">{{ error.message }}</p>
    <div class="grid gap-4 xl:grid-cols-2">
      <BsCard v-for="policy in data?.policies || []" :key="policy.policy_id">
        <div class="flex justify-between gap-3"><div><h2 class="font-black">{{ policy.display_name }}</h2><p class="font-mono text-xs text-fg-muted">{{ policy.policy_id }}</p></div><div class="flex items-start gap-2"><DashboardStatusPill :value="policy.active ? 'active' : 'inactive'" /><BsButton size="sm" @click="edit(policy)">Edit</BsButton></div></div>
        <ol class="mt-4 grid gap-2 sm:grid-cols-2"><li v-for="(profile,index) in policy.attempt_profiles" :key="index" class="rounded-control border border-[var(--bs-border)] p-3 text-sm"><span class="text-fg-muted">Attempt {{ index + 1 }}</span><strong class="ms-2">{{ profile }}</strong></li></ol>
      </BsCard>
    </div>
    <BsRecordActionDialog v-model:visible="visible" :title="mode === 'edit' ? 'Edit retry policy' : 'Create retry policy'" :dirty="dirty" :pending="pending" :error="actionError" :submit-disabled="!operator?.writesEnabled" submit-label="Validate and save" @submit="save">
      <div class="grid gap-3 md:grid-cols-3">
        <FloatingField label="Policy ID"><input v-model="form.policy_id" class="ls-input" required></FloatingField>
        <FloatingField label="Display name"><input v-model="form.display_name" class="ls-input" required></FloatingField>
        <FloatingField label="Max attempts"><input v-model.number="form.max_attempts" type="number" min="1" max="20" class="ls-input" required></FloatingField>
      </div>
      <FloatingField label="Attempt profiles, comma-separated"><input v-model="form.attempt_profiles" class="ls-input font-mono" required></FloatingField>
      <label class="flex items-center gap-2 text-sm"><input v-model="form.active" type="checkbox">Active</label>
      <p class="text-xs text-fg-muted">{{ operator?.writesEnabled ? 'Operator writes enabled' : 'Configure NUXT_CONTROL_OPERATOR_DATABASE_URL to save' }}</p>
    </BsRecordActionDialog>
  </main>
</template>
