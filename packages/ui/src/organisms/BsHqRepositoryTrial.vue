<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HqRepositoryMode, HqRepositoryTrialPresentation, HqTrialCommand } from '../types/hqAgentsPresentation'

const props = defineProps<{ agentId: string; trial: HqRepositoryTrialPresentation; pending: boolean }>()
const emit = defineEmits<{ command: [command: HqTrialCommand] }>()
const sha = ref('7614a98ae05d6c1e69ad05f2b35318823d306e8f')
const mode = ref<HqRepositoryMode>('snapshot'), pullRequest = ref(''), predecessor = ref('')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const prNumber = computed(() => /^\d{1,10}$/.test(pullRequest.value) ? Number(pullRequest.value) : NaN)
const valid = computed(() => /^[0-9a-f]{40}$/.test(sha.value)
  && (mode.value !== 'approved-pr' || Number.isSafeInteger(prNumber.value) && prNumber.value > 0 && prNumber.value <= 2147483647)
  && (props.agentId !== 'AG-DEV-003' || uuid.test(predecessor.value)))
function chooseMode(value: unknown) {
  if (value === 'snapshot' || value === 'stg' || value === 'approved-pr') mode.value = value
}
function freeze() {
  if (!valid.value || props.pending || !props.trial.freezeEligible) return
  emit('command', { action: 'freeze-repository', agentId: props.agentId, preset: props.trial.preset, mode: mode.value,
    sha: sha.value, pullRequestNumber: mode.value === 'approved-pr' ? prNumber.value : null,
    predecessorArtifactId: props.agentId === 'AG-DEV-003' ? predecessor.value : null })
}
</script>

<template>
  <section aria-label="Public repository trial">
    <h3>Public repository trial</h3>
    <p>Building-Suit/building-suit-monorepo · <bdi>{{ trial.preset }}</bdi></p>
    <p>This permits bounded anonymous public reads only. No shell, writes, private repository access or arbitrary paths. Ordinary skill qualification remains required.</p>
    <p role="status">{{ trial.qualified ? 'Repository qualification recorded for the current binding' : trial.status ? `Repository trial: ${trial.status}` : 'Repository qualification required' }} · {{ trial.budgetRemaining }} requests remaining</p>
    <form @submit.prevent="freeze">
      <BsSelect :model-value="mode" :options="[{ label: 'Historical snapshot', value: 'snapshot' }, { label: 'Verify staging commit', value: 'stg' }, { label: 'Approved pull request', value: 'approved-pr' }]" option-label="label" option-value="value" label="Repository bundle mode" :disabled="pending || !trial.freezeEligible" append-to="self" @update:model-value="chooseMode" />
      <BsField v-slot="field" label="Public commit SHA" required><BsInput :id="field.id" v-model="sha" :aria-describedby="field.describedby" maxlength="40" pattern="[0-9a-f]{40}" spellcheck="false" required :disabled="pending || !trial.freezeEligible" /></BsField>
      <p>The default is a frozen historical snapshot, not a claim about the latest staging commit.</p>
      <BsField v-if="mode === 'approved-pr'" v-slot="field" label="Approved pull request number" required><BsInput :id="field.id" v-model="pullRequest" :aria-describedby="field.describedby" inputmode="numeric" maxlength="10" required :disabled="pending || !trial.freezeEligible" /></BsField>
      <BsField v-if="agentId === 'AG-DEV-003'" v-slot="field" label="Accepted predecessor artifact ID" required><BsInput :id="field.id" v-model="predecessor" :aria-describedby="field.describedby" maxlength="36" required :disabled="pending || !trial.freezeEligible" /></BsField>
      <BsButton type="submit" :disabled="pending || !trial.freezeEligible || !valid">Freeze public repository bundle</BsButton>
    </form>
    <p v-if="!trial.freezeEligible">Current ordinary qualification, canonical source binding and bound reviewers must be ready before freezing.</p>
    <dl v-if="trial.bundleId"><dt>Frozen bundle</dt><dd><bdi>{{ trial.bundleId }}</bdi></dd><dt>Commit</dt><dd><bdi>{{ trial.sha }}</bdi></dd><dt>Mode</dt><dd>{{ trial.mode }}</dd><dt>Expires</dt><dd>{{ trial.expiresAt }}</dd><template v-if="trial.predecessorArtifactId"><dt>Predecessor artifact</dt><dd><bdi>{{ trial.predecessorArtifactId }}</bdi></dd></template></dl>
    <BsButton v-if="trial.eligible && trial.bindingCurrent && trial.bundleId && !trial.qualified && trial.status !== 'active'" :disabled="pending" @click="emit('command', { action: 'start-repository', agentId, bundleId: trial.bundleId })">Start repository trial</BsButton>
    <BsButton v-if="trial.reviewComplete && trial.bindingCurrent && trial.reviewerReady && trial.trialId && !trial.receiptIssued && !trial.qualified" :disabled="pending" @click="emit('command', { action: 'qualify-repository', agentId, trialId: trial.trialId })">Approve repository qualification</BsButton>
  </section>
</template>
