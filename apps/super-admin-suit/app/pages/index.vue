<script setup lang="ts">
import { approvalBlocked } from '../utils/payment-review'
definePageMeta({ layout: false })
const { t, locale, messages } = useI18n()
const { ready, state, pending, actionError, recheck, signIn, signOut } = useAdminSession()
await ready
const { registry, selection, state: registryState, label } = useAdminRegistry()
if (state.value === 'success') await registry.refresh()
watch(state, (value) => {
  registry.clear()
  if (value === 'success') void registry.refresh()
})
onMounted(() => {
  // Periodically re-resolve configuration and manifest expiry without a rebuild.
  const timer = setInterval(() => {
    if (state.value === 'success' && !transferVisible.value && !offerVisible.value && !offerRequest.value && !billingVisible.value && !reviewCommand.value && document.visibilityState === 'visible') void registry.refresh()
  }, 30_000)
  onScopeDispose(() => { clearInterval(timer); registry.clear() })
})
const transfer = useManualTransfer(() => selection.value.item?.bindingId, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'manual-transfer')
const { configuration, draft, reason, status: transferStatus, command, action: transferAction } = transfer
const { visible: transferVisible, pending: transferPending, dirty: transferDirty, error: transferError } = transferAction
const activity = useActivity(() => `${ready.data.value?.userId}:${ready.data.value?.authorityEnvironmentId}:${state.value}:${selection.value.suit?.key}:${selection.value.item?.key}`, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'activity')
const { query: activityQuery, rows: activityRows, sources: activitySources, total: activityTotal, status: activityStatus, retrieving, remoteFailed } = activity
const offers = useCustomOffers(() => selection.value.item?.bindingId, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'custom-offers')
const { versions: offerVersions, status: offerStatus, draft: offerDraft, reason: offerReason, command: offerRequest, revokeId, issueId, issuanceAvailable, customerLink } = offers
const { visible: offerVisible, pending: offerPending, dirty: offerDirty, error: offerError } = offers.action
const billing = usePaymentReview(() => selection.value.item?.bindingId, () => state.value === 'success' && registryState.value === 'success' && selection.value.item?.module === 'payment-review')
const { queue, status: billingStatus, filter: billingFilter, page: billingPage, selected: payment, draft: reviewDraft, command: reviewCommand, receipt, evidence, evidencePending, evidenceError, action: billingAction } = billing
const { visible: billingVisible, pending: billingPending, dirty: billingDirty, error: billingError } = billingAction
const accountModules = ref<{ bindingId: string; label: Record<string, string> }[]>([])
const moduleError = ref(false)
const requestFetch = useRequestFetch()
let moduleGeneration = 0
async function loadAccountModules() {
  const epoch = ++moduleGeneration
  accountModules.value = []; moduleError.value = false
  if (state.value !== 'success') return
  try {
    const result = await requestFetch<{ modules: typeof accountModules.value }>('/api/accounts/context')
    if (epoch === moduleGeneration && state.value === 'success') accountModules.value = result.modules
  } catch { if (epoch === moduleGeneration) moduleError.value = true }
}
watch(state, loadAccountModules)
onMounted(loadAccountModules)
onScopeDispose(() => { moduleGeneration++; accountModules.value = [] })
const accountLinks=computed(()=>accountModules.value.map(item=>({id:item.bindingId,label:item.label[locale.value]||item.label.en||item.label.ar||''})))
const email = ref('')
const password = ref('')
useHead({ title: () => t('product.name') })
async function submit() {
  const credential = password.value
  password.value = ''
  await signIn(email.value.trim(), credential)
}

const copy = computed(() => { const result: Record<string, string> = {}; function flatten(value: object, prefix = '') { for (const [key, entry] of Object.entries(value)) { const name = prefix ? `${prefix}.${key}` : key; if (typeof entry === 'string') result[name] = t(name); else if (entry && typeof entry === 'object') flatten(entry, name) } } flatten(messages.value[locale.value] as object); return result })
const presentation = computed(() => ({
  state: state.value,
  pending: pending.value,
  actionError: actionError.value,
  registryState: registryState.value,
  transferStatus: transferStatus.value,
  configuration: configuration.value,
  transferPending: transferPending.value,
  transferDirty: transferDirty.value,
  transferError: transferError.value,
  activityRows: activityRows.value,
  activitySources: activitySources.value,
  activityTotal: activityTotal.value,
  activityStatus: activityStatus.value,
  retrieving: retrieving.value,
  remoteFailed: remoteFailed.value,
  offerVersions: offerVersions.value,
  offerStatus: offerStatus.value,
  offerPending: offerPending.value,
  offerDirty: offerDirty.value,
  offerError: offerError.value,
  revokeId: revokeId.value,
  issueId: issueId.value,
  issuanceAvailable: issuanceAvailable.value,
  customerLink: customerLink.value,
  queue: queue.value,
  billingStatus: billingStatus.value,
  payment: payment.value,
  receipt: receipt.value,
  evidence: evidence.value,
  evidencePending: evidencePending.value,
  evidenceError: evidenceError.value,
  billingPending: billingPending.value,
  billingDirty: billingDirty.value,
  billingError: billingError.value,
  heading: selection.value.item ? label(selection.value.item.label) : selection.value.suit ? label(selection.value.suit.label) : '',
  description: label(selection.value.item?.description || selection.value.suit?.description || {}),
  module: selection.value.item?.module, command: !!command.value, offerRequest: !!offerRequest.value, reviewCommand: !!reviewCommand.value, approvalDisabled: !payment.value || approvalBlocked(payment.value),
}))
</script>
<template>
  <BsAdministrationEntryPage
    v-model:email="email"
    v-model:password="password"
    v-model:draft="draft"
    v-model:reason="reason"
    v-model:transfer-visible="transferVisible"
    v-model:activity-query="activityQuery"
    v-model:offer-draft="offerDraft"
    v-model:offer-reason="offerReason"
    v-model:offer-visible="offerVisible"
    v-model:billing-filter="billingFilter"
    v-model:billing-page="billingPage"
    v-model:review-draft="reviewDraft"
    v-model:billing-visible="billingVisible"
    :account-links="accountLinks"
    v-bind="presentation" :copy="copy" :locale="locale"
    @select-account="id=>navigateTo({path:'/accounts',query:{bindingId:id}})"
    @sign-in="submit" @sign-out="signOut" @retry="recheck" @refresh-registry="registry.refresh()"
    @reload-billing="billing.load()" @review-payment="id => { const row = queue?.items.find(item => item.id === id); if (row) billing.review(row) }" @save-payment="billing.save()" @open-evidence="billing.openEvidence"
    @apply-activity="activity.apply()" @reload-activity="activity.load()" @retrieve-activity="(id, stream) => { const source = activitySources.find(item => item.bindingId === id && item.stream === stream); if (source) activity.retrieve(source) }" @activity-page="(page, size) => { activityQuery.page = page; activityQuery.pageSize = size; activity.load() }" @activity-sort="order => { activityQuery.order = order; activity.load() }"
    @reload-transfer="transfer.load()" @edit-transfer="transfer.edit()" @save-transfer="transfer.save()"
    @reload-offers="offers.load()" @edit-offer="id => offers.edit(offerVersions.find(item => item.id === id))" @revoke-offer="id => { const row = offerVersions.find(item => item.id === id); if (row) offers.revoke(row) }" @issue-offer="id => { const row = offerVersions.find(item => item.id === id); if (row) offers.issue(row) }" @view-offer-link="id => { const row = offerVersions.find(item => item.id === id); if (row) offers.viewLink(row) }" @copy-offer-link="offers.copyLink()" @save-offer="offers.save()"
  />
</template>
