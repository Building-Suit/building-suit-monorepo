<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { downloadCsv, encodeCsv, importTemplates, parseCsv, validateImportHeaders } from '~/utils/catalogImport'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
type ImportKind = keyof typeof importTemplates
type ImportError = { row: number | null; field: string; code: string }
type ImportResult = { valid: boolean; dryRun: boolean; rowCount: number; errors: ImportError[]; created?: number; updated?: number; openingStockPosted?: number }
type Category = { id: string; name: string }
type LabelRow = { productId: string; name: string; sku: string | null; barcode: string; salePrice: number; category: string | null }
type SalesRow = { type: string; name: string; category: string; quantity: number; amount: number }

const captureScope = useShopTaskScope()
const confirmation = useConfirmation()
const exporting = ref(false)
let fileVersion = 0
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { current, currentId, loading: shopLoading } = useShop()
const { locale } = useI18n()
const { push: pushToast } = useToasts()
const isArabic = computed(() => locale.value === 'ar')
const kind = ref<ImportKind>('products')
const rows = ref<Array<Record<string, unknown>>>([])
const filename = ref('')
const requestId = ref('')
const result = ref<ImportResult | null>(null)
const parsingError = ref('')
const pending = ref(false)
const categoryName = ref('')
const categoryPending = ref(false)
const categoryError = ref('')
const { visible: categoryOpen, dirty: categoryDirty, complete: completeCategory } = useRecordAction(() => ({ name: categoryName.value }))
const categoryFilter = ref('')
const reportFrom = ref(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
const reportTo = ref(new Date().toISOString().slice(0, 10))

const copy = computed(() => isArabic.value ? {
  title: 'إعداد قائمة المنتجات والخدمات', subtitle: 'استورد بيانات Excel بصيغة CSV بعد ما تفحصها، وظبط التصنيفات وبيانات ملصقات الباركود.',
  categories: 'تصنيفات المنتجات والخدمات', categoryName: 'اسم التصنيف', addCategory: 'إضافة تصنيف', allCategories: 'كل التصنيفات',
  importTitle: 'استيراد CSV', products: 'منتجات', customers: 'عملاء', suppliers: 'موردون', template: 'تنزيل نموذج CSV',
  choose: 'اختار ملف CSV لحد 5 MB و1000 صف', validate: 'فحص من غير حفظ', apply: 'تنفيذ الاستيراد', validating: 'بنفحص…',
  valid: 'الملف صالح للتنفيذ.', applied: 'اكتمل الاستيراد.', row: 'الصف', field: 'الحقل', issue: 'المشكلة',
  labels: 'تصدير بيانات ملصقات الباركود', report: 'تقرير مبيعات الكتالوج', from: 'من', to: 'إلى', refresh: 'تحديث التقرير',
  item: 'الصنف', category: 'التصنيف', quantity: 'الكمية', amount: 'المبيعات', noData: 'مفيش بيانات.', noShop: 'اعمل متجر الأول.',
  fileError: 'مقدرناش نقرا الملف. راجع العناوين والصيغة والحجم.', serverError: 'مقدرناش نفحص الملف أو ننفّذ الاستيراد.', categoryError: 'مقدرناش نحفظ التصنيف.', confirmImport: 'تنفّذ الاستيراد؟ السجلات هتتعمل أو تتحدّث، والأرصدة الافتتاحية هتزود كمية المخزون وقيمته.', exportError: 'مقدرناش نصدّر الملصقات.', reportError: 'مقدرناش نحمّل التقرير.', retry: 'حاول تاني',
} : {
  title: 'Catalog setup & import', subtitle: 'Validate and import Excel-compatible CSV data, manage categories, and export barcode-label data.',
  categories: 'Product & service categories', categoryName: 'Category name', addCategory: 'Add category', allCategories: 'All categories',
  importTitle: 'CSV import', products: 'Products', customers: 'Customers', suppliers: 'Suppliers', template: 'Download CSV template',
  choose: 'Choose a CSV file up to 5 MB and 1,000 rows', validate: 'Validate without saving', apply: 'Apply import', validating: 'Validating…',
  valid: 'The file is ready to import.', applied: 'Import completed.', row: 'Row', field: 'Field', issue: 'Issue',
  labels: 'Export barcode label data', report: 'Catalog sales report', from: 'From', to: 'To', refresh: 'Refresh report',
  item: 'Item', category: 'Category', quantity: 'Quantity', amount: 'Sales', noData: 'No data.', noShop: 'Create a shop first.',
  fileError: 'Could not read the file. Check its headers, format, and size limits.', serverError: 'Could not validate or apply the import.', categoryError: 'Could not save the category.', confirmImport: 'Apply this import? Records will be created or updated; opening stock increases inventory quantities and value.', exportError: 'Could not export labels.', reportError: 'Could not load the report.', retry: 'Retry',
})

const { data: categories, refresh: refreshCategories } = useAsyncData(
  () => `shop-data:catalog-categories:${currentId.value ?? 'none'}`,
  async () => {
    if (!currentId.value) return []
    const { data, error } = await rpc.rpc('list_catalog_categories', { p_shop_id: currentId.value })
    if (error) throw error
    return data as Category[]
  }, { watch: [currentId], default: () => [] },
)

const { data: salesReport, pending: reportPending, error: reportError, refresh: refreshReport } = useAsyncData(
  () => `shop-data:catalog-report:${currentId.value ?? 'none'}:${categoryFilter.value}:${reportFrom.value}:${reportTo.value}`,
  async () => {
    if (!currentId.value) return { items: [] as SalesRow[] }
    const { data, error } = await rpc.rpc('catalog_sales_report', {
      p_shop_id: currentId.value, p_category_id: categoryFilter.value || null,
      p_from: reportFrom.value, p_to: reportTo.value,
    })
    if (error) throw error
    return data as { items: SalesRow[] }
  }, { watch: [currentId, categoryFilter, reportFrom, reportTo], default: () => ({ items: [] as SalesRow[] }) },
)

watch([kind, currentId], () => resetImport())
function resetImport() { fileVersion++; rows.value = []; filename.value = ''; requestId.value = ''; result.value = null; parsingError.value = '' }

async function readFile(event: Event) {
  resetImport()
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const version = fileVersion
  const inScope = captureScope()
  try {
    const content = await file.text()
    if (!inScope() || version !== fileVersion) return
    const parsed = parseCsv(content)
    const missing = validateImportHeaders(kind.value, parsed)
    if (missing.length) throw new Error(`MISSING_HEADERS:${missing.join(',')}`)
    rows.value = parsed
    filename.value = file.name
    requestId.value = crypto.randomUUID()
  } catch {
    if (inScope() && version === fileVersion) parsingError.value = copy.value.fileError
  }
}

function template() {
  downloadCsv(`${kind.value}-import-template.csv`, encodeCsv(importTemplates[kind.value], []))
}

async function runImport(dryRun: boolean) {
  if (!currentId.value || !rows.value.length || pending.value) return
  const inScope = captureScope()
  pending.value = true; parsingError.value = ''
  try {
    if (!dryRun && (!await confirmation.ask(copy.value.confirmImport) || !inScope())) return
    requestId.value ||= crypto.randomUUID()
    const response = await rpc.rpc('catalog_import', { p_request_id: requestId.value, p_shop_id: currentId.value, p_kind: kind.value, p_rows: rows.value, p_dry_run: dryRun })
    if (!inScope()) return
    if (response.error) throw response.error
    result.value = response.data as ImportResult
    if (!dryRun && result.value.valid) {
      await refreshNuxtData()
      if (inScope()) pushToast({ tone: 'success', title: copy.value.applied })
    }
  } catch {
    if (inScope()) parsingError.value = copy.value.serverError
  } finally { pending.value = false }
}

async function addCategory() {
  if (!currentId.value || categoryPending.value || categoryName.value.trim().length < 2) return
  const inScope = captureScope()
  categoryPending.value = true
  categoryError.value = ''
  try {
    const { error } = await rpc.rpc('save_catalog_category', { p_shop_id: currentId.value, p_category_id: null, p_name: categoryName.value.trim() })
    if (!inScope()) return
    if (error) throw error
    categoryName.value = ''; await refreshCategories(); completeCategory()
  } catch { if (inScope()) categoryError.value = copy.value.categoryError }
  finally { categoryPending.value = false }
}

async function exportLabels() {
  if (!currentId.value || exporting.value) return
  const inScope = captureScope()
  const shopId = currentId.value
  const category = categoryFilter.value
  const all: LabelRow[] = []
  exporting.value = true
  try {
    let page = 1
    let total = 0
    do {
      const { data, error } = await rpc.rpc('barcode_label_data', { p_shop_id: shopId, p_category_id: category || null, p_page: page, p_page_size: 100 })
      if (!inScope() || category !== categoryFilter.value) return
      if (error) throw error
      const batch = data as { items: LabelRow[]; total: number }
      all.push(...batch.items)
      total = batch.total
    } while (page++ * 100 < total)
    downloadCsv('barcode-labels.csv', encodeCsv(['name', 'sku', 'barcode', 'sale_price', 'category'], all.map(item => ({
      name: item.name, sku: item.sku, barcode: item.barcode, sale_price: item.salePrice, category: item.category,
    }))))
  } catch { if (inScope()) pushToast({ tone: 'error', title: copy.value.exportError }) }
  finally { exporting.value = false }
}

function money(value: number) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(value) }
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></header>
    <p v-if="!current && !shopLoading" class="ls-card p-8 text-center text-sm">{{ copy.noShop }}</p>
    <template v-else-if="current">
      <section class="ls-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-extrabold">{{ copy.categories }}</h2><BsButton variant="primary" @click="categoryName = ''; categoryError = ''; categoryOpen = true">{{ copy.addCategory }}</BsButton></div>
        <div class="mt-3 flex flex-wrap gap-2"><span v-for="category in categories" :key="category.id" class="ls-badge bg-muted">{{ category.name }}</span></div>
      </section>

      <BsRecordActionDialog v-model:visible="categoryOpen" :title="copy.addCategory" :dirty="categoryDirty" :pending="categoryPending" :error="categoryError" :submit-label="copy.addCategory" @submit="addCategory">
        <BsField :label="copy.categoryName"><BsInput v-model="categoryName" minlength="2" maxlength="80" required /></BsField>
      </BsRecordActionDialog>

      <section class="ls-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-extrabold">{{ copy.importTitle }}</h2><BsButton severity="secondary" @click="template">{{ copy.template }}</BsButton></div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm font-bold">{{ copy.importTitle }}<select v-model="kind" :disabled="pending" class="ls-select"><option value="products">{{ copy.products }}</option><option value="customers">{{ copy.customers }}</option><option value="suppliers">{{ copy.suppliers }}</option></select></label>
          <label class="space-y-2 text-sm font-bold">{{ copy.choose }}<input type="file" :disabled="pending" accept=".csv,text/csv" class="ls-input" @change="readFile"></label>
        </div>
        <p v-if="filename" class="mt-3 text-sm">{{ filename }} · {{ rows.length }}</p>
        <p v-if="parsingError" role="alert" class="mt-3 rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ parsingError }}</p>
        <div class="mt-4 flex flex-wrap gap-2"><BsButton severity="secondary" :disabled="!rows.length || pending" @click="runImport(true)">{{ pending ? copy.validating : copy.validate }}</BsButton><BsButton :pending="pending" :disabled="!result?.valid || !result.dryRun" @click="runImport(false)">{{ copy.apply }}</BsButton></div>
        <p v-if="result?.valid" role="status" class="mt-3 rounded-xl bg-[var(--bs-status-success-bg)] p-3 text-sm">{{ result.dryRun ? copy.valid : copy.applied }} <span v-if="!result.dryRun">{{ result.created }} / {{ result.updated }} / {{ result.openingStockPosted }}</span></p>
        <div v-if="result?.errors.length" class="mt-4 overflow-x-auto"><BsDataTable :value="result.errors"><Column field="row" :header="copy.row"/><Column field="field" :header="copy.field"/><Column field="code" :header="copy.issue"/></BsDataTable></div>
      </section>

      <section class="ls-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-extrabold">{{ copy.report }}</h2><BsButton severity="secondary" :pending="exporting" @click="exportLabels">{{ copy.labels }}</BsButton></div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3"><label class="space-y-2 text-sm font-bold">{{ copy.category }}<select v-model="categoryFilter" class="ls-select"><option value="">{{ copy.allCategories }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label class="space-y-2 text-sm font-bold">{{ copy.from }}<input v-model="reportFrom" type="date" class="ls-input"></label><label class="space-y-2 text-sm font-bold">{{ copy.to }}<input v-model="reportTo" type="date" class="ls-input"></label></div>
        <p v-if="reportPending" role="status" class="p-5 text-sm text-muted-foreground">{{ copy.validating }}</p>
        <div v-else-if="reportError" role="alert" class="mt-4">{{ copy.reportError }} <BsButton @click="refreshReport()">{{ copy.retry }}</BsButton></div>
        <div v-else class="mt-4 overflow-x-auto"><BsDataTable :value="salesReport.items"><Column field="name" :header="copy.item"/><Column field="category" :header="copy.category"/><Column field="quantity" :header="copy.quantity"/><Column :header="copy.amount"><template #body="{ data }">{{ money(Number(data.amount)) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noData }}</p></template></BsDataTable></div>
      </section>
    </template>
  </div>
</template>
