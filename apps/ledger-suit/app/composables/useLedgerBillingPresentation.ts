import type { BsBillingCopy, BsBillingView, BsBillingForm, BsManualPaymentView, BsPlanImpactView } from '@building-suit/ui/types/billingPresentation'
import { useLedgerBillingCheckoutView } from './useLedgerBillingCheckoutView'
import { useLedgerManualPaymentCheckoutView } from './useLedgerManualPaymentCheckoutView'

/** Ledger pricing, subscription display and commands mapped to neutral presentation. */
export function useLedgerBillingPresentation(options: { surface: 'checkout' | 'manage' | 'display' }) {
  const { t, locale } = useI18n()
  const { currentId, user } = { ...useTenant(), user: useSupabaseUser() }
  const pricing = reactive(useLedgerBillingCheckoutView(options))
  const usage = useLedgerUsagePresentation()
  const manual = reactive(useLedgerManualPaymentCheckoutView(reactive({ get plan() { return pricing.manualPlan }, get interval() { return pricing.interval }, get active() { return pricing.manualOpen } }), () => { pricing.manualOpen = false }))
  watch([currentId, user], () => { pricing.manualOpen = false }, { flush: 'sync' })
  const form = computed<BsBillingForm>({ get: () => ({ paidAmount: 0, transferDate: '', transferReference: '', privateLink: '', reason: manual.reason }), set: value => { manual.reason = value.reason } })
  const copy = computed<BsBillingCopy>(() => ({
    title: t('billing.title'), subtitle: t('billing.subtitle'), loading: t('app.loading'), retry: t('common.retry'), cancel: t('common.cancel'), denied: t('billing.manual.denied'), failed: t('billing.plans.loadFailed'), unavailable: t('billing.plans.loadFailed'),
    usage: t('usage.title'), usageHelp: t('usage.subtitle'), usageLoading: t('usage.loading'), usageError: t('usage.loadFailed'), compare: t('landing.pricingTitle'), compareHelp: '',
    instructions: '', instructionsHelp: '', manual: '', recipient: '', paymentLink: '', qr: '', instructionsUnavailable: '', privateTitle: '', privateHelp: '', privateLink: '', privatePreview: '', privateClear: '',
    notice: t('billing.manual.title'), noticeHelp: '', submit: t('billing.manual.submit'), requestedPlan: '', expected: '', interval: t('billing.billingCycle'), paid: '', transferDate: '', reference: t('billing.manual.reference'),
    policyPrefix: '', terms: t('marketing.terms'), privacy: t('marketing.privacy'), refund: t('marketing.refundCancellation'), noPurchasable: t('billing.plans.loadFailed'),
    evidenceTitle: t('billing.manual.receipt'), evidenceHelp: t('billing.manual.fileHint'), evidenceSelect: t('billing.manual.receipt'), evidenceUpload: t('billing.manual.submit'), evidenceUploading: t('app.loading'), evidenceFirst: '', evidenceSaved: '', evidenceAttached: '',
    history: t('billing.manual.history'), empty: t('billing.manual.empty'), access: '', reviewReason: '', reason: t('billing.manual.reason'), refresh: t('common.refresh'), requests: t('billing.manual.requests'), inspect: '', openSubscription: t('billing.manual.openSubscription'), cancelRequest: t('billing.manual.cancel'),
  }))
  const manualView = computed<BsManualPaymentView>(() => {
    const selected = manual.selected
    return { visible: pricing.manualOpen, denied: !manual.can('billing.manage'), pending: manual.pending, error: manual.error || manual.validation, dirty: manual.dirty, empty: !manual.pending && !selected && !manual.error,
      selected: selected ? { title: `${t(`billing.plans.${selected.plan_key}.name`)} · ${t(`billing.${selected.billing_interval}`)} · ${new Intl.NumberFormat(locale.value, { style: 'currency', currency: selected.currency_code.trim() }).format(selected.amount_minor / 100)}`, status: t(`billing.manual.states.${selected.status}`), instructions: selected.instructions, reference: selected.id, period: selected.period_start && selected.period_end ? `${manual.date(selected.period_start)} — ${manual.date(selected.period_end)}` : '', approved: selected.status === 'approved' } : null,
      uploadAllowed: !!manual.uploadAllowed, cancelAllowed: !!manual.cancelAllowed, canSubmit: !manual.pending && !!manual.file && !!manual.reason.trim(), fileKey: selected?.evidence_id ?? selected?.id ?? '', fileHint: t('billing.manual.fileHint'), pendingHint: t('billing.manual.pendingHint'),
      history: manual.history.map(event => ({ id: event.id, text: `${manual.date(event.occurred_at)} · ${t(`billing.manual.states.${event.after_state}`)} · ${event.reason}` })), evidence: manual.evidence.map(file => ({ id: file.id, text: `${file.filename} · ${manual.date(file.submitted_at)}` })), requests: manual.requests.map(request => ({ id: request.id, text: `${manual.date(request.created_at)} · ${t(`billing.plans.${request.plan_key}.name`)}` })),
    }
  })
  const impact = computed<BsPlanImpactView>(() => {
    const value = pricing.planImpact
    return { visible: !!value, title: t('billing.planChange.title'), summary: value ? t('billing.planChange.summary', { current: pricing.planNameForKey(value.current_plan_key), target: pricing.planNameForKey(value.target_plan_key) }) : '', noDeletion: t('billing.planChange.noDeletion'), price: value ? t('billing.planChange.targetPrice', { price: t('billing.plans.price', { amount: pricing.formatAmount(value.target_amount_minor) }), interval: t(`billing.${value.target_interval}`) }) : '', capacity: t('billing.planChange.capacityTitle'),
      quotas: pricing.quotaImpacts.map(quota => ({ id: quota.quota_key, label: t(`usage.quotas.${quota.quota_key}`), state: t(quota.will_block_new_activity ? 'billing.planChange.blocked' : 'billing.planChange.available'), blocked: quota.will_block_new_activity, detail: t('billing.planChange.usageLimit', { used: pricing.formatQuota(quota.quota_key, quota.used_value), limit: pricing.formatQuota(quota.quota_key, quota.target_limit_value) }) })),
      gainedTitle: t('billing.planChange.gainedTitle'), gained: [...pricing.gainedFeatures.map(feature => pricing.featureName(feature.feature_key)), ...(pricing.auditHistoryIncreased && value ? [t('billing.planChange.auditHistoryIncreased', { days: pricing.formatNumber(value.audit_history_target_days) })] : [])],
      lostTitle: t('billing.planChange.lostTitle'), lost: [...pricing.lostFeatures.map(feature => pricing.featureName(feature.feature_key)), ...(value?.audit_history_reduced ? [t('billing.planChange.auditHistoryReduced', { days: pricing.formatNumber(value.audit_history_target_days) })] : [])], handoffTitle: t('billing.planChange.handoffTitle'), handoff: value?.requires_manual_handoff ? t('billing.planChange.handoffBody') : '', noChange: t('billing.planChange.noChange'), close: t('common.close') }
  })
  const policyCopy = computed(() => {
    const [beforeTerms = '', beforeRefund = '', beforePrivacy = '', afterPrivacy = ''] = t('billing.policyReview', { terms: '__TERMS__', refund: '__REFUND__', privacy: '__PRIVACY__' }).split(/__TERMS__|__REFUND__|__PRIVACY__/)
    return { beforeTerms, beforeRefund, beforePrivacy, afterPrivacy, terms: t('marketing.terms'), refund: t('marketing.refundCancellation'), privacy: t('marketing.privacy') }
  })
  const view = computed<BsBillingView>(() => ({
    workspace: '', loading: false, failed: false, denied: false, available: true, summary: [], notice: '', details: [], providerNotice: '', latest: null,
    usage: { items: usage.items, loading: usage.loading, failed: !!usage.loadError },
    pricing: { interval: pricing.interval, plans: pricing.pricingPlans, intervalOptions: [{ value: 'monthly', label: t('billing.monthly') }, { value: 'yearly', label: t('billing.yearly') }], copy: { cycleLabel: t('billing.billingCycle'), loading: t('billing.plans.loading'), empty: t('billing.plans.loadFailed'), retry: t('common.retry'), included: t('billing.plans.included'), notIncluded: t('billing.plans.notIncluded') }, annualSaving: pricing.annualDiscount === null ? null : t('billing.plans.annualDiscount', { percent: pricing.annualDiscount }), loading: pricing.catalogPending, error: pricing.catalogError ? t('billing.plans.loadFailed') : null, columns: 4, testId: 'plan-pricing-grid', sectionTestId: 'plan-pricing' },
    instructions: null, privateOffer: null, transfer: null, evidence: null, showEvidence: false, history: [], showHistory: false,
    trial: pricing.trialPlanCurrent && options.surface === 'checkout' && ['trialing', 'read_only'].includes(pricing.accessState) ? { title: t(pricing.accessState === 'trialing' ? 'billing.trial.activeTitle' : 'billing.trial.expiredTitle'), body: pricing.accessState === 'trialing' ? t('billing.trial.activeBenefits') : t('billing.trial.expiredBody', { date: pricing.formatDate(pricing.subscription?.trial_ends_at) }), date: pricing.accessState === 'trialing' ? t('billing.trial.endsOn', { date: pricing.formatDate(pricing.subscription?.trial_ends_at) }) : '', note: t(pricing.accessState === 'trialing' ? 'billing.trial.optionalConversion' : 'billing.trial.resumeWrites') } : null,
    policy: options.surface === 'checkout' ? policyCopy.value : null,
    paymentNotice: options.surface === 'checkout' ? t('billing.manualPaymentNotice') : '', paymentRequired: options.surface === 'checkout' ? t('billing.paymentRequired') : '', compatibilityNotice: options.surface === 'manage' && pricing.compatibilityPlanCurrent ? t('billing.planChange.legacyGrandfathered') : '', pricingError: pricing.errorMessage, canRequests: pricing.can('billing.manage'),
  }))
  function interval(value: string) { if (value === 'monthly' || value === 'yearly') pricing.interval = value }
  function requests() { pricing.manualPlan = undefined; pricing.manualOpen = true }
  function select(id: string) { const value = manual.requests.find(request => request.id === id); if (value) manual.select(value) }
  function download(id: string) { const value = manual.evidence.find(file => file.id === id); if (value) return manual.download(value) }
  return { copy, view, form, manualView, impact, interval, requests, select, download, retry: pricing.refresh, usageRetry: usage.refresh, choose: pricing.choosePlan, chooseManual: pricing.chooseManualPlan, closeManual: () => { pricing.manualOpen = false }, refreshManual: () => manual.load(manual.plan, manual.interval, manual.quoteId), selectFile: manual.chooseFile, submitManual: manual.send, cancelManual: manual.cancelRequest, closeImpact: () => { pricing.planImpact = null }, openSubscription: () => reloadNuxtApp({ path: '/billing' }) }
}
