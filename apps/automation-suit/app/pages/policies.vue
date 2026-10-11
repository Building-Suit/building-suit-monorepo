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
</script>
<template>
  <BsPage padding="none" width="full">
    <BsInline justify="between" align="start">
      <BsStack gap="sm">
        <BsText size="xs" tone="muted" emphasis="semibold">
          Routing
        </BsText>
        <BsHeading :level="1">
          Retry policies
        </BsHeading>
        <BsText size="sm" tone="muted">
          Every attempt has an explicit profile. Assignments inherit global → project → workstream → task.
        </BsText>
      </BsStack>
      <BsButton variant="primary" @click="create">
        Create policy
      </BsButton>
    </BsInline>
    <BsAlert v-if="error" tone="error" :description="error.message" />
    <BsGrid columns="auto">
      <BsCard v-for="policy in data?.policies || []" :key="policy.policy_id">
        <BsStack gap="sm">
          <BsInline justify="between">
            <BsStack gap="sm">
              <BsHeading :level="2">
                {{ policy.display_name }}
              </BsHeading>
              <BsText size="xs" tone="muted">
                {{ policy.policy_id }}
              </BsText>
            </BsStack>
            <BsInline align="start">
              <BsStatusBadge :status="policy.active ? 'active' : 'inactive'" :label="policy.active ? 'active' : 'inactive'" :tone="automationStatusTone(policy.active ? 'active' : 'inactive')" />
              <BsButton size="sm" @click="edit(policy)">
                Edit
              </BsButton>
            </BsInline>
          </BsInline>
          <BsList ordered>
            <BsListItem v-for="(profile,index) in policy.attempt_profiles" :key="index">
              <BsText as="span" tone="muted">
                Attempt {{ index + 1 }}
              </BsText>
              <BsText as="strong" emphasis="semibold">
                {{ profile }}
              </BsText>
            </BsListItem>
          </BsList>
        </BsStack>
      </BsCard>
    </BsGrid>
    <BsRecordActionDialog v-model:visible="visible" :title="mode === 'edit' ? 'Edit retry policy' : 'Create retry policy'" :dirty="dirty" :pending="pending" :error="actionError" :submit-disabled="!operator?.writesEnabled" submit-label="Validate and save" @submit="save">
      <BsGrid columns="auto">
        <BsField v-slot="{ id, describedby }" label="Policy ID">
          <BsInput :id="id" v-model="form.policy_id" :aria-describedby="describedby" required />
        </BsField>
        <BsField v-slot="{ id, describedby }" label="Display name">
          <BsInput :id="id" v-model="form.display_name" :aria-describedby="describedby" required />
        </BsField>
        <BsField v-slot="{ id, describedby }" label="Max attempts">
          <BsInput :id="id" v-model.number="form.max_attempts" :aria-describedby="describedby" type="number" min="1" max="20" required />
        </BsField>
      </BsGrid>
      <BsField v-slot="{ id, describedby }" label="Attempt profiles, comma-separated">
        <BsInput :id="id" v-model="form.attempt_profiles" :aria-describedby="describedby" required />
      </BsField>
      <BsCheckbox v-model="form.active" label="Active" />
      <BsText size="xs" tone="muted">
        {{ operator?.writesEnabled ? 'Operator writes enabled' : 'Configure NUXT_CONTROL_OPERATOR_DATABASE_URL to save' }}
      </BsText>
    </BsRecordActionDialog>
  </BsPage>
</template>
