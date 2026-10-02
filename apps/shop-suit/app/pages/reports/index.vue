<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { OperationalReportKind, OperationalReportPage, OperationalReportRow } from '~/types/reporting'
import { downloadCsv, encodeCsv } from '~/utils/catalogImport'

definePageMeta({ layout: 'default', middleware: ['auth'] })

type ColumnFormat = 'text' | 'money' | 'number' | 'date' | 'percent' | 'boolean'
type ReportColumn = { key: string; label: string | undefined; format: ColumnFormat; primary?: boolean }

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const route = useRoute()
const { locale } = useI18n()
const { current, currentId, activeLocations } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const reportKinds: OperationalReportKind[] = ['sales', 'collections', 'receivables', 'suppliers', 'expenses', 'inventory', 'margin', 'activity']
const requestedReport = typeof route.query.report === 'string' && reportKinds.includes(route.query.report as OperationalReportKind)
  ? route.query.report as OperationalReportKind : 'sales'
const report = ref<OperationalReportKind>(requestedReport)
const locationId = ref('all')
const fromDate = ref('')
const toDate = ref('')
const page = ref(1)
const pageSize = 20
const exporting = ref(false)
const exportError = ref('')
const captureScope = useShopTaskScope()
let exportVersion = 0
watch([report, locationId, fromDate, toDate], () => { exportVersion++ }, { flush: 'sync' })

const copy = computed(() => isArabic.value ? {
  title: 'التقارير التشغيلية', subtitle: 'شوف أرقام الشغل من السجلات الأصلية، وحدد الفروع والتواريخ، وصدّر نفس النتايج.',
  operational: 'دي تقارير للشغل بس، مش قائمة دخل ولا ميزانية ولا دفتر أستاذ ولا محاسبة بالقيد المزدوج.',
  sales: 'المبيعات', collections: 'التحصيلات والمدفوعات', receivables: 'مبالغ مستحقة من العملاء', suppliers: 'المشتريات ومستحقات الموردين',
  expenses: 'المصروفات', inventory: 'المخزون والتقييم', margin: 'هامش FIFO (الأقدم أولًا)', activity: 'آخر نشاط',
  location: 'الفرع', allLocations: 'كل الفروع', from: 'من', to: 'إلى', fullHistory: 'اترك التاريخ فارغًا لعرض كل السجل.',
  export: 'تصدير CSV', exporting: 'بنصدّر…', exportFailed: 'مقدرناش نصدّر التقرير.',
  loading: 'بنحمّل التقرير…', failed: 'مقدرناش نحمّل التقرير.', retry: 'حاول تاني', denied: 'معندكش صلاحية تشوف التقارير.',
  costDenied: 'محتاج صلاحية عرض التكلفة والربح عشان تشوف التقرير ده.', empty: 'مفيش نتايج للاختيارات دي.',
  previous: 'السابق', next: 'التالي', page: 'صفحة', of: 'من', records: 'سجل', open: 'فتح المصدر',
  true: 'نعم', false: 'لا', fifoNotice: 'الهامش بيظهر بس للمنتجات اللي كمياتها مطابقة تمامًا لحركات تكلفة FIFO (الأقدم يتباع الأول). الخدمات والبنود غير المتطابقة مش بتتحسب.',
} : {
  title: 'Operational reports', subtitle: 'Full-history source-record reports with location/date filters and result-parity exports.',
  operational: 'These are operational reports—not a P&L, balance sheet, general ledger, journal, or double-entry accounting system.',
  sales: 'Sales', collections: 'Collections & payments', receivables: 'Customer outstanding', suppliers: 'Purchases & supplier payables',
  expenses: 'Expenses', inventory: 'Stock & valuation', margin: 'Reconciled FIFO margin', activity: 'Recent activity',
  location: 'Location', allLocations: 'All locations', from: 'From', to: 'To', fullHistory: 'Leave dates blank for full history.',
  export: 'Export CSV', exporting: 'Exporting…', exportFailed: 'Could not export this report.',
  loading: 'Loading report…', failed: 'Could not load this report.', retry: 'Retry', denied: 'You do not have report access.',
  costDenied: 'Cost and profit permission is required for this report.', empty: 'No results match these filters.',
  previous: 'Previous', next: 'Next', page: 'Page', of: 'of', records: 'records', open: 'Open source',
  true: 'Yes', false: 'No', fifoNotice: 'Margin appears only for product lines whose sold quantity exactly reconciles to FIFO cost movements. Services and unreconciled lines are excluded.',
})

const reportOptions = computed<Array<{ value: OperationalReportKind; label: string }>>(() => [
  { value: 'sales', label: copy.value.sales }, { value: 'collections', label: copy.value.collections },
  { value: 'receivables', label: copy.value.receivables },
  { value: 'suppliers', label: copy.value.suppliers }, { value: 'expenses', label: copy.value.expenses },
  { value: 'inventory', label: copy.value.inventory }, { value: 'margin', label: copy.value.margin },
  { value: 'activity', label: copy.value.activity },
])
const costReports: OperationalReportKind[] = ['suppliers', 'expenses', 'inventory', 'margin']

const { data: access, pending: accessPending, error: accessError, refresh: refreshAccess } = useAsyncData(
  () => `shop-data:report-access:${currentId.value ?? 'none'}`,
  async () => {
    if (!currentId.value) return { 'reports.view': false, 'reports.cost_profit.view': false }
    const { data, error } = await rpc.rpc('shop_permission_access', {
      p_shop_id: currentId.value,
      p_permission_keys: ['reports.view', 'reports.cost_profit.view'],
    })
    if (error) throw error
    return data
  }, { watch: [currentId], default: () => ({ 'reports.view': false, 'reports.cost_profit.view': false }) },
)
const canView = computed(() => access.value?.['reports.view'] === true)
const canViewCosts = computed(() => access.value?.['reports.cost_profit.view'] === true)
const costDenied = computed(() => costReports.includes(report.value) && !canViewCosts.value)

function emptyReport(): OperationalReportPage {
  return { report: report.value, locationId: null, fromDate: null, toDate: null, timezone: 'Africa/Cairo', canViewCosts: false,
    operationalOnly: true, summary: {}, items: [], total: 0, page: 1, pageSize }
}

function queryArgs(targetPage: number, targetSize = pageSize) {
  return {
    p_shop_id: currentId.value!, p_report: report.value,
    p_location_id: locationId.value === 'all' ? null : locationId.value,
    p_from: ['inventory', 'receivables'].includes(report.value) ? null : (fromDate.value || null),
    p_to: ['inventory', 'receivables'].includes(report.value) ? null : (toDate.value || null),
    p_page: targetPage, p_page_size: targetSize,
  }
}

const { data: result, pending, error, refresh } = useAsyncData(
  () => `shop-data:operational-report:${currentId.value ?? 'none'}:${report.value}:${locationId.value}:${fromDate.value}:${toDate.value}:${page.value}`,
  async (): Promise<OperationalReportPage> => {
    if (!currentId.value || !canView.value || costDenied.value) return emptyReport()
    const { data, error: queryError } = await rpc.rpc('shop_operational_report', queryArgs(page.value))
    if (queryError) throw queryError
    return data as OperationalReportPage
  }, { watch: [currentId, canView, canViewCosts, report, locationId, fromDate, toDate, page], default: emptyReport },
)

watch([report, locationId, fromDate, toDate], () => { page.value = 1; exportError.value = '' })
watch(activeLocations, locations => {
  if (locationId.value !== 'all' && !locations.some(location => location.id === locationId.value)) locationId.value = 'all'
}, { deep: true })

const labels = computed<Record<string, string>>(() => isArabic.value ? {
  invoice_number: 'الفاتورة', occurred_at: 'التاريخ', item_type: 'النوع', item_name: 'الصنف/الخدمة', quantity: 'الكمية', amount: 'القيمة', location_name: 'الفرع',
  customer_name: 'العميل', direction: 'الاتجاه', method: 'الطريقة', supplier_name: 'المورد', purchase_amount: 'المشتريات', payable: 'المستحق', status: 'الحالة',
  invoice_count: 'عدد الفواتير', oldest_due_date: 'أقدم استحقاق', overdueCustomerCount: 'عملاء متأخرون',
  title: 'المصروف', category_name: 'الفئة', name: 'المنتج', sku: 'SKU', quantity_on_hand: 'المتاح', inventory_value: 'قيمة المخزون', reorder_threshold: 'حد الطلب', low_stock: 'مخزون منخفض', movement_count: 'الحركات', last_movement_at: 'آخر حركة',
  revenue: 'الإيراد', fifo_cost: 'تكلفة FIFO', margin: 'الهامش', margin_percent: 'نسبة الهامش', event_type: 'النشاط', label: 'المرجع',
  sales: 'المبيعات', saleCount: 'عدد البيعات', averageTicket: 'متوسط الفاتورة', productSales: 'مبيعات المنتجات', serviceSales: 'مبيعات الخدمات',
  collected: 'المحصل', refunded: 'المردود', netCollections: 'صافي التحصيل', outstanding: 'مستحقات العملاء', outstandingCustomerCount: 'عملاء عليهم مستحقات',
  purchases: 'المشتريات', supplierPayments: 'مدفوعات الموردين', openPurchaseCount: 'فواتير موردين مفتوحة', expenses: 'المصروفات', expenseCount: 'عدد المصروفات', categoryCount: 'عدد الفئات', operatingResult: 'النتيجة التشغيلية (المبيعات ناقص المصروفات)',
  quantityOnHand: 'إجمالي الكمية', inventoryValue: 'إجمالي قيمة المخزون', productCount: 'عدد المنتجات', lowStockCount: 'مخزون منخفض',
  fifoCost: 'تكلفة FIFO', marginPercent: 'نسبة الهامش', reconciledLineCount: 'بنود متصالحة', excludedLineCount: 'بنود مستبعدة', activityCount: 'عدد الأنشطة',
} : {
  invoice_number: 'Invoice', occurred_at: 'Date', item_type: 'Type', item_name: 'Product/service', quantity: 'Quantity', amount: 'Amount', location_name: 'Location',
  customer_name: 'Customer', direction: 'Direction', method: 'Method', supplier_name: 'Supplier', purchase_amount: 'Purchases', payable: 'Payable', status: 'Status',
  invoice_count: 'Invoices', oldest_due_date: 'Oldest due date', overdueCustomerCount: 'Overdue customers',
  title: 'Expense', category_name: 'Category', name: 'Product', sku: 'SKU', quantity_on_hand: 'On hand', inventory_value: 'Stock value', reorder_threshold: 'Reorder level', low_stock: 'Low stock', movement_count: 'Movements', last_movement_at: 'Last movement',
  revenue: 'Revenue', fifo_cost: 'FIFO cost', margin: 'Margin', margin_percent: 'Margin %', event_type: 'Activity', label: 'Reference',
  sales: 'Sales', saleCount: 'Sales count', averageTicket: 'Average ticket', productSales: 'Product sales', serviceSales: 'Service sales',
  collected: 'Collected', refunded: 'Refunded', netCollections: 'Net collections', outstanding: 'Customer outstanding', outstandingCustomerCount: 'Customers outstanding',
  purchases: 'Purchases', supplierPayments: 'Supplier payments', openPurchaseCount: 'Open supplier bills', expenses: 'Expenses', expenseCount: 'Expense count', categoryCount: 'Categories', operatingResult: 'Operating result (sales less expenses)',
  quantityOnHand: 'Total on hand', inventoryValue: 'Inventory value', productCount: 'Products', lowStockCount: 'Low-stock products',
  fifoCost: 'FIFO cost', marginPercent: 'Margin %', reconciledLineCount: 'Reconciled lines', excludedLineCount: 'Excluded lines', activityCount: 'Activity count',
})

const columns = computed<ReportColumn[]>(() => {
  const date = { key: 'occurred_at', label: labels.value.occurred_at, format: 'date' as const }
  const location = { key: 'location_name', label: labels.value.location_name, format: 'text' as const }
  if (report.value === 'sales') return [
    { key: 'invoice_number', label: labels.value.invoice_number, format: 'text', primary: true }, date,
    { key: 'item_type', label: labels.value.item_type, format: 'text' }, { key: 'item_name', label: labels.value.item_name, format: 'text' },
    { key: 'quantity', label: labels.value.quantity, format: 'number' }, { key: 'amount', label: labels.value.amount, format: 'money' }, location,
  ]
  if (report.value === 'collections') return [date, { key: 'customer_name', label: labels.value.customer_name, format: 'text', primary: true },
    { key: 'direction', label: labels.value.direction, format: 'text' }, { key: 'method', label: labels.value.method, format: 'text' },
    { key: 'amount', label: labels.value.amount, format: 'money' }, location]
  if (report.value === 'receivables') return [{ key: 'customer_name', label: labels.value.customer_name, format: 'text', primary: true },
    { key: 'invoice_count', label: labels.value.invoice_count, format: 'number' }, { key: 'oldest_due_date', label: labels.value.oldest_due_date, format: 'date' },
    { key: 'outstanding', label: labels.value.outstanding, format: 'money' }]
  if (report.value === 'suppliers') return [date, { key: 'supplier_name', label: labels.value.supplier_name, format: 'text', primary: true },
    { key: 'invoice_number', label: labels.value.invoice_number, format: 'text' }, { key: 'purchase_amount', label: labels.value.purchase_amount, format: 'money' },
    { key: 'payable', label: labels.value.payable, format: 'money' }, { key: 'status', label: labels.value.status, format: 'text' }, location]
  if (report.value === 'expenses') return [date, { key: 'title', label: labels.value.title, format: 'text', primary: true },
    { key: 'category_name', label: labels.value.category_name, format: 'text' }, { key: 'amount', label: labels.value.amount, format: 'money' }, location]
  if (report.value === 'inventory') return [{ key: 'name', label: labels.value.name, format: 'text', primary: true },
    { key: 'sku', label: labels.value.sku, format: 'text' }, { key: 'quantity_on_hand', label: labels.value.quantity_on_hand, format: 'number' },
    { key: 'inventory_value', label: labels.value.inventory_value, format: 'money' }, { key: 'reorder_threshold', label: labels.value.reorder_threshold, format: 'number' },
    { key: 'low_stock', label: labels.value.low_stock, format: 'boolean' }, { key: 'movement_count', label: labels.value.movement_count, format: 'number' },
    { key: 'last_movement_at', label: labels.value.last_movement_at, format: 'date' }]
  if (report.value === 'margin') return [date, { key: 'invoice_number', label: labels.value.invoice_number, format: 'text', primary: true },
    { key: 'item_name', label: labels.value.item_name, format: 'text' }, { key: 'quantity', label: labels.value.quantity, format: 'number' },
    { key: 'revenue', label: labels.value.revenue, format: 'money' }, { key: 'fifo_cost', label: labels.value.fifo_cost, format: 'money' },
    { key: 'margin', label: labels.value.margin, format: 'money' }, { key: 'margin_percent', label: labels.value.margin_percent, format: 'percent' }, location]
  return [date, { key: 'event_type', label: labels.value.event_type, format: 'text' },
    { key: 'label', label: labels.value.label, format: 'text', primary: true }, { key: 'amount', label: labels.value.amount, format: 'money' }, location]
})

const totalPages = computed(() => Math.max(1, Math.ceil(Number(result.value.total) / pageSize)))

function money(value: unknown) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value ?? 0)) }
function number(value: unknown) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { maximumFractionDigits: 3 }).format(Number(value ?? 0)) }
function date(value: unknown) { return value ? new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(String(value))) : '—' }
function display(value: unknown, format: ColumnFormat) {
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'money') return money(value)
  if (format === 'number') return number(value)
  if (format === 'date') return date(value)
  if (format === 'percent') return `${number(value)}%`
  if (format === 'boolean') return value ? copy.value.true : copy.value.false
  return String(value).replaceAll('_', ' ')
}
function summaryFormat(key: string): ColumnFormat {
  if (['sales', 'averageTicket', 'productSales', 'serviceSales', 'collected', 'refunded', 'netCollections', 'outstanding', 'purchases', 'supplierPayments', 'payable', 'expenses', 'operatingResult', 'inventoryValue', 'revenue', 'fifoCost', 'margin'].includes(key)) return 'money'
  if (key === 'marginPercent') return 'percent'
  return 'number'
}
function summaryPath(key: string) {
  return ['outstanding', 'outstandingCustomerCount'].includes(key) ? '/customers' : '#report-results'
}
function sourcePath(row: OperationalReportRow) { return typeof row.source_path === 'string' ? row.source_path : '' }

async function exportReport() {
  if (!currentId.value || exporting.value || !canView.value || costDenied.value) return
  const inScope = captureScope()
  const version = exportVersion
  const stillCurrent = () => inScope() && version === exportVersion
  const args = queryArgs(1, 500)
  const headers = [...columns.value.map(column => column.key), 'source_path']
  const filename = `shop-${report.value}-${fromDate.value || 'all'}-${toDate.value || 'all'}.csv`
  exporting.value = true; exportError.value = ''
  try {
    const rows: OperationalReportRow[] = []
    let exportPage = 1
    let total = 0
    do {
      const { data, error } = await rpc.rpc('shop_operational_report', { ...args, p_page: exportPage })
      if (!stillCurrent()) return
      if (error) throw error
      const batch = data as OperationalReportPage
      total = Number(batch.total)
      if (!batch.items.length && rows.length < total) throw new Error('REPORT_EXPORT_PAGE_GAP')
      rows.push(...batch.items)
      exportPage++
    } while (rows.length < total)
    downloadCsv(filename, encodeCsv(headers, rows))
  } catch {
    if (stillCurrent()) exportError.value = copy.value.exportFailed
  } finally { exporting.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div><p class="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bs-link)]">{{ current?.name }}</p><h1 class="mt-1 text-3xl font-extrabold">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <BsButton variant="primary" :pending="exporting" :disabled="pending || !result.total || !canView || costDenied" @click="exportReport">{{ exporting ? copy.exporting : copy.export }}</BsButton>
    </header>

    <p class="rounded-xl border border-[var(--bs-status-warning)]/25 bg-[var(--bs-status-warning-bg)] p-4 text-sm">{{ copy.operational }}</p>
    <p v-if="report === 'margin'" class="ls-card-flat p-4 text-sm text-muted-foreground">{{ copy.fifoNotice }}</p>

    <section class="ls-card p-4 sm:p-5" :aria-label="copy.title">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label class="text-xs font-bold text-muted-foreground">{{ copy.title }}<select v-model="report" class="ls-select mt-1 w-full"><option v-for="option in reportOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
        <label class="text-xs font-bold text-muted-foreground">{{ copy.location }}<select v-model="locationId" class="ls-select mt-1 w-full"><option value="all">{{ copy.allLocations }}</option><option v-for="location in activeLocations" :key="location.id" :value="location.id">{{ location.name }}</option></select></label>
        <label class="text-xs font-bold text-muted-foreground">{{ copy.from }}<input v-model="fromDate" type="date" class="ls-input mt-1 w-full" :disabled="report === 'inventory' || report === 'receivables'"></label>
        <label class="text-xs font-bold text-muted-foreground">{{ copy.to }}<input v-model="toDate" type="date" class="ls-input mt-1 w-full" :disabled="report === 'inventory' || report === 'receivables'"></label>
      </div><p class="mt-3 text-xs text-muted-foreground">{{ copy.fullHistory }}</p>
    </section>

    <p v-if="accessError || error" role="alert" class="rounded-xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-4 text-sm text-[var(--bs-status-error)]">{{ copy.failed }} <BsButton @click="refreshAccess(); refresh()">{{ copy.retry }}</BsButton></p>
    <p v-else-if="exportError" role="alert" class="text-sm text-[var(--bs-status-error)]">{{ exportError }}</p>
    <p v-if="accessPending || pending" role="status" class="text-sm text-muted-foreground">{{ copy.loading }}</p>
    <p v-else-if="!canView" class="ls-card-flat p-6 text-sm text-muted-foreground">{{ copy.denied }}</p>
    <p v-else-if="costDenied" class="ls-card-flat p-6 text-sm text-muted-foreground">{{ copy.costDenied }}</p>

    <template v-else>
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NuxtLink v-for="(value, key) in result.summary" v-show="key !== 'costBasis' && key !== 'snapshot'" :key="key" :to="summaryPath(String(key))" class="ls-card p-4 transition hover:border-[var(--bs-accent)]"><p class="text-xs font-bold text-muted-foreground">{{ labels[key] || key }}</p><p class="mt-2 text-xl font-extrabold">{{ display(value, summaryFormat(String(key))) }}</p><span class="mt-2 block text-xs font-bold text-[var(--bs-link)]">{{ copy.open }}</span></NuxtLink>
      </section>

      <section id="report-results" class="scroll-mt-24 overflow-hidden ls-card">
        <div class="overflow-x-auto">
          <BsDataTable :value="result.items" data-key="id" :row-class="() => 'border-b border-border last:border-0'">
            <Column v-for="column in columns" :key="column.key" header-class="px-4 py-3 text-start" body-class="px-4 py-3 text-start whitespace-nowrap">
              <template #header>{{ column.label }}</template>
              <template #body="{ data: row }"><NuxtLink v-if="column.primary && sourcePath(row)" :to="sourcePath(row)" class="inline-flex min-h-11 min-w-11 items-center font-bold text-[var(--bs-link)] hover:underline">{{ display(row[column.key], column.format) }}</NuxtLink><span v-else>{{ display(row[column.key], column.format) }}</span></template>
            </Column>
            <Column header-class="px-4 py-3 text-end" body-class="px-4 py-3 text-end"><template #header>{{ copy.open }}</template><template #body="{ data: row }"><NuxtLink v-if="sourcePath(row)" :to="sourcePath(row)" class="inline-flex min-h-11 min-w-11 items-center font-bold text-[var(--bs-link)] hover:underline">{{ copy.open }}</NuxtLink></template></Column>
            <template #empty><p class="p-8 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template>
          </BsDataTable>
        </div>
        <footer v-if="result.total" class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm"><p class="text-muted-foreground">{{ result.total }} {{ copy.records }} · {{ copy.page }} {{ page }} {{ copy.of }} {{ totalPages }}</p><div class="flex gap-2"><BsButton :disabled="page <= 1" @click="page--">{{ copy.previous }}</BsButton><BsButton :disabled="page >= totalPages" @click="page++">{{ copy.next }}</BsButton></div></footer>
      </section>
    </template>
  </div>
</template>
