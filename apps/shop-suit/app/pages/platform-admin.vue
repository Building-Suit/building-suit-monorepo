<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { PlatformAdminEvent, PlatformAdminSession, PlatformDashboard, PlatformPage, PlatformShopDetail, PlatformShopRow } from '~/types/platformAdmin'

definePageMeta({ layout: 'platform-admin', middleware: ['auth'] })

type ActionKey = 'suspend_shop' | 'reactivate_shop' | 'extend_trial' | 'end_trial'
  | 'activate_subscription' | 'extend_subscription' | 'suspend_subscription'
  | 'correct_billing_metadata' | 'add_support_note'

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const user = useSupabaseUser()
const userId = computed(() => user.value?.id ?? null)
const { locale } = useI18n()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const showDevelopmentErrors = import.meta.dev
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const view = ref<'overview' | 'audit'>('overview')
const search = ref('')
const debouncedSearch = ref('')
const status = ref('')
const page = ref(1)
const auditPage = ref(1)
const selectedShopId = ref<string | null>(null)
const sessionError = ref('')
const commandError = ref('')
const action = reactive({ key: 'add_support_note' as ActionKey, reason: '', days: 30, planSlug: 'pro', billingReference: '', billingNote: '', note: '' })
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

watch(session, value => {
  if (value) return
  selectedShopId.value = null
  actionOpen.value = false
})

function date(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function actionLabel(key: string) {
  return copy.value.actions[key as ActionKey] ?? key
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
function handleDetailVisibility(value: boolean) { if (!value) selectedShopId.value = null }

const en = {
  title: 'Platform administration', subtitle: 'Cross-tenant support controls and immutable operational evidence.',
  overview: 'Overview', audit: 'Privileged audit', accessDenied: 'This account is not an authorized Shop Suit platform administrator.',
  accessHint: 'Platform access is provisioned independently and cannot be granted from a Shop membership.', retry: 'Retry',
  shops: 'Shops', activeShops: 'Active shops', suspendedShops: 'Suspended shops', locations: 'Locations', members: 'Members',
  activeTrials: 'Active trials', trialsSoon: 'Trials expiring soon', activeSubscriptions: 'Active subscriptions', readOnly: 'Read-only subscriptions', pendingBilling: 'Pending billing submissions',
  recentEvents: 'Recent privileged events', search: 'Search by shop, ID, or owner email', allStates: 'All states', open: 'Open support view',
  shop: 'Shop', owner: 'Owner', access: 'Access', plan: 'Plan', usage: 'Usage and limits', billing: 'Billing history', sensitive: 'Sensitive operational audit', supportNotes: 'Support notes', controls: 'Approved support controls',
  noRows: 'No records match this view.', noEvents: 'No audit events are available.', loadFailed: 'Could not load platform administration data.',
  reason: 'Reason', reasonRequired: 'Enter an explicit reason of at least two characters.', days: 'Days', daysInvalid: 'Enter a whole number of days in the allowed range.', planSlug: 'Plan', billingReference: 'Billing reference', billingNote: 'Billing note', note: 'Support note', noteRequired: 'Enter a support note.', save: 'Apply control', cancel: 'Cancel', commandSucceeded: 'The support control was applied and audited.', commandFailed: 'The support control could not be applied.', observer: 'Read-only observer', operator: 'Platform operator',
  status: 'Status', action: 'Action', actor: 'Actor', occurred: 'Occurred', emptyBilling: 'No billing submissions.', emptySensitive: 'No sensitive events are available.', emptyNotes: 'No support notes.',
  actions: { suspend_shop: 'Suspend Shop access', reactivate_shop: 'Reactivate Shop access', extend_trial: 'Extend trial', end_trial: 'End trial', activate_subscription: 'Activate subscription', extend_subscription: 'Extend subscription', suspend_subscription: 'Suspend subscription', correct_billing_metadata: 'Correct billing metadata', add_support_note: 'Add support note' },
  destructiveConfirm: { suspend_shop: 'Suspend this Shop? Tenant access will stop, but all history will be preserved.', end_trial: 'End this trial now? The Shop will become read-only.', suspend_subscription: 'Suspend this subscription? Historical reads remain available, but writes will stop.' },
}

const ar = {
  title: 'إدارة المنصة', subtitle: 'ضوابط دعم عابرة للمتاجر وأدلة تشغيلية غير قابلة للتعديل.',
  overview: 'نظرة عامة', audit: 'سجل الصلاحيات', accessDenied: 'هذا الحساب غير مصرح له بإدارة منصة Shop Suit.',
  accessHint: 'تُمنح صلاحية المنصة بشكل مستقل ولا يمكن منحها من عضوية متجر.', retry: 'إعادة المحاولة',
  shops: 'المتاجر', activeShops: 'المتاجر النشطة', suspendedShops: 'المتاجر الموقوفة', locations: 'الفروع', members: 'الأعضاء',
  activeTrials: 'التجارب النشطة', trialsSoon: 'تجارب تنتهي قريبًا', activeSubscriptions: 'الاشتراكات النشطة', readOnly: 'اشتراكات للقراءة فقط', pendingBilling: 'طلبات فوترة معلقة',
  recentEvents: 'أحدث إجراءات الصلاحيات', search: 'ابحث بالمتجر أو المعرّف أو بريد المالك', allStates: 'كل الحالات', open: 'فتح عرض الدعم',
  shop: 'المتجر', owner: 'المالك', access: 'الوصول', plan: 'الخطة', usage: 'الاستخدام والحدود', billing: 'سجل الفوترة', sensitive: 'سجل العمليات الحساسة', supportNotes: 'ملاحظات الدعم', controls: 'ضوابط الدعم المعتمدة',
  noRows: 'لا توجد سجلات مطابقة.', noEvents: 'لا توجد أحداث تدقيق.', loadFailed: 'تعذّر تحميل بيانات إدارة المنصة.',
  reason: 'السبب', reasonRequired: 'اكتب سببًا صريحًا من حرفين على الأقل.', days: 'الأيام', daysInvalid: 'اكتب عددًا صحيحًا من الأيام ضمن النطاق المسموح.', planSlug: 'الخطة', billingReference: 'مرجع الفوترة', billingNote: 'ملاحظة الفوترة', note: 'ملاحظة الدعم', noteRequired: 'اكتب ملاحظة دعم.', save: 'تطبيق الإجراء', cancel: 'إلغاء', commandSucceeded: 'تم تطبيق إجراء الدعم وتسجيله.', commandFailed: 'تعذّر تطبيق إجراء الدعم.', observer: 'مراقب للقراءة فقط', operator: 'مسؤول المنصة',
  status: 'الحالة', action: 'الإجراء', actor: 'المنفذ', occurred: 'الوقت', emptyBilling: 'لا توجد طلبات فوترة.', emptySensitive: 'لا توجد أحداث حساسة.', emptyNotes: 'لا توجد ملاحظات دعم.',
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

    <div v-if="sessionPending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div v-for="item in 8" :key="item" class="h-28 animate-pulse rounded-2xl bg-muted" /></div>
    <section v-else-if="!session" class="rounded-2xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-6" role="alert">
      <h2 class="font-extrabold">{{ copy.accessDenied }}</h2><p class="mt-2 text-sm">{{ copy.accessHint }}</p>
      <BsButton class="ls-btn mt-4" @click="refreshSession()">{{ copy.retry }}</BsButton>
      <p v-if="sessionError && showDevelopmentErrors" class="mt-3 text-xs opacity-75">{{ sessionError }}</p>
    </section>

    <template v-else>
      <div class="flex gap-2" role="tablist">
        <BsButton :aria-selected="view === 'overview'" role="tab" class="ls-btn" :class="view === 'overview' ? 'ls-btn-primary' : ''" @click="view = 'overview'">{{ copy.overview }}</BsButton>
        <BsButton :aria-selected="view === 'audit'" role="tab" class="ls-btn" :class="view === 'audit' ? 'ls-btn-primary' : ''" @click="view = 'audit'">{{ copy.audit }}</BsButton>
      </div>

      <template v-if="view === 'overview'">
        <p v-if="dashboardError || shopsError" class="ls-error" role="alert">{{ copy.loadFailed }} <BsButton class="font-bold underline" @click="refreshDashboard(); refreshShops()">{{ copy.retry }}</BsButton></p>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" :aria-busy="dashboardPending">
          <BsKpiCard :title="copy.shops">{{ dashboard?.shops ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.activeShops">{{ dashboard?.activeShops ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.suspendedShops">{{ dashboard?.suspendedShops ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.locations">{{ dashboard?.locations ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.members">{{ dashboard?.members ?? '—' }}</BsKpiCard>
          <BsKpiCard :title="copy.activeTrials">{{ dashboard?.activeTrials ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.trialsSoon">{{ dashboard?.trialsExpiringSoon ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.activeSubscriptions">{{ dashboard?.activeSubscriptions ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.readOnly">{{ dashboard?.readOnlySubscriptions ?? '—' }}</BsKpiCard><BsKpiCard :title="copy.pendingBilling">{{ dashboard?.pendingBillingSubmissions ?? '—' }}</BsKpiCard>
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

      <section v-else class="overflow-hidden rounded-2xl border border-border bg-card">
        <BsDataTable :value="audit?.items ?? []" :loading="auditPending" :error="auditError ? copy.loadFailed : null" :label="copy.audit" data-key="id" lazy paginator :rows="25" :first="(auditPage - 1) * 25" :total-records="audit?.total ?? 0" :always-show-paginator="false" @page="handleAuditPage" @retry="refreshAudit()">
          <Column field="shopName"><template #header>{{ copy.shop }}</template></Column><Column field="action"><template #header>{{ copy.action }}</template><template #body="{ data: event }">{{ actionLabel(event.action) || event.action }}</template></Column><Column field="reason"><template #header>{{ copy.reason }}</template></Column><Column field="actorUserId"><template #header>{{ copy.actor }}</template></Column><Column><template #header>{{ copy.occurred }}</template><template #body="{ data: event }">{{ date(event.occurredAt) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noEvents }}</p></template>
        </BsDataTable>
      </section>
    </template>

    <BsDialog :visible="Boolean(selectedShopId)" :title="detail?.shop.name || copy.shop" size="lg" :pending="detailPending" @update:visible="handleDetailVisibility">
      <p v-if="detailError" class="ls-error" role="alert">{{ copy.loadFailed }} <BsButton class="font-bold underline" @click="refreshDetail()">{{ copy.retry }}</BsButton></p>
      <div v-else-if="detail" class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><BsKpiCard :title="copy.owner">{{ detail.owner?.name || detail.owner?.email || '—' }}</BsKpiCard><BsKpiCard :title="copy.access"><StatusBadge :status="detail.shop.status === 'suspended' ? 'read_only' : (detail.subscription?.status || 'read_only')" /></BsKpiCard><BsKpiCard :title="copy.plan">{{ detail.subscription?.planName || '—' }}</BsKpiCard><BsKpiCard :title="copy.members">{{ detail.usage.members }}</BsKpiCard></div>
        <section><h3 class="font-extrabold">{{ copy.usage }}</h3><p class="mt-2 text-sm text-muted-foreground">{{ copy.locations }}: {{ detail.usage.locations }} · {{ copy.members }}: {{ detail.usage.members }} · Products: {{ detail.usage.products }} · Services: {{ detail.usage.services }}</p><pre class="mt-3 overflow-auto rounded-xl bg-muted p-3 text-xs">{{ JSON.stringify(detail.usage.limits || {}, null, 2) }}</pre></section>
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
  </div>
</template>
