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
const { data: plans, isLoading: plansPending, error: plansError, refresh: refreshPlans } = usePlans()
const isArabic = computed(() => locale.value === 'ar')
const periodOptions: ReportPeriod[] = ['day', 'week', 'month']
const selectablePlans = computed(() => plans.value?.filter(plan => !plan.is_coming_soon && plan.trial_days > 0) ?? [])
const selectedPlan = ref('')
const setupName = ref('')
const setupMode = ref<BusinessMode>('mixed')
const setupPending = ref(false)
const setupError = ref('')
const reportPeriod = ref<ReportPeriod>('day')
const reportAnchor = ref(localToday())
const reportLocationId = ref<string>('all')

watchEffect(() => {
  if (!selectablePlans.value.some(plan => plan.slug === selectedPlan.value)) {
    selectedPlan.value = selectablePlans.value[0]?.slug ?? ''
  }
})

const copy = computed(() => isArabic.value ? {
  title: 'لوحة التشغيل', subtitle: 'مبيعات وتحصيلات ومواعيد وأداء الفروع من سجلات المصدر.',
  setupTitle: 'أنشئ متجرك الأول', setupBody: 'ابدأ تجربة الخطة التي تختارها. ثم أعدّ الفروع والفريق والخدمات وساعات العمل.',
  shopName: 'اسم المتجر', plan: 'خطة التجربة', createShop: 'إنشاء المتجر', creating: 'جاري الإنشاء...',
  businessMode: 'طريقة تشغيل النشاط', businessModeHelp: 'تتحكم في ظهور مسارات المنتجات أو الخدمات ولا تغيّر خطة اشتراكك.',
  productMode: 'منتجات ومخزون', productModeBody: 'للبيع والمشتريات والموردين وإدارة المخزون.',
  serviceMode: 'خدمات فقط', serviceModeBody: 'لتقديم الخدمات دون الحاجة إلى سجلات مخزون.',
  mixedMode: 'منتجات وخدمات', mixedModeBody: 'لإظهار مسارات المنتجات والخدمات معًا.',
  loadingPlans: 'جاري تحميل الخطط...', noPlans: 'لا توجد خطط متاحة للتجربة الآن.',
  planStatus: 'حالة الخطة', trialEnds: 'تنتهي التجربة', periodEnds: 'نهاية الفترة', owner: 'مالك', employee: 'موظف',
  client: 'العميل', amount: 'الإجمالي', date: 'التاريخ',
  loadFailed: 'تعذّر تحميل البيانات.', retry: 'إعادة المحاولة',
  noShopAfterCreate: 'تم إنشاء المتجر لكن تعذّر تحميله. حدّث الصفحة.',
  setupFailed: 'تعذّر إنشاء المتجر.', invalidName: 'اكتب اسمًا للمتجر من حرفين إلى 120 حرفًا.',
  planUnavailable: 'هذه الخطة غير متاحة للتجربة الآن.', profileInactive: 'هذا الحساب غير نشط.',
  subscriptionReview: 'الاشتراك الحالي يحتاج مراجعة قبل إنشاء متجر.',
  modeDisabled: 'هذا المسار مخفي حسب طريقة تشغيل النشاط الحالية. يمكنك تغييره من إعدادات النشاط؛ وتظل البيانات السابقة محفوظة.',
  day: 'يوم', week: 'أسبوع', month: 'شهر', allLocations: 'كل الفروع', location: 'الفرع', reportDate: 'التاريخ',
  loadingReport: 'جاري تحميل تقرير التشغيل…', reportDenied: 'اطلب من المالك صلاحية التقارير. استخدم التقويم أو نقطة البيع لعملك اليومي.',
  sales: 'المبيعات', salesCount: 'عدد البيعات', averageTicket: 'متوسط الفاتورة', collections: 'التحصيلات',
  expenses: 'مصروفات التشغيل', operatingBalance: 'المبيعات ناقص المصروفات', accountingNotice: 'ملخص تشغيلي فقط؛ ليس ربحًا محاسبيًا ولا قائمة مالية.',
  salesMix: 'مزيج المبيعات', product: 'منتجات', service: 'خدمات', quantity: 'الكمية', paymentMix: 'مزيج طرق الدفع', collected: 'محصل', refunded: 'مرتجع', net: 'صافي التحصيل',
  outstanding: 'عملاء عليهم مستحقات', customer: 'العميل', noOutstanding: 'لا توجد مستحقات عملاء.',
  appointments: 'المواعيد', completed: 'مكتمل', cancelled: 'ملغي', noShow: 'لم يحضر', busiestTimes: 'أكثر الأوقات ازدحامًا', noAppointments: 'لا توجد بيانات مواعيد في الفترة.',
  cashVariance: 'فرق الخزنة', closedShifts: 'ورديات مغلقة', expected: 'متوقع', counted: 'فعلي', staffPerformance: 'أداء الفريق', staffMember: 'الموظف', serviceCount: 'عدد الخدمات',
  branchComparison: 'مقارنة الفروع', openSource: 'فتح السجلات', noData: 'لا توجد بيانات في هذه الفترة.',
  fullReports: 'كل التقارير التشغيلية', fullReportsBody: 'المبيعات والتحصيلات ومستحقات الموردين والمصروفات والمخزون وهامش FIFO والنشاط مع تصدير CSV مطابق.',
  supplierPayable: 'مستحقات الموردين', lowStock: 'منتجات منخفضة المخزون', inventoryValue: 'قيمة المخزون', fifoMargin: 'هامش FIFO المتصالح',
} : {
  title: 'Operating dashboard', subtitle: 'Sales, collections, appointments, and branch performance reconciled from source records.',
  setupTitle: 'Create your first shop', setupBody: 'Start a trial of your chosen plan. Then set up your locations, staff, services, and working hours.',
  shopName: 'Shop name', plan: 'Trial plan', createShop: 'Create shop', creating: 'Creating...',
  businessMode: 'Business operation mode', businessModeHelp: 'Controls product and service workflow visibility without changing your subscription plan.',
  productMode: 'Products and stock', productModeBody: 'For sales, purchasing, suppliers, and inventory operations.',
  serviceMode: 'Services only', serviceModeBody: 'For delivering services without requiring stock records.',
  mixedMode: 'Products and services', mixedModeBody: 'Shows both product and service workflows.',
  loadingPlans: 'Loading plans...', noPlans: 'No plans are currently available for a trial.',
  planStatus: 'Plan status', trialEnds: 'Trial ends', periodEnds: 'Period ends', owner: 'Owner', employee: 'Employee',
  client: 'Client', amount: 'Total', date: 'Date',
  loadFailed: 'Could not load this data.', retry: 'Retry',
  noShopAfterCreate: 'The shop was created but could not be loaded. Refresh this page.',
  setupFailed: 'Could not create the shop.', invalidName: 'Enter a shop name between 2 and 120 characters.',
  planUnavailable: 'This plan is not available for a trial right now.', profileInactive: 'This account is inactive.',
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
  if (message === 'PLAN_UNAVAILABLE') return copy.value.planUnavailable
  if (message === 'PROFILE_INACTIVE') return copy.value.profileInactive
  if (message === 'SUBSCRIPTION_REQUIRES_REVIEW') return copy.value.subscriptionReview
  return message || copy.value.setupFailed
}

async function createShop() {
  if (setupPending.value || current.value) return
  setupError.value = ''
  const name = setupName.value.trim()
  if (name.length < 2 || name.length > 120) { setupError.value = copy.value.invalidName; return }
  if (!selectablePlans.value.some(plan => plan.slug === selectedPlan.value)) {
    setupError.value = copy.value.planUnavailable
    return
  }
  setupPending.value = true
  try {
    const { error } = await shopRpc.rpc('create_owner_shop', {
      p_shop_name: name,
      p_plan_slug: selectedPlan.value,
      p_business_mode: setupMode.value,
    })
    if (error) throw error
    await reload()
    if (!currentId.value) throw new Error(copy.value.noShopAfterCreate)
    await Promise.all([refreshSubscription(), refreshReport()])
  } catch (error) {
    setupError.value = setupErrorText(error instanceof Error ? error.message : undefined)
  } finally {
    setupPending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <p v-if="modeDisabledNotice" role="status" class="rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm text-[var(--bs-status-warning)]">{{ copy.modeDisabled }}</p>
    <section v-if="!current" class="mx-auto max-w-3xl pt-6 lg:pt-12">
      <div class="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div class="border-b border-border bg-[var(--bs-deep-structure-navy)] p-6 text-white sm:p-8">
          <div class="mb-5 grid size-12 place-items-center rounded-2xl border border-[var(--bs-accent)]/30 bg-[var(--bs-primary)]"><AppIcon name="store" class="size-6 text-[var(--bs-highlight-gold)]" /></div>
          <h1 class="text-2xl font-extrabold sm:text-3xl">{{ copy.setupTitle }}</h1>
          <p class="mt-2 max-w-xl text-sm leading-6 text-white/60">{{ copy.setupBody }}</p>
        </div>
        <BsForm class="space-y-6 p-6 sm:p-8" :pending="setupPending" :error="setupError" @submit="createShop">
          <div class="space-y-2"><label for="shop-name" class="text-sm font-bold">{{ copy.shopName }}</label><input id="shop-name" v-model="setupName" type="text" minlength="2" maxlength="120" required class="ls-input"></div>
          <fieldset class="space-y-3">
            <legend class="text-sm font-bold">{{ copy.businessMode }}</legend>
            <p class="text-sm text-muted-foreground">{{ copy.businessModeHelp }}</p>
            <div class="grid gap-3 sm:grid-cols-3">
              <label v-for="mode in modeOptions" :key="mode.value" class="cursor-pointer rounded-2xl border p-4" :class="setupMode === mode.value ? 'border-[var(--bs-accent)] ring-2 ring-[var(--bs-accent)]/15' : 'border-border'">
                <input v-model="setupMode" type="radio" name="business-mode" :value="mode.value" class="me-2">
                <span class="font-extrabold">{{ mode.label }}</span>
                <span class="mt-2 block text-xs leading-5 text-muted-foreground">{{ mode.body }}</span>
              </label>
            </div>
          </fieldset>
          <fieldset class="space-y-3">
            <legend class="text-sm font-bold">{{ copy.plan }}</legend>
            <p v-if="plansPending" class="text-sm text-muted-foreground">{{ copy.loadingPlans }}</p>
            <p v-else-if="plansError" role="alert" class="text-sm text-[var(--bs-status-error)]">{{ copy.loadFailed }} <button type="button" class="underline" @click="refreshPlans()">{{ copy.retry }}</button></p>
            <p v-else-if="!selectablePlans.length" class="text-sm text-muted-foreground">{{ copy.noPlans }}</p>
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <label v-for="plan in selectablePlans" :key="plan.id" class="cursor-pointer rounded-2xl border p-4 transition" :class="selectedPlan === plan.slug ? 'border-[var(--bs-accent)] bg-[var(--bs-accent)]/5 ring-2 ring-[var(--bs-accent)]/15' : 'border-border bg-background hover:border-muted-foreground/50'">
                <input v-model="selectedPlan" type="radio" name="plan" :value="plan.slug" class="me-2">
                <div class="flex items-start justify-between gap-3"><div><p class="font-extrabold">{{ plan.name }}</p><p class="mt-1 text-xs text-muted-foreground">{{ plan.trial_days }} {{ isArabic ? 'يوم تجربة' : 'day trial' }}</p></div><p class="text-sm font-extrabold text-[var(--bs-link)]">{{ money(plan.price_amount, plan.currency) }}</p></div>
              </label>
            </div>
          </fieldset>
          <BsButton type="submit" variant="primary" class="w-full" :pending="setupPending" :disabled="!selectablePlans.length">{{ setupPending ? copy.creating : copy.createShop }}</BsButton>
        </BsForm>
      </div>
    </section>

    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div><p class="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--bs-link)]">{{ current.name }}</p><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
        <span class="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold">{{ isOwner ? copy.owner : copy.employee }}</span>
      </header>

      <BarberSetupGuide />

      <section v-if="isOwner" class="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div class="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <h2 class="font-extrabold">{{ copy.planStatus }}</h2>
          <p v-if="subscriptionError" role="alert" class="text-[var(--bs-status-error)]">{{ copy.loadFailed }} <button type="button" class="underline" @click="refreshSubscription()">{{ copy.retry }}</button></p>
          <template v-else-if="subscription"><p><span class="text-muted-foreground">{{ currentPlan?.name || copy.plan }}:</span> <strong>{{ subscription.status }}</strong></p><p v-if="subscription.trial_end_at"><span class="text-muted-foreground">{{ copy.trialEnds }}:</span> {{ formatDate(subscription.trial_end_at) }}</p><p v-else-if="subscription.current_period_end"><span class="text-muted-foreground">{{ copy.periodEnds }}:</span> {{ formatDate(subscription.current_period_end) }}</p></template>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-card p-4 sm:p-5" :aria-label="isArabic ? 'مرشحات التقارير' : 'Report filters'">
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="text-xs font-bold text-muted-foreground">{{ copy.location }}
            <select v-model="reportLocationId" class="ls-select mt-1 w-full"><option value="all">{{ copy.allLocations }}</option><option v-for="location in activeLocations" :key="location.id" :value="location.id">{{ location.name }}</option></select>
          </label>
          <label class="text-xs font-bold text-muted-foreground">{{ copy.reportDate }}<input v-model="reportAnchor" type="date" class="ls-input mt-1 w-full"></label>
          <fieldset><legend class="text-xs font-bold text-muted-foreground">{{ copy.date }}</legend><div class="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"><button v-for="value in periodOptions" :key="value" type="button" class="min-h-11 rounded-lg px-2 text-sm font-bold" :class="reportPeriod === value ? 'bg-card shadow-sm' : 'text-muted-foreground'" :aria-pressed="reportPeriod === value" @click="reportPeriod = value">{{ copy[value] }}</button></div></fieldset>
        </div>
      </section>

      <NuxtLink v-if="canViewReports" to="/reports" class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--bs-accent)]/40 bg-[var(--bs-accent)]/5 p-5 transition hover:border-[var(--bs-accent)]">
        <span><strong class="block">{{ copy.fullReports }}</strong><span class="mt-1 block text-sm text-muted-foreground">{{ copy.fullReportsBody }}</span></span><span class="font-bold text-[var(--bs-link)]">{{ copy.openSource }}</span>
      </NuxtLink>

      <p v-if="reportAccessError || reportError || highlightsError" role="alert" class="rounded-xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-4 text-sm text-[var(--bs-status-error)]">{{ copy.loadFailed }} <button type="button" class="min-h-11 min-w-11 underline" @click="refreshReportAccess(); refreshReport(); refreshHighlights()">{{ copy.retry }}</button></p>
      <p v-else-if="reportAccessPending" role="status">{{ copy.loadingReport }}</p>
      <p v-else-if="!canViewReports" role="status" class="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{{ copy.reportDenied }}</p>
      <div v-else-if="reportPending" class="space-y-4" aria-live="polite"><p class="text-sm text-muted-foreground">{{ copy.loadingReport }}</p><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div v-for="index in 8" :key="index" class="h-28 animate-pulse rounded-2xl bg-muted" /></div></div>

      <template v-else-if="report">
        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <button v-if="report.locationId" type="button" class="rounded-2xl border border-border bg-card p-5 text-start transition hover:border-[var(--bs-accent)]" @click="openLocationSource(report.locationId, '/sales')"><p class="text-sm text-muted-foreground">{{ copy.sales }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(report.sales) }}</p><p class="mt-1 text-xs text-[var(--bs-link)]">{{ report.saleCount }} {{ copy.salesCount }}</p></button>
          <article v-else class="rounded-2xl border border-border bg-card p-5"><p class="text-sm text-muted-foreground">{{ copy.sales }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(report.sales) }}</p><p class="mt-1 text-xs text-muted-foreground">{{ report.saleCount }} {{ copy.salesCount }}</p></article>
          <article class="rounded-2xl border border-border bg-card p-5"><p class="text-sm text-muted-foreground">{{ copy.collections }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(report.paymentsIn) }}</p><p class="mt-1 text-xs text-muted-foreground">{{ copy.averageTicket }}: {{ money(report.averageTicket) }}</p></article>
          <NuxtLink v-if="report.canViewCosts" to="/expenses" class="rounded-2xl border border-border bg-card p-5 transition hover:border-[var(--bs-accent)]"><p class="text-sm text-muted-foreground">{{ copy.expenses }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(report.expenses.amount) }}</p><p class="mt-1 text-xs text-[var(--bs-link)]">{{ report.expenses.count }} {{ copy.openSource }}</p></NuxtLink>
          <article v-if="report.canViewCosts" class="rounded-2xl border border-border bg-card p-5"><p class="text-sm text-muted-foreground">{{ copy.operatingBalance }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(report.expenses.operatingBalance) }}</p><p class="mt-1 text-xs leading-5 text-muted-foreground">{{ copy.accountingNotice }}</p></article>
        </section>

        <section v-if="reportHighlights || highlightsPending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <template v-if="reportHighlights"><NuxtLink to="/reports?report=suppliers" class="rounded-2xl border border-border bg-card p-5"><p class="text-sm text-muted-foreground">{{ copy.supplierPayable }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(reportHighlights.payable) }}</p></NuxtLink><NuxtLink to="/reports?report=inventory" class="rounded-2xl border border-border bg-card p-5"><p class="text-sm text-muted-foreground">{{ copy.lowStock }}</p><p class="mt-2 text-2xl font-extrabold">{{ reportHighlights.lowStockCount }}</p></NuxtLink><NuxtLink to="/reports?report=inventory" class="rounded-2xl border border-border bg-card p-5"><p class="text-sm text-muted-foreground">{{ copy.inventoryValue }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(reportHighlights.inventoryValue) }}</p></NuxtLink><NuxtLink to="/reports?report=margin" class="rounded-2xl border border-border bg-card p-5"><p class="text-sm text-muted-foreground">{{ copy.fifoMargin }}</p><p class="mt-2 text-2xl font-extrabold">{{ money(reportHighlights.margin) }}</p></NuxtLink></template>
          <template v-else><div v-for="index in 4" :key="index" class="h-28 animate-pulse rounded-2xl bg-muted" /></template>
        </section>

        <section class="grid gap-4 lg:grid-cols-2">
          <article class="rounded-2xl border border-border bg-card p-5"><h2 class="font-extrabold">{{ copy.salesMix }}</h2><div v-if="report.salesMix.length" class="mt-4 space-y-3"><div v-for="item in report.salesMix" :key="item.type" class="flex items-center justify-between gap-4 rounded-xl bg-muted/60 p-3"><div><p class="font-bold">{{ copy[item.type] }}</p><p class="text-xs text-muted-foreground">{{ copy.quantity }}: {{ whole(item.quantity) }}</p></div><strong>{{ money(item.amount) }}</strong></div></div><p v-else class="mt-4 text-sm text-muted-foreground">{{ copy.noData }}</p></article>
          <article class="rounded-2xl border border-border bg-card p-5"><h2 class="font-extrabold">{{ copy.paymentMix }}</h2><div v-if="report.paymentMix.length" class="mt-4 space-y-3"><div v-for="item in report.paymentMix" :key="item.method" class="rounded-xl bg-muted/60 p-3"><div class="flex justify-between gap-4"><strong>{{ methodLabel(item.method) }}</strong><strong>{{ money(item.net) }}</strong></div><p class="mt-1 text-xs text-muted-foreground">{{ copy.collected }} {{ money(item.collected) }} · {{ copy.refunded }} {{ money(item.refunded) }}</p></div></div><p v-else class="mt-4 text-sm text-muted-foreground">{{ copy.noData }}</p></article>
        </section>

        <section class="grid gap-4 lg:grid-cols-2">
          <article class="rounded-2xl border border-border bg-card p-5"><div class="flex items-center justify-between gap-3"><h2 class="font-extrabold">{{ copy.appointments }}</h2><button v-if="report.locationId" type="button" class="text-sm font-bold text-[var(--bs-link)]" @click="openLocationSource(report.locationId, '/appointments')">{{ copy.openSource }}</button></div><div v-if="report.appointments.total" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.appointments }}</p><strong class="text-xl">{{ report.appointments.total }}</strong></div><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.completed }}</p><strong class="text-xl">{{ report.appointments.completed }}</strong></div><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.cancelled }}</p><strong class="text-xl">{{ report.appointments.cancelled }}</strong></div><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.noShow }}</p><strong class="text-xl">{{ report.appointments.noShow }}</strong></div></div><p v-else class="mt-4 text-sm text-muted-foreground">{{ copy.noAppointments }}</p><div v-if="report.appointments.busiestTimes.length" class="mt-4"><p class="text-xs font-bold text-muted-foreground">{{ copy.busiestTimes }}</p><div class="mt-2 flex flex-wrap gap-2"><span v-for="time in report.appointments.busiestTimes" :key="time.hour" class="rounded-full border border-border px-3 py-1 text-sm">{{ hourLabel(time.hour) }} · {{ time.count }}</span></div></div></article>
          <article class="rounded-2xl border border-border bg-card p-5"><div class="flex items-center justify-between gap-3"><h2 class="font-extrabold">{{ copy.cashVariance }}</h2><button v-if="report.locationId" type="button" class="text-sm font-bold text-[var(--bs-link)]" @click="openLocationSource(report.locationId, '/cash-shifts')">{{ copy.openSource }}</button></div><div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.closedShifts }}</p><strong class="text-xl">{{ report.cash.closedShifts }}</strong></div><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.cashVariance }}</p><strong class="text-xl" :class="Number(report.cash.variance) ? 'text-[var(--bs-status-warning)]' : ''">{{ money(report.cash.variance) }}</strong></div><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.expected }}</p><strong>{{ money(report.cash.expected) }}</strong></div><div class="rounded-xl bg-muted p-3"><p class="text-xs text-muted-foreground">{{ copy.counted }}</p><strong>{{ money(report.cash.counted) }}</strong></div></div></article>
        </section>

        <section class="overflow-hidden rounded-2xl border border-border bg-card"><div class="border-b border-border px-5 py-4"><h2 class="font-extrabold">{{ copy.outstanding }} · {{ money(report.outstanding.amount) }}</h2></div><div v-if="report.outstanding.customers.length" class="overflow-x-auto"><BsDataTable :value="report.outstanding.customers" data-key="customerId"><Column header-class="px-5 py-3 text-start" body-class="px-5 py-4 font-semibold"><template #header>{{ copy.customer }}</template><template #body="{ data: customer }"><NuxtLink :to="`/customers/${customer.customerId}`" class="text-[var(--bs-link)] hover:underline">{{ customer.name }}</NuxtLink></template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end font-bold"><template #header>{{ copy.amount }}</template><template #body="{ data: customer }">{{ money(customer.amount) }}</template></Column></BsDataTable></div><p v-else class="p-6 text-sm text-muted-foreground">{{ copy.noOutstanding }}</p></section>

        <section class="overflow-hidden rounded-2xl border border-border bg-card"><div class="border-b border-border px-5 py-4"><h2 class="font-extrabold">{{ copy.staffPerformance }}</h2></div><div v-if="report.staff.length" class="overflow-x-auto"><BsDataTable :value="report.staff" data-key="membershipId"><Column header-class="px-5 py-3 text-start" body-class="px-5 py-4 font-semibold"><template #header>{{ copy.staffMember }}</template><template #body="{ data: member }">{{ member.name }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ copy.sales }}</template><template #body="{ data: member }">{{ money(member.sales) }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ copy.salesCount }}</template><template #body="{ data: member }">{{ member.saleCount }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ copy.serviceCount }}</template><template #body="{ data: member }">{{ whole(member.serviceCount) }}</template></Column></BsDataTable></div><p v-else class="p-6 text-sm text-muted-foreground">{{ copy.noData }}</p></section>

        <section class="overflow-hidden rounded-2xl border border-border bg-card"><div class="border-b border-border px-5 py-4"><h2 class="font-extrabold">{{ copy.branchComparison }}</h2></div><div class="overflow-x-auto"><BsDataTable :value="report.locations" data-key="locationId"><Column header-class="px-5 py-3 text-start" body-class="px-5 py-4 font-semibold"><template #header>{{ copy.location }}</template><template #body="{ data: branch }"><button type="button" class="text-[var(--bs-link)] hover:underline" @click="openLocationSource(branch.locationId, '/sales')">{{ branch.name }}</button></template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ copy.sales }}</template><template #body="{ data: branch }">{{ money(branch.sales) }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ copy.collections }}</template><template #body="{ data: branch }">{{ money(branch.collections) }}</template></Column><Column v-if="report.canViewCosts" header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ copy.expenses }}</template><template #body="{ data: branch }">{{ money(branch.expenses) }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ copy.cashVariance }}</template><template #body="{ data: branch }">{{ money(branch.cashVariance) }}</template></Column></BsDataTable></div></section>
      </template>
    </template>
  </div>
</template>
