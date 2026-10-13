<script setup lang="ts">
import type { BsBillingCopy, BsBillingView, BsBillingForm } from '@building-suit/ui/types/billingPresentation'
import type { BillingPlanOption, BillingSubmission, PrivateOfferPreview, ShopBilling } from '~/types/billing'
import type { PlanResourceKey, PlanUsageResource, ShopPlanInterval, ShopPlanOffer } from '~/types/plans'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { parsePrivateOfferLink } from '~/utils/private-offer'
import type { PrivateOfferEntry } from '~/utils/private-offer'
import type { XPayOrder } from '~/utils/xpay-checkout.mjs'
import { checkoutFailureCode, checkoutAttempt, checkoutAttemptKey, isXPayOrderId, parseXPayDatabaseOrders, parseXPayOrder, xpayHostedUrl } from '~/utils/xpay-checkout.mjs'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const client = useSupabaseClient<ShopRpcDatabase>()
const rpc = client.schema('public')
const { locale } = useI18n()
const ui = useUiCopy()
const { current, currentId, isOwner, reload: reloadShop } = useShop()
const { data: publicPlans, isLoading: catalogPending, error: catalogError, refresh: refreshCatalog, ready: catalogReady } = usePlans()
await catalogReady
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const form = reactive({ catalogTermsId: '', paidAmount: 0, transferDate: '', transferReference: '' })
const privateLink = ref('')
const privatePreview = shallowRef<PrivateOfferPreview | null>(null)
const privateEntry = shallowRef<PrivateOfferEntry | null>(null)
const privatePending = ref(false)
const privateError = ref('')
const user = useSupabaseUser()
let privateGeneration = 0
function clearPrivateOffer() {
  ++privateGeneration
  privateLink.value = ''; privatePreview.value = null; privateEntry.value = null
  privatePending.value = false; privateError.value = ''
}
async function previewPrivateOffer() {
  if (!currentId.value || !isOwner.value || privatePending.value) return
  const generation = ++privateGeneration
  privateError.value = ''; privatePreview.value = null; privateEntry.value = null
  const value = privateLink.value
  privateLink.value = ''
  privatePending.value = true
  try {
    const entry = parsePrivateOfferLink(value, window.location.origin)
    const shopId = currentId.value
    const { data, error: readError } = await rpc.rpc('shop_private_offer_read', {
      p_shop_id: shopId, p_offer_id: entry.offerId, p_offer_version: entry.offerVersion,
      p_target_binding_id: entry.targetBindingId, p_target_environment_id: entry.targetEnvironmentId,
      p_redemption_token: entry.redemptionToken,
    })
    if (readError) throw readError
    if (generation !== privateGeneration || shopId !== currentId.value || !isOwner.value) return
    const offer = data as PrivateOfferPreview
    if (!offer || offer.offerId !== entry.offerId || offer.offerVersion !== entry.offerVersion || offer.shopId !== shopId
      || offer.targetBindingId !== entry.targetBindingId || offer.targetEnvironmentId !== entry.targetEnvironmentId) throw new Error('offer_response_mismatch')
    privatePreview.value = offer
    privateEntry.value = entry
    form.paidAmount = offer.priceAmount
  } catch {
    if (generation === privateGeneration) privateError.value = copy.value.privateUnavailable
  } finally {
    if (generation === privateGeneration) privatePending.value = false
  }
}
onMounted(() => {
  if (!window.location.hash) return
  const link = window.location.href
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  privateLink.value = link
  void previewPrivateOffer()
})
watch([currentId, isOwner, user], clearPrivateOffer, { flush: 'sync' })

const { data: billing, pending, error, refresh } = await useAsyncData(
  'shop-data:billing',
  async (): Promise<ShopBilling | null> => {
    if (!currentId.value || !isOwner.value) return null
    const requestedShopId = currentId.value
    const { data, error: readError } = await rpc.rpc('shop_billing_read', { p_shop_id: requestedShopId })
    if (readError) throw readError
    if (requestedShopId !== currentId.value) return null
    return data as ShopBilling
  },
  { watch: [currentId, isOwner] },
)

const publicCatalogTerms = computed(() => new Set((publicPlans.value ?? [])
  .filter(plan => plan.is_purchasable && !plan.is_coming_soon)
  .map(plan => plan.catalog_terms_id)))
const purchasablePlans = computed(() => (billing.value?.availablePlans ?? [])
  .filter((plan): plan is BillingPlanOption & { billingInterval: ShopPlanInterval } => publicCatalogTerms.value.has(plan.catalogTermsId)
    && (plan.billingInterval === 'monthly' || plan.billingInterval === 'annual')))
const selectedPlan = computed(() => purchasablePlans.value.find(plan => plan.catalogTermsId === form.catalogTermsId) ?? null)
const noticeQuote = computed(() => privatePreview.value ? { planName: privatePreview.value.displayName, effectivePriceAmount: privatePreview.value.priceAmount, currency: privatePreview.value.currency, billingInterval: privatePreview.value.billingInterval, priceSource: 'private_offer', planVariant: 'private_offer', variantName: privatePreview.value.displayName, listPriceAmount: privatePreview.value.priceAmount, resourceLimits: privatePreview.value.resourceLimits, entitlements: privatePreview.value.entitlements, blockers: privatePreview.value.blockers } : selectedPlan.value)
const currentCatalogTermsId = computed(() => billing.value?.subscription.accessState === 'active' ? purchasablePlans.value.find(plan => plan.planSlug === billing.value?.subscription.planSlug
  && plan.planVariant === billing.value?.subscription.planVariant
  && plan.billingInterval === billing.value?.subscription.billingInterval)?.catalogTermsId ?? '' : '')
const trialCatalogTermsId = computed(() => billing.value?.subscription.accessState === 'trialing' ? purchasablePlans.value.find(plan => plan.planSlug === billing.value?.subscription.planSlug
  && plan.planVariant === billing.value?.subscription.planVariant
  && plan.billingInterval === billing.value?.subscription.billingInterval)?.catalogTermsId ?? '' : '')
const latestSubmission = computed(() => billing.value?.submissions?.[0] ?? null)
const checkoutVisible = ref(false)
const prorationEnabled = ref(false)
const checkoutReady = ref(false)
const checkoutMode = ref<'test' | 'live' | null>(null)
const checkoutChecking = ref(false)
const checkoutPending = ref(false)
const checkoutError = ref('')
const checkoutOrders = shallowRef<XPayOrder[]>([])
const checkoutCurrent = shallowRef<XPayOrder | null>(null)
const confirmation = useConfirmation()
let checkoutGeneration = 0
let checkoutTimer: ReturnType<typeof setTimeout> | null = null
let checkoutPolls = 0
const openCheckout = computed(() => checkoutOrders.value.find(order => ['creating', 'open', 'pending', 'requires_review'].includes(order.state)) ?? null)
const activeCheckout = computed(() => openCheckout.value?.orderId !== checkoutCurrent.value?.orderId && openCheckout.value ? openCheckout.value : checkoutCurrent.value ?? openCheckout.value)
function clearCheckoutTimer() { if (checkoutTimer) clearTimeout(checkoutTimer); checkoutTimer = null }
function scheduleCheckoutPoll() {
  clearCheckoutTimer()
  if (!checkoutReady.value || checkoutPolls >= 20 || !['creating', 'pending', 'open'].includes(activeCheckout.value?.state ?? '')) return
  const context = checkoutContext()
  checkoutTimer = setTimeout(() => { if (sameCheckoutContext(context)) { checkoutPolls++; void refreshCheckout() } }, 15000)
}
function checkoutContext() { return { generation: checkoutGeneration, shop: currentId.value, user: user.value?.id } }
function sameCheckoutContext(value: ReturnType<typeof checkoutContext>) { return value.generation === checkoutGeneration && value.shop === currentId.value && value.user === user.value?.id && isOwner.value }
const proration = useShopProrationCheckout({ context: checkoutContext, sameContext: sameCheckoutContext,
  locale: () => isArabic.value ? 'ar' : 'en', invoke: body => client.functions.invoke('shop-xpay-checkout', { body }),
  target: () => { const entry = privateEntry.value; return { selection: entry ? `offer:${entry.offerId}:${entry.offerVersion}` : `terms:${form.catalogTermsId}`,
    catalogTermsId: entry ? null : form.catalogTermsId, privateOffer: entry ? { offerId: entry.offerId, offerVersion: entry.offerVersion, targetBindingId: entry.targetBindingId, targetEnvironmentId: entry.targetEnvironmentId, redemptionToken: entry.redemptionToken } : null } },
})
function checkoutErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'checkoutCode' in error ? String(error.checkoutCode) : ''
  const messages: Record<string, string> = { checkout_historical_review_pending: copy.value.checkoutHistoricalReview, checkout_quote_stale: copy.value.quoteStale,
    checkout_quote_open: copy.value.quoteOpen, checkout_payment_unresolved: copy.value.quotePaymentUnresolved, checkout_proration_unavailable: copy.value.quoteUnavailable,
    checkout_currency_unsupported: copy.value.quoteCurrency, checkout_period_unsupported: copy.value.quotePeriodUnsupported, checkout_offer_expiring: copy.value.quoteOfferExpiring, checkout_plan_change_blocked: planPresentation.copy.blockers,
    checkout_quote_required: copy.value.quoteRequired, checkout_payment_method_unsupported: copy.value.quoteCardUnsupported }
  return messages[code] ?? copy.value.checkoutFailed
}
async function restartCheckoutQuote() {
  const context = checkoutContext()
  if (!context.shop || !context.user || checkoutPending.value || !isOwner.value) return
  checkoutPending.value = true; checkoutError.value = ''
  try { await proration.abandon(); if (sameCheckoutContext(context)) await proration.prepare() }
  catch (error) { if (sameCheckoutContext(context)) checkoutError.value = checkoutErrorMessage(error) }
  finally { if (sameCheckoutContext(context)) checkoutPending.value = false }
}

async function loadCheckoutStatus() {
  const context = checkoutContext()
  if (!import.meta.client || !context.shop || !context.user || !isOwner.value || checkoutChecking.value) return
  checkoutChecking.value = true
  try {
    // History remains readable even when the provider is unavailable/unconfigured.
    const { data, error } = await rpc.rpc('shop_xpay_order_read', { p_shop_id: context.shop, p_order_id: null })
    if (sameCheckoutContext(context) && !error) checkoutOrders.value = parseXPayDatabaseOrders(data)
    const result = await client.functions.invoke('shop-xpay-checkout', { body: { action: 'status', shopId: context.shop, locale: isArabic.value ? 'ar' : 'en' } })
    if (!sameCheckoutContext(context)) return
    checkoutReady.value = !result.error && result.data?.ready === true && ['test', 'live'].includes(result.data?.mode)
    checkoutMode.value = checkoutReady.value ? result.data.mode : null
    prorationEnabled.value = !result.error && result.data?.prorationEnabled === true
    if (checkoutReady.value && Array.isArray(result.data?.orders) && result.data.orders.length <= 20) checkoutOrders.value = result.data.orders.map(parseXPayOrder)
    const restored = await proration.restore(openCheckout.value?.quoteId)
    if (sameCheckoutContext(context) && restored?.state === 'settled') await reloadShop()
  } catch {
    if (sameCheckoutContext(context)) checkoutReady.value = false
  } finally {
    if (sameCheckoutContext(context)) { checkoutChecking.value = false; scheduleCheckoutPoll() }
  }
}
async function refreshCheckout(orderId = activeCheckout.value?.orderId) {
  const context = checkoutContext()
  if (!context.shop || !context.user || !isOwner.value || checkoutPending.value) return
  checkoutError.value = ''; checkoutPending.value = true
  try {
    if (orderId && checkoutReady.value) {
      const result = await client.functions.invoke('shop-xpay-checkout', { body: { orderId, shopId: context.shop, locale: isArabic.value ? 'ar' : 'en' } })
      if (result.error) throw result.error
      if (!sameCheckoutContext(context)) return
      checkoutCurrent.value = parseXPayOrder(result.data)
      if (['expired', 'failed', 'paid'].includes(checkoutCurrent.value.state)) {
        try { sessionStorage.removeItem(checkoutAttemptKey(context.user, context.shop)) } catch { /* No payment authority in storage. */ }
        if (checkoutCurrent.value.state === 'paid') { proration.clear(context); await reloadShop() } else await refresh()
      }
    }
    await loadCheckoutStatus()
  } catch { if (sameCheckoutContext(context)) checkoutError.value = copy.value.checkoutFailed }
  finally { if (sameCheckoutContext(context)) { checkoutPending.value = false; scheduleCheckoutPoll() } }
}
async function startCheckout() {
  const context = checkoutContext(), quote = noticeQuote.value
  if (!context.shop || !context.user || !isOwner.value || !checkoutReady.value || checkoutPending.value || checkoutChecking.value
    || ['pending', 'requires_review'].includes(activeCheckout.value?.state ?? '')
    || (!proration.quote.value && !openCheckout.value && (!quote || quote.blockers.length)) || billing.value?.subscription.accessState === 'suspended') return
  checkoutPending.value = true; checkoutError.value = ''
  try {
    const existing = openCheckout.value
    const frozen = proration.quote.value
    if (!existing && prorationEnabled.value && !frozen) { await proration.prepare(); return }
    if (!existing && frozen && !prorationEnabled.value) throw Object.assign(new Error('checkout_failed'), { checkoutCode: 'checkout_proration_unavailable' })
    if (!existing && frozen && proration.expired.value) throw Object.assign(new Error('checkout_failed'), { checkoutCode: 'checkout_quote_stale' })
    if (!existing && frozen?.calculation.amountDueMinor === 0) {
      const approved = await confirmation.ask(copy.value.quoteCreditConfirm(frozen.planName, money(frozen.calculation.creditAfterMinor / 100, 'EGP')))
      if (!approved || !sameCheckoutContext(context)) return
      const settled = await proration.confirmCredit()
      if (settled?.state === 'settled' && sameCheckoutContext(context)) { checkoutVisible.value = false; await reloadShop(); await loadCheckoutStatus() }
      return
    }
    const entry = privateEntry.value
    const selection = entry ? `offer:${entry.offerId}:${entry.offerVersion}` : `terms:${form.catalogTermsId}`
    const requestId = checkoutAttempt(sessionStorage, checkoutAttemptKey(context.user, context.shop), selection, () => crypto.randomUUID())
    const body = existing ? { orderId: existing.orderId, shopId: context.shop, locale: isArabic.value ? 'ar' : 'en' }
      : frozen ? { action: 'pay_quote', quoteId: frozen.quoteId, shopId: context.shop, locale: isArabic.value ? 'ar' : 'en' } : { requestId, shopId: context.shop, locale: isArabic.value ? 'ar' : 'en', catalogTermsId: entry ? null : form.catalogTermsId,
          privateOffer: entry ? { offerId: entry.offerId, offerVersion: entry.offerVersion, targetBindingId: entry.targetBindingId, targetEnvironmentId: entry.targetEnvironmentId, redemptionToken: entry.redemptionToken } : null }
    const result = await client.functions.invoke('shop-xpay-checkout', { body })
    const failure = await checkoutFailureCode(result.data, result.error)
    if (failure) throw Object.assign(new Error('checkout_failed'), { checkoutCode: failure })
    if (result.error) throw result.error
    if (!sameCheckoutContext(context)) return
    const order = parseXPayOrder(result.data)
    if (!existing && frozen && (order.quoteId !== frozen.quoteId || order.amountMinor !== frozen.calculation.amountDueMinor)) throw new Error('invalid_frozen_order')
    checkoutCurrent.value = order
    if (order.state !== 'open' || !order.url) {
      if (['expired', 'failed', 'paid'].includes(order.state)) { try { sessionStorage.removeItem(checkoutAttemptKey(context.user, context.shop)) } catch { /* No payment authority in storage. */ } }
      await refresh(); await loadCheckoutStatus(); return
    }
    const approved = await confirmation.ask(copy.value.checkoutConfirm(order.planName, money(order.amountMinor / 100, order.currency)))
    if (!approved || !sameCheckoutContext(context)) { await loadCheckoutStatus(); return }
    window.location.assign(xpayHostedUrl(order.url, order.sessionId))
  } catch (error) { if (sameCheckoutContext(context)) checkoutError.value = checkoutErrorMessage(error) }
  finally { if (sameCheckoutContext(context)) { checkoutPending.value = false; scheduleCheckoutPoll() } }
}
watch([currentId, isOwner, () => user.value?.id], () => {
  checkoutVisible.value = false
  proration.reset(); prorationEnabled.value = false
  ++checkoutGeneration; clearCheckoutTimer(); checkoutReady.value = false; checkoutChecking.value = false
  checkoutPending.value = false; checkoutError.value = ''; checkoutOrders.value = []; checkoutCurrent.value = null; checkoutMode.value = null; checkoutPolls = 0
  if (import.meta.client) void loadCheckoutStatus()
}, { flush: 'sync' })
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const returned = params.get('xpayOrder')
  params.delete('xpayOrder'); params.delete('cancelled')
  window.history.replaceState(window.history.state, '', window.location.pathname + (params.size ? `?${params}` : '') + window.location.hash)
  await loadCheckoutStatus()
  if (isXPayOrderId(returned)) { await refreshCheckout(returned); checkoutVisible.value = !!activeCheckout.value }
})
watch(() => activeCheckout.value?.state, state => {
  if (state !== 'pending' && state !== 'creating' && state !== 'open') clearCheckoutTimer()
  else scheduleCheckoutPoll()
})
onBeforeUnmount(() => { ++checkoutGeneration; clearCheckoutTimer() })
const usageResources = computed<PlanUsageResource[]>(() => {
  if (!billing.value) return []
  if (billing.value.usage.resources?.length) return billing.value.usage.resources
  const usage = billing.value.usage
  const pairs: Array<[PlanResourceKey, number]> = [
    ['active_locations', usage.locations], ['active_members', usage.members],
    ['active_products', usage.products], ['active_services', usage.services],
    ['active_customers', usage.customers], ['active_suppliers', usage.suppliers],
  ]
  return pairs.map(([resource, used]) => {
    const limit = usage.limits?.[resource] ?? null
    return { resource, used, limit, remaining: limit == null ? null : Math.max(0, limit - used), unlimited: limit == null, atLimit: limit != null && used >= limit, overLimit: limit != null && used > limit }
  })
})

watch([billing, purchasablePlans], () => {
  const plans = purchasablePlans.value
  if (!plans.length) { form.catalogTermsId = ''; return }
  if (!plans.some(plan => plan.catalogTermsId === form.catalogTermsId)) {
    form.catalogTermsId = plans.find(plan => plan.planSlug === billing.value?.subscription.planSlug
      && plan.planVariant === billing.value?.subscription.planVariant
      && plan.billingInterval === billing.value?.subscription.billingInterval)?.catalogTermsId
      ?? plans[0]?.catalogTermsId ?? ''
  }
}, { immediate: true })

watch(selectedPlan, value => {
  if (value && !privatePreview.value) form.paidAmount = value.effectivePriceAmount
}, { immediate: true })

watch(currentId, () => {
  Object.assign(form, { catalogTermsId: '', paidAmount: 0, transferDate: '', transferReference: '' })
}, { flush: 'sync' })

function date(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

function statusLabel(status: string) {
  return copy.value.statuses[status as keyof typeof copy.value.statuses] ?? status
}

function intervalLabel(interval: string) {
  return copy.value.intervals[interval as keyof typeof copy.value.intervals] ?? interval
}

function submissionMessage(submission: BillingSubmission) {
  return copy.value.submissionMessages[submission.status]
}

function choosePlan(plan: ShopPlanOffer, intent: 'choose' | 'preview') {
  clearPrivateOffer()
  form.catalogTermsId = plan.catalogTermsId
  if (intent === 'choose') checkoutVisible.value = true
}

const en = {
  checkoutChecking: 'Checking checkout availability…', checkoutResume: 'Resume checkout', checkoutCheck: 'Check payment status', checkoutFailed: 'Could not complete checkout or check payment. Check the saved status before starting another payment.',
  checkoutConfirm: (plan: string, amount: string) => `Continue to X-Pay for ${plan} at ${amount}? Review the hosted checkout before paying.`,
  quoteCreditTitle: 'Confirm credited plan change', quoteCreditHelp: 'Verified prepaid value and credits cover this change. Confirm the change without a new provider charge.',
  quotePrepare: 'Review frozen quote', quoteCreditAction: 'Apply credited plan change', quoteNoChange: 'Keep current plan', quoteBreakdown: 'Server-approved plan change',
  quoteRate: 'Full plan rate', quoteService: 'Cost for the quoted period', quoteUnused: 'Unused prepaid value', quoteExistingCredit: 'Existing carryforward credit', quoteDue: 'Amount due now', quoteAfter: 'Carryforward credit after change',
  quoteRenewal: (end: string) => `Your renewal date stays ${end}. Access changes only after verified payment or explicit credit confirmation.`,
  quoteNoChangePolicy: 'Your current plan and renewal date stay unchanged. Existing carryforward credit is preserved.',
  quoteNewPeriod: 'A new full billing term starts only after verified payment or explicit credit confirmation. Your current access stays unchanged until then.',
  quotePrecision: 'Intermediate values are displayed to four decimal places. The server nets credits before rounding the final amount.', quoteCardOnly: 'Prorated hosted checkout supports cards. Asynchronous payment methods are not supported for these frozen changes.',
  quoteExpires: (remaining: string) => `Start payment or confirm the credit change within ${remaining}.`, quoteSaved: 'A saved payment is already in progress. Check its status before starting another payment.',
  quoteRestart: 'Discard unstarted quote and review again', quoteStale: 'This quote expired or your subscription changed. Discard an unstarted quote to review a fresh price. Check any saved payment before paying again.',
  quoteOpen: 'A saved plan-change quote is unresolved. Resume it or discard an unstarted quote before choosing another plan.', quotePaymentUnresolved: 'Payment may already be in progress. Check the saved status or contact support; do not pay again.',
  quoteUnavailable: 'Prorated changes are currently unavailable. Your saved access and credit stay unchanged.', quoteCurrency: 'This change does not support currency conversion. Contact support to review the existing prepaid value.',
  quotePeriodUnsupported: 'Your current access spans multiple or custom billing terms. This remaining-period change needs support; no new price or checkout was accepted.',
  quoteOfferExpiring: 'This private offer expires too soon to start a hosted payment. Request a fresh offer before paying.', quoteRequired: 'Review a frozen quote before starting this plan change.', quoteCardUnsupported: 'This merchant cannot accept card payments for prorated changes. No checkout was created.',
  quoteCreditConfirm: (plan: string, credit: string) => `Apply ${plan} using your verified prepaid value and credits? No X-Pay payment will be created. Your remaining carryforward credit will be ${credit}.`,
  checkoutHistoricalReview: 'An earlier manual payment notice is still awaiting review. No new X-Pay checkout was created. Ask support to resolve that notice before paying again; do not send another payment while its status is unresolved.',
  checkoutHistory: 'X-Pay checkout history', checkoutEmpty: 'No X-Pay checkouts yet.', checkoutTest: 'Test checkout: no real funds are collected.',
  checkoutStates: { creating: 'Checkout is being prepared. You can retry the saved checkout safely.', open: 'Checkout is open. Continue to X-Pay to complete payment.', pending: 'Payment is pending. Access stays unchanged until the server confirms payment.', paid: 'Payment verified. Your subscription summary shows your current access.', requires_review: 'Payment received; access needs review. Contact support before paying again.', expired: 'Checkout expired without confirmed payment. You may start a new checkout.', failed: 'Payment was not completed. You may retry with a new checkout.' },
  checkoutTitle: 'Pay with X-Pay', checkoutHelp: 'Use secure hosted checkout for your selected plan. Payment details stay with X-Pay; no receipt image is needed.',
  checkoutConsequences: 'Your current access stays unchanged until payment is verified. The chosen plan’s limits apply after activation; your saved data is preserved.',
  checkoutSavedOrder: 'A saved checkout is already open. This payment resumes that saved order and its quoted amount, rather than creating another charge for the newly chosen card.',
  checkoutTrial: 'You may pay from day one of your trial. You do not need to wait seven days. Paid access starts after verified payment, with trial history preserved.',
  checkoutUnavailable: 'X-Pay checkout is not available yet. Contact support or check again later. Your current access remains unchanged.', checkoutAction: 'Continue to X-Pay',
  privateTitle: 'Private offer', privateHelp: 'Sign in to the intended owner account, then open or paste the private offer link to review its terms. Previewing does not activate access.', privateLink: 'Private offer link', privatePreview: 'Review private terms', privateUnavailable: 'This offer is unavailable for this owner or shop. Check the link, expiry and recipient.', privateClear: 'Clear private offer', privateRedeemed: 'These private terms already have a recorded payment or credited activation. Review your current access and history before paying again.',
  title: 'Subscription and billing', subtitle: 'Review your plan, usage and X-Pay checkout. Previous payment requests remain in your history.',
  ownerOnly: 'Ask the Shop owner to review billing. Only the owner can access these details.',
  noBilling: 'No subscription information is available. Contact Building Suit support to review this shop’s billing.', loadFailed: 'Could not load billing information.', retry: 'Retry', plan: 'Current plan', access: 'Access state',
  days: 'days', periodEnd: 'Current access ends', trialEnd: 'Trial ends', currentPrice: 'Effective price', listPrice: 'List price', negotiated: 'Negotiated price applies', usage: 'Plan usage', usageHelp: 'Near-limit and full resources are highlighted before a write is rejected.',
  readOnly: 'Your business history remains available. Subscription-gated writes resume only after verified paid activation or an authorized access adjustment.',
  compare: 'Compare plans', compareHelp: 'Only plans currently approved for purchase are shown. Limits are enforced by resource, not by business type.', current: 'Current', choose: 'Choose plan', chosen: 'Selected',
  blocked: 'Approval blocked by current usage', blockers: 'Resolve the excess usage below before paying for this plan.', preservation: 'All resources and data stay saved. Nothing is automatically deleted or archived. Resources above the chosen plan limits are unavailable for new or active use until you reduce usage or upgrade the plan.', used: 'used', limitLabel: 'limit', over: 'over',
  requestedPlan: 'Requested plan', interval: 'Commercial term', expected: 'Quoted plan price', paid: 'Amount transferred', transferDate: 'Transfer date', reference: 'Transfer reference',
  policyPrefix: 'By submitting, you acknowledge the', terms: 'Terms & Conditions', privacy: 'Privacy Policy', refund: 'Refund & Cancellation Policy',
  latest: 'Latest request', history: 'Payment notice history', empty: 'No payment notices have been submitted.', reviewReason: 'Review note', manual: 'Manual verification', catalogFailed: 'Could not load the purchasable plan catalog.', noPurchasable: 'No plans are currently available to request. Your current subscription remains unchanged.',
  statuses: { trialing: 'Trialing', active: 'Active', read_only: 'Read-only', suspended: 'Suspended', submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected' },
  submissionMessages: { submitted: 'Submitted for manual review. Your current plan and access have not changed.', under_review: 'An operator is reviewing this transfer. Your current plan and access have not changed.', approved: 'This request was approved. The current-plan summary above is the authoritative active access.', rejected: 'This historical request was rejected. Review the note and contact support if needed.' },
  resources: { active_locations: 'Active locations', active_members: 'Team members', active_products: 'Active products', active_services: 'Active services', active_customers: 'Active customers', active_suppliers: 'Active suppliers' },
  intervals: { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' },
}

const ar = {
  checkoutChecking: 'بنتحقق من إتاحة الدفع…', checkoutResume: 'استكمال الدفع', checkoutCheck: 'تحقق من حالة الدفع', checkoutFailed: 'مقدرناش نكمّل الدفع أو نتحقق من حالته. راجع الحالة المحفوظة قبل بدء دفع آخر.',
  checkoutConfirm: (plan: string, amount: string) => `تتابع إلى X-Pay لخطة ${plan} بمبلغ ${amount}؟ راجع صفحة الدفع قبل السداد.`,
  quoteCreditTitle: 'تأكيد تغيير الخطة بالرصيد', quoteCreditHelp: 'تغطي القيمة المدفوعة والرصيد المعتمد هذا التغيير. أكد التغيير دون إنشاء دفعة جديدة.',
  quotePrepare: 'مراجعة عرض سعر ثابت', quoteCreditAction: 'تطبيق تغيير الخطة بالرصيد', quoteNoChange: 'الإبقاء على الخطة الحالية', quoteBreakdown: 'تغيير الخطة المعتمد من الخادم',
  quoteRate: 'سعر الخطة الكامل', quoteService: 'تكلفة الفترة المعروضة', quoteUnused: 'القيمة المدفوعة غير المستخدمة', quoteExistingCredit: 'الرصيد المرحّل الحالي', quoteDue: 'المبلغ المطلوب الآن', quoteAfter: 'الرصيد المرحّل بعد التغيير',
  quoteRenewal: (end: string) => `يظل تاريخ التجديد ${end}. يتغير الوصول فقط بعد تأكيد الدفع أو تأكيد استخدام الرصيد.`,
  quoteNoChangePolicy: 'تظل الخطة الحالية وتاريخ التجديد كما هما، مع الحفاظ على الرصيد المرحّل الحالي.',
  quoteNewPeriod: 'تبدأ فترة فوترة كاملة جديدة فقط بعد تأكيد الدفع أو تأكيد استخدام الرصيد. يظل الوصول الحالي كما هو حتى ذلك الوقت.',
  quotePrecision: 'تُعرض القيم الوسيطة بأربع منازل عشرية. يحتسب الخادم الرصيد قبل تقريب المبلغ النهائي.', quoteCardOnly: 'يدعم الدفع المستضاف لهذه التغييرات البطاقات فقط. طرق الدفع المؤجلة غير مدعومة لعرض السعر الثابت.',
  quoteExpires: (remaining: string) => `ابدأ الدفع أو أكد استخدام الرصيد خلال ${remaining}.`, quoteSaved: 'توجد دفعة محفوظة قيد المعالجة. تحقق من حالتها قبل بدء دفعة أخرى.',
  quoteRestart: 'تجاهل العرض الذي لم يبدأ ومراجعته مجددًا', quoteStale: 'انتهى عرض السعر أو تغيّر الاشتراك. تجاهل العرض الذي لم يبدأ لمراجعة سعر جديد. تحقق من أي دفعة محفوظة قبل الدفع مجددًا.',
  quoteOpen: 'يوجد عرض تغيير خطة محفوظ لم تُحسم حالته. استأنفه أو تجاهل العرض الذي لم يبدأ قبل اختيار خطة أخرى.', quotePaymentUnresolved: 'قد تكون دفعة قيد المعالجة بالفعل. تحقق من الحالة المحفوظة أو تواصل مع الدعم؛ لا تدفع مجددًا.',
  quoteUnavailable: 'تغيير الخطة بحسب المدة غير متاح حاليًا. يظل الوصول والرصيد المحفوظ كما هو.', quoteCurrency: 'هذا التغيير لا يدعم تحويل العملات. تواصل مع الدعم لمراجعة القيمة المدفوعة الحالية.',
  quotePeriodUnsupported: 'تغطي فترة الوصول الحالية عدة دورات أو مدة فوترة مخصصة. يتطلب تغيير الفترة المتبقية مراجعة الدعم؛ لم يُعتمد سعر أو دفع جديد.',
  quoteOfferExpiring: 'سينتهي العرض الخاص قريبًا جدًا لبدء دفع مستضاف. اطلب عرضًا جديدًا قبل الدفع.', quoteRequired: 'راجع عرض سعر ثابت قبل بدء تغيير الخطة.', quoteCardUnsupported: 'لا يستطيع هذا التاجر قبول الدفع بالبطاقة لتغيير الخطة بحسب المدة. لم يتم إنشاء دفع.',
  quoteCreditConfirm: (plan: string, credit: string) => `هل تريد تطبيق ${plan} باستخدام القيمة المدفوعة والرصيد المعتمد؟ لن يتم إنشاء دفعة عبر X-Pay. سيكون الرصيد المرحّل المتبقي ${credit}.`,
  checkoutHistoricalReview: 'يوجد إشعار دفع يدوي سابق ما زال بانتظار المراجعة. لم يتم إنشاء دفع جديد عبر X-Pay. اطلب من الدعم معالجة الإشعار قبل الدفع مجددًا؛ لا ترسل دفعة أخرى حتى تتضح حالته.',
  checkoutHistory: 'سجل الدفع عبر X-Pay', checkoutEmpty: 'لا توجد عمليات دفع عبر X-Pay بعد.', checkoutTest: 'دفع تجريبي: لا يتم تحصيل أموال حقيقية.',
  checkoutStates: { creating: 'بنجهّز صفحة الدفع. تقدر تعيد المحاولة لنفس الطلب بأمان.', open: 'طلب الدفع مفتوح. تابع إلى X-Pay لإكمال الدفع.', pending: 'الدفع معلّق. سيظل الوصول دون تغيير حتى يؤكد الخادم الدفع.', paid: 'تم تأكيد الدفع. ملخص الاشتراك يعرض وصولك الحالي.', requires_review: 'تم استلام الدفع ويحتاج الوصول إلى مراجعة. تواصل مع الدعم قبل الدفع مرة أخرى.', expired: 'انتهت صلاحية الطلب دون دفع مؤكد. يمكنك بدء طلب جديد.', failed: 'لم يكتمل الدفع. يمكنك إعادة المحاولة بطلب جديد.' },
  checkoutTitle: 'الدفع بـ X-Pay', checkoutHelp: 'استخدم صفحة الدفع الآمنة للخطة المختارة. تظل بيانات الدفع لدى X-Pay ولا تحتاج إلى رفع صورة إيصال.',
  checkoutConsequences: 'يظل الوصول الحالي كما هو حتى تأكيد الدفع. تسري حدود الخطة المختارة بعد التفعيل مع الحفاظ على البيانات المحفوظة.',
  checkoutSavedOrder: 'يوجد دفع محفوظ مفتوح بالفعل. ستستأنف هذه العملية الطلب المحفوظ ومبلغه المعروض دون إنشاء دفعة أخرى للخطة المختارة حديثًا.',
  checkoutTrial: 'يمكنك الدفع من أول يوم في التجربة، ولا يلزم انتظار السبعة أيام. يبدأ الوصول المدفوع بعد تأكيد الدفع مع الاحتفاظ بسجل التجربة.',
  checkoutUnavailable: 'الدفع عبر X-Pay غير متاح بعد. تواصل مع الدعم أو حاول لاحقًا. سيظل وصولك الحالي دون تغيير.', checkoutAction: 'المتابعة إلى X-Pay',
  privateTitle: 'عرض خاص', privateHelp: 'سجّل الدخول بحساب المالك المقصود، ثم افتح رابط العرض الخاص أو الصقه لمراجعة شروطه. المعاينة لا تفعّل الوصول.', privateLink: 'رابط العرض الخاص', privatePreview: 'مراجعة شروط العرض', privateUnavailable: 'هذا العرض غير متاح لهذا المالك أو المتجر. راجع الرابط والصلاحية والمستلم.', privateClear: 'مسح العرض الخاص', privateRedeemed: 'تم تسجيل دفع أو تفعيل بالرصيد لهذه الشروط الخاصة. راجع الوصول الحالي والسجل قبل الدفع مجددًا.',
  title: 'الاشتراك والدفع', subtitle: 'راجع خطتك واستخدامك والدفع عبر X-Pay. تظل طلبات الدفع السابقة محفوظة في سجلك.',
  ownerOnly: 'اطلب من مالك المتجر مراجعة الفوترة. هذه التفاصيل متاحة للمالك فقط.',
  noBilling: 'مفيش معلومات اشتراك متاحة. كلّم دعم Building Suit عشان يراجع اشتراك المتجر.', loadFailed: 'مقدرناش نحمّل معلومات الاشتراك.', retry: 'حاول تاني', plan: 'الخطة الحالية', access: 'حالة الاستخدام',
  days: 'يوم', periodEnd: 'ينتهي الوصول الحالي', trialEnd: 'تنتهي التجربة', currentPrice: 'السعر الفعلي', listPrice: 'السعر المعلن', negotiated: 'يُطبق سعر تفاوضي', usage: 'استخدام الخطة', usageHelp: 'نوضح الموارد القريبة من الحد أو المكتملة قبل رفض عملية جديدة.',
  readOnly: 'يظل سجل شغلك متاحًا للقراءة. تُستأنف العمليات التي تتطلب اشتراكًا بعد تفعيل دفع مؤكّد أو تعديل وصول مصرح به.',
  compare: 'مقارنة الخطط', compareHelp: 'تظهر فقط الخطط المعتمدة والمتاحة للشراء الآن. تُطبّق الحدود حسب المورد وليس نوع النشاط.', current: 'الحالية', choose: 'اختيار الخطة', chosen: 'تم الاختيار',
  blocked: 'التفعيل متوقف بسبب الاستخدام الحالي', blockers: 'عالج تجاوزات الاستخدام الموضحة أدناه قبل الدفع لهذه الخطة.', preservation: 'تظل كل الموارد والبيانات محفوظة. لن يُحذف أو يُؤرشف أي شيء تلقائيًا. الموارد التي تتجاوز حدود الخطة المختارة لن تكون متاحة للاستخدام الجديد أو النشط حتى تخفّض الاستخدام أو ترقي الخطة.', used: 'مستخدم', limitLabel: 'الحد', over: 'فوق الحد',
  requestedPlan: 'الخطة المطلوبة', interval: 'مدة الاشتراك', expected: 'سعر الخطة المثبت', paid: 'المبلغ المحوّل', transferDate: 'تاريخ التحويل', reference: 'مرجع التحويل',
  policyPrefix: 'بإرسال الطلب، أنت تقر بالاطلاع على', terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية', refund: 'سياسة الاسترداد والإلغاء',
  latest: 'أحدث طلب', history: 'سجل إشعارات الدفع', empty: 'لم تُرسل إشعارات دفع بعد.', reviewReason: 'ملاحظة المراجعة', manual: 'تحقق يدوي', catalogFailed: 'تعذّر تحميل كتالوج الخطط المتاحة للشراء.', noPurchasable: 'لا توجد خطط متاحة للطلب حاليًا. سيظل اشتراكك الحالي دون تغيير.',
  statuses: { trialing: 'فترة تجريبية', active: 'نشط', read_only: 'قراءة فقط', suspended: 'موقوف', submitted: 'مُرسل', under_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' },
  submissionMessages: { submitted: 'تم الإرسال للمراجعة اليدوية. لم تتغير خطتك الحالية أو صلاحية الوصول.', under_review: 'يراجع مسؤول المنصة التحويل الآن. لم تتغير خطتك الحالية أو صلاحية الوصول.', approved: 'تم اعتماد هذا الطلب. ملخص الخطة الحالية بالأعلى هو المرجع الفعلي لصلاحية الوصول.', rejected: 'تم رفض هذا الطلب السابق. راجع الملاحظة وتواصل مع الدعم عند الحاجة.' },
  resources: { active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق', active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة', active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون' },
  intervals: { monthly: 'شهريًا', quarterly: 'كل ثلاثة أشهر', annual: 'سنويًا' },
}
const planPresentation = reactive(useShopPlanPresentation({ get offers() { return purchasablePlans.value }, get selectedCatalogTermsId() { return form.catalogTermsId }, get currentCatalogTermsId() { return currentCatalogTermsId.value }, get trialCatalogTermsId() { return trialCatalogTermsId.value }, action: 'select' }, choosePlan))
const usagePresentation = useShopUsagePresentation()

useShopRealtime('billing', () => privatePending.value || !!privateLink.value || !!privatePreview.value)

const billingForm = computed<BsBillingForm>({ get: () => ({ paidAmount: form.paidAmount, transferDate: form.transferDate, transferReference: form.transferReference, privateLink: privateLink.value, reason: '' }), set: value => { form.paidAmount = value.paidAmount; form.transferDate = value.transferDate; form.transferReference = value.transferReference; privateLink.value = value.privateLink } })
const billingCopy = computed<BsBillingCopy>(() => ({
  instructions: copy.value.checkoutTitle, instructionsHelp: copy.value.checkoutHelp, manual: '', recipient: '', paymentLink: '', qr: '', instructionsUnavailable: copy.value.checkoutUnavailable,
  evidenceTitle: '', evidenceHelp: '', evidenceSelect: '', evidenceUpload: '', evidenceUploading: '', evidenceFirst: '', evidenceSaved: '', evidenceAttached: '',
  current: copy.value.plan, payment: isArabic.value ? 'الدفع بـ X-Pay' : 'X-Pay payment',
  title: copy.value.title, subtitle: copy.value.subtitle, loading: ui('loading'), retry: copy.value.retry, cancel: ui('cancel'), denied: copy.value.ownerOnly, failed: copy.value.loadFailed, unavailable: copy.value.noBilling,
  usage: copy.value.usage, usageHelp: copy.value.usageHelp, usageLoading: ui('loading'), usageError: copy.value.loadFailed, compare: copy.value.compare, compareHelp: copy.value.compareHelp,
  privateTitle: copy.value.privateTitle, privateHelp: copy.value.privateHelp, privateLink: copy.value.privateLink, privatePreview: copy.value.privatePreview, privateClear: copy.value.privateClear,
  notice: '', noticeHelp: '', submit: '', requestedPlan: copy.value.requestedPlan, expected: copy.value.expected, interval: copy.value.interval, paid: copy.value.paid, transferDate: copy.value.transferDate, reference: copy.value.reference,
  policyPrefix: copy.value.policyPrefix, terms: copy.value.terms, privacy: copy.value.privacy, refund: copy.value.refund, noPurchasable: copy.value.noPurchasable,
  history: copy.value.history, empty: copy.value.empty, access: copy.value.access, reviewReason: copy.value.reviewReason, reason: copy.value.reviewReason, refresh: copy.value.retry, requests: copy.value.history, inspect: copy.value.history, openSubscription: copy.value.title, cancelRequest: ui('cancel'),
}))
const billingView = computed<BsBillingView>(() => {
  const value = billing.value
  const sub = value?.subscription
  const quote = noticeQuote.value
  const preview = privatePreview.value
  const latest = latestSubmission.value
  const payment = activeCheckout.value
  const frozen = proration.quote.value
  const intermediateMoney = (minor: string) => new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(minor) / 100)
  const paymentHeld = payment?.state === 'requires_review' || payment?.state === 'pending'
  const paymentMessage = checkoutChecking.value ? copy.value.checkoutChecking : payment ? copy.value.checkoutStates[payment.state] : ''
  return {
    workspace: current.value?.name ?? '', loading: pending.value, failed: !!error.value, denied: !isOwner.value, available: !!value,
    summary: sub ? [
      { id: 'plan', label: copy.value.plan, value: sub.planName },
      { id: 'access', label: copy.value.access, value: statusLabel(sub.accessState), status: sub.accessState },
      { id: 'ends', label: sub.accessState === 'trialing' ? copy.value.trialEnd : copy.value.periodEnd, value: date(sub.accessState === 'trialing' ? sub.trialEndAt : sub.periodEnd), note: sub.accessState === 'trialing' ? `${sub.trialDaysRemaining} ${copy.value.days}` : '' },
      { id: 'price', label: copy.value.currentPrice, value: money(sub.effectivePriceAmount ?? sub.priceAmount, sub.currency), note: [sub.priceSource === 'override' ? copy.value.negotiated : '', sub.listPriceAmount !== sub.effectivePriceAmount ? `${copy.value.listPrice}: ${money(sub.listPriceAmount, sub.currency)}` : ''].filter(Boolean).join(' · ') },
    ] : [],
    notice: sub && ['read_only', 'suspended'].includes(sub.accessState) ? copy.value.readOnly : '', details: [], providerNotice: '',
    latest: latest ? { title: copy.value.latest, status: latest.status, statusLabel: statusLabel(latest.status), summary: `${latest.requestedPlanName} · ${money(latest.effectivePriceAmount, latest.currency)}`, message: submissionMessage(latest), reason: latest.reviewReason ?? '' } : null,
    usage: { items: usageResources.value.map(usagePresentation), loading: false, failed: false },
    pricing: { variant: 'shop', interval: planPresentation.interval, plans: planPresentation.pricingPlans.map(plan => ({ ...plan, notice: undefined })), intervalOptions: [{ value: 'monthly', label: planPresentation.copy.monthly }, { value: 'annual', label: planPresentation.copy.yearly }], copy: { cycleLabel: planPresentation.copy.cycle, loading: planPresentation.copy.loading, empty: copy.value.noPurchasable, retry: planPresentation.copy.retry, included: planPresentation.copy.included, notIncluded: planPresentation.copy.notIncluded }, annualSaving: planPresentation.annualDiscount === null ? null : planPresentation.copy.annualSaving(planPresentation.annualDiscount), columns: 3, loading: catalogPending.value, error: catalogError.value ? copy.value.catalogFailed : null, testId: 'shop-plan-cards' },
    instructions: null,
    privateOffer: { pending: privatePending.value, error: privateError.value, title: preview?.displayName ?? '', summary: preview ? `${money(preview.priceAmount, preview.currency)} · ${intervalLabel(preview.billingInterval)} · ${date(preview.expiresAt)}` : '', limits: preview ? Object.entries(preview.resourceLimits).map(([key, limit]) => ({ key, label: copy.value.resources[key as PlanResourceKey], value: limit == null ? '∞' : String(limit) })) : [], notice: preview?.blockers.length ? copy.value.preservation : '', redeemed: preview && (preview.submissionId || preview.xpayOrderId || preview.settledQuoteId) ? copy.value.privateRedeemed : '' },
    checkout: { title: frozen?.calculation.amountDueMinor === 0 ? copy.value.quoteCreditTitle : copy.value.checkoutTitle, description: frozen?.calculation.amountDueMinor === 0 ? copy.value.quoteCreditHelp : copy.value.checkoutHelp, showProviderLogo: frozen?.calculation.amountDueMinor !== 0, logoLight: '/payments/xpay-light.svg', logoDark: '/payments/xpay-dark.svg', logoAlt: 'X-Pay',
      breakdown: frozen ? { title: copy.value.quoteBreakdown, items: [
        { label: copy.value.requestedPlan, value: `${frozen.planName}${frozen.details ? ` · ${({ solo_1: planPresentation.copy.oneMember, solo_2: planPresentation.copy.twoMembers, multi_2: planPresentation.copy.twoBranches, multi_3: planPresentation.copy.threeBranches } as Record<string, string>)[frozen.details.planVariant] ?? frozen.planName}` : ''}` },
        ...(frozen.details ? Object.entries(frozen.details.resourceLimits).map(([key, limit]) => ({ label: copy.value.resources[key as PlanResourceKey], value: limit == null ? '∞' : String(limit) })) : []),
        ...(frozen.details ? Object.entries(frozen.details.entitlements).map(([key]) => ({ label: key === 'appointments' ? isArabic.value ? 'المواعيد' : 'Appointments' : isArabic.value ? 'التقارير' : 'Reports', value: isArabic.value ? 'مشمول' : 'Included' })) : []),
        ...(frozen.details && frozen.details.listPriceAmount > frozen.details.effectivePriceAmount ? [{ label: isArabic.value ? 'خصم سعر الخطة' : 'Plan rate discount', value: money(frozen.details.listPriceAmount - frozen.details.effectivePriceAmount, 'EGP') }] : []),
        { label: copy.value.quoteRate, value: `${money(frozen.calculation.newTermMinor / 100, 'EGP')} · ${intervalLabel(frozen.calculation.newBillingInterval)}` },
        { label: copy.value.quoteService, value: intermediateMoney(frozen.calculation.serviceValueMinor) }, { label: copy.value.quoteUnused, value: intermediateMoney(frozen.calculation.unusedPrepaidMinor) },
        { label: copy.value.quoteExistingCredit, value: money(frozen.calculation.creditBeforeMinor / 100, 'EGP') }, { label: copy.value.quoteDue, value: money(frozen.calculation.amountDueMinor / 100, 'EGP') },
        { label: copy.value.quoteAfter, value: money(frozen.calculation.creditAfterMinor / 100, 'EGP') }], policy: `${frozen.calculation.mode === 'no_change' ? copy.value.quoteNoChangePolicy : frozen.calculation.mode === 'remaining_period' ? copy.value.quoteRenewal(date(frozen.calculation.periodEnd)) : copy.value.quoteNewPeriod} ${copy.value.quotePrecision}`, expiry: openCheckout.value ? copy.value.quoteSaved : copy.value.quoteExpires(proration.deadline.format(proration.deadline.expiresIn.value)) } : quote && !openCheckout.value ? { title: copy.value.requestedPlan, items: [
        { label: copy.value.requestedPlan, value: `${quote.planName} · ${quote.variantName}` },
        { label: copy.value.interval, value: intervalLabel(quote.billingInterval) },
        ...Object.entries(quote.resourceLimits).map(([key, limit]) => ({ label: copy.value.resources[key as PlanResourceKey], value: limit == null ? '∞' : String(limit) })),
        ...(quote.listPriceAmount > quote.effectivePriceAmount ? [{ label: isArabic.value ? 'خصم سعر الخطة' : 'Plan rate discount', value: money(quote.listPriceAmount - quote.effectivePriceAmount, quote.currency) }] : []),
        { label: copy.value.quoteDue, value: money(quote.effectivePriceAmount, quote.currency) }], policy: copy.value.checkoutConsequences, expiry: '' } : undefined,
      restartLabel: frozen ? copy.value.quoteRestart : undefined, restartDisabled: checkoutPending.value || !!openCheckout.value,
      quote: frozen ? `${frozen.planName} · ${money(frozen.calculation.amountDueMinor / 100, 'EGP')}` : openCheckout.value ? `${openCheckout.value.planName} · ${money(openCheckout.value.amountMinor / 100, openCheckout.value.currency)}` : quote ? `${quote.planName} · ${money(quote.effectivePriceAmount, quote.currency)} · ${intervalLabel(quote.billingInterval)}` : copy.value.noPurchasable,
      restrictions: !preview ? planPresentation.pricingPlans.find(plan => plan.id === selectedPlan.value?.planSlug)?.notice : preview.blockers.length ? { title: planPresentation.copy.blocked, body: planPresentation.copy.blockers, items: preview.blockers.map(blocker => `${planPresentation.copy.resources[blocker.resource as PlanResourceKey]}: ${blocker.used} / ${blocker.limit}`), footer: copy.value.preservation } : undefined,
      consequences: [copy.value.checkoutConsequences, ...((prorationEnabled.value || frozen) && frozen?.calculation.amountDueMinor !== 0 ? [copy.value.quoteCardOnly] : []), ...(openCheckout.value ? [copy.value.checkoutSavedOrder] : [])],
      notice: [quote?.blockers.length ? copy.value.preservation : sub?.accessState === 'trialing' ? copy.value.checkoutTrial : '', checkoutMode.value === 'test' ? copy.value.checkoutTest : ''].filter(Boolean).join(' '),
      unavailable: quote && quote.currency !== 'EGP' ? copy.value.quoteCurrency : !checkoutReady.value && !checkoutChecking.value ? copy.value.checkoutUnavailable : '', action: openCheckout.value ? copy.value.checkoutResume : prorationEnabled.value && !frozen ? copy.value.quotePrepare : frozen?.calculation.mode === 'no_change' ? copy.value.quoteNoChange : frozen?.calculation.amountDueMinor === 0 ? copy.value.quoteCreditAction : copy.value.checkoutAction,
      pending: checkoutPending.value, disabled: (!openCheckout.value && !!quote && quote.currency !== 'EGP') || (!openCheckout.value && !!frozen && (proration.expired.value || !prorationEnabled.value)) || !checkoutReady.value || checkoutChecking.value || checkoutPending.value || paymentHeld || !quote || !!quote.blockers.length
        || !!privatePreview.value?.submissionId || !!privatePreview.value?.xpayOrderId || !!privatePreview.value?.settledQuoteId || billing.value?.subscription.accessState === 'suspended', error: checkoutError.value,
      statusMessage: paymentMessage, refreshLabel: copy.value.checkoutCheck, refreshDisabled: checkoutPending.value || checkoutChecking.value },
    checkoutHistory: { title: copy.value.checkoutHistory, status: copy.value.access, plan: copy.value.requestedPlan, amount: copy.value.expected, date: copy.value.transferDate, empty: copy.value.checkoutEmpty,
      rows: checkoutOrders.value.map(order => ({ id: order.orderId, status: copy.value.checkoutStates[order.state], plan: order.planName, amount: money(order.amountMinor / 100, order.currency), date: date(order.createdAt) })) },
    transfer: null, evidence: null, showEvidence: false, showHistory: true,
    history: (value?.submissions ?? []).map(item => ({ id: item.id, status: item.status, statusLabel: statusLabel(item.status), plan: item.requestedPlanName, expected: money(item.effectivePriceAmount, item.currency), paid: money(item.paidAmount, item.currency), reference: item.transferReference, date: date(item.transferDate), reason: item.reviewReason ?? '' })),
    trial: null, policy: null, paymentNotice: '', paymentRequired: '', compatibilityNotice: '', pricingError: '', canRequests: false,
  }
})
function chooseBillingInterval(value: string) { if (value === 'monthly' || value === 'annual') planPresentation.interval = value }
</script>
<template>
  <BsBillingPage v-model:checkout-visible="checkoutVisible" v-model:form="billingForm" variant="shop" :copy="billingCopy" :view="billingView" @retry="refresh()" @usage-retry="refresh()" @pricing-retry="refreshCatalog()" @interval="chooseBillingInterval" @variant="planPresentation.chooseVariant" @plan="planPresentation.choose" @private-preview="previewPrivateOffer" @private-clear="clearPrivateOffer" @checkout="startCheckout" @checkout-refresh="refreshCheckout()" @checkout-restart="restartCheckoutQuote"/>
</template>
