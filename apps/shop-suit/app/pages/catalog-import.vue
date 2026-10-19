<script setup lang="ts">
import type { BsCatalogImportCopy, BsCatalogImportView, BsCatalogImportChoice } from '@building-suit/ui/types/catalogImportPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { downloadCsv, encodeCsv, importTemplates, parseCsv, validateImportHeaders } from '~/utils/catalogImport'
const { refreshShopQueries } = useShopInvalidation()


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
const rpc = useShopClient<ShopRpcDatabase>().schema('public')
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

const { data: categories, refresh: refreshCategories } = useShopQuery(
  () => `shop-data:catalog-categories:${currentId.value ?? 'none'}`,
  async () => {
    if (!currentId.value) return []
    const { data, error } = await rpc.rpc('list_catalog_categories', { p_shop_id: currentId.value })
    if (error) throw error
    return data as Category[]
  }, { watch: [currentId], default: () => [] },
)

const { data: salesReport, pending: reportPending, error: reportError, refresh: refreshReport } = useShopQuery(
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

async function readFile(file: File | null) {
  resetImport()
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
      await refreshShopQueries(key => key.startsWith('shop-data:'))
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

const importCopy = computed<BsCatalogImportCopy>(() => ({
  addCategory: copy.value.addCategory,
  allCategories: copy.value.allCategories,
  amount: copy.value.amount,
  applied: copy.value.applied,
  apply: copy.value.apply,
  categories: copy.value.categories,
  category: copy.value.category,
  categoryName: copy.value.categoryName,
  choose: copy.value.choose,
  customers: copy.value.customers,
  field: copy.value.field,
  from: copy.value.from,
  importTitle: copy.value.importTitle,
  issue: copy.value.issue,
  item: copy.value.item,
  labels: copy.value.labels,
  noData: copy.value.noData,
  noShop: copy.value.noShop,
  products: copy.value.products,
  quantity: copy.value.quantity,
  report: copy.value.report,
  reportError: copy.value.reportError,
  retry: copy.value.retry,
  row: copy.value.row,
  subtitle: copy.value.subtitle,
  suppliers: copy.value.suppliers,
  template: copy.value.template,
  title: copy.value.title,
  to: copy.value.to,
  valid: copy.value.valid,
  validate: copy.value.validate,
  validating: copy.value.validating,
}))
const importView = computed<BsCatalogImportView>(() => ({
  available: Boolean(current.value), contextLoading: shopLoading.value, categories: categories.value.map(row => ({ id: row.id, name: row.name })), categoryDirty: categoryDirty.value, categoryPending: categoryPending.value, categoryError: categoryError.value,
  pending: pending.value, filename: filename.value, rowCount: rows.value.length, error: parsingError.value, canValidate: rows.value.length > 0 && !pending.value, canApply: Boolean(result.value?.valid && result.value.dryRun), resultLabel: result.value?.valid ? result.value.dryRun ? copy.value.valid : `${copy.value.applied} ${result.value.created} / ${result.value.updated} / ${result.value.openingStockPosted}` : '',
  issues: (result.value?.errors ?? []).map(row => ({ row: row.row, field: row.field, code: row.code })), exporting: exporting.value, reportPending: reportPending.value, reportError: Boolean(reportError.value), reportRows: salesReport.value.items.map((row, index) => ({ id: String(index), name: row.name, category: row.category, quantity: String(row.quantity), amount: money(Number(row.amount)) })),
}))
const importKind = computed<string>({ get: () => kind.value, set: value => { if (value === 'products' || value === 'customers' || value === 'suppliers') kind.value = value } })
const importKindChoices = computed<BsCatalogImportChoice[]>(() => [{ value: 'products', label: copy.value.products }, { value: 'customers', label: copy.value.customers }, { value: 'suppliers', label: copy.value.suppliers }])
const importCategoryChoices = computed<BsCatalogImportChoice[]>(() => [{ value: '', label: copy.value.allCategories }, ...categories.value.map(row => ({ value: row.id, label: row.name }))])
function openCategory() { categoryName.value = ''; categoryError.value = ''; categoryOpen.value = true }
</script>
<template>
  <BsCatalogImportPage v-model:kind="importKind" v-model:category-open="categoryOpen" v-model:category-name="categoryName" v-model:category-filter="categoryFilter" v-model:report-from="reportFrom" v-model:report-to="reportTo" :copy="importCopy" :view="importView" :kind-choices="importKindChoices" :category-choices="importCategoryChoices" @open-category="openCategory" @save-category="addCategory" @download-template="template" @file="readFile" @validate="runImport(true)" @apply="runImport(false)" @export-labels="exportLabels" @reload-report="refreshReport()" />
</template>
