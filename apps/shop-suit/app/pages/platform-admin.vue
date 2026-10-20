<script setup lang="ts">
import type { BsPlatformAdministrationCopy, BsAdminCommerceCopy, BsAdminCommerceView, BsAdminSupportForm, BsAdminReceiptReviewForm, BsAdminPriceForm, BsAdminPaymentConfigurationForm, BsAdminAuditRow } from '@building-suit/ui/types/platformAdministrationPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { PlatformBillingConfiguration, PlatformBillingQueueItem } from '~/types/billing'
import type { PlatformAdminEvent, PlatformAdminSession, PlatformDashboard, PlatformPage, PlatformShopDetail, PlatformShopRow } from '~/types/platformAdmin'

definePageMeta({ layout: 'platform-admin', middleware: ['auth'] })

type ActionKey = 'suspend_shop' | 'reactivate_shop' | 'extend_trial' | 'end_trial'
  | 'correct_billing_metadata' | 'add_support_note'

const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const user = useSupabaseUser()
const userId = computed(() => user.value?.id ?? null)
const { locale } = useI18n()
const ui = useUiCopy()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const showDevelopmentErrors = import.meta.dev
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const view = ref<'overview' | 'plans' | 'billing' | 'audit'>('overview')
const search = ref('')
const debouncedSearch = ref('')
const status = ref('')
const page = ref(1)
const auditPage = ref(1)
const billingPage = ref(1)
const billingAuditPage = ref(1)
const billingStatus = ref<'' | 'submitted' | 'under_review' | 'approved' | 'rejected'>('')
const selectedShopId = ref<string | null>(null)
const sessionError = ref('')
const commandError = ref('')
const action = reactive({ key: 'add_support_note' as ActionKey, reason: '', days: 30, planSlug: 'pro', billingReference: '', billingNote: '', note: '' })
const billingConfiguration = reactive({ recipientAlias: '', paymentLink: '', qrImageUrl: '', instructionsEn: '', instructionsAr: '', reason: '' })
const configurationPending = ref(false)
const configurationError = ref('')
const configurationRequestId = ref<string | null>(null)
const billingReviewOpen = ref(false)
const billingReviewPending = ref(false)
const billingReviewError = ref('')
const billingReviewRequestId = ref<string | null>(null)
const billingReview = reactive({ submission: null as PlatformBillingQueueItem | null, action: 'mark_under_review' as 'mark_under_review' | 'approve' | 'reject', reason: '', receivedAmount: 0, receivedReference: '', receivedDate: '', amountOverrideReason: '' })
const priceOverrideOpen = ref(false)
const priceOverridePending = ref(false)
const priceOverrideError = ref('')
const priceOverrideRequestId = ref<string | null>(null)
const priceOverride = reactive({ shopId: '', shopName: '', amount: 0, currency: 'EGP', effectiveFrom: '', expiresAt: '', reason: '' })
const { visible: actionOpen, pending: actionPending, dirty: actionDirty, open: showAction, complete: completeAction } = useRecordAction(() => action)
const { dirty: billingReviewDirty } = useRecordAction(() => billingReview, billingReviewOpen)
const { dirty: priceOverrideDirty } = useRecordAction(() => priceOverride, priceOverrideOpen)
const searchInteraction = useDebouncedChange(search, value => { debouncedSearch.value = value.trim(); page.value = 1 }, 300)
watch(status, () => { page.value = 1 })

async function callRead<T>(resource: 'dashboard' | 'shops' | 'shop' | 'audit', options: Partial<ShopRpcDatabase['public']['Functions']['platform_admin_read']['Args']> = {}) {
  const { data, error } = await rpc.rpc('platform_admin_read', { p_resource: resource, ...options })
  if (error) throw error
  return data as T
}

const sessionQuery = useShopQuery(
  'platform-admin:session',
  async (): Promise<PlatformAdminSession | null> => {
    const requestedUserId = userId.value
    sessionError.value = ''
    if (!requestedUserId) return null
    const { data, error } = await rpc.rpc('platform_admin_session')
    if (requestedUserId !== userId.value) return null
    if (error) {
      sessionError.value = error.message
      return null
    }
    return data as PlatformAdminSession
  },
  { watch: [userId] },
)
const { data: session, pending: sessionPending, refresh: refreshSession } = sessionQuery
// Resolve server-rendered dependencies; client reads remain reactive.
if (import.meta.server) await sessionQuery.ensure()

watch(userId, () => {
  searchInteraction.cancel()
  selectedShopId.value = null
  actionOpen.value = false
  billingReviewOpen.value = false
  priceOverrideOpen.value = false
  billingReview.submission = null
  billingReviewRequestId.value = null
  configurationRequestId.value = null
  priceOverrideRequestId.value = null
  billingReviewError.value = ''
  configurationError.value = ''
}, { flush: 'sync' })

const dashboardQuery = useShopQuery(
  'platform-admin:dashboard',
  async (): Promise<PlatformDashboard | null> => session.value ? await callRead<PlatformDashboard>('dashboard') : null,
  { watch: [session] },
)
const { data: dashboard, pending: dashboardPending, error: dashboardError, refresh: refreshDashboard } = dashboardQuery
if (import.meta.server) await dashboardQuery.ensure()

const shopsQuery = useShopQuery(
  'platform-admin:shops',
  async (): Promise<PlatformPage<PlatformShopRow> | null> => session.value ? await callRead<PlatformPage<PlatformShopRow>>('shops', {
    p_search: debouncedSearch.value || null,
    p_status: status.value || null,
    p_page: page.value,
    p_page_size: 20,
  }) : null,
  { watch: [session, debouncedSearch, status, page] },
)
const { data: shops, pending: shopsPending, error: shopsError, refresh: refreshShops } = shopsQuery
if (import.meta.server) await shopsQuery.ensure()

const detailQuery = useShopQuery(
  'platform-admin:shop-detail',
  async (): Promise<PlatformShopDetail | null> => session.value && selectedShopId.value
    ? await callRead<PlatformShopDetail>('shop', { p_shop_id: selectedShopId.value })
    : null,
  { watch: [session, selectedShopId] },
)
const { data: detail, pending: detailPending, error: detailError, refresh: refreshDetail } = detailQuery
if (import.meta.server) await detailQuery.ensure()

const auditQuery = useShopQuery(
  'platform-admin:audit',
  async (): Promise<PlatformPage<PlatformAdminEvent> | null> => session.value ? await callRead<PlatformPage<PlatformAdminEvent>>('audit', {
    p_page: auditPage.value,
    p_page_size: 25,
  }) : null,
  { watch: [session, auditPage] },
)
const { data: audit, pending: auditPending, error: auditError, refresh: refreshAudit } = auditQuery
if (import.meta.server) await auditQuery.ensure()

const billingQueueQuery = useShopQuery(
  'platform-admin:billing-queue',
  async (): Promise<PlatformPage<PlatformBillingQueueItem> | null> => {
    if (!session.value) return null
    const { data, error } = await rpc.rpc('platform_admin_billing_read', {
      p_resource: 'queue', p_status: billingStatus.value || null,
      p_page: billingPage.value, p_page_size: 25,
    })
    if (error) throw error
    return data as PlatformPage<PlatformBillingQueueItem>
  },
  { watch: [session, billingStatus, billingPage] },
)
const { data: billingQueue, pending: billingQueuePending, error: billingQueueError, refresh: refreshBillingQueue } = billingQueueQuery
if (import.meta.server) await billingQueueQuery.ensure()

const storedBillingConfigurationQuery = useShopQuery(
  'platform-admin:billing-configuration',
  async (): Promise<PlatformBillingConfiguration | null> => {
    if (!session.value) return null
    const { data, error } = await rpc.rpc('platform_admin_billing_read', { p_resource: 'configuration' })
    if (error) throw error
    return data as PlatformBillingConfiguration
  },
  { watch: [session] },
)
const { data: storedBillingConfiguration, error: billingConfigurationLoadError, refresh: refreshBillingConfiguration } = storedBillingConfigurationQuery
if (import.meta.server) await storedBillingConfigurationQuery.ensure()

const billingSummaryQuery = useShopQuery(
  'platform-admin:billing-summary',
  async (): Promise<{ open: number, submitted: number, underReview: number, approved: number, rejected: number } | null> => {
    if (!session.value) return null
    const { data, error } = await rpc.rpc('platform_admin_billing_read', { p_resource: 'summary' })
    if (error) throw error
    return data as { open: number, submitted: number, underReview: number, approved: number, rejected: number }
  },
  { watch: [session] },
)
const { data: billingSummary, refresh: refreshBillingSummary } = billingSummaryQuery
if (import.meta.server) await billingSummaryQuery.ensure()

const billingAuditQuery = useShopQuery(
  'platform-admin:billing-audit',
  async (): Promise<PlatformPage<PlatformAdminEvent> | null> => {
    if (!session.value) return null
    const { data, error } = await rpc.rpc('platform_admin_billing_read', { p_resource: 'audit', p_page: billingAuditPage.value, p_page_size: 25 })
    if (error) throw error
    return data as PlatformPage<PlatformAdminEvent>
  },
  { watch: [session, billingAuditPage] },
)
const { data: billingAudit, pending: billingAuditPending, error: billingAuditError, refresh: refreshBillingAudit } = billingAuditQuery
if (import.meta.server) await billingAuditQuery.ensure()

watch(storedBillingConfiguration, value => {
  if (!value) return
  Object.assign(billingConfiguration, {
    recipientAlias: value.recipientAlias || '', paymentLink: value.paymentLink || '', qrImageUrl: value.qrImageUrl || '',
    instructionsEn: value.instructionsEn || '', instructionsAr: value.instructionsAr || '', reason: '',
  })
}, { immediate: true })

watch(billingStatus, () => { billingPage.value = 1 })

watch(session, value => {
  if (value) return
  selectedShopId.value = null
  actionOpen.value = false
})

async function saveBillingConfiguration() {
  if (!session.value?.canMutate || configurationPending.value) return
  configurationError.value = ''
  if (billingConfiguration.reason.trim().length < 2) { configurationError.value = copy.value.reasonRequired; return }
  configurationPending.value = true
  const requestId = configurationRequestId.value ?? globalThis.crypto.randomUUID()
  configurationRequestId.value = requestId
  try {
    const { error } = await rpc.rpc('platform_admin_billing_command', {
      p_request_id: requestId, p_action: 'configure_instructions', p_submission_id: null,
      p_reason: billingConfiguration.reason.trim(),
      p_payload: {
        recipientAlias: billingConfiguration.recipientAlias.trim(), paymentLink: billingConfiguration.paymentLink.trim(),
        qrImageUrl: billingConfiguration.qrImageUrl.trim(), instructionsEn: billingConfiguration.instructionsEn.trim(), instructionsAr: billingConfiguration.instructionsAr.trim(),
      },
    })
    if (error) throw error
    configurationRequestId.value = null
    await Promise.all([refreshBillingConfiguration(), refreshBillingAudit()])
    configurationAction.complete()
    pushToast({ tone: 'success', title: copy.value.configurationSaved })
  }
  catch { configurationError.value = copy.value.commandFailed }
  finally { configurationPending.value = false }
}

function openBillingReview(submission: PlatformBillingQueueItem, actionKey: 'mark_under_review' | 'approve' | 'reject') {
  Object.assign(billingReview, {
    submission, action: actionKey, reason: '', receivedAmount: submission.paidAmount,
    receivedReference: submission.transferReference, receivedDate: submission.transferDate, amountOverrideReason: '',
  })
  billingReviewError.value = ''
  billingReviewRequestId.value = null
  billingReviewOpen.value = true
}

async function runBillingReview() {
  const submission = billingReview.submission
  if (!session.value?.canMutate || !submission || billingReviewPending.value) return
  billingReviewError.value = ''
  if (billingReview.reason.trim().length < 2) { billingReviewError.value = copy.value.reasonRequired; return }
  const amountMismatch = billingReview.receivedAmount !== submission.effectivePriceAmount || submission.paidAmount !== submission.effectivePriceAmount
  if (billingReview.action === 'approve' && (!(billingReview.receivedAmount > 0) || billingReview.receivedReference.trim().length < 2 || !billingReview.receivedDate || (amountMismatch && billingReview.amountOverrideReason.trim().length < 2))) {
    billingReviewError.value = copy.value.approvalInvalid; return
  }
  if (billingReview.action === 'approve' && !await confirmation.ask(copy.value.approveConfirm)) return
  billingReviewPending.value = true
  const requestId = billingReviewRequestId.value ?? globalThis.crypto.randomUUID()
  billingReviewRequestId.value = requestId
  try {
    const payload = billingReview.action === 'approve' ? {
      receivedAmount: billingReview.receivedAmount, receivedReference: billingReview.receivedReference.trim(),
      receivedDate: billingReview.receivedDate,
      ...(amountMismatch ? { amountOverrideReason: billingReview.amountOverrideReason.trim() } : {}),
    } : {}
    const { error } = await rpc.rpc('platform_admin_billing_command', {
      p_request_id: requestId, p_action: billingReview.action,
      p_submission_id: submission.id, p_reason: billingReview.reason.trim(), p_payload: payload,
    })
    if (error) throw error
    billingReviewRequestId.value = null
    billingReviewOpen.value = false
    await Promise.all([refreshBillingQueue(), refreshBillingSummary(), refreshBillingAudit(), refreshDashboard(), refreshShops(), refreshDetail(), refreshAudit()])
    pushToast({ tone: 'success', title: copy.value.commandSucceeded })
  }
  catch { billingReviewError.value = copy.value.commandFailed }
  finally { billingReviewPending.value = false }
}

function openPriceOverride(item: PlatformBillingQueueItem) {
  Object.assign(priceOverride, {
    shopId: item.shopId, shopName: item.shopName,
    amount: item.effectivePriceAmount, currency: item.currency,
    effectiveFrom: new Date().toISOString().slice(0, 10), expiresAt: '', reason: '',
  })
  priceOverrideError.value = ''
  priceOverrideRequestId.value = null
  priceOverrideOpen.value = true
}

async function savePriceOverride() {
  if (!session.value?.canMutate || priceOverridePending.value) return
  priceOverrideError.value = ''
  if (!(priceOverride.amount > 0) || priceOverride.reason.trim().length < 2 || !priceOverride.effectiveFrom) {
    priceOverrideError.value = copy.value.priceOverrideInvalid
    return
  }
  priceOverridePending.value = true
  const requestId = priceOverrideRequestId.value ?? globalThis.crypto.randomUUID()
  priceOverrideRequestId.value = requestId
  try {
    const { error } = await rpc.rpc('platform_admin_billing_command', {
      p_request_id: requestId, p_action: 'set_price_override', p_submission_id: null,
      p_reason: priceOverride.reason.trim(),
      p_payload: {
        shopId: priceOverride.shopId, amount: priceOverride.amount,
        currency: priceOverride.currency, effectiveFrom: priceOverride.effectiveFrom,
        expiresAt: priceOverride.expiresAt || null,
      },
    })
    if (error) throw error
    priceOverrideRequestId.value = null
    priceOverrideOpen.value = false
    await Promise.all([refreshBillingQueue(), refreshBillingAudit(), refreshDetail()])
    pushToast({ tone: 'success', title: copy.value.priceOverrideSaved })
  }
  catch { priceOverrideError.value = copy.value.commandFailed }
  finally { priceOverridePending.value = false }
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function usageBlockersLabel(blockers: PlatformBillingQueueItem['usageBlockers']) {
  return blockers.map(blocker => `${blocker.resource}: +${blocker.excess}`).join(', ')
}

function actionLabel(key: string) {
  return copy.value.actions[key as ActionKey] ?? key
}

function detailAccessState(value: PlatformShopDetail) {
  if (value.shop.status === 'suspended') return 'suspended'
  const subscription = value.subscription
  if (subscription?.status === 'trialing' && subscription.trialEndAt && new Date(subscription.trialEndAt).getTime() > Date.now()) return 'trialing'
  if (subscription?.status === 'active' && subscription.periodEnd && new Date(subscription.periodEnd).getTime() > Date.now()) return 'active'
  return 'read_only'
}

function openAction(key: ActionKey) {
  action.key = key
  action.reason = ''
  action.days = key === 'extend_trial' ? 7 : 30
  action.planSlug = detail.value?.subscription?.planSlug || 'pro'
  action.billingReference = String(detail.value?.subscription?.billingMetadata?.billingReference || '')
  action.billingNote = String(detail.value?.subscription?.billingMetadata?.billingNote || '')
  action.note = ''
  commandError.value = ''
  showAction()
}

function payload() {
  if (action.key === 'extend_trial') return { days: action.days }
  if (action.key === 'correct_billing_metadata') return { billingReference: action.billingReference.trim(), billingNote: action.billingNote.trim() }
  if (action.key === 'add_support_note') return { note: action.note.trim() }
  return {}
}

async function runAction() {
  if (!selectedShopId.value || !session.value?.canMutate || actionPending.value) return
  commandError.value = ''
  if (action.reason.trim().length < 2) {
    commandError.value = copy.value.reasonRequired
    return
  }
  if (action.key === 'extend_trial'
    && (!Number.isInteger(action.days) || action.days < 1 || action.days > 3660)) {
    commandError.value = copy.value.daysInvalid
    return
  }
  if (action.key === 'add_support_note' && action.note.trim().length < 2) {
    commandError.value = copy.value.noteRequired
    return
  }
  if (['suspend_shop', 'end_trial'].includes(action.key)
    && !await confirmation.ask(copy.value.destructiveConfirm[action.key as 'suspend_shop' | 'end_trial'])) return

  actionPending.value = true
  try {
    const { error } = await rpc.rpc('platform_admin_command', {
      p_request_id: globalThis.crypto.randomUUID(),
      p_shop_id: selectedShopId.value,
      p_action: action.key,
      p_reason: action.reason.trim(),
      p_payload: payload(),
    })
    if (error) throw error
    completeAction()
    await Promise.all([refreshDashboard(), refreshShops(), refreshDetail(), refreshAudit()])
    pushToast({ tone: 'success', title: copy.value.commandSucceeded })
  }
  catch (error) {
    commandError.value = error instanceof Error ? error.message : copy.value.commandFailed
  }
  finally {
    actionPending.value = false
  }
}

function handleShopPage(event: { page: number }) { page.value = event.page + 1 }
function handleAuditPage(event: { page: number }) { auditPage.value = event.page + 1 }
function handleBillingPage(event: { page: number }) { billingPage.value = event.page + 1 }
function handleBillingAuditPage(event: { page: number }) { billingAuditPage.value = event.page + 1 }
async function refreshPlanConsumers() {
  await Promise.all([refreshDashboard(), refreshShops(), refreshDetail(), refreshAudit(), refreshBillingQueue(), refreshBillingSummary(), refreshBillingAudit()])
}

const en = {
  title: 'Platform administration', subtitle: 'Cross-tenant support controls and immutable operational evidence.',
  overview: 'Overview', plans: 'Plans & subscriptions', audit: 'Privileged audit', billingQueue: 'Billing queue', accessDenied: 'This account is not an authorized Shop Suit platform administrator.',
  accessHint: 'Contact your platform operator for access. A Shop membership does not grant platform administration.', retry: 'Retry',
  shops: 'Shops', activeShops: 'Active shops', suspendedShops: 'Suspended shops', locations: 'Locations', members: 'Members',
  activeTrials: 'Active trials', trialsSoon: 'Trials expiring soon', activeSubscriptions: 'Active subscriptions', readOnly: 'Read-only subscriptions', pendingBilling: 'Pending billing submissions',
  recentEvents: 'Recent privileged events', search: 'Search by shop, ID, or owner email', allStates: 'All states', open: 'Open support view',
  shop: 'Shop', owner: 'Owner', access: 'Access', plan: 'Plan', usage: 'Usage and limits', billing: 'Billing history', sensitive: 'Sensitive operational audit', supportNotes: 'Support notes', controls: 'Approved support controls', trialStart: 'Trial start', trialEnd: 'Trial end', periodEnd: 'Paid period end',
  noRows: 'No records match this view.', noEvents: 'No audit events are available.', loadFailed: 'Could not load platform administration data.',
  reason: 'Reason', reasonRequired: 'Enter an explicit reason of at least two characters.', days: 'Days', daysInvalid: 'Enter a whole number of days in the allowed range.', planSlug: 'Plan', billingReference: 'Billing reference', billingNote: 'Billing note', note: 'Support note', noteRequired: 'Enter a support note.', save: 'Apply control', cancel: 'Cancel', commandSucceeded: 'The support control was applied and audited.', commandFailed: 'The support control could not be applied.', observer: 'Read-only observer', operator: 'Platform operator',
  status: 'Status', action: 'Action', actor: 'Actor', occurred: 'Occurred', emptyBilling: 'No billing submissions.', emptySensitive: 'No sensitive events are available.', emptyNotes: 'No support notes.',
  configuration: 'InstaPay instructions', configurationHelp: 'These details are shown to Shop owners. Transfers remain manually verified.', recipientAlias: 'Recipient alias', paymentLink: 'Payment link', qrImageUrl: 'QR image URL', instructionsEn: 'English instructions', instructionsAr: 'Arabic instructions', configurationSaved: 'Payment instructions were updated and audited.',
  currentPlan: 'Current plan', requestedPlan: 'Requested plan', interval: 'Term', listPrice: 'List price', effectivePrice: 'Quoted price', blockers: 'Usage blockers', noBlockers: 'None', negotiated: 'Negotiated', expectedAmount: 'Expected', paidAmount: 'Paid', transferDate: 'Transfer date', transferReference: 'Transfer reference', receivedAmount: 'Received amount', receivedReference: 'Received reference', receivedDate: 'Received date', review: 'Review', markUnderReview: 'Mark under review', approve: 'Approve and activate', reject: 'Reject', submitted: 'Submitted', underReview: 'Under review', approved: 'Approved', rejected: 'Rejected', approvalInvalid: 'Enter valid received payment details and an explicit mismatch reason when amounts differ.', amountOverrideReason: 'Amount mismatch override reason', approveConfirm: 'Approve this externally verified transfer and apply the requested plan for exactly one catalog term?', priceOverride: 'Set negotiated price', overrideAmount: 'Effective price', effectiveFrom: 'Effective date', expiresAt: 'Optional expiry', priceOverrideInvalid: 'Enter a valid positive price, effective date, and reason.', priceOverrideSaved: 'The negotiated price was appended and audited.',
  actions: { suspend_shop: 'Suspend Shop access', reactivate_shop: 'Reactivate Shop access', extend_trial: 'Extend trial', end_trial: 'End trial', correct_billing_metadata: 'Correct billing metadata', add_support_note: 'Add support note' },
  destructiveConfirm: { suspend_shop: 'Suspend this Shop? Tenant access will stop, but all history will be preserved.', end_trial: 'End this trial now? The Shop will become read-only.' },
}

const ar = {
  title: 'إدارة المنصة', subtitle: 'ضوابط دعم عابرة للمتاجر وأدلة تشغيلية غير قابلة للتعديل.',
  overview: 'نظرة عامة', plans: 'الخطط والاشتراكات', audit: 'سجل الصلاحيات', billingQueue: 'قائمة الفوترة', accessDenied: 'هذا الحساب غير مصرح له بإدارة منصة Shop Suit.',
  accessHint: 'تواصل مع مسؤول المنصة للحصول على الصلاحية. عضوية المتجر لا تمنح صلاحية إدارة المنصة.', retry: 'إعادة المحاولة',
  shops: 'المتاجر', activeShops: 'المتاجر النشطة', suspendedShops: 'المتاجر الموقوفة', locations: 'الفروع', members: 'الأعضاء',
  activeTrials: 'التجارب النشطة', trialsSoon: 'تجارب تنتهي قريبًا', activeSubscriptions: 'الاشتراكات النشطة', readOnly: 'اشتراكات للقراءة فقط', pendingBilling: 'طلبات فوترة معلقة',
  recentEvents: 'أحدث إجراءات الصلاحيات', search: 'ابحث بالمتجر أو المعرّف أو بريد المالك', allStates: 'كل الحالات', open: 'فتح عرض الدعم',
  shop: 'المتجر', owner: 'المالك', access: 'الوصول', plan: 'الخطة', usage: 'الاستخدام والحدود', billing: 'سجل الفوترة', sensitive: 'سجل العمليات الحساسة', supportNotes: 'ملاحظات الدعم', controls: 'ضوابط الدعم المعتمدة', trialStart: 'بداية التجربة', trialEnd: 'نهاية التجربة', periodEnd: 'نهاية الفترة المدفوعة',
  noRows: 'لا توجد سجلات مطابقة.', noEvents: 'لا توجد أحداث تدقيق.', loadFailed: 'تعذّر تحميل بيانات إدارة المنصة.',
  reason: 'السبب', reasonRequired: 'اكتب سببًا صريحًا من حرفين على الأقل.', days: 'الأيام', daysInvalid: 'اكتب عددًا صحيحًا من الأيام ضمن النطاق المسموح.', planSlug: 'الخطة', billingReference: 'مرجع الفوترة', billingNote: 'ملاحظة الفوترة', note: 'ملاحظة الدعم', noteRequired: 'اكتب ملاحظة دعم.', save: 'تطبيق الإجراء', cancel: 'إلغاء', commandSucceeded: 'تم تطبيق إجراء الدعم وتسجيله.', commandFailed: 'تعذّر تطبيق إجراء الدعم.', observer: 'مراقب للقراءة فقط', operator: 'مسؤول المنصة',
  status: 'الحالة', action: 'الإجراء', actor: 'المنفذ', occurred: 'الوقت', emptyBilling: 'لا توجد طلبات فوترة.', emptySensitive: 'لا توجد أحداث حساسة.', emptyNotes: 'لا توجد ملاحظات دعم.',
  configuration: 'تعليمات InstaPay', configurationHelp: 'تظهر هذه البيانات لمالكي المتاجر وتظل التحويلات خاضعة للتحقق اليدوي.', recipientAlias: 'عنوان المستلم', paymentLink: 'رابط الدفع', qrImageUrl: 'رابط صورة QR', instructionsEn: 'التعليمات الإنجليزية', instructionsAr: 'التعليمات العربية', configurationSaved: 'تم تحديث تعليمات الدفع وتسجيلها.',
  currentPlan: 'الخطة الحالية', requestedPlan: 'الخطة المطلوبة', interval: 'المدة', listPrice: 'السعر المعلن', effectivePrice: 'السعر المثبت', blockers: 'عوائق الاستخدام', noBlockers: 'لا يوجد', negotiated: 'تفاوضي', expectedAmount: 'المتوقع', paidAmount: 'المدفوع', transferDate: 'تاريخ التحويل', transferReference: 'مرجع التحويل', receivedAmount: 'المبلغ المستلم', receivedReference: 'المرجع المستلم', receivedDate: 'تاريخ الاستلام', review: 'المراجعة', markUnderReview: 'بدء المراجعة', approve: 'اعتماد وتفعيل', reject: 'رفض', submitted: 'مُرسل', underReview: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', approvalInvalid: 'أدخل بيانات الاستلام الصحيحة وسببًا صريحًا عند اختلاف المبلغ.', amountOverrideReason: 'سبب تجاوز اختلاف المبلغ', approveConfirm: 'اعتماد هذا التحويل المتحقق منه وتطبيق الخطة المطلوبة لمدة تجارية واحدة؟', priceOverride: 'تعيين سعر تفاوضي', overrideAmount: 'السعر الفعلي', effectiveFrom: 'تاريخ السريان', expiresAt: 'انتهاء اختياري', priceOverrideInvalid: 'أدخل سعرًا موجبًا وتاريخ سريان وسببًا.', priceOverrideSaved: 'تمت إضافة السعر التفاوضي وتسجيله.',
  actions: { suspend_shop: 'إيقاف وصول المتجر', reactivate_shop: 'إعادة تفعيل وصول المتجر', extend_trial: 'تمديد التجربة', end_trial: 'إنهاء التجربة', correct_billing_metadata: 'تصحيح بيانات الفوترة', add_support_note: 'إضافة ملاحظة دعم' },
  destructiveConfirm: { suspend_shop: 'إيقاف هذا المتجر؟ سيتوقف وصول المستأجر مع الحفاظ على كل السجل.', end_trial: 'إنهاء التجربة الآن؟ سيصبح المتجر للقراءة فقط.' },
}
const catalogControls = reactive(usePlatformPlanAdmin(reactive({ mode: 'catalog' as const, get canMutate() { return Boolean(session.value?.canMutate) } }), refreshPlanConsumers))
const shopControls = reactive(usePlatformPlanAdmin(reactive({ mode: 'shop' as const, get shopId() { return selectedShopId.value }, get canMutate() { return Boolean(session.value?.canMutate) } }), refreshPlanConsumers))

const configurationAction = useRecordAction(() => billingConfiguration)
const { visible: configurationActionOpen, dirty: configurationActionDirty } = configurationAction

const catalogPresentation = useShopPlatformPlanPresentation(catalogControls)
const tenantPresentation = useShopPlatformPlanPresentation(shopControls)
const catalogTerms = catalogPresentation.terms
const catalogAvailability = catalogPresentation.availability
const catalogChange = catalogPresentation.change
const catalogPrice = catalogPresentation.price
const tenantTerms = tenantPresentation.terms
const tenantAvailability = tenantPresentation.availability
const tenantChange = tenantPresentation.change
const tenantPrice = tenantPresentation.price
const planCopy = catalogPresentation.copy
const supportForm = computed<BsAdminSupportForm>({ get: () => ({ reason: action.reason, days: action.days, reference: action.billingReference, billingNote: action.billingNote, note: action.note }), set: value => Object.assign(action, { reason: value.reason, days: value.days, billingReference: value.reference, billingNote: value.billingNote, note: value.note }) })
const receiptForm = computed<BsAdminReceiptReviewForm>({ get: () => ({ reason: billingReview.reason, amount: billingReview.receivedAmount, reference: billingReview.receivedReference, date: billingReview.receivedDate, mismatchReason: billingReview.amountOverrideReason }), set: value => Object.assign(billingReview, { reason: value.reason, receivedAmount: value.amount, receivedReference: value.reference, receivedDate: value.date, amountOverrideReason: value.mismatchReason }) })
const priceForm = computed<BsAdminPriceForm>({ get: () => ({ amount: priceOverride.amount, effectiveFrom: priceOverride.effectiveFrom, expiresAt: priceOverride.expiresAt, reason: priceOverride.reason }), set: value => Object.assign(priceOverride, value) })
const configurationForm = computed<BsAdminPaymentConfigurationForm>({ get: () => ({ recipient: billingConfiguration.recipientAlias, paymentLink: billingConfiguration.paymentLink, qrImageUrl: billingConfiguration.qrImageUrl, instructionsEn: billingConfiguration.instructionsEn, instructionsAr: billingConfiguration.instructionsAr, reason: billingConfiguration.reason }), set: value => Object.assign(billingConfiguration, { recipientAlias: value.recipient, paymentLink: value.paymentLink, qrImageUrl: value.qrImageUrl, instructionsEn: value.instructionsEn, instructionsAr: value.instructionsAr, reason: value.reason }) })
const presentationCopy = computed<BsPlatformAdministrationCopy>(() => ({ title: copy.value.title, subtitle: copy.value.subtitle, saved: copy.value.commandSucceeded, view: copy.value.overview, search: copy.value.search, filter: copy.value.status, apply: copy.value.save, clear: copy.value.cancel, refresh: copy.value.retry, loading: ui('loading'), empty: copy.value.noRows, scoped: copy.value.controls, memberships: copy.value.members, review: copy.value.review, manage: copy.value.controls, previous: '', next: '', action: copy.value.action, targetPlan: copy.value.requestedPlan, currentPlan: copy.value.currentPlan, inspect: copy.value.open, openReceipt: copy.value.open, reason: copy.value.reason, context: copy.value.note, cancel: copy.value.cancel, submit: copy.value.save }))
const commerceCopy = computed<BsAdminCommerceCopy>(() => ({
  overview: copy.value.overview, plans: copy.value.plans, audit: copy.value.audit, billingQueue: copy.value.billingQueue, denied: copy.value.accessDenied, accessHint: copy.value.accessHint, retry: copy.value.retry, loading: ui('loading'), loadFailed: copy.value.loadFailed,
  tenants: copy.value.shops, tenant: copy.value.shop, owner: copy.value.owner, access: copy.value.access, plan: copy.value.plan, members: copy.value.members, search: copy.value.search, status: copy.value.status, open: copy.value.open, noRows: copy.value.noRows, recentEvents: copy.value.recentEvents, noEvents: copy.value.noEvents, action: copy.value.action, reason: copy.value.reason, actor: copy.value.actor, occurred: copy.value.occurred,
  currentPlan: copy.value.currentPlan, requestedPlan: copy.value.requestedPlan, listPrice: copy.value.listPrice, effectivePrice: copy.value.effectivePrice, paid: copy.value.paidAmount, blockers: copy.value.blockers, negotiated: copy.value.negotiated, reference: copy.value.transferReference, date: copy.value.transferDate, review: copy.value.review, startReview: copy.value.markUnderReview, approve: copy.value.approve, reject: copy.value.reject, overridePrice: copy.value.priceOverride, emptyBilling: copy.value.emptyBilling,
  configuration: copy.value.configuration, configurationHelp: copy.value.configurationHelp, recipient: copy.value.recipientAlias, paymentLink: copy.value.paymentLink, qrImageUrl: copy.value.qrImageUrl, instructionsEn: copy.value.instructionsEn, instructionsAr: copy.value.instructionsAr, save: copy.value.save, cancel: copy.value.cancel, usage: copy.value.usage, controls: copy.value.controls, billingHistory: copy.value.billing, sensitive: copy.value.sensitive, notes: copy.value.supportNotes, emptySensitive: copy.value.emptySensitive, emptyNotes: copy.value.emptyNotes,
  days: copy.value.days, billingReference: copy.value.billingReference, billingNote: copy.value.billingNote, note: copy.value.note, receivedAmount: copy.value.receivedAmount, receivedReference: copy.value.receivedReference, receivedDate: copy.value.receivedDate, mismatchReason: copy.value.amountOverrideReason, overrideAmount: copy.value.overrideAmount, effectiveFrom: copy.value.effectiveFrom, expiresAt: copy.value.expiresAt,
}))
function auditRows(items: PlatformAdminEvent[] | undefined, translated = false): BsAdminAuditRow[] { return (items ?? []).map(event => ({ id: event.id, tenant: event.shopName, action: translated ? actionLabel(event.action) : event.action, reason: event.reason, actor: event.actorUserId, occurred: date(event.occurredAt) })) }
const commerceView = computed<BsAdminCommerceView>(() => {
  const currentDetail = detail.value?.shop?.id === selectedShopId.value ? detail.value : null
  const subscription = shopControls.shopPlan?.subscription
  const pendingChange = subscription?.pendingPlanChange
  return {
    selected: view.value, role: session.value ? (session.value.role === 'operator' ? copy.value.operator : copy.value.observer) : '', loading: sessionPending.value, denied: !session.value && !sessionError.value, error: sessionError.value ? (showDevelopmentErrors ? sessionError.value : copy.value.loadFailed) : '', canMutate: Boolean(session.value?.canMutate), overviewPending: dashboardPending.value, overviewError: dashboardError.value || shopsError.value ? copy.value.loadFailed : null,
    metrics: [['shops', 'shops'], ['activeShops', 'activeShops'], ['suspendedShops', 'suspendedShops'], ['locations', 'locations'], ['members', 'members'], ['activeTrials', 'activeTrials'], ['trialsSoon', 'trialsExpiringSoon'], ['activeSubscriptions', 'activeSubscriptions'], ['readOnly', 'readOnlySubscriptions']].map(([label, key]) => ({ label: copy.value[label as keyof typeof copy.value] as string, value: String(dashboard.value?.[key as keyof PlatformDashboard] ?? '—') })).concat([{ label: copy.value.pendingBilling, value: String(billingSummary.value?.open ?? '—') }]),
    search: search.value, status: status.value, statusChoices: [{ value: '', label: copy.value.allStates }, { value: 'active', label: copy.value.activeShops }, { value: 'suspended', label: copy.value.suspendedShops }, { value: 'read_only', label: copy.value.readOnly }],
    tenants: { rows: (shops.value?.items ?? []).map(row => ({ id: row.id, name: row.name, owner: row.ownerName || '—', email: row.ownerEmail || '—', status: row.accessState, plan: row.planSlug || '—', members: String(row.memberCount) })), loading: shopsPending.value, error: shopsError.value ? copy.value.loadFailed : null, total: shops.value?.total ?? 0, first: (page.value - 1) * 20 },
    recent: { rows: auditRows(dashboard.value?.recentEvents, true), loading: dashboardPending.value, error: null, total: 0, first: 0 }, audit: { rows: auditRows(audit.value?.items, true), loading: auditPending.value, error: auditError.value ? copy.value.loadFailed : null, total: audit.value?.total ?? 0, first: (auditPage.value - 1) * 25 }, plans: catalogPresentation.view.value,
    billing: { rows: (billingQueue.value?.items ?? []).map(item => ({ id: item.id, tenant: item.shopName, status: item.status, currentPlan: item.currentPlanName, requestedPlan: `${item.requestedPlanName} · ${item.billingInterval}`, listPrice: `${item.listPriceAmount} ${item.currency}`, effectivePrice: `${item.effectivePriceAmount} ${item.currency}`, negotiated: item.priceSource === 'override', paid: `${item.paidAmount} ${item.currency}`, blockers: item.usageBlockers.length ? usageBlockersLabel(item.usageBlockers) : copy.value.noBlockers, reference: item.transferReference, date: date(item.transferDate), canStart: item.status === 'submitted', canReview: ['submitted', 'under_review'].includes(item.status), approveDisabled: item.usageBlockers.length > 0 })), loading: billingQueuePending.value, error: billingQueueError.value ? copy.value.loadFailed : null, total: billingQueue.value?.total ?? 0, first: (billingPage.value - 1) * 25, status: billingStatus.value, statusChoices: [{ value: '', label: copy.value.allStates }, ...(['submitted', 'under_review', 'approved', 'rejected'] as const).map(value => ({ value, label: value === 'under_review' ? copy.value.underReview : copy.value[value] }))] },
    billingAudit: { rows: auditRows(billingAudit.value?.items), loading: billingAuditPending.value, error: billingAuditError.value ? copy.value.loadFailed : null, total: billingAudit.value?.total ?? 0, first: (billingAuditPage.value - 1) * 25 },
    detail: { visible: Boolean(selectedShopId.value), title: currentDetail?.shop.name || copy.value.shop, pending: detailPending.value, error: detailError.value ? copy.value.loadFailed : null, available: !detailPending.value && !detailError.value && !!currentDetail,
      metrics: [{ label: copy.value.owner, value: currentDetail?.owner?.name || currentDetail?.owner?.email || '—' }, { label: copy.value.access, value: '', status: currentDetail ? detailAccessState(currentDetail) : undefined }, { label: copy.value.plan, value: currentDetail?.subscription?.planName || '—' }, { label: copy.value.members, value: String(currentDetail?.usage.members ?? 0) }], trial: `${copy.value.trialStart}: ${date(currentDetail?.subscription?.trialStartAt)} · ${copy.value.trialEnd}: ${date(currentDetail?.subscription?.trialEndAt)} · ${copy.value.periodEnd}: ${date(currentDetail?.subscription?.periodEnd)}`, usage: `${copy.value.locations}: ${currentDetail?.usage.locations ?? 0} · ${copy.value.members}: ${currentDetail?.usage.members ?? 0} · ${isArabic.value ? 'المنتجات' : 'Products'}: ${currentDetail?.usage.products ?? 0} · ${isArabic.value ? 'الخدمات' : 'Services'}: ${currentDetail?.usage.services ?? 0}`, limits: JSON.stringify(currentDetail?.usage.limits || {}, null, 2),
      subscriptionPending: shopControls.shopPending, subscriptionError: shopControls.shopError ? shopControls.copy.loadFailed : null, subscriptionAvailable: !!subscription, subscriptionMetrics: [{ label: shopControls.copy.currentPlan, value: subscription?.planName ?? '' }, { label: shopControls.copy.access, value: '', status: subscription?.accessState }, { label: shopControls.copy.effectivePrice, value: subscription ? `${shopControls.money(subscription.effectivePriceAmount, subscription.currency)}${subscription.priceSource === 'override' ? ` (${shopControls.copy.negotiatedPrice})` : ''}` : '' }, { label: shopControls.copy.pendingBilling, value: String(subscription?.pendingBillingRequests ?? 0) }], resources: (subscription?.usage.resources ?? []).map(item => ({ id: item.resource, label: shopControls.copy[item.resource as keyof typeof shopControls.copy], value: `${item.used} / ${shopControls.limit(item.limit)}${item.overLimit ? ` · +${item.used - (item.limit || 0)} ${shopControls.copy.excess}` : ''}` })), pendingChange: pendingChange ? `${pendingChange.targetPlanName} · ${shopControls.date(pendingChange.effectiveAt)} · ${pendingChange.reason}` : shopControls.copy.noPendingChange, canRemovePrice: !!subscription?.priceOverrideId, controls: (Object.keys(copy.value.actions) as ActionKey[]).map(value => ({ value, label: actionLabel(value) })),
      billing: (currentDetail?.billingHistory ?? []).map(item => ({ id: item.id, action: item.kind, status: item.status, reference: item.reference || '', occurred: date(item.submittedAt) })), sensitive: (currentDetail?.sensitiveEvents ?? []).map(item => ({ id: item.id, status: item.type, action: item.action, reason: item.reason || '', occurred: date(item.occurredAt) })), notes: (currentDetail?.supportNotes ?? []).map(item => ({ id: item.id, note: item.note, detail: `${item.reason} · ${date(item.createdAt)}` })),
    }, tenantPlanDialog: tenantPresentation.dialog.value,
    supportDialog: { visible: actionOpen.value, title: actionLabel(action.key), dirty: actionDirty.value, pending: actionPending.value, error: commandError.value, showDays: action.key === 'extend_trial', showBilling: action.key === 'correct_billing_metadata', showNote: action.key === 'add_support_note' },
    receiptDialog: { visible: billingReviewOpen.value, title: billingReview.action === 'approve' ? copy.value.approve : billingReview.action === 'reject' ? copy.value.reject : copy.value.markUnderReview, dirty: billingReviewDirty.value, pending: billingReviewPending.value, error: billingReviewError.value, approving: billingReview.action === 'approve', mismatched: Boolean(billingReview.submission && (billingReview.receivedAmount !== billingReview.submission.effectivePriceAmount || billingReview.submission.paidAmount !== billingReview.submission.effectivePriceAmount)), maxDate: new Date().toISOString().slice(0, 10) }, priceDialog: { visible: priceOverrideOpen.value, title: `${copy.value.priceOverride} · ${priceOverride.shopName}`, dirty: priceOverrideDirty.value, pending: priceOverridePending.value, error: priceOverrideError.value }, configuration: { visible: configurationActionOpen.value, dirty: configurationActionDirty.value, pending: configurationPending.value, error: configurationError.value, loadError: billingConfigurationLoadError.value ? copy.value.loadFailed : null },
  }
})
async function retryPresentation(key: 'session' | 'overview' | 'tenants' | 'catalog' | 'audit' | 'billing' | 'billingAudit' | 'configuration' | 'detail' | 'subscription') {
  if (key === 'session') await refreshSession()
  else if (key === 'overview') await Promise.all([refreshDashboard(), refreshShops()])
  else if (key === 'tenants') await refreshShops()
  else if (key === 'catalog') await catalogControls.refreshCatalog()
  else if (key === 'audit') await refreshAudit()
  else if (key === 'billing') await refreshBillingQueue()
  else if (key === 'billingAudit') await refreshBillingAudit()
  else if (key === 'configuration') await refreshBillingConfiguration()
  else if (key === 'detail') await refreshDetail()
  else await shopControls.refreshShop()
}
function pagePresentation(key: 'tenants' | 'audit' | 'billing' | 'billingAudit', event: { page: number }) { if (key === 'tenants') handleShopPage(event); else if (key === 'audit') handleAuditPage(event); else if (key === 'billing') handleBillingPage(event); else handleBillingAuditPage(event) }
function closeDialog(key: 'support' | 'receipt' | 'price' | 'configuration') { if (key === 'support') actionOpen.value = false; else if (key === 'receipt') billingReviewOpen.value = false; else if (key === 'price') priceOverrideOpen.value = false; else configurationActionOpen.value = false }
function reviewById(id: string, actionKey: 'mark_under_review' | 'approve' | 'reject') { const item = billingQueue.value?.items.find(item => item.id === id); if (item) openBillingReview(item, actionKey) }
function priceById(id: string) { const item = billingQueue.value?.items.find(item => item.id === id); if (item) openPriceOverride(item) }
function supportByKey(key: string) { if (Object.hasOwn(copy.value.actions, key)) openAction(key as ActionKey) }
function selectBillingStatus(value: string) { if (['', 'submitted', 'under_review', 'approved', 'rejected'].includes(value)) billingStatus.value = value as typeof billingStatus.value }
async function planCommand(scope: 'catalog' | 'tenant', command: Parameters<typeof catalogPresentation.command>[0], id?: string) { await (scope === 'catalog' ? catalogPresentation : tenantPresentation).command(command, id) }
</script>
<template>
  <BsPlatformAdministrationPage v-model:catalog-terms="catalogTerms" v-model:catalog-availability="catalogAvailability" v-model:catalog-change="catalogChange" v-model:catalog-price="catalogPrice" v-model:tenant-terms="tenantTerms" v-model:tenant-availability="tenantAvailability" v-model:tenant-change="tenantChange" v-model:tenant-price="tenantPrice" v-model:support="supportForm" v-model:receipt="receiptForm" v-model:price="priceForm" v-model:configuration="configurationForm" :copy="presentationCopy" :commerce="commerceView" :commerce-copy="commerceCopy" :plan-copy="planCopy" @select="view = $event" @search="search = $event" @status="status = $event" @retry="retryPresentation" @commerce-page="pagePresentation" @open-tenant="selectedShopId = $event" @close-tenant="selectedShopId = null" @billing-status="selectBillingStatus" @plan="planCommand" @review="reviewById" @price="priceById" @support="supportByKey" @configure="configurationAction.edit()" @close-dialog="closeDialog" @submit-support="runAction" @submit-receipt="runBillingReview" @submit-price="savePriceOverride" @submit-configuration="saveBillingConfiguration"/>
</template>
