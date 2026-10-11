<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { BusinessMode } from '~/utils/businessMode'
import { BUSINESS_MODES } from '~/utils/businessMode'

definePageMeta({ layout: 'default', middleware: ['auth'] })

type Subscription = { status: string; trial_end_at: string | null; current_period_end: string | null; plan_id: string }
type ReportPeriod = 'day' | 'week' | 'month'
type OperatingReport = {
  locationId: string | null; period: ReportPeriod; fromDate: string; toDateExclusive: string; canViewCosts: boolean
  sales: number; saleCount: number; averageTicket: number; paymentsIn: number
  salesMix: Array<{ type: 'product' | 'service'; amount: number; quantity: number }>
  paymentMix: Array<{ method: string; collected: number; refunded: number; net: number; count: number }>
  outstanding: { amount: number; customerCount: number; customers: Array<{ customerId: string; name: string; amount: number }> }
  expenses: { amount: number | null; count: number | null; operatingBalance: number | null }
  appointments: { total: number; completed: number; cancelled: number; noShow: number; busiestTimes: Array<{ hour: number; count: number }> }
  cash: { closedShifts: number; expected: number; counted: number; variance: number }
  staff: Array<{ membershipId: string; name: string; sales: number; saleCount: number; serviceCount: number }>
  locations: Array<{ locationId: string; name: string; sales: number; saleCount: number; collections: number; expenses: number | null; cashVariance: number }>
}
type ReportHighlights = { payable: number; lowStockCount: number; inventoryValue: number; margin: number }

const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const route = useRoute()
const { locale } = useI18n()
const { current, currentId, activeLocations, currentLocationId, currentMembership, isOwner, selectLocation, reload } = useShop()
const { data: plans } = usePlans()
const isArabic = computed(() => locale.value === 'ar')
const periodOptions: ReportPeriod[] = ['day', 'week', 'month']
const setupName = ref('')
const setupMode = ref<BusinessMode>('mixed')
const setupPending = ref(false)
const setupError = ref('')
const reportPeriod = ref<ReportPeriod>('day')
const reportAnchor = ref(localToday())
const reportLocationId = ref<string>('all')

const copy = computed(() => isArabic.value ? {
  title: 'لوحة التحكم', subtitle: 'شوف المبيعات والتحصيلات والمواعيد وأداء الفروع في مكان واحد.',
  setupTitle: 'اعمل متجرك الأول', setupBody: 'ابدأ تجربة كاملة 7 أيام من غير ما تختار خطة مدفوعة. تقدر تختار خطتك بعدين من صفحة الاشتراك.',
  shopName: 'اسم المتجر', plan: 'الخطة', fullTrial: 'تجربة كاملة 7 أيام', createShop: 'اعمل المتجر', creating: 'بنجهّز المتجر...',
  businessMode: 'طريقة تشغيل النشاط', businessModeHelp: 'يمكنك تغيير طريقة التشغيل لاحقًا من إعدادات النشاط دون فقد أي بيانات.',
  productMode: 'منتجات ومخزون', productModeBody: 'للبيع والمشتريات والموردين وإدارة المخزون.',
  serviceMode: 'خدمات فقط', serviceModeBody: 'لتقديم الخدمات دون الحاجة إلى سجلات مخزون.',
  mixedMode: 'منتجات ومخزون وخدمات', mixedModeBody: 'لإظهار مسارات المنتجات والمخزون والخدمات معًا.',
  planStatus: 'حالة الخطة', trialEnds: 'تنتهي التجربة', periodEnds: 'نهاية الفترة', owner: 'مالك', employee: 'موظف',
  client: 'العميل', amount: 'الإجمالي', date: 'التاريخ',
  loadFailed: 'مقدرناش نحمّل البيانات.', retry: 'حاول تاني',
  noShopAfterCreate: 'تم إنشاء المتجر لكن تعذّر تحميله. حدّث الصفحة.',
  setupFailed: 'تعذّر إنشاء المتجر.', invalidName: 'اكتب اسمًا للمتجر من حرفين إلى 120 حرفًا.',
  profileInactive: 'هذا الحساب غير نشط.',
  subscriptionReview: 'الاشتراك الحالي يحتاج مراجعة قبل إنشاء متجر.',
  modeDisabled: 'هذا المسار مخفي حسب طريقة تشغيل النشاط الحالية. يمكنك تغييره من إعدادات النشاط؛ وتظل البيانات السابقة محفوظة.',
  day: 'يوم', week: 'أسبوع', month: 'شهر', allLocations: 'كل الفروع', location: 'الفرع', reportDate: 'التاريخ',
  loadingReport: 'جاري تحميل تقرير التشغيل…', reportDenied: 'اطلب من المالك صلاحية التقارير. استخدم التقويم أو نقطة البيع لعملك اليومي.',
  sales: 'المبيعات', salesCount: 'عدد البيعات', averageTicket: 'متوسط الفاتورة', collections: 'التحصيلات',
  expenses: 'مصروفات التشغيل', operatingBalance: 'المبيعات ناقص المصروفات', accountingNotice: 'ده ملخص للشغل بس، مش حساب للربح المحاسبي ومش قائمة مالية.',
  salesMix: 'مزيج المبيعات', product: 'منتجات', service: 'خدمات', quantity: 'الكمية', paymentMix: 'مزيج طرق الدفع', collected: 'محصل', refunded: 'مرتجع', net: 'صافي التحصيل',
  outstanding: 'عملاء عليهم مستحقات', customer: 'العميل', noOutstanding: 'لا توجد مستحقات عملاء.',
  appointments: 'المواعيد', completed: 'مكتمل', cancelled: 'ملغي', noShow: 'لم يحضر', busiestTimes: 'أكثر الأوقات ازدحامًا', noAppointments: 'لا توجد بيانات مواعيد في الفترة.',
  cashVariance: 'فرق الخزنة', closedShifts: 'ورديات مغلقة', expected: 'متوقع', counted: 'فعلي', staffPerformance: 'أداء الفريق', staffMember: 'الموظف', serviceCount: 'عدد الخدمات',
  branchComparison: 'مقارنة الفروع', openSource: 'فتح السجلات', noData: 'لا توجد بيانات في هذه الفترة.',
  fullReports: 'كل تقارير الشغل', fullReportsBody: 'المبيعات والتحصيلات ومستحقات الموردين والمصروفات والمخزون، وهامش FIFO (الأقدم أولًا)، مع تصدير CSV.',
  supplierPayable: 'مستحقات الموردين', lowStock: 'منتجات منخفضة المخزون', inventoryValue: 'قيمة المخزون', fifoMargin: 'هامش FIFO المتصالح',
} : {
  title: 'Operating dashboard', subtitle: 'Sales, collections, appointments, and branch performance reconciled from source records.',
  setupTitle: 'Create your first shop', setupBody: 'Start with full product access for 7 days and no paid-plan choice. Choose a plan later from Billing.',
  shopName: 'Shop name', plan: 'Plan', fullTrial: 'Full product trial · 7 days', createShop: 'Create shop', creating: 'Creating...',
  businessMode: 'Business operation mode', businessModeHelp: 'You can change this later in Business settings without losing data.',
  productMode: 'Products and stock', productModeBody: 'For sales, purchasing, suppliers, and inventory operations.',
  serviceMode: 'Services only', serviceModeBody: 'For delivering services without requiring stock records.',
  mixedMode: 'Products, stock and services', mixedModeBody: 'Shows product, stock, and service workflows together.',
  planStatus: 'Plan status', trialEnds: 'Trial ends', periodEnds: 'Period ends', owner: 'Owner', employee: 'Employee',
  client: 'Client', amount: 'Total', date: 'Date',
  loadFailed: 'Could not load this data.', retry: 'Retry',
  noShopAfterCreate: 'The shop was created but could not be loaded. Refresh this page.',
  setupFailed: 'Could not create the shop.', invalidName: 'Enter a shop name between 2 and 120 characters.',
  profileInactive: 'This account is inactive.',
  subscriptionReview: 'The current subscription needs review before creating a shop.',
  modeDisabled: 'This workflow is hidden by the current business mode. You can change it in Business settings; existing history remains preserved.',
  day: 'Day', week: 'Week', month: 'Month', allLocations: 'All locations', location: 'Location', reportDate: 'Date',
  loadingReport: 'Loading the operating report…', reportDenied: 'Ask the owner for report access. Use Calendar or Point of sale for your daily work.',
  sales: 'Sales', salesCount: 'Sales count', averageTicket: 'Average ticket', collections: 'Collections',
  expenses: 'Operating expenses', operatingBalance: 'Sales less operating expenses', accountingNotice: 'Operational summary only; this is not accounting profit or a financial statement.',
  salesMix: 'Sales mix', product: 'Products', service: 'Services', quantity: 'Quantity', paymentMix: 'Payment-method mix', collected: 'Collected', refunded: 'Refunded', net: 'Net collections',
  outstanding: 'Outstanding customers', customer: 'Customer', noOutstanding: 'No customer balances are outstanding.',
  appointments: 'Appointments', completed: 'Completed', cancelled: 'Cancelled', noShow: 'No-show', busiestTimes: 'Busiest times', noAppointments: 'No appointment data exists for this period.',
  cashVariance: 'Cash variance', closedShifts: 'Closed shifts', expected: 'Expected', counted: 'Counted', staffPerformance: 'Staff performance', staffMember: 'Staff member', serviceCount: 'Service count',
  branchComparison: 'Location comparison', openSource: 'Open source records', noData: 'No data exists for this period.',
  fullReports: 'All operational reports', fullReportsBody: 'Sales, collections, supplier payables, expenses, stock, reconciled FIFO margin, activity, and matching CSV exports.',
  supplierPayable: 'Supplier payable', lowStock: 'Low-stock products', inventoryValue: 'Inventory value', fifoMargin: 'Reconciled FIFO margin',
})

const modeOptions = computed(() => BUSINESS_MODES.map(value => ({
  value,
  label: value === 'product' ? copy.value.productMode : value === 'service' ? copy.value.serviceMode : copy.value.mixedMode,
  body: value === 'product' ? copy.value.productModeBody : value === 'service' ? copy.value.serviceModeBody : copy.value.mixedModeBody,
})))
const modeDisabledNotice = computed(() => route.query.modeDisabled === 'product' || route.query.modeDisabled === 'service')

const { data: subscription, error: subscriptionError, refresh: refreshSubscription } = useAsyncData(
  'shop-data:subscription', async () => {
    if (!currentId.value || !isOwner.value || !currentMembership.value) return null
    const { data, error } = await supabase.from('subscriptions')
      .select('status,trial_end_at,current_period_end,plan_id')
      .eq('profile_id', currentMembership.value.profile_id).maybeSingle()
    if (error) throw error
    return data as Subscription | null
  }, { watch: [currentId], default: () => null },
)

const { data: reportAccess, error: reportAccessError, pending: reportAccessPending, refresh: refreshReportAccess } = useAsyncData(
  'shop-data:dashboard-report-access', async () => {
    if (!currentId.value) return { 'reports.view': false, 'reports.cost_profit.view': false }
    const { data, error } = await shopRpc.rpc('shop_permission_access', {
      p_shop_id: currentId.value, p_permission_keys: ['reports.view', 'reports.cost_profit.view'],
    })
    if (error) throw error
    return data
  }, { watch: [currentId], default: () => ({ 'reports.view': false, 'reports.cost_profit.view': false }) },
)
const canViewReports = computed(() => reportAccess.value?.['reports.view'] === true)
const canViewReportCosts = computed(() => reportAccess.value?.['reports.cost_profit.view'] === true)

watch([currentId, currentLocationId, activeLocations], () => {
  if (!currentId.value) { reportLocationId.value = 'all'; return }
  if (reportLocationId.value !== 'all'
    && activeLocations.value.some(location => location.id === reportLocationId.value)) return
  reportLocationId.value = activeLocations.value.length > 1 ? 'all' : (currentLocationId.value ?? 'all')
}, { immediate: true, deep: true })

const { data: report, pending: reportPending, error: reportError, refresh: refreshReport } = useAsyncData(
  'shop-data:operating-report', async (): Promise<OperatingReport | null> => {
    if (!currentId.value || !canViewReports.value) return null
    const { data, error } = await shopRpc.rpc('shop_operating_report', {
      p_shop_id: currentId.value,
      p_location_id: reportLocationId.value === 'all' ? null : reportLocationId.value,
      p_period: reportPeriod.value,
      p_anchor_date: reportAnchor.value,
    })
    if (error) throw error
    return data as OperatingReport
  }, {
    watch: [currentId, canViewReports, reportLocationId, reportPeriod, reportAnchor],
    default: () => null,
  },
)

const { data: reportHighlights, pending: highlightsPending, error: highlightsError, refresh: refreshHighlights } = useAsyncData(
  'shop-data:operational-report-highlights', async (): Promise<ReportHighlights | null> => {
    if (!currentId.value || !canViewReports.value || !canViewReportCosts.value || !report.value) return null
    const location = reportLocationId.value === 'all' ? null : reportLocationId.value
    const range = reportQuery()
    const [suppliers, inventory, margin] = await Promise.all([
      shopRpc.rpc('shop_operational_report', { p_shop_id: currentId.value, p_report: 'suppliers', p_location_id: location, p_from: range.from, p_to: range.to, p_page: 1, p_page_size: 1 }),
      shopRpc.rpc('shop_operational_report', { p_shop_id: currentId.value, p_report: 'inventory', p_location_id: location, p_from: null, p_to: null, p_page: 1, p_page_size: 1 }),
      shopRpc.rpc('shop_operational_report', { p_shop_id: currentId.value, p_report: 'margin', p_location_id: location, p_from: range.from, p_to: range.to, p_page: 1, p_page_size: 1 }),
    ])
    const queryError = suppliers.error || inventory.error || margin.error
    if (queryError) throw queryError
    return {
      payable: Number((suppliers.data as { summary: { payable: number } }).summary.payable),
      lowStockCount: Number((inventory.data as { summary: { lowStockCount: number } }).summary.lowStockCount),
      inventoryValue: Number((inventory.data as { summary: { inventoryValue: number } }).summary.inventoryValue),
      margin: Number((margin.data as { summary: { margin: number } }).summary.margin),
    }
  }, {
    watch: [currentId, canViewReports, canViewReportCosts, report, reportLocationId],
    default: () => null,
  },
)

const currentPlan = computed(() => plans.value?.find(plan => plan.id === subscription.value?.plan_id))

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(value))
}

function localToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function whole(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { maximumFractionDigits: 2 }).format(Number(value))
}

function methodLabel(value: string) {
  const labels = isArabic.value
    ? { cash: 'نقدي', bank_transfer: 'تحويل بنكي', card: 'بطاقة', wallet: 'محفظة', cheque: 'شيك', other: 'أخرى' }
    : { cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', wallet: 'Wallet', cheque: 'Cheque', other: 'Other' }
  return labels[value as keyof typeof labels] ?? value
}

function hourLabel(hour: number) {
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { hour: 'numeric', timeZone: 'Africa/Cairo' })
    .format(new Date(Date.UTC(2020, 0, 1, Number(hour))))
}

function reportQuery() {
  if (!report.value) return {}
  const inclusiveTo = new Date(`${report.value.toDateExclusive}T12:00:00Z`)
  inclusiveTo.setUTCDate(inclusiveTo.getUTCDate() - 1)
  return { from: report.value.fromDate, to: inclusiveTo.toISOString().slice(0, 10) }
}

async function openLocationSource(locationId: string, path: string) {
  await selectLocation(locationId)
  await navigateTo({ path, query: reportQuery() })
}

function money(value: number | null, currency = 'EGP') {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(Number(value ?? 0))
}

function setupErrorText(message?: string) {
  if (message === 'INVALID_SHOP_NAME') return copy.value.invalidName
  if (message === 'TRIAL_UNAVAILABLE') return copy.value.setupFailed
  if (message === 'PROFILE_INACTIVE') return copy.value.profileInactive
  if (message === 'SUBSCRIPTION_REQUIRES_REVIEW') return copy.value.subscriptionReview
  return message || copy.value.setupFailed
}

async function createShop() {
  if (setupPending.value || current.value) return
  setupError.value = ''
  const name = setupName.value.trim()
  if (name.length < 2 || name.length > 120) { setupError.value = copy.value.invalidName; return }
  setupPending.value = true
  try {
    const { error } = await shopRpc.rpc('create_owner_shop', {
      p_shop_name: name,
      p_business_mode: setupMode.value,
    })
    if (error) throw error
    await reload()
    if (!currentId.value) throw new Error(copy.value.noShopAfterCreate)
    await Promise.all([refreshSubscription(), refreshReport()])
    setupAction.complete()
  } catch (error) {
    setupError.value = setupErrorText(error instanceof Error ? error.message : undefined)
  } finally {
    setupPending.value = false
  }
}
const setupGuide = reactive(useShopSetupGuide())

const setupAction = useRecordAction(() => ({ name: setupName.value, mode: setupMode.value }))
const { visible: setupActionOpen, dirty: setupActionDirty } = setupAction
const ui = useUiCopy()
</script>

<template>
  <BsStack>
    <BsText v-if="modeDisabledNotice" role="status" as="p" size="sm" tone="warning">{{ copy.modeDisabled }}</BsText>
    <BsBox v-if="!current" as="section">
      <BsBox>
        <BsBox padding="md">
          <BsGrid :columns="1">
            <BsIcon name="store"/>
          </BsGrid>
          <BsHeading :level="1">{{ copy.setupTitle }}</BsHeading>
          <BsText as="p" size="sm" tone="muted">{{ copy.setupBody }}</BsText>
        </BsBox>
        <BsStack>
          <BsButton :disabled="false" @click="setupAction.edit()">{{ copy.createShop }}</BsButton>
          <BsRecordActionDialog v-model:visible="setupActionOpen" :title="copy.setupTitle" :dirty="setupActionDirty" :pending="setupPending" :error="setupError" :submit-label="copy.createShop" :cancel-label="ui('cancel')" :submit-disabled="false" @submit="createShop">
            <BsField v-slot="field" :label="copy.shopName" for="shop-name">
              <BsInput :id="field.id" v-model="setupName" type="text" :minlength="2" :maxlength="120" required :aria-describedby="field.describedby" />
            </BsField>
            <BsFieldGroup :legend="(copy.businessMode)">
              <BsText as="p" size="sm" tone="muted">{{ copy.businessModeHelp }}</BsText>
              <BsGrid :columns="3">
                <BsRadio v-for="mode in modeOptions" :key="mode.value" v-model="setupMode" name="business-mode" :value="mode.value" :label="(mode.label) + (mode.body)" />
              </BsGrid>
            </BsFieldGroup>
            <BsBox padding="md">
              <BsText as="p" emphasis="semibold">{{ copy.fullTrial }}</BsText>
              <BsText as="p" size="sm" tone="muted">{{ copy.setupBody }}</BsText>
            </BsBox>
          </BsRecordActionDialog>
        </BsStack>
      </BsBox>
    </BsBox>
    <template v-else>
      <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
        <template #actions>
          <BsText as="p" size="xs" emphasis="semibold">{{ current.name }}</BsText>
          <BsText as="span" size="xs" emphasis="semibold">{{ isOwner ? copy.owner : copy.employee }}</BsText>
        </template>
      </BsPageHeader>
      <BsSetupChecklist v-if="isOwner && current?.business_mode !== 'product'" :title="setupGuide.copy.title" :description="setupGuide.copy.help" :steps="setupGuide.steps" :progress-label="setupGuide.copy.help" :empty-label="copy.noData" :retry-label="copy.retry"/>
      <BsPanel v-if="isOwner" padding="md">
        <BsInline>
          <BsHeading :level="2">{{ copy.planStatus }}</BsHeading>
          <BsText v-if="subscriptionError" role="alert" as="p" tone="danger">{{ copy.loadFailed }} <BsButton variant="link" type="button" @click="refreshSubscription()">{{ copy.retry }}</BsButton>
          </BsText>
          <template v-else-if="subscription">
            <BsText as="p">
              <BsText as="span" tone="muted">{{ currentPlan?.name || (subscription.status === 'trialing' ? copy.fullTrial : copy.plan) }}:</BsText> <BsText as="strong">{{ subscription.status }}</BsText>
            </BsText>
            <BsText v-if="subscription.trial_end_at" as="p">
              <BsText as="span" tone="muted">{{ copy.trialEnds }}:</BsText> {{ formatDate(subscription.trial_end_at) }}</BsText>
            <BsText v-else-if="subscription.current_period_end" as="p">
              <BsText as="span" tone="muted">{{ copy.periodEnds }}:</BsText> {{ formatDate(subscription.current_period_end) }}</BsText>
          </template>
        </BsInline>
      </BsPanel>
      <BsFilterBar :label="isArabic ? 'مرشحات التقارير' : 'Report filters'">
        <BsGrid :columns="3">
          <BsField v-slot="field" :label="(copy.location) + ' '">
            <BsSelect v-model="reportLocationId" :input-id="field.id" :aria-describedby="field.describedby" :label="(copy.location) + ' '" :options="[{ value: 'all', label: (copy.allLocations), disabled: false }, ...(activeLocations).map(location => ({ value: location.id, label: (location.name), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="copy.reportDate">
            <BsInput :id="field.id" v-model="reportAnchor" :aria-describedby="field.describedby" type="date"/>
          </BsField>
          <BsFieldGroup :legend="(copy.date)">
            <BsGrid :columns="3">
              <BsButton v-for="value in periodOptions" :key="value" variant="chip" type="button" :aria-pressed="reportPeriod === value" @click="reportPeriod = value">{{ copy[value] }}</BsButton>
            </BsGrid>
          </BsFieldGroup>
        </BsGrid>
      </BsFilterBar>
      <BsActionTile v-if="canViewReports" to="/reports">
        <BsText as="span">
          <BsText as="strong">{{ copy.fullReports }}</BsText>
          <BsText as="span" size="sm" tone="muted">{{ copy.fullReportsBody }}</BsText>
        </BsText>
        <BsText as="span" emphasis="semibold">{{ copy.openSource }}</BsText>
      </BsActionTile>
      <BsText v-if="reportAccessError || reportError || highlightsError" role="alert" as="p" size="sm" tone="danger">{{ copy.loadFailed }} <BsButton variant="link" type="button" @click="refreshReportAccess(); refreshReport(); refreshHighlights()">{{ copy.retry }}</BsButton>
      </BsText>
      <BsText v-else-if="reportAccessPending" role="status" as="p">{{ copy.loadingReport }}</BsText>
      <BsText v-else-if="!canViewReports" role="status" as="p" size="sm" tone="muted">{{ copy.reportDenied }}</BsText>
      <BsStack v-else-if="reportPending" aria-live="polite">
        <BsText as="p" size="sm" tone="muted">{{ copy.loadingReport }}</BsText>
        <BsGrid :columns="4">
          <BsSkeleton v-for="index in 8" :key="index"/>
        </BsGrid>
      </BsStack>
      <template v-else-if="report">
        <BsGrid :columns="4">
          <BsActionTile v-if="report.locationId" type="button" @click="openLocationSource(report.locationId, '/sales')">
            <BsText as="p" size="sm" tone="muted">{{ copy.sales }}</BsText>
            <BsText as="p" size="lg" emphasis="semibold">{{ money(report.sales) }}</BsText>
            <BsText as="p" size="xs">{{ report.saleCount }} {{ copy.salesCount }}</BsText>
          </BsActionTile>
          <BsKpiCard v-else :title="copy.sales" :hint="`${report.saleCount} ${copy.salesCount}`">{{ money(report.sales) }}</BsKpiCard>
          <BsKpiCard  :title="copy.collections" :hint="`${copy.averageTicket}: ${money(report.averageTicket)}`">{{ money(report.paymentsIn) }}</BsKpiCard>
          <BsActionTile v-if="report.canViewCosts" to="/expenses">
            <BsText as="p" size="sm" tone="muted">{{ copy.expenses }}</BsText>
            <BsText as="p" size="lg" emphasis="semibold">{{ money(report.expenses.amount) }}</BsText>
            <BsText as="p" size="xs">{{ report.expenses.count }} {{ copy.openSource }}</BsText>
          </BsActionTile>
          <BsKpiCard v-if="report.canViewCosts" :title="copy.operatingBalance" :hint="copy.accountingNotice">{{ money(report.expenses.operatingBalance) }}</BsKpiCard>
        </BsGrid>
        <BsGrid v-if="reportHighlights || highlightsPending" :columns="4">
          <template v-if="reportHighlights">
            <BsActionTile to="/reports?report=suppliers">
              <BsText as="p" size="sm" tone="muted">{{ copy.supplierPayable }}</BsText>
              <BsText as="p" size="lg" emphasis="semibold">{{ money(reportHighlights.payable) }}</BsText>
            </BsActionTile>
            <BsActionTile to="/reports?report=inventory">
              <BsText as="p" size="sm" tone="muted">{{ copy.lowStock }}</BsText>
              <BsText as="p" size="lg" emphasis="semibold">{{ reportHighlights.lowStockCount }}</BsText>
            </BsActionTile>
            <BsActionTile to="/reports?report=inventory">
              <BsText as="p" size="sm" tone="muted">{{ copy.inventoryValue }}</BsText>
              <BsText as="p" size="lg" emphasis="semibold">{{ money(reportHighlights.inventoryValue) }}</BsText>
            </BsActionTile>
            <BsActionTile to="/reports?report=margin">
              <BsText as="p" size="sm" tone="muted">{{ copy.fifoMargin }}</BsText>
              <BsText as="p" size="lg" emphasis="semibold">{{ money(reportHighlights.margin) }}</BsText>
            </BsActionTile>
          </template>
          <template v-else>
            <BsSkeleton v-for="index in 4" :key="index"/>
          </template>
        </BsGrid>
        <BsGrid :columns="2">
          <BsCard as="article" padding="md">
            <BsHeading :level="2">{{ copy.salesMix }}</BsHeading>
            <BsStack v-if="report.salesMix.length">
              <BsInline v-for="item in report.salesMix" :key="item.type" justify="between">
                <BsBox>
                  <BsText as="p" emphasis="semibold">{{ copy[item.type] }}</BsText>
                  <BsText as="p" size="xs" tone="muted">{{ copy.quantity }}: {{ whole(item.quantity) }}</BsText>
                </BsBox>
                <BsText as="strong">{{ money(item.amount) }}</BsText>
              </BsInline>
            </BsStack>
            <BsText v-else as="p" size="sm" tone="muted">{{ copy.noData }}</BsText>
          </BsCard>
          <BsCard as="article" padding="md">
            <BsHeading :level="2">{{ copy.paymentMix }}</BsHeading>
            <BsStack v-if="report.paymentMix.length">
              <BsBox v-for="item in report.paymentMix" :key="item.method">
                <BsInline justify="between">
                  <BsText as="strong">{{ methodLabel(item.method) }}</BsText>
                  <BsText as="strong">{{ money(item.net) }}</BsText>
                </BsInline>
                <BsText as="p" size="xs" tone="muted">{{ copy.collected }} {{ money(item.collected) }} · {{ copy.refunded }} {{ money(item.refunded) }}</BsText>
              </BsBox>
            </BsStack>
            <BsText v-else as="p" size="sm" tone="muted">{{ copy.noData }}</BsText>
          </BsCard>
        </BsGrid>
        <BsGrid :columns="2">
          <BsCard as="article" padding="md">
            <BsInline justify="between">
              <BsHeading :level="2">{{ copy.appointments }}</BsHeading>
              <BsButton v-if="report.locationId" variant="link" type="button" @click="openLocationSource(report.locationId, '/appointments')">{{ copy.openSource }}</BsButton>
            </BsInline>
            <BsGrid v-if="report.appointments.total" :columns="4">
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.appointments }}</BsText>
                <BsText as="strong" size="lg">{{ report.appointments.total }}</BsText>
              </BsBox>
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.completed }}</BsText>
                <BsText as="strong" size="lg">{{ report.appointments.completed }}</BsText>
              </BsBox>
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.cancelled }}</BsText>
                <BsText as="strong" size="lg">{{ report.appointments.cancelled }}</BsText>
              </BsBox>
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.noShow }}</BsText>
                <BsText as="strong" size="lg">{{ report.appointments.noShow }}</BsText>
              </BsBox>
            </BsGrid>
            <BsText v-else as="p" size="sm" tone="muted">{{ copy.noAppointments }}</BsText>
            <BsBox v-if="report.appointments.busiestTimes.length">
              <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.busiestTimes }}</BsText>
              <BsInline>
                <BsText v-for="time in report.appointments.busiestTimes" :key="time.hour" as="span" size="sm">{{ hourLabel(time.hour) }} · {{ time.count }}</BsText>
              </BsInline>
            </BsBox>
          </BsCard>
          <BsCard as="article" padding="md">
            <BsInline justify="between">
              <BsHeading :level="2">{{ copy.cashVariance }}</BsHeading>
              <BsButton v-if="report.locationId" variant="link" type="button" @click="openLocationSource(report.locationId, '/cash-shifts')">{{ copy.openSource }}</BsButton>
            </BsInline>
            <BsGrid :columns="2">
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.closedShifts }}</BsText>
                <BsText as="strong" size="lg">{{ report.cash.closedShifts }}</BsText>
              </BsBox>
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.cashVariance }}</BsText>
                <BsText as="strong" size="lg">{{ money(report.cash.variance) }}</BsText>
              </BsBox>
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.expected }}</BsText>
                <BsText as="strong">{{ money(report.cash.expected) }}</BsText>
              </BsBox>
              <BsBox>
                <BsText as="p" size="xs" tone="muted">{{ copy.counted }}</BsText>
                <BsText as="strong">{{ money(report.cash.counted) }}</BsText>
              </BsBox>
            </BsGrid>
          </BsCard>
        </BsGrid>
        <BsPanel padding="md">
          <BsBox>
            <BsHeading :level="2">{{ copy.outstanding }} · {{ money(report.outstanding.amount) }}</BsHeading>
          </BsBox>
          <BsBox v-if="report.outstanding.customers.length" scroll="x">
            <BsDataTable :value="report.outstanding.customers" data-key="customerId" :columns="[{ key: 'column0', header: (copy.customer) }, { key: 'column1', header: (copy.amount), align: 'end' }]">
              <template #cell-column0="{ row: customer }">
                <BsLink :to="`/customers/${customer.customerId}`">{{ customer.name }}</BsLink>
              </template>
              <template #cell-column1="{ row: customer }">{{ money(customer.amount) }}</template>
            </BsDataTable>
          </BsBox>
          <BsText v-else as="p" size="sm" tone="muted">{{ copy.noOutstanding }}</BsText>
        </BsPanel>
        <BsPanel padding="md">
          <BsBox>
            <BsHeading :level="2">{{ copy.staffPerformance }}</BsHeading>
          </BsBox>
          <BsBox v-if="report.staff.length" scroll="x">
            <BsDataTable :value="report.staff" data-key="membershipId" :columns="[{ key: 'column0', header: (copy.staffMember) }, { key: 'column1', header: (copy.sales), align: 'end' }, { key: 'column2', header: (copy.salesCount), align: 'end' }, { key: 'column3', header: (copy.serviceCount), align: 'end' }]">
              <template #cell-column0="{ row: member }">{{ member.name }}</template>
              <template #cell-column1="{ row: member }">{{ money(member.sales) }}</template>
              <template #cell-column2="{ row: member }">{{ member.saleCount }}</template>
              <template #cell-column3="{ row: member }">{{ whole(member.serviceCount) }}</template>
            </BsDataTable>
          </BsBox>
          <BsText v-else as="p" size="sm" tone="muted">{{ copy.noData }}</BsText>
        </BsPanel>
        <BsPanel padding="md">
          <BsBox>
            <BsHeading :level="2">{{ copy.branchComparison }}</BsHeading>
          </BsBox>
          <BsBox scroll="x">
            <BsDataTable :value="report.locations" data-key="locationId" :columns="[{ key: 'column0', header: (copy.location) }, { key: 'column1', header: (copy.sales), align: 'end' }, { key: 'column2', header: (copy.collections), align: 'end' }, { key: 'column3', header: (copy.expenses), hidden: !(report.canViewCosts), align: 'end' }, { key: 'column4', header: (copy.cashVariance), align: 'end' }]">
              <template #cell-column0="{ row: branch }">
                <BsButton variant="link" type="button" @click="openLocationSource(branch.locationId, '/sales')">{{ branch.name }}</BsButton>
              </template>
              <template #cell-column1="{ row: branch }">{{ money(branch.sales) }}</template>
              <template #cell-column2="{ row: branch }">{{ money(branch.collections) }}</template>
              <template #cell-column3="{ row: branch }">{{ money(branch.expenses) }}</template>
              <template #cell-column4="{ row: branch }">{{ money(branch.cashVariance) }}</template>
            </BsDataTable>
          </BsBox>
        </BsPanel>
      </template>
    </template>
  </BsStack>
</template>
