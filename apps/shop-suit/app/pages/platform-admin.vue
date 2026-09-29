<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { PlatformBillingConfiguration, PlatformBillingQueueItem } from '~/types/billing'
import type { PlatformAdminEvent, PlatformAdminSession, PlatformDashboard, PlatformPage, PlatformShopDetail, PlatformShopRow } from '~/types/platformAdmin'

definePageMeta({ layout: 'platform-admin', middleware: ['auth'] })

type ActionKey = 'suspend_shop' | 'reactivate_shop' | 'extend_trial' | 'end_trial'
  | 'activate_subscription' | 'extend_subscription' | 'suspend_subscription'
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
const view = ref<'overview' | 'billing' | 'audit'>('overview')
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
const billingReview = reactive({ submission: null as PlatformBillingQueueItem | null, action: 'mark_under_review' as 'mark_under_review' | 'approve' | 'reject', reason: '', receivedAmount: 0, receivedReference: '', receivedDate: '', days: 30 })
const { visible: actionOpen, pending: actionPending, dirty: actionDirty, open: showAction, complete: completeAction } = useRecordAction(() => action)
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
  billingReview.submission = null
  billingReviewRequestId.value = null
  configurationRequestId.value = null
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
    pushToast({ tone: 'success', title: copy.value.configurationSaved })
  }
  catch { configurationError.value = copy.value.commandFailed }
  finally { configurationPending.value = false }
}

function openBillingReview(submission: PlatformBillingQueueItem, actionKey: 'mark_under_review' | 'approve' | 'reject') {
  Object.assign(billingReview, {
    submission, action: actionKey, reason: '', receivedAmount: submission.paidAmount,
    receivedReference: submission.transferReference, receivedDate: submission.transferDate, days: 30,
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
  if (billingReview.action === 'approve' && (!(billingReview.receivedAmount > 0) || billingReview.receivedReference.trim().length < 2 || !billingReview.receivedDate || !Number.isInteger(billingReview.days) || billingReview.days < 1 || billingReview.days > 3660)) {
    billingReviewError.value = copy.value.approvalInvalid; return
  }
  if (billingReview.action === 'approve' && !await confirmation.ask(copy.value.approveConfirm)) return
  billingReviewPending.value = true
  const requestId = billingReviewRequestId.value ?? globalThis.crypto.randomUUID()
  billingReviewRequestId.value = requestId
  try {
    const payload = billingReview.action === 'approve' ? {
      receivedAmount: billingReview.receivedAmount, receivedReference: billingReview.receivedReference.trim(),
      receivedDate: billingReview.receivedDate, days: billingReview.days,
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

function date(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
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
  if (action.key === 'extend_trial' || action.key === 'extend_subscription') return { days: action.days }
  if (action.key === 'activate_subscription') return { days: action.days, planSlug: action.planSlug }
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
  if ((action.key === 'extend_trial' || action.key === 'activate_subscription' || action.key === 'extend_subscription')
    && (!Number.isInteger(action.days) || action.days < 1 || action.days > 3660)) {
    commandError.value = copy.value.daysInvalid
    return
  }
  if (action.key === 'add_support_note' && action.note.trim().length < 2) {
    commandError.value = copy.value.noteRequired
    return
  }
  if (['suspend_shop', 'end_trial', 'suspend_subscription'].includes(action.key)
    && !await confirmation.ask(copy.value.destructiveConfirm[action.key as 'suspend_shop' | 'end_trial' | 'suspend_subscription'])) return

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

const en = {
  title: 'Platform administration', subtitle: 'Cross-tenant support controls and immutable operational evidence.',
  overview: 'Overview', audit: 'Privileged audit', billingQueue: 'Billing queue', accessDenied: 'This account is not an authorized Shop Suit platform administrator.',
  accessHint: 'Contact your platform operator for access. A Shop membership does not grant platform administration.', retry: 'Retry',
  shops: 'Shops', activeShops: 'Active shops', suspendedShops: 'Suspended shops', locations: 'Locations', members: 'Members',
  activeTrials: 'Active trials', trialsSoon: 'Trials expiring soon', activeSubscriptions: 'Active subscriptions', readOnly: 'Read-only subscriptions', pendingBilling: 'Pending billing submissions',
  recentEvents: 'Recent privileged events', search: 'Search by shop, ID, or owner email', allStates: 'All states', open: 'Open support view',
  shop: 'Shop', owner: 'Owner', access: 'Access', plan: 'Plan', usage: 'Usage and limits', billing: 'Billing history', sensitive: 'Sensitive operational audit', supportNotes: 'Support notes', controls: 'Approved support controls', trialStart: 'Trial start', trialEnd: 'Trial end', periodEnd: 'Paid period end',
  noRows: 'No records match this view.', noEvents: 'No audit events are available.', loadFailed: 'Could not load platform administration data.',
  reason: 'Reason', reasonRequired: 'Enter an explicit reason of at least two characters.', days: 'Days', daysInvalid: 'Enter a whole number of days in the allowed range.', planSlug: 'Plan', billingReference: 'Billing reference', billingNote: 'Billing note', note: 'Support note', noteRequired: 'Enter a support note.', save: 'Apply control', cancel: 'Cancel', commandSucceeded: 'The support control was applied and audited.', commandFailed: 'The support control could not be applied.', observer: 'Read-only observer', operator: 'Platform operator',
  status: 'Status', action: 'Action', actor: 'Actor', occurred: 'Occurred', emptyBilling: 'No billing submissions.', emptySensitive: 'No sensitive events are available.', emptyNotes: 'No support notes.',
  configuration: 'InstaPay instructions', configurationHelp: 'These details are shown to Shop owners. Transfers remain manually verified.', recipientAlias: 'Recipient alias', paymentLink: 'Payment link', qrImageUrl: 'QR image URL', instructionsEn: 'English instructions', instructionsAr: 'Arabic instructions', configurationSaved: 'Payment instructions were updated and audited.',
  expectedAmount: 'Expected', paidAmount: 'Paid', transferDate: 'Transfer date', transferReference: 'Transfer reference', receivedAmount: 'Received amount', receivedReference: 'Received reference', receivedDate: 'Received date', activationDays: 'Subscription days', review: 'Review', markUnderReview: 'Mark under review', approve: 'Approve and activate', reject: 'Reject', submitted: 'Submitted', underReview: 'Under review', approved: 'Approved', rejected: 'Rejected', approvalInvalid: 'Enter valid received payment details and subscription days.', approveConfirm: 'Approve this externally verified transfer and extend the subscription exactly once?',
  actions: { suspend_shop: 'Suspend Shop access', reactivate_shop: 'Reactivate Shop access', extend_trial: 'Extend trial', end_trial: 'End trial', activate_subscription: 'Activate subscription', extend_subscription: 'Extend subscription', suspend_subscription: 'Suspend subscription', correct_billing_metadata: 'Correct billing metadata', add_support_note: 'Add support note' },
  destructiveConfirm: { suspend_shop: 'Suspend this Shop? Tenant access will stop, but all history will be preserved.', end_trial: 'End this trial now? The Shop will become read-only.', suspend_subscription: 'Suspend this subscription? Historical reads remain available, but writes will stop.' },
}

const ar = {
  title: 'إدارة المنصة', subtitle: 'ضوابط دعم عابرة للمتاجر وأدلة تشغيلية غير قابلة للتعديل.',
  overview: 'نظرة عامة', audit: 'سجل الصلاحيات', billingQueue: 'قائمة الفوترة', accessDenied: 'هذا الحساب غير مصرح له بإدارة منصة Shop Suit.',
  accessHint: 'تواصل مع مسؤول المنصة للحصول على الصلاحية. عضوية المتجر لا تمنح صلاحية إدارة المنصة.', retry: 'إعادة المحاولة',
  shops: 'المتاجر', activeShops: 'المتاجر النشطة', suspendedShops: 'المتاجر الموقوفة', locations: 'الفروع', members: 'الأعضاء',
  activeTrials: 'التجارب النشطة', trialsSoon: 'تجارب تنتهي قريبًا', activeSubscriptions: 'الاشتراكات النشطة', readOnly: 'اشتراكات للقراءة فقط', pendingBilling: 'طلبات فوترة معلقة',
  recentEvents: 'أحدث إجراءات الصلاحيات', search: 'ابحث بالمتجر أو المعرّف أو بريد المالك', allStates: 'كل الحالات', open: 'فتح عرض الدعم',
  shop: 'المتجر', owner: 'المالك', access: 'الوصول', plan: 'الخطة', usage: 'الاستخدام والحدود', billing: 'سجل الفوترة', sensitive: 'سجل العمليات الحساسة', supportNotes: 'ملاحظات الدعم', controls: 'ضوابط الدعم المعتمدة', trialStart: 'بداية التجربة', trialEnd: 'نهاية التجربة', periodEnd: 'نهاية الفترة المدفوعة',
  noRows: 'لا توجد سجلات مطابقة.', noEvents: 'لا توجد أحداث تدقيق.', loadFailed: 'تعذّر تحميل بيانات إدارة المنصة.',
  reason: 'السبب', reasonRequired: 'اكتب سببًا صريحًا من حرفين على الأقل.', days: 'الأيام', daysInvalid: 'اكتب عددًا صحيحًا من الأيام ضمن النطاق المسموح.', planSlug: 'الخطة', billingReference: 'مرجع الفوترة', billingNote: 'ملاحظة الفوترة', note: 'ملاحظة الدعم', noteRequired: 'اكتب ملاحظة دعم.', save: 'تطبيق الإجراء', cancel: 'إلغاء', commandSucceeded: 'تم تطبيق إجراء الدعم وتسجيله.', commandFailed: 'تعذّر تطبيق إجراء الدعم.', observer: 'مراقب للقراءة فقط', operator: 'مسؤول المنصة',
  status: 'الحالة', action: 'الإجراء', actor: 'المنفذ', occurred: 'الوقت', emptyBilling: 'لا توجد طلبات فوترة.', emptySensitive: 'لا توجد أحداث حساسة.', emptyNotes: 'لا توجد ملاحظات دعم.',
  configuration: 'تعليمات InstaPay', configurationHelp: 'تظهر هذه البيانات لمالكي المتاجر وتظل التحويلات خاضعة للتحقق اليدوي.', recipientAlias: 'عنوان المستلم', paymentLink: 'رابط الدفع', qrImageUrl: 'رابط صورة QR', instructionsEn: 'التعليمات الإنجليزية', instructionsAr: 'التعليمات العربية', configurationSaved: 'تم تحديث تعليمات الدفع وتسجيلها.',
  expectedAmount: 'المتوقع', paidAmount: 'المدفوع', transferDate: 'تاريخ التحويل', transferReference: 'مرجع التحويل', receivedAmount: 'المبلغ المستلم', receivedReference: 'المرجع المستلم', receivedDate: 'تاريخ الاستلام', activationDays: 'أيام الاشتراك', review: 'المراجعة', markUnderReview: 'بدء المراجعة', approve: 'اعتماد وتفعيل', reject: 'رفض', submitted: 'مُرسل', underReview: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', approvalInvalid: 'أدخل بيانات الاستلام وأيام الاشتراك بشكل صحيح.', approveConfirm: 'اعتماد هذا التحويل المتحقق منه خارجيًا وتمديد الاشتراك مرة واحدة؟',
  actions: { suspend_shop: 'إيقاف وصول المتجر', reactivate_shop: 'إعادة تفعيل وصول المتجر', extend_trial: 'تمديد التجربة', end_trial: 'إنهاء التجربة', activate_subscription: 'تفعيل الاشتراك', extend_subscription: 'تمديد الاشتراك', suspend_subscription: 'إيقاف الاشتراك', correct_billing_metadata: 'تصحيح بيانات الفوترة', add_support_note: 'إضافة ملاحظة دعم' },
  destructiveConfirm: { suspend_shop: 'إيقاف هذا المتجر؟ سيتوقف وصول المستأجر مع الحفاظ على كل السجل.', end_trial: 'إنهاء التجربة الآن؟ سيصبح المتجر للقراءة فقط.', suspend_subscription: 'إيقاف الاشتراك؟ ستبقى قراءة السجل متاحة وتتوقف الكتابة.' },
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <StatusBadge v-if="session" :status="session.role === 'operator' ? 'active' : 'read_only'" />
    </header>

    <div v-if="sessionPending" role="status" :aria-label="ui('loading')" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div v-for="item in 8" :key="item" class="h-28 animate-pulse rounded-2xl bg-muted" /></div>
    <section v-else-if="!session" class="rounded-2xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-6" role="alert">
      <h2 class="font-extrabold">{{ copy.accessDenied }}</h2><p class="mt-2 text-sm">{{ copy.accessHint }}</p>
      <BsButton class="ls-btn mt-4" @click="refreshSession()">{{ copy.retry }}</BsButton>
      <p v-if="sessionError && showDevelopmentErrors" class="mt-3 text-xs opacity-75">{{ sessionError }}</p>
    </section>

    <template v-else>
      <div class="flex flex-wrap gap-2" role="group" :aria-label="copy.title">
        <BsButton :aria-pressed="view === 'overview'" class="ls-btn" :class="view === 'overview' ? 'ls-btn-primary' : ''" @click="view = 'overview'">{{ copy.overview }}</BsButton>
        <BsButton :aria-pressed="view === 'billing'" class="ls-btn" :class="view === 'billing' ? 'ls-btn-primary' : ''" @click="view = 'billing'">{{ copy.billingQueue }}</BsButton>
        <BsButton :aria-pressed="view === 'audit'" class="ls-btn" :class="view === 'audit' ? 'ls-btn-primary' : ''" @click="view = 'audit'">{{ copy.audit }}</BsButton>
      </div>

      <template v-if="view === 'overview'">
        <p v-if="dashboardError || shopsError" class="ls-error" role="alert">{{ copy.loadFailed }} <BsButton class="font-bold underline" @click="refreshDashboard(); refreshShops()">{{ copy.retry }}</BsButton></p>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" :aria-busy="dashboardPending">
          <BsKpiCard :title="copy.shops">{{ dashboard?.shops ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.activeShops">{{ dashboard?.activeShops ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.suspendedShops">{{ dashboard?.suspendedShops ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.locations">{{ dashboard?.locations ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.members">{{ dashboard?.members ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.activeTrials">{{ dashboard?.activeTrials ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.trialsSoon">{{ dashboard?.trialsExpiringSoon ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.activeSubscriptions">{{ dashboard?.activeSubscriptions ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.readOnly">{{ dashboard?.readOnlySubscriptions ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.pendingBilling">{{ billingSummary?.open ?? '—' }}</BsKpiCard>
        </div>

        <section class="overflow-hidden rounded-2xl border border-border bg-card">
          <div class="flex flex-col gap-3 border-b border-border p-4 sm:flex-row"><input v-model="search" type="search" :placeholder="copy.search" :aria-label="copy.search" class="ls-input sm:max-w-md"><select v-model="status" :aria-label="copy.status" class="ls-select sm:ms-auto sm:w-auto"><option value="">{{ copy.allStates }}</option><option value="active">{{ copy.activeShops }}</option><option value="suspended">{{ copy.suspendedShops }}</option><option value="read_only">{{ copy.readOnly }}</option></select></div>
          <BsDataTable :value="shops?.items ?? []" :loading="shopsPending" :error="shopsError ? copy.loadFailed : null" :label="copy.shops" data-key="id" lazy paginator :rows="20" :first="(page - 1) * 20" :total-records="shops?.total ?? 0" :always-show-paginator="false" @page="handleShopPage" @retry="refreshShops()">
            <Column><template #header>{{ copy.shop }}</template><template #body="{ data: row }"><p class="font-bold">{{ row.name }}</p><p class="text-xs text-muted-foreground">{{ row.id }}</p></template></Column>
            <Column><template #header>{{ copy.owner }}</template><template #body="{ data: row }"><p>{{ row.ownerName || '—' }}</p><p class="text-xs text-muted-foreground">{{ row.ownerEmail || '—' }}</p></template></Column>
            <Column><template #header>{{ copy.access }}</template><template #body="{ data: row }"><StatusBadge :status="row.accessState" /></template></Column>
            <Column><template #header>{{ copy.plan }}</template><template #body="{ data: row }">{{ row.planSlug || '—' }}</template></Column>
            <Column><template #header>{{ copy.members }}</template><template #body="{ data: row }">{{ row.memberCount }}</template></Column>
            <Column><template #body="{ data: row }"><BsButton class="font-bold text-[var(--bs-link)]" @click="selectedShopId = row.id">{{ copy.open }}</BsButton></template></Column>
            <template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noRows }}</p></template>
          </BsDataTable>
        </section>

        <section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-extrabold">{{ copy.recentEvents }}</h2><div class="mt-4 overflow-x-auto"><BsDataTable :value="dashboard?.recentEvents ?? []" :loading="dashboardPending" data-key="id" :label="copy.recentEvents"><Column field="shopName"><template #header>{{ copy.shop }}</template></Column><Column field="action"><template #header>{{ copy.action }}</template><template #body="{ data: event }">{{ actionLabel(event.action) || event.action }}</template></Column><Column field="reason"><template #header>{{ copy.reason }}</template></Column><Column><template #header>{{ copy.occurred }}</template><template #body="{ data: event }">{{ date(event.occurredAt) }}</template></Column><template #empty><p class="p-5 text-center text-sm text-muted-foreground">{{ copy.noEvents }}</p></template></BsDataTable></div></section>
      </template>

      <section v-else-if="view === 'audit'" class="overflow-hidden rounded-2xl border border-border bg-card">
        <BsDataTable :value="audit?.items ?? []" :loading="auditPending" :error="auditError ? copy.loadFailed : null" :label="copy.audit" data-key="id" lazy paginator :rows="25" :first="(auditPage - 1) * 25" :total-records="audit?.total ?? 0" :always-show-paginator="false" @page="handleAuditPage" @retry="refreshAudit()">
          <Column field="shopName"><template #header>{{ copy.shop }}</template></Column><Column field="action"><template #header>{{ copy.action }}</template><template #body="{ data: event }">{{ actionLabel(event.action) || event.action }}</template></Column><Column field="reason"><template #header>{{ copy.reason }}</template></Column><Column field="actorUserId"><template #header>{{ copy.actor }}</template></Column><Column><template #header>{{ copy.occurred }}</template><template #body="{ data: event }">{{ date(event.occurredAt) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noEvents }}</p></template>
        </BsDataTable>
      </section>
      <div v-else class="space-y-6">
        <section class="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 class="text-lg font-extrabold">{{ copy.configuration }}</h2><p class="mt-2 text-sm text-muted-foreground">{{ copy.configurationHelp }}</p>
          <p v-if="billingConfigurationLoadError" role="alert" class="ls-error mt-4">{{ copy.loadFailed }} <BsButton @click="refreshBillingConfiguration()">{{ copy.retry }}</BsButton></p>
          <BsForm v-else class="mt-5 grid gap-4 sm:grid-cols-2" :pending="configurationPending" :error="configurationError" @submit="saveBillingConfiguration">
            <fieldset class="contents" :disabled="!session.canMutate || configurationPending">
            <label class="grid gap-2 text-sm font-bold">{{ copy.recipientAlias }}<input v-model="billingConfiguration.recipientAlias" class="ls-input" dir="ltr" maxlength="200"></label>
            <label class="grid gap-2 text-sm font-bold">{{ copy.paymentLink }}<input v-model="billingConfiguration.paymentLink" class="ls-input" dir="ltr" maxlength="1000"></label>
            <label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.qrImageUrl }}<input v-model="billingConfiguration.qrImageUrl" class="ls-input" dir="ltr" maxlength="1000"></label>
            <label class="grid gap-2 text-sm font-bold"><span>{{ copy.instructionsEn }}</span><textarea v-model="billingConfiguration.instructionsEn" class="ls-input" dir="ltr" maxlength="2000" rows="4" /></label>
            <label class="grid gap-2 text-sm font-bold"><span>{{ copy.instructionsAr }}</span><textarea v-model="billingConfiguration.instructionsAr" class="ls-input" dir="rtl" maxlength="2000" rows="4" /></label>
            <label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.reason }}<textarea v-model="billingConfiguration.reason" class="ls-input" minlength="2" maxlength="1000" required rows="2" /></label>
            <div class="sm:col-span-2"><BsButton v-if="session.canMutate" type="submit" class="ls-btn ls-btn-primary" :pending="configurationPending">{{ copy.save }}</BsButton></div>
            </fieldset>
          </BsForm>
        </section>
        <section class="overflow-hidden rounded-2xl border border-border bg-card">
          <div class="flex flex-wrap gap-3 border-b border-border p-4"><h2 class="text-lg font-extrabold">{{ copy.billingQueue }}</h2><select v-model="billingStatus" class="ls-select ms-auto" :aria-label="copy.status"><option value="">{{ copy.allStates }}</option><option value="submitted">{{ copy.submitted }}</option><option value="under_review">{{ copy.underReview }}</option><option value="approved">{{ copy.approved }}</option><option value="rejected">{{ copy.rejected }}</option></select></div>
          <BsDataTable :value="billingQueue?.items ?? []" :loading="billingQueuePending" :error="billingQueueError ? copy.loadFailed : null" :label="copy.billingQueue" data-key="id" lazy paginator :rows="25" :first="(billingPage - 1) * 25" :total-records="billingQueue?.total ?? 0" :always-show-paginator="false" @page="handleBillingPage" @retry="refreshBillingQueue()">
            <Column field="shopName"><template #header>{{ copy.shop }}</template></Column><Column field="status"><template #header>{{ copy.status }}</template><template #body="{ data: item }"><StatusBadge :status="item.status" /></template></Column><Column><template #header>{{ copy.expectedAmount }}</template><template #body="{ data: item }">{{ item.expectedAmount }} {{ item.currency }}</template></Column><Column><template #header>{{ copy.paidAmount }}</template><template #body="{ data: item }">{{ item.paidAmount }} {{ item.currency }}</template></Column><Column field="transferReference"><template #header>{{ copy.transferReference }}</template></Column><Column><template #header>{{ copy.transferDate }}</template><template #body="{ data: item }">{{ date(item.transferDate) }}</template></Column>
            <Column v-if="session.canMutate"><template #header>{{ copy.review }}</template><template #body="{ data: item }"><div v-if="['submitted','under_review'].includes(item.status)" class="flex flex-wrap gap-2"><BsButton v-if="item.status === 'submitted'" class="ls-btn" @click="openBillingReview(item, 'mark_under_review')">{{ copy.markUnderReview }}</BsButton><BsButton class="ls-btn ls-btn-primary" @click="openBillingReview(item, 'approve')">{{ copy.approve }}</BsButton><BsButton class="ls-btn" @click="openBillingReview(item, 'reject')">{{ copy.reject }}</BsButton></div></template></Column>
            <template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.emptyBilling }}</p></template>
          </BsDataTable>
        </section>
        <section class="overflow-hidden rounded-2xl border border-border bg-card">
          <div class="border-b border-border p-4"><h2 class="text-lg font-extrabold">{{ copy.billingQueue }} · {{ copy.audit }}</h2></div>
          <BsDataTable :value="billingAudit?.items ?? []" :loading="billingAuditPending" :error="billingAuditError ? copy.loadFailed : null" :label="`${copy.billingQueue} ${copy.audit}`" data-key="id" lazy paginator :rows="25" :first="(billingAuditPage - 1) * 25" :total-records="billingAudit?.total ?? 0" :always-show-paginator="false" @page="handleBillingAuditPage" @retry="refreshBillingAudit()">
            <Column field="shopName"><template #header>{{ copy.shop }}</template></Column><Column field="action"><template #header>{{ copy.action }}</template></Column><Column field="reason"><template #header>{{ copy.reason }}</template></Column><Column field="actorUserId"><template #header>{{ copy.actor }}</template></Column><Column><template #header>{{ copy.occurred }}</template><template #body="{ data: event }">{{ date(event.occurredAt) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noEvents }}</p></template>
          </BsDataTable>
        </section>
      </div>
    </template>

    <BsDialog :visible="Boolean(selectedShopId)" :title="detail?.shop.name || copy.shop" size="lg" :pending="detailPending" @update:visible="handleDetailVisibility">
      <p v-if="detailError" class="ls-error" role="alert">{{ copy.loadFailed }} <BsButton class="font-bold underline" @click="refreshDetail()">{{ copy.retry }}</BsButton></p>
      <div v-else-if="detail" class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><BsKpiCard :title="copy.owner">{{ detail.owner?.name || detail.owner?.email || '—' }}</BsKpiCard><BsKpiCard :title="copy.access"><StatusBadge :status="detailAccessState(detail)" /></BsKpiCard><BsKpiCard :title="copy.plan">{{ detail.subscription?.planName || '—' }}</BsKpiCard><BsKpiCard :title="copy.members">{{ detail.usage.members }}</BsKpiCard></div>
        <section><h3 class="font-extrabold">{{ copy.usage }}</h3><p class="mt-2 text-sm text-muted-foreground">{{ copy.trialStart }}: {{ date(detail.subscription?.trialStartAt) }} · {{ copy.trialEnd }}: {{ date(detail.subscription?.trialEndAt) }} · {{ copy.periodEnd }}: {{ date(detail.subscription?.periodEnd) }}</p><p class="mt-2 text-sm text-muted-foreground">{{ copy.locations }}: {{ detail.usage.locations }} · {{ copy.members }}: {{ detail.usage.members }} · {{ isArabic ? 'المنتجات' : 'Products' }}: {{ detail.usage.products }} · {{ isArabic ? 'الخدمات' : 'Services' }}: {{ detail.usage.services }}</p><pre class="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs">{{ JSON.stringify(detail.usage.limits || {}, null, 2) }}</pre></section>
        <section v-if="session?.canMutate"><h3 class="font-extrabold">{{ copy.controls }}</h3><div class="mt-3 flex flex-wrap gap-2"><BsButton v-for="key in (Object.keys(copy.actions) as ActionKey[])" :key="key" class="ls-btn" @click="openAction(key)">{{ actionLabel(key) }}</BsButton></div></section>
        <section><h3 class="font-extrabold">{{ copy.billing }}</h3><BsDataTable class="mt-3" :value="detail.billingHistory" data-key="id" :label="copy.billing"><Column field="kind"><template #header>{{ copy.action }}</template></Column><Column field="status"><template #header>{{ copy.status }}</template><template #body="{ data: item }"><StatusBadge :status="item.status" /></template></Column><Column field="reference"><template #header>{{ copy.billingReference }}</template></Column><Column><template #header>{{ copy.occurred }}</template><template #body="{ data: item }">{{ date(item.submittedAt) }}</template></Column><template #empty><p class="p-5 text-center text-sm text-muted-foreground">{{ copy.emptyBilling }}</p></template></BsDataTable></section>
        <section><h3 class="font-extrabold">{{ copy.sensitive }}</h3><BsDataTable class="mt-3" :value="detail.sensitiveEvents" data-key="id" :label="copy.sensitive"><Column field="type"><template #header>{{ copy.status }}</template></Column><Column field="action"><template #header>{{ copy.action }}</template></Column><Column field="reason"><template #header>{{ copy.reason }}</template></Column><Column><template #header>{{ copy.occurred }}</template><template #body="{ data: event }">{{ date(event.occurredAt) }}</template></Column><template #empty><p class="p-5 text-center text-sm text-muted-foreground">{{ copy.emptySensitive }}</p></template></BsDataTable></section>
        <section><h3 class="font-extrabold">{{ copy.supportNotes }}</h3><ul v-if="detail.supportNotes.length" class="mt-3 space-y-3"><li v-for="note in detail.supportNotes" :key="note.id" class="rounded-xl border border-border p-4"><p>{{ note.note }}</p><p class="mt-2 text-xs text-muted-foreground">{{ note.reason }} · {{ date(note.createdAt) }}</p></li></ul><p v-else class="mt-3 text-sm text-muted-foreground">{{ copy.emptyNotes }}</p></section>
      </div>
    </BsDialog>

    <BsDialog v-model:visible="actionOpen" :title="actionLabel(action.key)" :dirty="actionDirty" :pending="actionPending">
      <template #default="{ close }"><BsForm class="space-y-4" :pending="actionPending" :error="commandError" @submit="runAction">
        <label class="block space-y-2 text-sm font-bold">{{ copy.reason }}<textarea v-model="action.reason" class="ls-input" minlength="2" maxlength="1000" required rows="3" /></label>
        <label v-if="['extend_trial','activate_subscription','extend_subscription'].includes(action.key)" class="block space-y-2 text-sm font-bold">{{ copy.days }}<input v-model.number="action.days" class="ls-input" type="number" min="1" :max="action.key === 'extend_trial' ? 365 : 3660" step="1" required></label>
        <label v-if="action.key === 'activate_subscription'" class="block space-y-2 text-sm font-bold">{{ copy.planSlug }}<input v-model="action.planSlug" class="ls-input" maxlength="100" required></label>
        <template v-if="action.key === 'correct_billing_metadata'"><label class="block space-y-2 text-sm font-bold">{{ copy.billingReference }}<input v-model="action.billingReference" class="ls-input" maxlength="200"></label><label class="block space-y-2 text-sm font-bold">{{ copy.billingNote }}<textarea v-model="action.billingNote" class="ls-input" maxlength="1000" rows="3" /></label></template>
        <label v-if="action.key === 'add_support_note'" class="block space-y-2 text-sm font-bold">{{ copy.note }}<textarea v-model="action.note" class="ls-input" minlength="2" maxlength="2000" required rows="5" /></label>
        <div class="flex flex-wrap gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="actionPending">{{ copy.save }}</BsButton><BsButton class="ls-btn" :disabled="actionPending" @click="close">{{ copy.cancel }}</BsButton></div>
      </BsForm></template>
    </BsDialog>
    <BsDialog v-model:visible="billingReviewOpen" :title="billingReview.action === 'approve' ? copy.approve : billingReview.action === 'reject' ? copy.reject : copy.markUnderReview" :pending="billingReviewPending">
      <BsForm class="space-y-4" :pending="billingReviewPending" :error="billingReviewError" @submit="runBillingReview">
        <label class="grid gap-2 text-sm font-bold">{{ copy.reason }}<textarea v-model="billingReview.reason" class="ls-input" minlength="2" maxlength="1000" required rows="3" /></label>
        <template v-if="billingReview.action === 'approve'">
          <label class="grid gap-2 text-sm font-bold">{{ copy.receivedAmount }}<input v-model.number="billingReview.receivedAmount" class="ls-input" type="number" min="0.01" step="0.01" required></label>
          <label class="grid gap-2 text-sm font-bold">{{ copy.receivedReference }}<input v-model="billingReview.receivedReference" class="ls-input" dir="ltr" minlength="2" maxlength="200" required></label>
          <label class="grid gap-2 text-sm font-bold">{{ copy.receivedDate }}<input v-model="billingReview.receivedDate" class="ls-input" type="date" :max="new Date().toISOString().slice(0, 10)" required></label>
          <label class="grid gap-2 text-sm font-bold">{{ copy.activationDays }}<input v-model.number="billingReview.days" class="ls-input" type="number" min="1" max="3660" step="1" required></label>
        </template>
        <div class="flex flex-wrap gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary" :pending="billingReviewPending">{{ copy.save }}</BsButton><BsButton type="button" class="ls-btn" :disabled="billingReviewPending" @click="billingReviewOpen = false">{{ copy.cancel }}</BsButton></div>
      </BsForm>
    </BsDialog>
  </div>
</template>
