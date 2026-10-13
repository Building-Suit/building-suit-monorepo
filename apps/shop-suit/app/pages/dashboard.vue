<script setup lang="ts">
import type { BsDashboardCopy, BsDashboardFilters, BsDashboardSetupForm, BsDashboardView, BsDashboardTable, BsDashboardMetric, BsDashboardRow } from '@building-suit/ui/types/dashboardPresentation'

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
  expenses: 'مصروفات التشغيل', operatingBalance: 'المبيعات ناقص المصروفات', operatingBalanceHint: 'ملخص تشغيلي، وليس ربحًا محاسبيًا.', periodLabel: 'الفترة', accountingNotice: 'ده ملخص للشغل بس، مش حساب للربح المحاسبي ومش قائمة مالية.',
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
  expenses: 'Operating expenses', operatingBalance: 'Sales less operating expenses', operatingBalanceHint: 'Operational summary; not accounting profit', periodLabel: 'Period', accountingNotice: 'Operational summary only; this is not accounting profit or a financial statement.',
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

const { data: reportAccess, error: reportAccessError, pending: reportAccessPending, refresh: refreshReportAccess } = await useAsyncData(
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

const dashboardSetupForm = computed<BsDashboardSetupForm>({ get: () => ({ name: setupName.value, mode: setupMode.value }), set: value => { setupName.value = value.name; if (BUSINESS_MODES.includes(value.mode as BusinessMode)) setupMode.value = value.mode as BusinessMode } })
const dashboardFilters = computed<BsDashboardFilters>({ get: () => ({ period: reportPeriod.value, date: reportAnchor.value, location: reportLocationId.value, months: 6, custom: false, from: '', to: '' }), set: value => { if (periodOptions.includes(value.period as ReportPeriod)) reportPeriod.value = value.period as ReportPeriod; reportAnchor.value = value.date; if (value.location === 'all' || activeLocations.value.some(location => location.id === value.location)) reportLocationId.value = value.location } })
const dashboardLocations = computed(() => [{ value: 'all', label: copy.value.allLocations }, ...activeLocations.value.map(location => ({ value: location.id, label: location.name }))])
const dashboardPeriods = computed(() => periodOptions.map(value => ({ value, label: copy.value[value] })))
const dashboardCopy = computed<BsDashboardCopy>(() => ({ retry: copy.value.retry, cancel: ui('cancel'), create: copy.value.createShop, name: copy.value.shopName, mode: copy.value.businessMode, plan: copy.value.planStatus, filters: isArabic.value ? 'مرشحات التقارير' : 'Report filters', location: copy.value.location, date: copy.value.reportDate, range: copy.value.periodLabel, custom: '', from: '', to: '', source: copy.value.openSource, manage: '', start: '' }))
function reportLink(kind = 'sales') {
 const dates = reportQuery()
 const query = new URLSearchParams({ report: kind, location: reportLocationId.value, ...(dates.from ? { from: dates.from, to: dates.to! } : {}) })
 return `/reports?${query}`
}
const dashboardView = computed<BsDashboardView>(() => {
 const value = report.value
 const source = (path: string) => value?.locationId ? { location: value.locationId, path } : null
 const metric = (id: string, title: string, value: string, hint = '', to = '', intent: { location: string; path: string } | null = null): BsDashboardMetric => ({ id, title, value, hint, to, source: intent, changeLabel: '', tone: 'neutral' })
 const row = (id: string, name: string, cells: Record<string, string>, to = '', intent: { location: string; path: string } | null = null): BsDashboardRow => ({ id, name, cells, to, source: intent, status: '' })
 const table = (title: string, empty: string, rows: BsDashboardRow[], columns: BsDashboardTable['columns']): BsDashboardTable => ({ title, empty, rows, columns, loading: false, error: '', to: '', action: false })
 return {
  metricsNotice: value?.canViewCosts ? copy.value.accountingNotice : '',
  periodLabel: value ? `${formatDate(value.fromDate)} — ${formatDate(reportQuery().to)} · ${dashboardLocations.value.find(location => location.value === reportLocationId.value)?.label || ''}` : '',
  title: copy.value.title, subtitle: copy.value.subtitle, workspace: current.value?.name || '', role: isOwner.value ? copy.value.owner : copy.value.employee, notice: modeDisabledNotice.value ? copy.value.modeDisabled : '', available: Boolean(current.value), loading: reportAccessPending.value || reportPending.value, error: reportAccessError.value || reportError.value || highlightsError.value ? copy.value.loadFailed : '', denied: !reportAccessPending.value && !canViewReports.value ? copy.value.reportDenied : '', empty: '', emptyDescription: '', canStart: false, errorDescription: '',
  checklist: { visible: Boolean(isOwner.value && current.value?.business_mode !== 'product'), title: setupGuide.copy.title, description: setupGuide.copy.help, progress: setupGuide.copy.help, steps: setupGuide.steps, loading: false, error: null, empty: copy.value.noData },
  setup: { title: copy.value.setupTitle, description: copy.value.setupBody, trial: copy.value.fullTrial, modeHelp: copy.value.businessModeHelp, dirty: setupActionDirty.value, pending: setupPending.value, error: setupError.value },
  plan: { visible: isOwner.value, error: subscriptionError.value ? copy.value.loadFailed : '', name: currentPlan.value?.name || (subscription.value?.status === 'trialing' ? copy.value.fullTrial : copy.value.plan), status: subscription.value?.status || '', dateLabel: subscription.value?.trial_end_at ? copy.value.trialEnds : copy.value.periodEnds, date: formatDate(subscription.value?.trial_end_at || subscription.value?.current_period_end) },
  periodFilter: true, metricsLoading: false, metricsError: '', metricsTitle: '', metrics: value ? [
    metric('sales', copy.value.sales, money(value.sales), `${value.saleCount} ${copy.value.salesCount}`, source('/sales') ? '' : reportLink('sales'), source('/sales')),
    metric('collections', copy.value.collections, money(value.paymentsIn), `${copy.value.averageTicket}: ${money(value.averageTicket)}`, reportLink('collections')),
    metric('orders', copy.value.salesCount, whole(value.saleCount), copy.value.sales, source('/sales') ? '' : reportLink('sales'), source('/sales')),
    metric('customers', copy.value.outstanding, whole(value.outstanding.customerCount), money(value.outstanding.amount), reportLink('receivables')),
  ] : [],
  highlightsLoading: highlightsPending.value, highlights: [
    ...(value?.canViewCosts ? [metric('expenses', copy.value.expenses, money(value.expenses.amount), `${value.expenses.count} ${copy.value.openSource}`, reportLink('expenses')), metric('balance', copy.value.operatingBalance, money(value.expenses.operatingBalance), copy.value.operatingBalanceHint)] : []),
    ...(reportHighlights.value ? [metric('payable', copy.value.supplierPayable, money(reportHighlights.value.payable), '', reportLink('suppliers')), metric('stock', copy.value.lowStock, String(reportHighlights.value.lowStockCount), '', reportLink('inventory')), metric('inventory', copy.value.inventoryValue, money(reportHighlights.value.inventoryValue), '', reportLink('inventory')), metric('margin', copy.value.fifoMargin, money(reportHighlights.value.margin), '', reportLink('margin'))] : []),
  ],
  reportLink: { visible: canViewReports.value, title: copy.value.fullReports, description: copy.value.fullReportsBody, to: reportLink() }, chart: { visible: Boolean(value), loading: false, error: '', title: copy.value.branchComparison, pointLabel: copy.value.location, tableLabel: copy.value.openSource, empty: copy.value.noData, points: (value?.locations || []).map(branch => ({ id: branch.locationId, label: branch.name, values: { sales: branch.sales, collections: branch.collections }, formattedValues: { sales: money(branch.sales), collections: money(branch.collections) } })), series: [{ id: 'sales', label: copy.value.sales, tone: 'neutral' }, { id: 'collections', label: copy.value.collections, tone: 'warning' }], tableSeries: [{ id: 'sales', label: copy.value.sales }, { id: 'collections', label: copy.value.collections }] }, cashPosition: null, commitments: null, recent: null,
  salesMix: { visible: Boolean(value), title: copy.value.salesMix, empty: copy.value.noData, action: { label: copy.value.openSource, to: reportLink('sales') }, rows: (value?.salesMix || []).map(item => ({ id: item.type, name: copy.value[item.type], hint: `${copy.value.quantity}: ${whole(item.quantity)}`, amount: money(item.amount), value: item.amount })) },
  paymentMix: { visible: Boolean(value), title: copy.value.paymentMix, empty: copy.value.noData, action: { label: copy.value.openSource, to: reportLink('collections') }, rows: (value?.paymentMix || []).map(item => ({ id: item.method, name: methodLabel(item.method), hint: `${copy.value.collected} ${money(item.collected)} · ${copy.value.refunded} ${money(item.refunded)}`, amount: money(item.net), value: item.net })) },
  appointments: { visible: Boolean(value), title: copy.value.appointments, empty: copy.value.noAppointments, source: source('/appointments'), metrics: value?.appointments.total ? [{ title: copy.value.appointments, value: String(value.appointments.total) }, { title: copy.value.completed, value: String(value.appointments.completed) }, { title: copy.value.cancelled, value: String(value.appointments.cancelled) }, { title: copy.value.noShow, value: String(value.appointments.noShow) }] : [], busiestTitle: copy.value.busiestTimes, busiest: (value?.appointments.busiestTimes || []).map(time => ({ id: String(time.hour), label: `${hourLabel(time.hour)} · ${time.count}` })) },
  cash: { visible: Boolean(value), title: copy.value.cashVariance, source: source('/cash-shifts'), metrics: value ? [{ title: copy.value.closedShifts, value: String(value.cash.closedShifts) }, { title: copy.value.cashVariance, value: money(value.cash.variance) }, { title: copy.value.expected, value: money(value.cash.expected) }, { title: copy.value.counted, value: money(value.cash.counted) }] : [] },
  customers: value ? table(`${copy.value.outstanding} · ${money(value.outstanding.amount)}`, copy.value.noOutstanding, value.outstanding.customers.map(customer => row(customer.customerId, customer.name, { amount: money(customer.amount) }, `/customers/${customer.customerId}`)), [{ key: 'name', header: copy.value.customer }, { key: 'amount', header: copy.value.amount, align: 'end' }]) : null,
  staff: value ? table(copy.value.staffPerformance, copy.value.noData, value.staff.map(member => row(member.membershipId, member.name, { sales: money(member.sales), saleCount: String(member.saleCount), serviceCount: whole(member.serviceCount) })), [{ key: 'name', header: copy.value.staffMember }, { key: 'sales', header: copy.value.sales, align: 'end' }, { key: 'saleCount', header: copy.value.salesCount, align: 'end' }, { key: 'serviceCount', header: copy.value.serviceCount, align: 'end' }]) : null,
  locations: value ? table(copy.value.branchComparison, copy.value.noData, value.locations.map(branch => row(branch.locationId, branch.name, { sales: money(branch.sales), collections: money(branch.collections), expenses: money(branch.expenses), variance: money(branch.cashVariance) }, '', { location: branch.locationId, path: '/sales' })), [{ key: 'name', header: copy.value.location }, { key: 'sales', header: copy.value.sales, align: 'end' }, { key: 'collections', header: copy.value.collections, align: 'end' }, { key: 'expenses', header: copy.value.expenses, hidden: !value.canViewCosts, align: 'end' }, { key: 'variance', header: copy.value.cashVariance, align: 'end' }]) : null,
 }
})
function retryDashboard() { return Promise.all([refreshReportAccess(), refreshReport(), refreshHighlights()]) }
</script>
<template>
  <BsDashboardPage v-model:filters="dashboardFilters" v-model:setup-form="dashboardSetupForm" v-model:setup-open="setupActionOpen" variant="shop" :copy="dashboardCopy" :view="dashboardView" :locations="dashboardLocations" :periods="dashboardPeriods" :month-options="[]" :modes="modeOptions" :constraints="{ nameMinimum: 2, nameMaximum: 120 }" @retry="retryDashboard" @retry-plan="refreshSubscription()" @source="openLocationSource" @setup="setupAction.edit()" @create="createShop"/>
</template>
