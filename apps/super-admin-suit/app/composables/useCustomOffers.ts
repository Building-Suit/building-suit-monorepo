import { emptyOffer, offerCommand, amendOffer } from '../utils/custom-offer'
import type { OfferVersion } from '../utils/custom-offer'

export function useCustomOffers(binding: () => string | undefined, active: () => boolean) {
  const { t } = useI18n()
  const fetch = useRequestFetch()
  const versions = ref<OfferVersion[]>([])
  const status = ref<'loading' | 'empty' | 'success' | 'error' | 'denied'>('loading')
  const draft = ref(emptyOffer())
  const reason = ref('')
  const command = shallowRef<Record<string, unknown> | null>(null)
  const revokeId = ref<string | null>(null)
  const issueId = ref<string | null>(null)
  const issuanceAvailable = ref(false)
  const customerLink = ref('')
  const action = useRecordAction(() => ({ draft: draft.value, reason: reason.value }))
  let generation = 0
  async function load() {
    const current = ++generation
    versions.value = []; customerLink.value = ''; issuanceAvailable.value = false; status.value = 'loading'
    if (!binding() || !active()) return
    try {
      const result = await fetch<{ versions: OfferVersion[]; issuanceAvailable: boolean }>('/api/custom-offers', { method: 'POST', body: { action: 'read', bindingId: binding() } })
      if (current !== generation) return
      issuanceAvailable.value = result.issuanceAvailable === true
      versions.value = result.versions
      status.value = result.versions.length ? 'success' : 'empty'
    } catch (cause) {
      if (current !== generation) return
      status.value = (cause as { statusCode?: number }).statusCode === 403 ? 'denied' : 'error'
    }
  }
  async function copyLink() {
    try { if (customerLink.value) await navigator.clipboard.writeText(customerLink.value) }
    catch { action.error.value = t('offers.saveError') }
  }
  function issue(o: OfferVersion) { edit(o); issueId.value = o.id }
  function viewLink(o: OfferVersion) { customerLink.value = o.state === 'issued' ? o.customerLink ?? '' : '' }
  function revoke(o: OfferVersion) { edit(o); revokeId.value = o.id }
  function edit(o?: OfferVersion) {
    revokeId.value = null; issueId.value = null; customerLink.value = ''
    draft.value = o ? amendOffer(o) : { ...emptyOffer(), definitionId: crypto.randomUUID() }
    reason.value = ''; command.value = null
    if (o) action.edit(); else action.create()
  }
  async function save() {
    const current = generation
    await action.run(async () => {
      if (reason.value.trim().length < 8) throw new Error('invalid_request')
      command.value ||= (revokeId.value || issueId.value) ? { action: revokeId.value ? 'revoke' : 'issue', bindingId: binding(), requestId: crypto.randomUUID(), correlationId: crypto.randomUUID(), reason: reason.value.trim(), payload: { offerVersionId: revokeId.value ?? issueId.value } } : offerCommand(binding()!, draft.value, reason.value, () => crypto.randomUUID())
      const result = await fetch<{ offer?: OfferVersion; targetState?: string; customerLink?: string | null }>('/api/custom-offers', { method: 'POST', body: command.value })
      if (issueId.value && (result.targetState !== 'issued' || result.offer?.id !== issueId.value)) throw new Error('issuance_unconfirmed')
      if (current !== generation || !active()) return
      command.value = null
      await load()
      if (current + 1 === generation && issueId.value) customerLink.value = result.customerLink ?? ''
    }, () => t('offers.saveError'))
  }
  watch([binding, active], () => {
    ++generation; versions.value = []; command.value = null; draft.value = emptyOffer(); reason.value = ''; revokeId.value = null; issueId.value = null; customerLink.value = ''; issuanceAvailable.value = false; action.complete()
    if (active()) void load()
  }, { immediate: true })
  onScopeDispose(() => { ++generation; versions.value = []; command.value = null; draft.value = emptyOffer(); reason.value = ''; customerLink.value = ''; issuanceAvailable.value = false })
  return { versions, status, draft, reason, command, revokeId, issueId, issuanceAvailable, customerLink, action, load, edit, issue, viewLink, copyLink, revoke, save }
}
