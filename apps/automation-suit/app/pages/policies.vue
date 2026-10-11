<script setup lang="ts">
import { automationStatusTone } from '../utils/automationStatusTone'
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

const policyViews = computed(() => (data.value?.policies ?? []).map(policy => ({
  id: policy.policy_id, name: policy.display_name,
  status: policy.active ? 'active' : 'inactive', statusLabel: policy.active ? 'active' : 'inactive',
  statusTone: automationStatusTone(policy.active ? 'active' : 'inactive'),
  attempts: policy.attempt_profiles.map((profile, index) => ({ id: String(index), label: `Attempt ${index + 1}`, profile })),
})))
const editorForm = computed({
  get: () => ({ id: form.policy_id, name: form.display_name, maximumAttempts: form.max_attempts, profiles: form.attempt_profiles, active: form.active }),
  set: (value: import('@building-suit/ui/types/routingPolicyPresentation').BsRoutingPolicyForm) => Object.assign(form, { policy_id: value.id, display_name: value.name, max_attempts: value.maximumAttempts, attempt_profiles: value.profiles, active: value.active }),
})
const copy = computed(() => ({
  eyebrow: 'Routing', title: 'Retry policies', description: 'Every attempt has an explicit profile. Assignments inherit global → project → workstream → task.',
  create: 'Create policy', edit: 'Edit', createTitle: 'Create retry policy', editTitle: 'Edit retry policy', submit: 'Validate and save',
  id: 'Policy ID', name: 'Display name', maximumAttempts: 'Max attempts', profiles: 'Attempt profiles, comma-separated', active: 'Active',
  writeStatus: operator.value?.writesEnabled ? 'Operator writes enabled' : 'Configure NUXT_CONTROL_OPERATOR_DATABASE_URL to save',
}))
function editById(id: string) { const policy = data.value?.policies.find(row => row.policy_id === id); if (policy) edit(policy) }
</script>
<template>
  <BsRoutingPolicyPage v-model:form="editorForm" v-model:visible="visible" :policies="policyViews" :copy="copy" :error="error?.message" :editor="{ editing: mode === 'edit', dirty, pending, error: actionError, canSubmit: Boolean(operator?.writesEnabled) }" @create="create" @edit="editById" @submit="save" />
</template>
