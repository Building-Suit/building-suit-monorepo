<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { PlatformBillingConfiguration, PlatformBillingQueueItem } from '~/types/billing'
import type { PlatformAdminEvent, PlatformAdminSession, PlatformDashboard, PlatformPage, PlatformShopDetail, PlatformShopRow } from '~/types/platformAdmin'

definePageMeta({ layout: 'platform-admin', middleware: ['auth'] })

type ActionKey = 'suspend_shop' | 'reactivate_shop' | 'extend_trial' | 'end_trial'
  | 'correct_billing_metadata' | 'add_support_note'

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
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
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(search, value => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value.trim()
    page.value = 1
  }, 300)
})
watch(status, () => { page.value = 1 })
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })

async function callRead<T>(resource: 'dashboard' | 'shops' | 'shop' | 'audit', options: Partial<ShopRpcDatabase['public']['Functions']['platform_admin_read']['Args']> = {}) {
  const { data, error } = await rpc.rpc('platform_admin_read', { p_resource: resource, ...options })
  if (error) throw error
  return data as T
}

const { data: session, pending: sessionPending, refresh: refreshSession } = await useAsyncData(
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

watch(userId, () => {
  session.value = null
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

const { data: dashboard, pending: dashboardPending, error: dashboardError, refresh: refreshDashboard } = await useAsyncData(
  'platform-admin:dashboard',
  async (): Promise<PlatformDashboard | null> => session.value ? await callRead<PlatformDashboard>('dashboard') : null,
  { watch: [session] },
)

const { data: shops, pending: shopsPending, error: shopsError, refresh: refreshShops } = await useAsyncData(
  'platform-admin:shops',
  async (): Promise<PlatformPage<PlatformShopRow> | null> => session.value ? await callRead<PlatformPage<PlatformShopRow>>('shops', {
    p_search: debouncedSearch.value || null,
    p_status: status.value || null,
    p_page: page.value,
    p_page_size: 20,
  }) : null,
  { watch: [session, debouncedSearch, status, page] },
)

const { data: detail, pending: detailPending, error: detailError, refresh: refreshDetail } = await useAsyncData(
  'platform-admin:shop-detail',
  async (): Promise<PlatformShopDetail | null> => session.value && selectedShopId.value
    ? await callRead<PlatformShopDetail>('shop', { p_shop_id: selectedShopId.value })
    : null,
  { watch: [session, selectedShopId] },
)

const { data: audit, pending: auditPending, error: auditError, refresh: refreshAudit } = await useAsyncData(
  'platform-admin:audit',
  async (): Promise<PlatformPage<PlatformAdminEvent> | null> => session.value ? await callRead<PlatformPage<PlatformAdminEvent>>('audit', {
    p_page: auditPage.value,
    p_page_size: 25,
  }) : null,
  { watch: [session, auditPage] },
)

const { data: billingQueue, pending: billingQueuePending, error: billingQueueError, refresh: refreshBillingQueue } = await useAsyncData(
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

const { data: storedBillingConfiguration, error: billingConfigurationLoadError, refresh: refreshBillingConfiguration } = await useAsyncData(
  'platform-admin:billing-configuration',
  async (): Promise<PlatformBillingConfiguration | null> => {
    if (!session.value) return null
    const { data, error } = await rpc.rpc('platform_admin_billing_read', { p_resource: 'configuration' })
    if (error) throw error
    return data as PlatformBillingConfiguration
  },
  { watch: [session] },
)

const { data: billingSummary, refresh: refreshBillingSummary } = await useAsyncData(
  'platform-admin:billing-summary',
  async (): Promise<{ open: number, submitted: number, underReview: number, approved: number, rejected: number } | null> => {
    if (!session.value) return null
    const { data, error } = await rpc.rpc('platform_admin_billing_read', { p_resource: 'summary' })
    if (error) throw error
    return data as { open: number, submitted: number, underReview: number, approved: number, rejected: number }
  },
  { watch: [session] },
)

const { data: billingAudit, pending: billingAuditPending, error: billingAuditError, refresh: refreshBillingAudit } = await useAsyncData(
  'platform-admin:billing-audit',
  async (): Promise<PlatformPage<PlatformAdminEvent> | null> => {
    if (!session.value) return null
    const { data, error } = await rpc.rpc('platform_admin_billing_read', { p_resource: 'audit', p_page: billingAuditPage.value, p_page_size: 25 })
    if (error) throw error
    return data as PlatformPage<PlatformAdminEvent>
  },
  { watch: [session, billingAuditPage] },
)

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
function handleDetailVisibility(value: boolean) { if (!value) selectedShopId.value = null }
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
const catalogControls = reactive(await usePlatformPlanAdmin(reactive({ mode: 'catalog' as const, get canMutate() { return Boolean(session.value?.canMutate) } }), refreshPlanConsumers))
const shopControls = reactive(await usePlatformPlanAdmin(reactive({ mode: 'shop' as const, get shopId() { return selectedShopId.value }, get canMutate() { return Boolean(session.value?.canMutate) } }), refreshPlanConsumers))

const configurationAction = useRecordAction(() => billingConfiguration)
const { visible: configurationActionOpen, dirty: configurationActionDirty } = configurationAction
</script>

<template>
  <BsStack>
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsStatusBadge v-if="session" :status="session.role === 'operator' ? 'active' : 'read_only'"/>
      </template>
    </BsPageHeader>
    <BsGrid v-if="sessionPending" role="status" :aria-label="ui('loading')" :columns="4">
      <BsSkeleton v-for="item in 8" :key="item"/>
    </BsGrid>
    <BsBox v-else-if="!session" role="alert" as="section" padding="md">
      <BsHeading :level="2">{{ copy.accessDenied }}</BsHeading>
      <BsText as="p" size="sm">{{ copy.accessHint }}</BsText>
      <BsButton @click="refreshSession()">{{ copy.retry }}</BsButton>
      <BsText v-if="sessionError && showDevelopmentErrors" as="p" size="xs">{{ sessionError }}</BsText>
    </BsBox>
    <template v-else>
      <BsInline role="group" :aria-label="copy.title">
        <BsButton variant="chip" :aria-pressed="view === 'overview'" @click="view = 'overview'">{{ copy.overview }}</BsButton>
        <BsButton variant="chip" :aria-pressed="view === 'plans'" @click="view = 'plans'">{{ copy.plans }}</BsButton>
        <BsButton variant="chip" :aria-pressed="view === 'billing'" @click="view = 'billing'">{{ copy.billingQueue }}</BsButton>
        <BsButton variant="chip" :aria-pressed="view === 'audit'" @click="view = 'audit'">{{ copy.audit }}</BsButton>
      </BsInline>
      <template v-if="view === 'overview'">
        <BsText v-if="dashboardError || shopsError" role="alert" as="p">{{ copy.loadFailed }} <BsButton variant="link" @click="refreshDashboard(); refreshShops()">{{ copy.retry }}</BsButton>
        </BsText>
        <BsGrid :aria-busy="dashboardPending" :columns="2">
          <BsKpiCard :title="copy.shops">{{ dashboard?.shops ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.activeShops">{{ dashboard?.activeShops ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.suspendedShops">{{ dashboard?.suspendedShops ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.locations">{{ dashboard?.locations ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.members">{{ dashboard?.members ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.activeTrials">{{ dashboard?.activeTrials ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.trialsSoon">{{ dashboard?.trialsExpiringSoon ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.activeSubscriptions">{{ dashboard?.activeSubscriptions ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.readOnly">{{ dashboard?.readOnlySubscriptions ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.pendingBilling">{{ billingSummary?.open ?? '—' }}</BsKpiCard>
        </BsGrid>
        <BsPanel padding="md">
          <BsStack>
            <BsInput v-model="search" type="search" :placeholder="copy.search" :aria-label="copy.search"/>
            <BsSelect v-model="status" :label="copy.status" :options="[{ value: '', label: (copy.allStates), disabled: false }, { value: 'active', label: (copy.activeShops), disabled: false }, { value: 'suspended', label: (copy.suspendedShops), disabled: false }, { value: 'read_only', label: (copy.readOnly), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsStack>
          <BsDataTable :value="shops?.items ?? []" :loading="shopsPending" :error="shopsError ? copy.loadFailed : null" :label="copy.shops" data-key="id" lazy paginator :rows="20" :first="(page - 1) * 20" :total-records="shops?.total ?? 0" :always-show-paginator="false" :columns="[{ key: 'column0', header: (copy.shop) }, { key: 'column1', header: (copy.owner) }, { key: 'column2', header: (copy.access) }, { key: 'column3', header: (copy.plan) }, { key: 'column4', header: (copy.members) }, { key: 'column5', header: '' }]" @page="handleShopPage" @retry="refreshShops()">
            <template #cell-column0="{ row: row }">
              <BsText as="p" emphasis="semibold">{{ row.name }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ row.id }}</BsText>
            </template>
            <template #cell-column1="{ row: row }">
              <BsText as="p">{{ row.ownerName || '—' }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ row.ownerEmail || '—' }}</BsText>
            </template>
            <template #cell-column2="{ row: row }">
              <BsStatusBadge :status="row.accessState"/>
            </template>
            <template #cell-column3="{ row: row }">{{ row.planSlug || '—' }}</template>
            <template #cell-column4="{ row: row }">{{ row.memberCount }}</template>
            <template #cell-column5="{ row: row }">
              <BsButton variant="link" @click="selectedShopId = row.id">{{ copy.open }}</BsButton>
            </template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.noRows }}</BsText>
            </template>
          </BsDataTable>
        </BsPanel>
        <BsPanel padding="md">
          <BsHeading :level="2">{{ copy.recentEvents }}</BsHeading>
          <BsBox scroll="x">
            <BsDataTable :value="dashboard?.recentEvents ?? []" :loading="dashboardPending" data-key="id" :label="copy.recentEvents" :columns="[{ key: 'shopName', header: (copy.shop), field: 'shopName' }, { key: 'action', header: (copy.action), field: 'action' }, { key: 'reason', header: (copy.reason), field: 'reason' }, { key: 'column3', header: (copy.occurred) }]">
              <template #cell-action="{ row: event }">{{ actionLabel(event.action) || event.action }}</template>
              <template #cell-column3="{ row: event }">{{ date(event.occurredAt) }}</template>
              <template #empty>
                <BsText as="p" size="sm" tone="muted">{{ copy.noEvents }}</BsText>
              </template>
            </BsDataTable>
          </BsBox>
        </BsPanel>
      </template>
      <template v-else-if="view === 'plans'">
        <BsPanel padding="md">
          <BsBox padding="md">
            <BsHeading :level="2">{{ catalogControls.copy.catalog }}</BsHeading>
            <BsText as="p" size="sm" tone="muted">{{ catalogControls.copy.catalogHelp }}</BsText>
            <BsText v-if="!session.canMutate" as="p" size="sm" emphasis="semibold">{{ catalogControls.copy.observer }}</BsText>
          </BsBox>
          <BsDataTable :value="catalogControls.catalog?.items ?? []" :loading="catalogControls.catalogPending" :error="catalogControls.catalogError ? catalogControls.copy.loadFailed : null" :label="catalogControls.copy.catalog" data-key="id" :columns="[{ key: 'column0', header: (catalogControls.copy.plan) }, { key: 'column1', header: (catalogControls.copy.state) }, { key: 'column2', header: (catalogControls.copy.price) }, { key: 'column3', header: (catalogControls.copy.limits) }, { key: 'column4', header: (catalogControls.copy.version) }, { key: 'subscriptionCount', header: (catalogControls.copy.subscriptions), field: 'subscriptionCount' }, { key: 'column6', header: (catalogControls.copy.actions), hidden: !(session.canMutate) }]" @retry="catalogControls.refreshCatalog()">
            <template #cell-column0="{ row: plan }">
              <BsText as="p" emphasis="semibold">{{ plan.name }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ plan.slug }}</BsText>
            </template>
            <template #cell-column1="{ row: plan }">
              <BsText as="p">{{ plan.isActive ? catalogControls.copy.active : catalogControls.copy.inactive }} · {{ plan.isPublic ? catalogControls.copy.public : catalogControls.copy.private }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ plan.isPurchasable ? catalogControls.copy.purchasable : catalogControls.copy.unavailable }}<BsText v-if="plan.isComingSoon" as="span"> · {{ catalogControls.copy.comingSoon }}</BsText>
              </BsText>
            </template>
            <template #cell-column2="{ row: plan }">{{ catalogControls.money(plan.priceAmount, plan.currency) }} / {{ plan.billingInterval }}</template>
            <template #cell-column3="{ row: plan }">
              <BsList>
                <BsListItem v-for="key in catalogControls.resourceKeys" :key="key">{{ catalogControls.copy[key] }}: {{ catalogControls.limit(plan.resourceLimits[key]) }}</BsListItem>
              </BsList>
            </template>
            <template #cell-column4="{ row: plan }">
              <BsText as="p">v{{ plan.catalogVersion }} · {{ catalogControls.date(plan.effectiveFrom) }}</BsText>
              <BsText v-if="plan.nextTerms" as="p" size="xs" tone="warning" emphasis="semibold">{{ catalogControls.copy.nextVersion }} v{{ plan.nextTerms.version }} · {{ catalogControls.date(plan.nextTerms.effectiveFrom) }}</BsText>
            </template>
            <template #cell-column6="{ row: plan }">
              <BsInline>
                <BsButton @click="catalogControls.openTerms(plan)">{{ catalogControls.copy.editTerms }}</BsButton>
                <BsButton @click="catalogControls.openAvailability(plan)">{{ catalogControls.copy.availability }}</BsButton>
              </BsInline>
            </template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ catalogControls.copy.noPlans }}</BsText>
            </template>
          </BsDataTable>
        </BsPanel>
        <BsRecordActionDialog :visible="catalogControls.dialog === 'terms'" :title="`${catalogControls.copy.editTerms} · ${catalogControls.selectedPlan?.name || ''}`" :dirty="catalogControls.dialogDirty" :pending="catalogControls.pending" :error="catalogControls.commandError" :submit-label="catalogControls.copy.save" :cancel-label="catalogControls.copy.cancel" @update:visible="value => { if (!value) catalogControls.dialog = null }" @submit="catalogControls.publishTerms">
          <BsField v-slot="field" :label="(catalogControls.copy.displayName)">
            <BsInput :id="field.id" v-model="catalogControls.terms.displayName" :aria-describedby="field.describedby" :maxlength="120" required/>
          </BsField>
          <BsGrid :columns="2">
            <BsField v-slot="field" :label="(catalogControls.copy.price)">
              <BsInput :id="field.id" v-model.number="catalogControls.terms.priceAmount" :aria-describedby="field.describedby" type="number" :min="0" :step="1" required/>
            </BsField>
            <BsField v-slot="field" :label="(catalogControls.copy.currency)">
              <BsInput :id="field.id" v-model="catalogControls.terms.currency" :aria-describedby="field.describedby" :maxlength="3" required/>
            </BsField>
            <BsField v-slot="field" :label="(catalogControls.copy.interval)">
              <BsSelect v-model="catalogControls.terms.billingInterval" :input-id="field.id" :aria-describedby="field.describedby" :label="(catalogControls.copy.interval)" :options="[{ value: 'monthly', label: 'monthly', disabled: false }, { value: 'quarterly', label: 'quarterly', disabled: false }, { value: 'annual', label: 'annual', disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
            </BsField>
            <BsField v-slot="field" :label="(catalogControls.copy.effectiveFrom)">
              <BsInput :id="field.id" v-model="catalogControls.terms.effectiveFrom" :aria-describedby="field.describedby" type="datetime-local" required/>
            </BsField>
            <BsField v-for="key in catalogControls.resourceKeys" :key="key" v-slot="field" :label="(catalogControls.copy[key])">
              <BsInput :id="field.id" v-model.number="catalogControls.terms[key]" :aria-describedby="field.describedby" type="number" :min="1" :step="1" :placeholder="catalogControls.copy.unlimited"/>
            </BsField>
          </BsGrid>
          <BsField v-slot="field" :label="(catalogControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="catalogControls.terms.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
        </BsRecordActionDialog>
        <BsRecordActionDialog :visible="catalogControls.dialog === 'availability'" :title="`${catalogControls.copy.availability} · ${catalogControls.selectedPlan?.name || ''}`" :dirty="catalogControls.dialogDirty" :pending="catalogControls.pending" :error="catalogControls.commandError" :submit-label="catalogControls.copy.save" :cancel-label="catalogControls.copy.cancel" @update:visible="value => { if (!value) catalogControls.dialog = null }" @submit="catalogControls.saveAvailability">
          <BsCheckbox  v-model="catalogControls.availability.isActive" :label="(catalogControls.copy.active)" />
          <BsCheckbox  v-model="catalogControls.availability.isPublic" :label="(catalogControls.copy.public)" />
          <BsCheckbox  v-model="catalogControls.availability.isPurchasable" :label="(catalogControls.copy.purchasable)" />
          <BsCheckbox  v-model="catalogControls.availability.isComingSoon" :label="(catalogControls.copy.comingSoon)" />
          <BsField v-slot="field" :label="(catalogControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="catalogControls.availability.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
        </BsRecordActionDialog>
        <BsRecordActionDialog :visible="catalogControls.dialog === 'change'" :title="catalogControls.copy.changePlan" :dirty="catalogControls.dialogDirty" :pending="catalogControls.pending" :error="catalogControls.commandError" :submit-disabled="Boolean(catalogControls.targetPlan?.blockers.length)" @update:visible="value => { if (!value) catalogControls.dialog = null }" @submit="catalogControls.changePlan">
          <BsField v-slot="field" :label="(catalogControls.copy.targetPlan)">
            <BsSelect v-model="catalogControls.subscriptionAction.planId" :input-id="field.id" :aria-describedby="field.describedby" :label="(catalogControls.copy.targetPlan)" :options="[...(catalogControls.shopPlan?.availablePlans || []).map(plan => ({ value: plan.planId, label: (plan.planName) + ' · ' + (catalogControls.money(plan.listPriceAmount, plan.currency)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="(catalogControls.copy.timing)">
            <BsSelect v-model="catalogControls.subscriptionAction.timing" :input-id="field.id" :aria-describedby="field.describedby" :label="(catalogControls.copy.timing)" :options="[{ value: 'automatic', label: (catalogControls.copy.automatic), disabled: false }, { value: 'period_end', label: (catalogControls.copy.periodEnd), disabled: false }, { value: 'immediate', label: (catalogControls.copy.immediate), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsBox v-if="catalogControls.targetPlan?.blockers.length" role="alert">
            <BsText as="p" emphasis="semibold">{{ catalogControls.copy.blockers }}</BsText>
            <BsList>
              <BsListItem v-for="blocker in catalogControls.targetPlan.blockers" :key="blocker.resource">{{ catalogControls.copy[blocker.resource as keyof typeof catalogControls.copy] }}: {{ blocker.used }} / {{ blocker.limit }} (+{{ blocker.excess }})</BsListItem>
            </BsList>
          </BsBox>
          <BsField v-slot="field" :label="(catalogControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="catalogControls.subscriptionAction.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
          <template #actions="{ close }">
            <BsButton type="submit" variant="primary" :disabled="Boolean(catalogControls.targetPlan?.blockers.length)">{{ catalogControls.copy.changePlan }}</BsButton>
            <BsButton type="button" @click="catalogControls.simpleAction('renew_subscription')">{{ catalogControls.copy.renew }}</BsButton>
            <BsButton type="button" @click="catalogControls.simpleAction('suspend_subscription')">{{ catalogControls.copy.suspend }}</BsButton>
            <BsButton type="button" @click="close">{{ catalogControls.copy.cancel }}</BsButton>
          </template>
        </BsRecordActionDialog>
        <BsRecordActionDialog :visible="catalogControls.dialog === 'override'" :title="catalogControls.copy.negotiatedPrice" :dirty="catalogControls.dialogDirty" :pending="catalogControls.pending" :error="catalogControls.commandError" @update:visible="value => { if (!value) catalogControls.dialog = null }" @submit="catalogControls.saveOverride">
          <BsField v-slot="field" :label="(catalogControls.copy.amount)">
            <BsInput :id="field.id" v-model.number="catalogControls.price.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" required/>
          </BsField>
          <BsField v-slot="field" :label="(catalogControls.copy.currency)">
            <BsInput :id="field.id" v-model="catalogControls.price.currency" :aria-describedby="field.describedby" :maxlength="3" required/>
          </BsField>
          <BsField v-slot="field" :label="(catalogControls.copy.effectiveFrom)">
            <BsInput :id="field.id" v-model="catalogControls.price.effectiveFrom" :aria-describedby="field.describedby" type="datetime-local" required/>
          </BsField>
          <BsField v-slot="field" :label="(catalogControls.copy.expiresAt)">
            <BsInput :id="field.id" v-model="catalogControls.price.expiresAt" :aria-describedby="field.describedby" type="datetime-local"/>
          </BsField>
          <BsField v-slot="field" :label="(catalogControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="catalogControls.price.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
          <template #actions="{ close }">
            <BsButton type="submit" variant="primary">{{ catalogControls.copy.setPrice }}</BsButton>
            <BsButton v-if="catalogControls.shopPlan?.subscription?.priceOverrideId" type="button" @click="catalogControls.simpleAction('remove_price_override')">{{ catalogControls.copy.removePrice }}</BsButton>
            <BsButton type="button" @click="close">{{ catalogControls.copy.cancel }}</BsButton>
          </template>
        </BsRecordActionDialog>
      </template>
      <BsPanel v-else-if="view === 'audit'" padding="md">
        <BsDataTable :value="audit?.items ?? []" :loading="auditPending" :error="auditError ? copy.loadFailed : null" :label="copy.audit" data-key="id" lazy paginator :rows="25" :first="(auditPage - 1) * 25" :total-records="audit?.total ?? 0" :always-show-paginator="false" :columns="[{ key: 'shopName', header: (copy.shop), field: 'shopName' }, { key: 'action', header: (copy.action), field: 'action' }, { key: 'reason', header: (copy.reason), field: 'reason' }, { key: 'actorUserId', header: (copy.actor), field: 'actorUserId' }, { key: 'column4', header: (copy.occurred) }]" @page="handleAuditPage" @retry="refreshAudit()">
          <template #cell-action="{ row: event }">{{ actionLabel(event.action) || event.action }}</template>
          <template #cell-column4="{ row: event }">{{ date(event.occurredAt) }}</template>
          <template #empty>
            <BsText as="p" size="sm" tone="muted">{{ copy.noEvents }}</BsText>
          </template>
        </BsDataTable>
      </BsPanel>
      <BsStack v-else>
        <BsPanel padding="md">
          <BsHeading :level="2">{{ copy.configuration }}</BsHeading>
          <BsText as="p" size="sm" tone="muted">{{ copy.configurationHelp }}</BsText>
          <BsText v-if="billingConfigurationLoadError" role="alert" as="p">{{ copy.loadFailed }} <BsButton @click="refreshBillingConfiguration()">{{ copy.retry }}</BsButton>
          </BsText>
          <template v-else>
            <BsButton :disabled="!session?.canMutate" @click="configurationAction.edit()">{{ copy.save }}</BsButton>
            <BsRecordActionDialog v-model:visible="configurationActionOpen" :title="copy.configuration" :dirty="configurationActionDirty" :pending="configurationPending" :error="configurationError" :submit-label="copy.save" :cancel-label="copy.cancel" :submit-disabled="!session?.canMutate" @submit="saveBillingConfiguration">
              <BsFieldGroup :disabled="!session.canMutate || configurationPending" :legend="''">
                <BsField v-slot="field" :label="copy.recipientAlias">
                  <BsInput :id="field.id" v-model="billingConfiguration.recipientAlias" :aria-describedby="field.describedby" dir="ltr" :maxlength="200"/>
                </BsField>
                <BsField v-slot="field" :label="copy.paymentLink">
                  <BsInput :id="field.id" v-model="billingConfiguration.paymentLink" :aria-describedby="field.describedby" dir="ltr" :maxlength="1000"/>
                </BsField>
                <BsField v-slot="field" :label="copy.qrImageUrl">
                  <BsInput :id="field.id" v-model="billingConfiguration.qrImageUrl" :aria-describedby="field.describedby" dir="ltr" :maxlength="1000"/>
                </BsField>
                <BsField v-slot="field" :label="copy.instructionsEn">
                  <BsTextarea :id="field.id" v-model="billingConfiguration.instructionsEn" :aria-describedby="field.describedby" dir="ltr" :maxlength="2000" :rows="4"/>
                </BsField>
                <BsField v-slot="field" :label="copy.instructionsAr">
                  <BsTextarea :id="field.id" v-model="billingConfiguration.instructionsAr" :aria-describedby="field.describedby" dir="rtl" :maxlength="2000" :rows="4"/>
                </BsField>
                <BsField v-slot="field" :label="copy.reason">
                  <BsTextarea :id="field.id" v-model="billingConfiguration.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="2"/>
                </BsField>
              </BsFieldGroup>
            </BsRecordActionDialog>
          </template>
        </BsPanel>
        <BsPanel padding="md">
          <BsInline>
            <BsHeading :level="2">{{ copy.billingQueue }}</BsHeading>
            <BsSelect v-model="billingStatus" :label="copy.status" :options="[{ value: '', label: (copy.allStates), disabled: false }, { value: 'submitted', label: (copy.submitted), disabled: false }, { value: 'under_review', label: (copy.underReview), disabled: false }, { value: 'approved', label: (copy.approved), disabled: false }, { value: 'rejected', label: (copy.rejected), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsInline>
          <BsDataTable :value="billingQueue?.items ?? []" :loading="billingQueuePending" :error="billingQueueError ? copy.loadFailed : null" :label="copy.billingQueue" data-key="id" lazy paginator :rows="25" :first="(billingPage - 1) * 25" :total-records="billingQueue?.total ?? 0" :always-show-paginator="false" :columns="[{ key: 'shopName', header: (copy.shop), field: 'shopName' }, { key: 'status', header: (copy.status), field: 'status' }, { key: 'column2', header: (copy.currentPlan) }, { key: 'column3', header: (copy.requestedPlan) }, { key: 'column4', header: (copy.listPrice) }, { key: 'column5', header: (copy.effectivePrice) }, { key: 'column6', header: (copy.paidAmount) }, { key: 'column7', header: (copy.blockers) }, { key: 'transferReference', header: (copy.transferReference), field: 'transferReference' }, { key: 'column9', header: (copy.transferDate) }, { key: 'column10', header: (copy.review), hidden: !(session.canMutate) }]" @page="handleBillingPage" @retry="refreshBillingQueue()">
            <template #cell-status="{ row: item }">
              <BsStatusBadge :status="item.status"/>
            </template>
            <template #cell-column2="{ row: item }">{{ item.currentPlanName }}</template>
            <template #cell-column3="{ row: item }">{{ item.requestedPlanName }} · {{ item.billingInterval }}</template>
            <template #cell-column4="{ row: item }">{{ item.listPriceAmount }} {{ item.currency }}</template>
            <template #cell-column5="{ row: item }">{{ item.effectivePriceAmount }} {{ item.currency }}<BsText v-if="item.priceSource === 'override'" as="span" size="xs" emphasis="semibold">{{ copy.negotiated }}</BsText>
            </template>
            <template #cell-column6="{ row: item }">{{ item.paidAmount }} {{ item.currency }}</template>
            <template #cell-column7="{ row: item }">
              <BsText v-if="item.usageBlockers.length" as="span" tone="warning">{{ usageBlockersLabel(item.usageBlockers) }}</BsText>
              <BsText v-else as="span">{{ copy.noBlockers }}</BsText>
            </template>
            <template #cell-column9="{ row: item }">{{ date(item.transferDate) }}</template>
            <template #cell-column10="{ row: item }">
              <BsInline>
                <template v-if="['submitted','under_review'].includes(item.status)">
                  <BsButton v-if="item.status === 'submitted'" @click="openBillingReview(item, 'mark_under_review')">{{ copy.markUnderReview }}</BsButton>
                  <BsButton :disabled="item.usageBlockers.length > 0" @click="openBillingReview(item, 'approve')">{{ copy.approve }}</BsButton>
                  <BsButton @click="openBillingReview(item, 'reject')">{{ copy.reject }}</BsButton>
                </template>
                <BsButton @click="openPriceOverride(item)">{{ copy.priceOverride }}</BsButton>
              </BsInline>
            </template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.emptyBilling }}</BsText>
            </template>
          </BsDataTable>
        </BsPanel>
        <BsPanel padding="md">
          <BsBox padding="md">
            <BsHeading :level="2">{{ copy.billingQueue }} · {{ copy.audit }}</BsHeading>
          </BsBox>
          <BsDataTable :value="billingAudit?.items ?? []" :loading="billingAuditPending" :error="billingAuditError ? copy.loadFailed : null" :label="`${copy.billingQueue} ${copy.audit}`" data-key="id" lazy paginator :rows="25" :first="(billingAuditPage - 1) * 25" :total-records="billingAudit?.total ?? 0" :always-show-paginator="false" :columns="[{ key: 'shopName', header: (copy.shop), field: 'shopName' }, { key: 'action', header: (copy.action), field: 'action' }, { key: 'reason', header: (copy.reason), field: 'reason' }, { key: 'actorUserId', header: (copy.actor), field: 'actorUserId' }, { key: 'column4', header: (copy.occurred) }]" @page="handleBillingAuditPage" @retry="refreshBillingAudit()">
            <template #cell-column4="{ row: event }">{{ date(event.occurredAt) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.noEvents }}</BsText>
            </template>
          </BsDataTable>
        </BsPanel>
      </BsStack>
    </template>
    <BsDialog :visible="Boolean(selectedShopId)" :title="detail?.shop.name || copy.shop" size="lg" :pending="detailPending" @update:visible="handleDetailVisibility">
      <BsText v-if="detailError" role="alert" as="p">{{ copy.loadFailed }} <BsButton variant="link" @click="refreshDetail()">{{ copy.retry }}</BsButton>
      </BsText>
      <BsStack v-else-if="detail">
        <BsGrid :columns="4">
          <BsKpiCard :title="copy.owner">{{ detail.owner?.name || detail.owner?.email || '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.access">
            <BsStatusBadge :status="detailAccessState(detail)"/>
          </BsKpiCard>
          <BsKpiCard :title="copy.plan">{{ detail.subscription?.planName || '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.members">{{ detail.usage.members }}</BsKpiCard>
        </BsGrid>
        <BsBox as="section">
          <BsHeading :level="3">{{ copy.usage }}</BsHeading>
          <BsText as="p" size="sm" tone="muted">{{ copy.trialStart }}: {{ date(detail.subscription?.trialStartAt) }} · {{ copy.trialEnd }}: {{ date(detail.subscription?.trialEndAt) }} · {{ copy.periodEnd }}: {{ date(detail.subscription?.periodEnd) }}</BsText>
          <BsText as="p" size="sm" tone="muted">{{ copy.locations }}: {{ detail.usage.locations }} · {{ copy.members }}: {{ detail.usage.members }} · {{ isArabic ? 'المنتجات' : 'Products' }}: {{ detail.usage.products }} · {{ isArabic ? 'الخدمات' : 'Services' }}: {{ detail.usage.services }}</BsText>
          <BsCodeBlock>{{ JSON.stringify(detail.usage.limits || {}, null, 2) }}</BsCodeBlock>
        </BsBox>
        <BsStack>
          <BsText v-if="shopControls.shopError" role="alert" as="p">{{ shopControls.copy.loadFailed }} <BsButton @click="shopControls.refreshShop()">{{ shopControls.copy.retry }}</BsButton>
          </BsText>
          <BsSkeleton v-else-if="shopControls.shopPending"/>
          <template v-else-if="shopControls.shopPlan?.subscription">
            <BsGrid :columns="4">
              <BsKpiCard :title="shopControls.copy.currentPlan">{{ shopControls.shopPlan.subscription.planName }}</BsKpiCard>
              <BsKpiCard :title="shopControls.copy.access">
                <BsStatusBadge :status="shopControls.shopPlan.subscription.accessState"/>
              </BsKpiCard>
              <BsKpiCard :title="shopControls.copy.effectivePrice">{{ shopControls.money(shopControls.shopPlan.subscription.effectivePriceAmount, shopControls.shopPlan.subscription.currency) }}<BsText v-if="shopControls.shopPlan.subscription.priceSource === 'override'" as="span" size="xs">({{ shopControls.copy.negotiatedPrice }})</BsText>
              </BsKpiCard>
              <BsKpiCard :title="shopControls.copy.pendingBilling">{{ shopControls.shopPlan.subscription.pendingBillingRequests }}</BsKpiCard>
            </BsGrid>
            <BsBox>
              <BsHeading :level="4">{{ shopControls.copy.usage }}</BsHeading>
              <BsGrid :columns="2">
                <BsBox v-for="resource in shopControls.shopPlan.subscription.usage.resources" :key="resource.resource">
                  <BsText as="p" emphasis="semibold">{{ shopControls.copy[resource.resource as keyof typeof shopControls.copy] }}</BsText>
                  <BsText as="p">{{ resource.used }} / {{ shopControls.limit(resource.limit) }}<BsText v-if="resource.overLimit" as="span"> · +{{ resource.used - (resource.limit || 0) }} {{ shopControls.copy.excess }}</BsText>
                  </BsText>
                </BsBox>
              </BsGrid>
            </BsBox>
            <BsBox padding="md">
              <BsHeading :level="4">{{ shopControls.copy.pendingChange }}</BsHeading>
              <BsText v-if="shopControls.shopPlan?.subscription?.pendingPlanChange" as="p" size="sm">{{ shopControls.shopPlan?.subscription?.pendingPlanChange.targetPlanName }} · {{ shopControls.date(shopControls.shopPlan?.subscription?.pendingPlanChange.effectiveAt) }} · {{ shopControls.shopPlan?.subscription?.pendingPlanChange.reason }}</BsText>
              <BsText v-else as="p" size="sm" tone="muted">{{ shopControls.copy.noPendingChange }}</BsText>
            </BsBox>
            <BsInline v-if="Boolean(session?.canMutate)">
              <BsButton @click="shopControls.openChange">{{ shopControls.copy.changePlan }}</BsButton>
              <BsButton @click="shopControls.subscriptionAction.reason = ''; shopControls.commandError = ''; shopControls.requestId = null; shopControls.dialog = 'change'">{{ shopControls.copy.renew }}</BsButton>
              <BsButton @click="shopControls.openOverride">{{ shopControls.copy.setPrice }}</BsButton>
              <BsButton v-if="shopControls.shopPlan?.subscription?.priceOverrideId" @click="shopControls.price.reason = ''; shopControls.commandError = ''; shopControls.requestId = null; shopControls.dialog = 'override'">{{ shopControls.copy.removePrice }}</BsButton>
              <BsButton @click="shopControls.subscriptionAction.reason = ''; shopControls.commandError = ''; shopControls.requestId = null; shopControls.dialog = 'change'">{{ shopControls.copy.suspend }}</BsButton>
            </BsInline>
          </template>
        </BsStack>
        <BsRecordActionDialog :visible="shopControls.dialog === 'terms'" :title="`${shopControls.copy.editTerms} · ${shopControls.selectedPlan?.name || ''}`" :dirty="shopControls.dialogDirty" :pending="shopControls.pending" :error="shopControls.commandError" :submit-label="shopControls.copy.save" :cancel-label="shopControls.copy.cancel" @update:visible="value => { if (!value) shopControls.dialog = null }" @submit="shopControls.publishTerms">
          <BsField v-slot="field" :label="(shopControls.copy.displayName)">
            <BsInput :id="field.id" v-model="shopControls.terms.displayName" :aria-describedby="field.describedby" :maxlength="120" required/>
          </BsField>
          <BsGrid :columns="2">
            <BsField v-slot="field" :label="(shopControls.copy.price)">
              <BsInput :id="field.id" v-model.number="shopControls.terms.priceAmount" :aria-describedby="field.describedby" type="number" :min="0" :step="1" required/>
            </BsField>
            <BsField v-slot="field" :label="(shopControls.copy.currency)">
              <BsInput :id="field.id" v-model="shopControls.terms.currency" :aria-describedby="field.describedby" :maxlength="3" required/>
            </BsField>
            <BsField v-slot="field" :label="(shopControls.copy.interval)">
              <BsSelect v-model="shopControls.terms.billingInterval" :input-id="field.id" :aria-describedby="field.describedby" :label="(shopControls.copy.interval)" :options="[{ value: 'monthly', label: 'monthly', disabled: false }, { value: 'quarterly', label: 'quarterly', disabled: false }, { value: 'annual', label: 'annual', disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
            </BsField>
            <BsField v-slot="field" :label="(shopControls.copy.effectiveFrom)">
              <BsInput :id="field.id" v-model="shopControls.terms.effectiveFrom" :aria-describedby="field.describedby" type="datetime-local" required/>
            </BsField>
            <BsField v-for="key in shopControls.resourceKeys" :key="key" v-slot="field" :label="(shopControls.copy[key])">
              <BsInput :id="field.id" v-model.number="shopControls.terms[key]" :aria-describedby="field.describedby" type="number" :min="1" :step="1" :placeholder="shopControls.copy.unlimited"/>
            </BsField>
          </BsGrid>
          <BsField v-slot="field" :label="(shopControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="shopControls.terms.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
        </BsRecordActionDialog>
        <BsRecordActionDialog :visible="shopControls.dialog === 'availability'" :title="`${shopControls.copy.availability} · ${shopControls.selectedPlan?.name || ''}`" :dirty="shopControls.dialogDirty" :pending="shopControls.pending" :error="shopControls.commandError" :submit-label="shopControls.copy.save" :cancel-label="shopControls.copy.cancel" @update:visible="value => { if (!value) shopControls.dialog = null }" @submit="shopControls.saveAvailability">
          <BsCheckbox  v-model="shopControls.availability.isActive" :label="(shopControls.copy.active)" />
          <BsCheckbox  v-model="shopControls.availability.isPublic" :label="(shopControls.copy.public)" />
          <BsCheckbox  v-model="shopControls.availability.isPurchasable" :label="(shopControls.copy.purchasable)" />
          <BsCheckbox  v-model="shopControls.availability.isComingSoon" :label="(shopControls.copy.comingSoon)" />
          <BsField v-slot="field" :label="(shopControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="shopControls.availability.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
        </BsRecordActionDialog>
        <BsRecordActionDialog :visible="shopControls.dialog === 'change'" :title="shopControls.copy.changePlan" :dirty="shopControls.dialogDirty" :pending="shopControls.pending" :error="shopControls.commandError" :submit-disabled="Boolean(shopControls.targetPlan?.blockers.length)" @update:visible="value => { if (!value) shopControls.dialog = null }" @submit="shopControls.changePlan">
          <BsField v-slot="field" :label="(shopControls.copy.targetPlan)">
            <BsSelect v-model="shopControls.subscriptionAction.planId" :input-id="field.id" :aria-describedby="field.describedby" :label="(shopControls.copy.targetPlan)" :options="[...(shopControls.shopPlan?.availablePlans || []).map(plan => ({ value: plan.planId, label: (plan.planName) + ' · ' + (shopControls.money(plan.listPriceAmount, plan.currency)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="(shopControls.copy.timing)">
            <BsSelect v-model="shopControls.subscriptionAction.timing" :input-id="field.id" :aria-describedby="field.describedby" :label="(shopControls.copy.timing)" :options="[{ value: 'automatic', label: (shopControls.copy.automatic), disabled: false }, { value: 'period_end', label: (shopControls.copy.periodEnd), disabled: false }, { value: 'immediate', label: (shopControls.copy.immediate), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsBox v-if="shopControls.targetPlan?.blockers.length" role="alert">
            <BsText as="p" emphasis="semibold">{{ shopControls.copy.blockers }}</BsText>
            <BsList>
              <BsListItem v-for="blocker in shopControls.targetPlan.blockers" :key="blocker.resource">{{ shopControls.copy[blocker.resource as keyof typeof shopControls.copy] }}: {{ blocker.used }} / {{ blocker.limit }} (+{{ blocker.excess }})</BsListItem>
            </BsList>
          </BsBox>
          <BsField v-slot="field" :label="(shopControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="shopControls.subscriptionAction.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
          <template #actions="{ close }">
            <BsButton type="submit" variant="primary" :disabled="Boolean(shopControls.targetPlan?.blockers.length)">{{ shopControls.copy.changePlan }}</BsButton>
            <BsButton type="button" @click="shopControls.simpleAction('renew_subscription')">{{ shopControls.copy.renew }}</BsButton>
            <BsButton type="button" @click="shopControls.simpleAction('suspend_subscription')">{{ shopControls.copy.suspend }}</BsButton>
            <BsButton type="button" @click="close">{{ shopControls.copy.cancel }}</BsButton>
          </template>
        </BsRecordActionDialog>
        <BsRecordActionDialog :visible="shopControls.dialog === 'override'" :title="shopControls.copy.negotiatedPrice" :dirty="shopControls.dialogDirty" :pending="shopControls.pending" :error="shopControls.commandError" @update:visible="value => { if (!value) shopControls.dialog = null }" @submit="shopControls.saveOverride">
          <BsField v-slot="field" :label="(shopControls.copy.amount)">
            <BsInput :id="field.id" v-model.number="shopControls.price.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" required/>
          </BsField>
          <BsField v-slot="field" :label="(shopControls.copy.currency)">
            <BsInput :id="field.id" v-model="shopControls.price.currency" :aria-describedby="field.describedby" :maxlength="3" required/>
          </BsField>
          <BsField v-slot="field" :label="(shopControls.copy.effectiveFrom)">
            <BsInput :id="field.id" v-model="shopControls.price.effectiveFrom" :aria-describedby="field.describedby" type="datetime-local" required/>
          </BsField>
          <BsField v-slot="field" :label="(shopControls.copy.expiresAt)">
            <BsInput :id="field.id" v-model="shopControls.price.expiresAt" :aria-describedby="field.describedby" type="datetime-local"/>
          </BsField>
          <BsField v-slot="field" :label="(shopControls.copy.reason)">
            <BsTextarea :id="field.id" v-model="shopControls.price.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required/>
          </BsField>
          <template #actions="{ close }">
            <BsButton type="submit" variant="primary">{{ shopControls.copy.setPrice }}</BsButton>
            <BsButton v-if="shopControls.shopPlan?.subscription?.priceOverrideId" type="button" @click="shopControls.simpleAction('remove_price_override')">{{ shopControls.copy.removePrice }}</BsButton>
            <BsButton type="button" @click="close">{{ shopControls.copy.cancel }}</BsButton>
          </template>
        </BsRecordActionDialog>
        <BsBox v-if="session?.canMutate" as="section">
          <BsHeading :level="3">{{ copy.controls }}</BsHeading>
          <BsInline>
            <BsButton v-for="key in (Object.keys(copy.actions) as ActionKey[])" :key="key" @click="openAction(key)">{{ actionLabel(key) }}</BsButton>
          </BsInline>
        </BsBox>
        <BsBox as="section">
          <BsHeading :level="3">{{ copy.billing }}</BsHeading>
          <BsDataTable :value="detail.billingHistory" data-key="id" :label="copy.billing" :columns="[{ key: 'kind', header: (copy.action), field: 'kind' }, { key: 'status', header: (copy.status), field: 'status' }, { key: 'reference', header: (copy.billingReference), field: 'reference' }, { key: 'column3', header: (copy.occurred) }]">
            <template #cell-status="{ row: item }">
              <BsStatusBadge :status="item.status"/>
            </template>
            <template #cell-column3="{ row: item }">{{ date(item.submittedAt) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.emptyBilling }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
        <BsBox as="section">
          <BsHeading :level="3">{{ copy.sensitive }}</BsHeading>
          <BsDataTable :value="detail.sensitiveEvents" data-key="id" :label="copy.sensitive" :columns="[{ key: 'type', header: (copy.status), field: 'type' }, { key: 'action', header: (copy.action), field: 'action' }, { key: 'reason', header: (copy.reason), field: 'reason' }, { key: 'column3', header: (copy.occurred) }]">
            <template #cell-column3="{ row: event }">{{ date(event.occurredAt) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.emptySensitive }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
        <BsBox as="section">
          <BsHeading :level="3">{{ copy.supportNotes }}</BsHeading>
          <BsList v-if="detail.supportNotes.length">
            <BsListItem v-for="note in detail.supportNotes" :key="note.id">
              <BsText as="p">{{ note.note }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ note.reason }} · {{ date(note.createdAt) }}</BsText>
            </BsListItem>
          </BsList>
          <BsText v-else as="p" size="sm" tone="muted">{{ copy.emptyNotes }}</BsText>
        </BsBox>
      </BsStack>
    </BsDialog>
    <BsRecordActionDialog v-model:visible="actionOpen" :title="actionLabel(action.key)" :dirty="actionDirty" :pending="actionPending" :error="commandError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="runAction">
      <BsField v-slot="field" :label="copy.reason">
        <BsTextarea :id="field.id" v-model="action.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="3"/>
      </BsField>
      <BsField v-if="action.key === 'extend_trial'" v-slot="field" :label="copy.days">
        <BsInput :id="field.id" v-model.number="action.days" :aria-describedby="field.describedby" type="number" :min="1" :max="365" :step="1" required/>
      </BsField>
      <template v-if="action.key === 'correct_billing_metadata'">
        <BsField v-slot="field" :label="copy.billingReference">
          <BsInput :id="field.id" v-model="action.billingReference" :aria-describedby="field.describedby" :maxlength="200"/>
        </BsField>
        <BsField v-slot="field" :label="copy.billingNote">
          <BsTextarea :id="field.id" v-model="action.billingNote" :aria-describedby="field.describedby" :maxlength="1000" :rows="3"/>
        </BsField>
      </template>
      <BsField v-if="action.key === 'add_support_note'" v-slot="field" :label="copy.note">
        <BsTextarea :id="field.id" v-model="action.note" :aria-describedby="field.describedby" :minlength="2" :maxlength="2000" required :rows="5"/>
      </BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="billingReviewOpen" :title="billingReview.action === 'approve' ? copy.approve : billingReview.action === 'reject' ? copy.reject : copy.markUnderReview" :dirty="billingReviewDirty" :pending="billingReviewPending" :error="billingReviewError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="runBillingReview">
      <BsField v-slot="field" :label="copy.reason">
        <BsTextarea :id="field.id" v-model="billingReview.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="3"/>
      </BsField>
      <template v-if="billingReview.action === 'approve'">
        <BsField v-slot="field" :label="copy.receivedAmount">
          <BsInput :id="field.id" v-model.number="billingReview.receivedAmount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.receivedReference">
          <BsInput :id="field.id" v-model="billingReview.receivedReference" :aria-describedby="field.describedby" dir="ltr" :minlength="2" :maxlength="200" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.receivedDate">
          <BsInput :id="field.id" v-model="billingReview.receivedDate" :aria-describedby="field.describedby" type="date" :max="new Date().toISOString().slice(0, 10)" required/>
        </BsField>
        <BsField v-if="billingReview.submission && (billingReview.receivedAmount !== billingReview.submission.effectivePriceAmount || billingReview.submission.paidAmount !== billingReview.submission.effectivePriceAmount)" v-slot="field" :label="copy.amountOverrideReason">
          <BsTextarea :id="field.id" v-model="billingReview.amountOverrideReason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="3"/>
        </BsField>
      </template>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="priceOverrideOpen" :title="`${copy.priceOverride} · ${priceOverride.shopName}`" :dirty="priceOverrideDirty" :pending="priceOverridePending" :error="priceOverrideError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="savePriceOverride">
      <BsField v-slot="field" :label="copy.overrideAmount">
        <BsInput :id="field.id" v-model.number="priceOverride.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" required/>
      </BsField>
      <BsField v-slot="field" :label="copy.effectiveFrom">
        <BsInput :id="field.id" v-model="priceOverride.effectiveFrom" :aria-describedby="field.describedby" type="date" required/>
      </BsField>
      <BsField v-slot="field" :label="copy.expiresAt">
        <BsInput :id="field.id" v-model="priceOverride.expiresAt" :aria-describedby="field.describedby" type="date" :min="priceOverride.effectiveFrom"/>
      </BsField>
      <BsField v-slot="field" :label="copy.reason">
        <BsTextarea :id="field.id" v-model="priceOverride.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="3"/>
      </BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>
