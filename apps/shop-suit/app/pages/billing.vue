<script setup lang="ts">
import type { BsBillingCopy, BsBillingView, BsBillingForm } from '@building-suit/ui/types/billingPresentation'
import type { BillingPlanOption, BillingSubmission, PrivateOfferPreview, ShopBilling } from '~/types/billing'
import type { PlanResourceKey, PlanUsageResource, ShopPlanInterval, ShopPlanOffer } from '~/types/plans'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { parsePrivateOfferLink } from '~/utils/private-offer'
import type { PrivateOfferEntry } from '~/utils/private-offer'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const client = useSupabaseClient<ShopRpcDatabase>()
const rpc = client.schema('public')
const { locale } = useI18n()
const ui = useUiCopy()
const { current, currentId, isOwner } = useShop()
const { push: pushToast } = useToasts()
const confirmation = useConfirmation()
const { data: publicPlans, isLoading: catalogPending, error: catalogError, refresh: refreshCatalog, ready: catalogReady } = usePlans()
await catalogReady
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const form = reactive({ catalogTermsId: '', paidAmount: 0, transferDate: '', transferReference: '' })
const submitPending = ref(false)
const submitError = ref('')
const submitRequestId = ref<string | null>(null)
const privateLink = ref('')
const privateEntry = shallowRef<PrivateOfferEntry | null>(null)
const privatePreview = shallowRef<PrivateOfferPreview | null>(null)
const privatePending = ref(false)
const privateError = ref('')
const user = useSupabaseUser()
let privateGeneration = 0
function clearPrivateOffer() {
  ++privateGeneration
  privateLink.value = ''; privateEntry.value = null; privatePreview.value = null
  privatePending.value = false; privateError.value = ''; submitRequestId.value = null; submitPending.value = false
}
async function previewPrivateOffer() {
  if (!currentId.value || !isOwner.value || privatePending.value) return
  const generation = ++privateGeneration
  privateError.value = ''; privatePreview.value = null; privateEntry.value = null; submitRequestId.value = null
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
    privateEntry.value = entry; privatePreview.value = offer
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
const noticeQuote = computed(() => privatePreview.value ? { planName: privatePreview.value.displayName, effectivePriceAmount: privatePreview.value.priceAmount, currency: privatePreview.value.currency, billingInterval: privatePreview.value.billingInterval, priceSource: 'private_offer', blockers: privatePreview.value.blockers } : selectedPlan.value)
const currentCatalogTermsId = computed(() => purchasablePlans.value.find(plan => plan.planSlug === billing.value?.subscription.planSlug
  && plan.planVariant === billing.value?.subscription.planVariant
  && plan.billingInterval === billing.value?.subscription.billingInterval)?.catalogTermsId ?? '')
const latestSubmission = computed(() => billing.value?.submissions?.[0] ?? null)
const evidenceSubmission = computed(() => billing.value?.submissions.find(item => ['submitted', 'under_review'].includes(item.status)) ?? null)
const evidenceFile = shallowRef<File | null>(null)
const evidenceInputVersion = ref(0)
const evidencePending = ref(false)
const evidenceError = ref('')
const evidenceSaved = ref(false)
const evidenceFiles = ref<Array<{ evidenceId: string; originalFileName: string; sha256: string }>>([])
let evidenceGeneration = 0
let reservation: { evidenceId: string; bucket: string; objectName: string; mimeType: string; sizeBytes: number } | null = null
watch([currentId, isOwner, user, () => evidenceSubmission.value?.id], async () => {
  const generation = ++evidenceGeneration
  evidenceFile.value = null; reservation = null; evidenceError.value = ''; evidenceSaved.value = false
  evidenceFiles.value = []; evidencePending.value = false
  ++evidenceInputVersion.value
  const submission = evidenceSubmission.value
  if (!submission || !isOwner.value) return
  try {
    const { data, error } = await rpc.rpc('shop_billing_payment_evidence_read', { p_submission_id: submission.id })
    if (error) throw error
    if (generation === evidenceGeneration) evidenceFiles.value = data ?? []
  } catch {
    if (generation === evidenceGeneration) evidenceError.value = copy.value.evidenceFailed
  }
}, { immediate: true, flush: 'sync' })
function selectEvidence(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  evidenceError.value = ''; evidenceSaved.value = false
  if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5242880
    || file.name.trim().length > 160 || /[/\\]/.test(file.name) || Array.from(file.name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) {
    evidenceError.value = copy.value.evidenceInvalid
    input.value = ''; evidenceFile.value = null; reservation = null
    return
  }
  if (file !== evidenceFile.value) reservation = null
  evidenceFile.value = file
}
async function uploadEvidence() {
  const file = evidenceFile.value
  const submission = evidenceSubmission.value
  if (!file || !submission || !isOwner.value || evidencePending.value) return
  const generation = evidenceGeneration
  evidencePending.value = true; evidenceError.value = ''; evidenceSaved.value = false
  try {
    const bytes = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    if (generation !== evidenceGeneration) return
    if (!reservation) {
      const { data, error } = await rpc.rpc('reserve_shop_billing_payment_evidence', {
        p_submission_id: submission.id, p_original_file_name: file.name, p_mime_type: file.type, p_size_bytes: file.size, p_sha256: sha256,
      })
      if (error || !data) throw error ?? new Error('reservation_missing')
      if (generation !== evidenceGeneration) return
      reservation = data
    }
    const { error: uploadError } = await client.storage.from(reservation.bucket).upload(reservation.objectName, bytes, { contentType: reservation.mimeType, upsert: false })
    if (generation !== evidenceGeneration) return
    // Read completed evidence even on a lost upload response; never replace a receipt.
    const { data, error: readError } = await rpc.rpc('shop_billing_payment_evidence_read', { p_submission_id: submission.id })
    if (generation !== evidenceGeneration) return
    if (readError || !data?.some(item => item.evidenceId === reservation?.evidenceId)) throw uploadError ?? readError ?? new Error('upload_incomplete')
    evidenceFiles.value = data; evidenceSaved.value = true; evidenceFile.value = null; reservation = null
    ++evidenceInputVersion.value
  } catch {
    if (generation === evidenceGeneration) evidenceError.value = copy.value.evidenceFailed
  } finally {
    if (generation === evidenceGeneration) evidencePending.value = false
  }
}

const hasOpenRequest = computed(() => billing.value?.submissions?.some(item => ['submitted', 'under_review'].includes(item.status)) ?? false)
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
  submitRequestId.value = null
  submitError.value = ''
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

function choosePlan(plan: ShopPlanOffer) {
  clearPrivateOffer()
  form.catalogTermsId = plan.catalogTermsId
}

async function submitNotice() {
  if (!currentId.value || !isOwner.value || submitPending.value) return
  submitError.value = ''
  const plan = selectedPlan.value
  const entry = privateEntry.value
  const shopId = currentId.value
  const generation = privateGeneration
  if (!plan || (!entry && !selectedPlan.value) || !(form.paidAmount > 0) || !form.transferDate || form.transferReference.trim().length < 2) {
    submitError.value = copy.value.invalid
    return
  }
  const confirmed = await confirmation.ask(copy.value.confirmNotice(plan.planName, money(plan.effectivePriceAmount, plan.currency), money(form.paidAmount, plan.currency)))
  if (!confirmed || generation !== privateGeneration || shopId !== currentId.value || !isOwner.value) return
  submitPending.value = true
  const requestId = submitRequestId.value ?? globalThis.crypto.randomUUID()
  submitRequestId.value = requestId
  try {
    const { error: commandError } = entry ? await rpc.rpc('redeem_shop_private_offer', {
      p_request_id: requestId, p_shop_id: shopId, p_offer_id: entry.offerId, p_offer_version: entry.offerVersion,
      p_target_binding_id: entry.targetBindingId, p_target_environment_id: entry.targetEnvironmentId, p_redemption_token: entry.redemptionToken,
      p_paid_amount: form.paidAmount, p_transfer_date: form.transferDate, p_transfer_reference: form.transferReference.trim(),
    }) : await rpc.rpc('submit_shop_billing_notice', {
      p_request_id: requestId,
      p_shop_id: currentId.value,
      p_requested_plan_slug: selectedPlan.value!.planSlug,
      p_requested_catalog_terms_id: selectedPlan.value!.catalogTermsId,
      p_paid_amount: form.paidAmount,
      p_transfer_date: form.transferDate,
      p_transfer_reference: form.transferReference.trim(),
    })
    if (commandError) throw commandError
    if (generation !== privateGeneration || shopId !== currentId.value || !isOwner.value) return
    clearPrivateOffer()
    submitRequestId.value = null
    Object.assign(form, { paidAmount: plan.effectivePriceAmount, transferDate: '', transferReference: '' })
    await refresh()
    noticeAction.complete()
    pushToast({ tone: 'success', title: copy.value.submitted })
  }
  catch {
    if (generation === privateGeneration) submitError.value = copy.value.failed
  }
  finally {
    if (generation === privateGeneration) submitPending.value = false
  }
}

const en = {
  evidenceTitle: 'Payment receipt image', evidenceHelp: 'After transferring, submit your payment notice, then upload the receipt image for that request. JPEG, PNG or WebP, up to 5 MB.', evidenceSelect: 'Receipt image', evidenceUpload: 'Upload receipt', evidenceUploading: 'Uploading…', evidenceFirst: 'Submit a payment notice above to attach your receipt.', evidenceInvalid: 'Choose a JPEG, PNG or WebP image between 1 byte and 5 MB with a filename up to 160 characters.', evidenceFailed: 'Could not load or upload the receipt. Retry safely; your payment notice is already saved.', evidenceSaved: 'Receipt image sent for review.', evidenceAttached: 'Attached receipts',
  privateTitle: 'Private offer', privateHelp: 'Sign in to the intended owner account, then open or paste the private offer link. Submitting starts manual payment review; it does not activate access.', privateLink: 'Private offer link', privatePreview: 'Review private terms', privateUnavailable: 'This offer is unavailable for this owner or shop. Check the link, expiry and recipient.', privateClear: 'Clear private offer', privateRedeemed: 'This offer already has a payment notice. Review its status below.',
  title: 'Subscription and billing', subtitle: 'Understand your plan, usage, and manually reviewed InstaPay requests.',
  ownerOnly: 'Ask the Shop owner to review billing or submit a transfer notice. Only the owner can access these details.',
  noBilling: 'No subscription information is available. Contact Building Suit support to review this shop’s billing.', loadFailed: 'Could not load billing information.', retry: 'Retry', plan: 'Current plan', access: 'Access state',
  days: 'days', periodEnd: 'Current access ends', trialEnd: 'Trial ends', currentPrice: 'Effective price', listPrice: 'List price', negotiated: 'Negotiated price applies', usage: 'Plan usage', usageHelp: 'Near-limit and full resources are highlighted before a write is rejected.',
  readOnly: 'Your business history remains available, but subscription-gated writes are disabled until an operator approves payment or adjusts access.',
  compare: 'Compare plans', compareHelp: 'Only plans currently approved for purchase are shown. Limits are enforced by resource, not by business type.', current: 'Current', choose: 'Choose plan', chosen: 'Selected',
  blocked: 'Approval blocked by current usage', blockers: 'You can select this plan and submit its payment notice now, but it cannot be activated until every excess below is resolved.', preservation: 'All resources and data stay saved. Nothing is automatically deleted or archived. Resources above the chosen plan limits are unavailable for new or active use until you reduce usage or upgrade the plan.', used: 'used', limitLabel: 'limit', over: 'over',
  instructions: 'Pay with InstaPay / instant bank transfer', instructionsHelp: 'Transfer using the operator-configured details below, then submit the notice for manual review. This is not automatic bank verification.',
  recipient: 'Recipient alias', paymentLink: 'Payment link', qr: 'Payment QR', unavailable: 'Payment instructions have not been configured yet. Contact Building Suit support before transferring.',
  notice: 'Submit payment notice', noticeHelp: 'A notice starts manual review. It does not change your plan or access until a platform operator approves it.', requestedPlan: 'Requested plan', interval: 'Commercial term', expected: 'Quoted plan price', paid: 'Amount transferred', transferDate: 'Transfer date', reference: 'Transfer reference',
  submit: 'Submit for review', submitting: 'Submitting…', invalid: 'Choose an available plan and enter a positive amount, transfer date, and reference.', submitted: 'Payment notice submitted for manual review.', failed: 'Could not submit the payment notice. You can retry safely.', confirmNotice: (plan: string, quote: string, paid: string) => `Submit a manual payment notice for ${plan}? The quoted price is ${quote} and you entered ${paid}. Your access will not change until an operator approves it.`,
  policyPrefix: 'By submitting, you acknowledge the', terms: 'Terms & Conditions', privacy: 'Privacy Policy', refund: 'Refund & Cancellation Policy',
  latest: 'Latest request', history: 'Payment notice history', empty: 'No payment notices have been submitted.', reviewReason: 'Review note', manual: 'Manual verification', catalogFailed: 'Could not load the purchasable plan catalog.', noPurchasable: 'No plans are currently available to request. Your current subscription remains unchanged.',
  statuses: { trialing: 'Trialing', active: 'Active', read_only: 'Read-only', suspended: 'Suspended', submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected' },
  submissionMessages: { submitted: 'Submitted for manual review. Your current plan and access have not changed.', under_review: 'An operator is reviewing this transfer. Your current plan and access have not changed.', approved: 'This request was approved. The current-plan summary above is the authoritative active access.', rejected: 'This request was rejected. Review the note, correct the transfer details, and submit a new notice if needed.' },
  resources: { active_locations: 'Active locations', active_members: 'Team members', active_products: 'Active products', active_services: 'Active services', active_customers: 'Active customers', active_suppliers: 'Active suppliers' },
  intervals: { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' },
}

const ar = {
  evidenceTitle: 'صورة إيصال الدفع', evidenceHelp: 'بعد التحويل، ابعت إشعار الدفع ثم ارفع صورة الإيصال للطلب. JPEG أو PNG أو WebP بحد أقصى ٥ ميجابايت.', evidenceSelect: 'صورة الإيصال', evidenceUpload: 'ارفع الإيصال', evidenceUploading: 'بنرفع…', evidenceFirst: 'ابعت إشعار الدفع بالأعلى عشان ترفق صورة الإيصال.', evidenceInvalid: 'اختار صورة JPEG أو PNG أو WebP بحجم من بايت واحد إلى ٥ ميجابايت واسم لا يتجاوز ١٦٠ حرفًا.', evidenceFailed: 'مقدرناش نحمّل أو نرفع الإيصال. حاول تاني بأمان؛ إشعار الدفع محفوظ بالفعل.', evidenceSaved: 'اتبعت صورة الإيصال للمراجعة.', evidenceAttached: 'الإيصالات المرفقة',
  privateTitle: 'عرض خاص', privateHelp: 'سجّل الدخول بحساب المالك المقصود، ثم افتح رابط العرض الخاص أو الصقه. الإرسال يبدأ مراجعة الدفع اليدوية ولا يفعّل الوصول.', privateLink: 'رابط العرض الخاص', privatePreview: 'مراجعة شروط العرض', privateUnavailable: 'هذا العرض غير متاح لهذا المالك أو المتجر. راجع الرابط والصلاحية والمستلم.', privateClear: 'مسح العرض الخاص', privateRedeemed: 'يوجد إشعار دفع لهذا العرض بالفعل. راجع حالته أدناه.',
  title: 'الاشتراك والدفع', subtitle: 'شوف خطتك واستخدامك، وتابع طلبات InstaPay اللي بنراجعها يدويًا.',
  ownerOnly: 'اطلب من مالك المتجر مراجعة الفوترة أو إرسال إشعار التحويل. هذه التفاصيل متاحة للمالك فقط.',
  noBilling: 'مفيش معلومات اشتراك متاحة. كلّم دعم Building Suit عشان يراجع اشتراك المتجر.', loadFailed: 'مقدرناش نحمّل معلومات الاشتراك.', retry: 'حاول تاني', plan: 'الخطة الحالية', access: 'حالة الاستخدام',
  days: 'يوم', periodEnd: 'ينتهي الوصول الحالي', trialEnd: 'تنتهي التجربة', currentPrice: 'السعر الفعلي', listPrice: 'السعر المعلن', negotiated: 'يُطبق سعر تفاوضي', usage: 'استخدام الخطة', usageHelp: 'نوضح الموارد القريبة من الحد أو المكتملة قبل رفض عملية جديدة.',
  readOnly: 'سجل شغلك هيفضل متاح للقراية، بس مش هتقدر تعمل عمليات جديدة لحد ما مسؤول المنصة يعتمد الدفعة أو يعدّل الاستخدام.',
  compare: 'مقارنة الخطط', compareHelp: 'تظهر فقط الخطط المعتمدة والمتاحة للشراء الآن. تُطبّق الحدود حسب المورد وليس نوع النشاط.', current: 'الحالية', choose: 'اختيار الخطة', chosen: 'تم الاختيار',
  blocked: 'التفعيل متوقف بسبب الاستخدام الحالي', blockers: 'يمكنك اختيار هذه الخطة وإرسال إشعار الدفع الآن، لكن لا يمكن تفعيلها حتى تعالج كل تجاوز موضح أدناه.', preservation: 'تظل كل الموارد والبيانات محفوظة. لن يُحذف أو يُؤرشف أي شيء تلقائيًا. الموارد التي تتجاوز حدود الخطة المختارة لن تكون متاحة للاستخدام الجديد أو النشط حتى تخفّض الاستخدام أو ترقي الخطة.', used: 'مستخدم', limitLabel: 'الحد', over: 'فوق الحد',
  instructions: 'الدفع بـ InstaPay أو تحويل بنكي فوري', instructionsHelp: 'حوّل على البيانات الظاهرة، وبعدها ابعت إشعار الدفع للمراجعة. التحويل بيتراجع يدويًا، مش بيتطابق تلقائيًا.',
  recipient: 'عنوان المستلم', paymentLink: 'رابط الدفع', qr: 'رمز QR للدفع', unavailable: 'لم يضبط مسؤول المنصة تعليمات الدفع بعد. تواصل مع دعم Building Suit قبل التحويل.',
  notice: 'ابعت إشعار الدفع', noticeHelp: 'إشعار الدفع بيبدأ المراجعة اليدوية، بس خطتك واستخدامك مش هيتغيّروا غير بعد الاعتماد.', requestedPlan: 'الخطة المطلوبة', interval: 'مدة الاشتراك', expected: 'سعر الخطة المثبت', paid: 'المبلغ المحوّل', transferDate: 'تاريخ التحويل', reference: 'مرجع التحويل',
  submit: 'ابعت للمراجعة', submitting: 'بنبعت…', invalid: 'اختار خطة متاحة، واكتب المبلغ وتاريخ ومرجع التحويل.', submitted: 'اتبعت إشعار الدفع للمراجعة اليدوية.', failed: 'مقدرناش نبعت إشعار الدفع. تقدر تحاول تاني من غير ما التحويل يتكرر.', confirmNotice: (plan: string, quote: string, paid: string) => `تبعت إشعار دفع لخطة ${plan}؟ سعر الخطة ${quote} والمبلغ اللي كتبته ${paid}. لن يتغير الوصول إلا بعد اعتماد مسؤول المنصة.`,
  policyPrefix: 'بإرسال الطلب، أنت تقر بالاطلاع على', terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية', refund: 'سياسة الاسترداد والإلغاء',
  latest: 'أحدث طلب', history: 'سجل إشعارات الدفع', empty: 'لم تُرسل إشعارات دفع بعد.', reviewReason: 'ملاحظة المراجعة', manual: 'تحقق يدوي', catalogFailed: 'تعذّر تحميل كتالوج الخطط المتاحة للشراء.', noPurchasable: 'لا توجد خطط متاحة للطلب حاليًا. سيظل اشتراكك الحالي دون تغيير.',
  statuses: { trialing: 'فترة تجريبية', active: 'نشط', read_only: 'قراءة فقط', suspended: 'موقوف', submitted: 'مُرسل', under_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' },
  submissionMessages: { submitted: 'تم الإرسال للمراجعة اليدوية. لم تتغير خطتك الحالية أو صلاحية الوصول.', under_review: 'يراجع مسؤول المنصة التحويل الآن. لم تتغير خطتك الحالية أو صلاحية الوصول.', approved: 'تم اعتماد هذا الطلب. ملخص الخطة الحالية بالأعلى هو المرجع الفعلي لصلاحية الوصول.', rejected: 'تم رفض الطلب. راجع الملاحظة وصحح بيانات التحويل ثم أرسل إشعارًا جديدًا عند الحاجة.' },
  resources: { active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق', active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة', active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون' },
  intervals: { monthly: 'شهريًا', quarterly: 'كل ثلاثة أشهر', annual: 'سنويًا' },
}
const planPresentation = reactive(useShopPlanPresentation({ get offers() { return purchasablePlans.value }, get selectedCatalogTermsId() { return form.catalogTermsId }, get currentCatalogTermsId() { return currentCatalogTermsId.value }, action: 'select' }, choosePlan))
const usagePresentation = useShopUsagePresentation()

const noticeAction = useRecordAction(() => form)
const { visible: noticeActionOpen, dirty: noticeActionDirty } = noticeAction

useShopRealtime('billing', () => submitPending.value || privatePending.value || !!privateLink.value || !!privatePreview.value || !!form.transferReference || !!form.transferDate || form.paidAmount > 0)

const billingForm = computed<BsBillingForm>({ get: () => ({ paidAmount: form.paidAmount, transferDate: form.transferDate, transferReference: form.transferReference, privateLink: privateLink.value, reason: '' }), set: value => { form.paidAmount = value.paidAmount; form.transferDate = value.transferDate; form.transferReference = value.transferReference; privateLink.value = value.privateLink } })
const billingCopy = computed<BsBillingCopy>(() => ({
  title: copy.value.title, subtitle: copy.value.subtitle, loading: ui('loading'), retry: copy.value.retry, cancel: ui('cancel'), denied: copy.value.ownerOnly, failed: copy.value.loadFailed, unavailable: copy.value.noBilling,
  usage: copy.value.usage, usageHelp: copy.value.usageHelp, usageLoading: ui('loading'), usageError: copy.value.loadFailed, compare: copy.value.compare, compareHelp: copy.value.compareHelp,
  instructions: copy.value.instructions, instructionsHelp: copy.value.instructionsHelp, manual: copy.value.manual, recipient: copy.value.recipient, paymentLink: copy.value.paymentLink, qr: copy.value.qr, instructionsUnavailable: copy.value.unavailable,
  privateTitle: copy.value.privateTitle, privateHelp: copy.value.privateHelp, privateLink: copy.value.privateLink, privatePreview: copy.value.privatePreview, privateClear: copy.value.privateClear,
  notice: copy.value.notice, noticeHelp: copy.value.noticeHelp, submit: copy.value.submit, requestedPlan: copy.value.requestedPlan, expected: copy.value.expected, interval: copy.value.interval, paid: copy.value.paid, transferDate: copy.value.transferDate, reference: copy.value.reference,
  policyPrefix: copy.value.policyPrefix, terms: copy.value.terms, privacy: copy.value.privacy, refund: copy.value.refund, noPurchasable: copy.value.noPurchasable,
  evidenceTitle: copy.value.evidenceTitle, evidenceHelp: copy.value.evidenceHelp, evidenceSelect: copy.value.evidenceSelect, evidenceUpload: copy.value.evidenceUpload, evidenceUploading: copy.value.evidenceUploading, evidenceFirst: copy.value.evidenceFirst, evidenceSaved: copy.value.evidenceSaved, evidenceAttached: copy.value.evidenceAttached,
  history: copy.value.history, empty: copy.value.empty, access: copy.value.access, reviewReason: copy.value.reviewReason, reason: copy.value.reviewReason, refresh: copy.value.retry, requests: copy.value.history, inspect: copy.value.evidenceAttached, openSubscription: copy.value.title, cancelRequest: ui('cancel'),
}))
const billingView = computed<BsBillingView>(() => {
  const value = billing.value
  const sub = value?.subscription
  const quote = noticeQuote.value
  const preview = privatePreview.value
  const latest = latestSubmission.value
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
    pricing: { interval: planPresentation.interval, plans: planPresentation.pricingPlans, intervalOptions: [{ value: 'monthly', label: planPresentation.copy.monthly }, { value: 'annual', label: planPresentation.copy.yearly }], copy: { cycleLabel: planPresentation.copy.cycle, loading: planPresentation.copy.loading, empty: copy.value.noPurchasable, retry: planPresentation.copy.retry, included: planPresentation.copy.included, notIncluded: planPresentation.copy.notIncluded }, annualSaving: planPresentation.annualDiscount === null ? null : planPresentation.copy.annualSaving(planPresentation.annualDiscount), columns: 3, loading: catalogPending.value, error: catalogError.value ? copy.value.catalogFailed : null, testId: 'shop-plan-cards' },
    instructions: value ? { recipient: value.instructions.recipientAlias ?? '', link: value.instructions.paymentLink ?? '', qr: value.instructions.qrImageUrl ?? '', text: (isArabic.value ? value.instructions.instructionsAr : value.instructions.instructionsEn) ?? '' } : null,
    privateOffer: { pending: privatePending.value, error: privateError.value, title: preview?.displayName ?? '', summary: preview ? `${money(preview.priceAmount, preview.currency)} · ${intervalLabel(preview.billingInterval)} · ${date(preview.expiresAt)}` : '', limits: preview ? Object.entries(preview.resourceLimits).map(([key, limit]) => ({ key, label: copy.value.resources[key as PlanResourceKey], value: limit == null ? '∞' : String(limit) })) : [], notice: preview?.blockers.length ? copy.value.preservation : '', redeemed: preview?.submissionId ? copy.value.privateRedeemed : '' },
    transfer: { visible: noticeActionOpen.value, dirty: noticeActionDirty.value, pending: submitPending.value, error: submitError.value, disabled: !quote || hasOpenRequest.value || !!preview?.submissionId, quote: quote ? `${copy.value.requestedPlan}: ${quote.planName} · ${copy.value.expected}: ${money(quote.effectivePriceAmount, quote.currency)} · ${copy.value.interval}: ${intervalLabel(quote.billingInterval)}` : '', quoteNotice: quote ? [quote.priceSource === 'override' ? copy.value.negotiated : '', quote.blockers.length ? copy.value.preservation : ''].filter(Boolean).join(' · ') : '', maximumDate: new Date().toISOString().slice(0, 10) },
    evidence: evidenceSubmission.value ? { reference: evidenceSubmission.value.transferReference, pending: evidencePending.value, error: evidenceError.value, saved: evidenceSaved.value, inputVersion: evidenceInputVersion.value, filenames: evidenceFiles.value.map(file => file.originalFileName) } : null,
    showEvidence: true, showHistory: true, history: (value?.submissions ?? []).map(item => ({ id: item.id, status: item.status, statusLabel: statusLabel(item.status), plan: item.requestedPlanName, expected: money(item.effectivePriceAmount, item.currency), paid: money(item.paidAmount, item.currency), reference: item.transferReference, date: date(item.transferDate), reason: item.reviewReason ?? '' })),
    trial: null, policy: null, paymentNotice: '', paymentRequired: '', compatibilityNotice: '', pricingError: '', canRequests: false,
  }
})
function chooseBillingInterval(value: string) { if (value === 'monthly' || value === 'annual') planPresentation.interval = value }
</script>
<template>
  <BsBillingPage v-model:form="billingForm" v-model:evidence-file="evidenceFile" :copy="billingCopy" :view="billingView" @retry="refresh()" @usage-retry="refresh()" @pricing-retry="refreshCatalog()" @interval="chooseBillingInterval" @variant="planPresentation.chooseVariant" @plan="planPresentation.choose" @private-preview="previewPrivateOffer" @private-clear="clearPrivateOffer" @transfer-open="noticeAction.edit()" @transfer-close="noticeActionOpen = false" @transfer-submit="submitNotice" @evidence-select="selectEvidence" @evidence-upload="uploadEvidence"/>
</template>
