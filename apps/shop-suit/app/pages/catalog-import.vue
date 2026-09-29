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
const categoryFilter = ref('')
const reportFrom = ref(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
const reportTo = ref(new Date().toISOString().slice(0, 10))

const copy = computed(() => isArabic.value ? {
  title: 'إعداد الكتالوج والاستيراد', subtitle: 'استورد بيانات Excel بصيغة CSV بعد فحصها، وأدر التصنيفات وبيانات ملصقات الباركود.',
  categories: 'تصنيفات المنتجات والخدمات', categoryName: 'اسم التصنيف', addCategory: 'إضافة تصنيف', allCategories: 'كل التصنيفات',
  importTitle: 'استيراد CSV', products: 'منتجات', customers: 'عملاء', suppliers: 'موردون', template: 'تنزيل نموذج CSV',
  choose: 'اختر ملف CSV حتى 5 MB و1000 صف', validate: 'فحص بدون حفظ', apply: 'تنفيذ الاستيراد', validating: 'جاري الفحص…',
  valid: 'الملف صالح للتنفيذ.', applied: 'اكتمل الاستيراد.', row: 'الصف', field: 'الحقل', issue: 'المشكلة',
  labels: 'تصدير بيانات ملصقات الباركود', report: 'تقرير مبيعات الكتالوج', from: 'من', to: 'إلى', refresh: 'تحديث التقرير',
  item: 'الصنف', category: 'التصنيف', quantity: 'الكمية', amount: 'المبيعات', noData: 'لا توجد بيانات.', noShop: 'أنشئ متجرًا أولًا.',
  fileError: 'تعذّر قراءة الملف. تأكد من العناوين والصيغة والحد الأقصى.', serverError: 'تعذّر فحص أو تنفيذ الاستيراد.', categoryError: 'تعذّر حفظ التصنيف.',
} : {
  title: 'Catalog setup & import', subtitle: 'Validate and import Excel-compatible CSV data, manage categories, and export barcode-label data.',
  categories: 'Product & service categories', categoryName: 'Category name', addCategory: 'Add category', allCategories: 'All categories',
  importTitle: 'CSV import', products: 'Products', customers: 'Customers', suppliers: 'Suppliers', template: 'Download CSV template',
  choose: 'Choose a CSV file up to 5 MB and 1,000 rows', validate: 'Validate without saving', apply: 'Apply import', validating: 'Validating…',
  valid: 'The file is ready to import.', applied: 'Import completed.', row: 'Row', field: 'Field', issue: 'Issue',
  labels: 'Export barcode label data', report: 'Catalog sales report', from: 'From', to: 'To', refresh: 'Refresh report',
  item: 'Item', category: 'Category', quantity: 'Quantity', amount: 'Sales', noData: 'No data.', noShop: 'Create a shop first.',
  fileError: 'Could not read the file. Check its headers, format, and size limits.', serverError: 'Could not validate or apply the import.', categoryError: 'Could not save the category.',
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

const { data: salesReport, pending: reportPending } = useAsyncData(
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
function resetImport() { rows.value = []; filename.value = ''; requestId.value = ''; result.value = null; parsingError.value = '' }

async function readFile(event: Event) {
  resetImport()
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const parsed = parseCsv(await file.text())
    const missing = validateImportHeaders(kind.value, parsed)
    if (missing.length) throw new Error(`MISSING_HEADERS:${missing.join(',')}`)
    rows.value = parsed
    filename.value = file.name
    requestId.value = crypto.randomUUID()
  } catch (error) {
    parsingError.value = error instanceof Error ? `${copy.value.fileError} (${error.message})` : copy.value.fileError
  }
}

function template() {
  downloadCsv(`${kind.value}-import-template.csv`, encodeCsv(importTemplates[kind.value], []))
}

async function runImport(dryRun: boolean) {
  if (!currentId.value || !rows.value.length || pending.value) return
  pending.value = true; parsingError.value = ''
  try {
    requestId.value ||= crypto.randomUUID()
    const response = await rpc.rpc('catalog_import', { p_request_id: requestId.value, p_shop_id: currentId.value, p_kind: kind.value, p_rows: rows.value, p_dry_run: dryRun })
    if (response.error) throw response.error
    result.value = response.data as ImportResult
    if (!dryRun && result.value.valid) pushToast({ tone: 'success', title: copy.value.applied })
  } catch (error) {
    parsingError.value = error instanceof Error ? `${copy.value.serverError} (${error.message})` : copy.value.serverError
  } finally { pending.value = false }
}

async function addCategory() {
  if (!currentId.value || categoryPending.value || categoryName.value.trim().length < 2) return
  categoryPending.value = true
  try {
    const { error } = await rpc.rpc('save_catalog_category', { p_shop_id: currentId.value, p_category_id: null, p_name: categoryName.value.trim() })
    if (error) throw error
    categoryName.value = ''; await refreshCategories()
  } catch { pushToast({ tone: 'error', title: copy.value.categoryError }) }
  finally { categoryPending.value = false }
}

async function exportLabels() {
  if (!currentId.value) return
  const all: LabelRow[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await rpc.rpc('barcode_label_data', { p_shop_id: currentId.value, p_category_id: categoryFilter.value || null, p_page: page, p_page_size: 500 })
    if (error) { pushToast({ tone: 'error', title: error.message }); return }
    const batch = data as { items: LabelRow[]; total: number; pageSize: number }
    all.push(...batch.items)
    if (page * batch.pageSize >= batch.total) break
  }
  downloadCsv('barcode-labels.csv', encodeCsv(['name', 'sku', 'barcode', 'sale_price', 'category'], all.map(item => ({
    name: item.name, sku: item.sku, barcode: item.barcode, sale_price: item.salePrice, category: item.category,
  }))))
}

function money(value: number) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' }).format(value) }
</script>

<template>
  <div class="space-y-6">
    <header><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></header>
    <p v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm">{{ copy.noShop }}</p>
    <template v-else-if="current">
      <section class="rounded-2xl border border-border bg-card p-5">
        <h2 class="text-lg font-extrabold">{{ copy.categories }}</h2>
        <form class="mt-4 flex flex-wrap gap-2" @submit.prevent="addCategory"><input v-model="categoryName" class="ls-input max-w-sm" minlength="2" maxlength="80" required :placeholder="copy.categoryName"><BsButton type="submit" :disabled="categoryPending">{{ copy.addCategory }}</BsButton></form>
        <div class="mt-3 flex flex-wrap gap-2"><span v-for="category in categories" :key="category.id" class="ls-badge bg-muted">{{ category.name }}</span></div>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-extrabold">{{ copy.importTitle }}</h2><BsButton severity="secondary" @click="template">{{ copy.template }}</BsButton></div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <label class="space-y-2 text-sm font-bold">{{ copy.importTitle }}<select v-model="kind" class="ls-select"><option value="products">{{ copy.products }}</option><option value="customers">{{ copy.customers }}</option><option value="suppliers">{{ copy.suppliers }}</option></select></label>
          <label class="space-y-2 text-sm font-bold">{{ copy.choose }}<input type="file" accept=".csv,text/csv" class="ls-input" @change="readFile"></label>
        </div>
        <p v-if="filename" class="mt-3 text-sm">{{ filename }} · {{ rows.length }}</p>
        <p v-if="parsingError" role="alert" class="mt-3 rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ parsingError }}</p>
        <div class="mt-4 flex gap-2"><BsButton severity="secondary" :disabled="!rows.length || pending" @click="runImport(true)">{{ pending ? copy.validating : copy.validate }}</BsButton><BsButton :disabled="!result?.valid || !result.dryRun || pending" @click="runImport(false)">{{ copy.apply }}</BsButton></div>
        <p v-if="result?.valid" role="status" class="mt-3 rounded-xl bg-[var(--bs-status-success-bg)] p-3 text-sm">{{ result.dryRun ? copy.valid : copy.applied }} <span v-if="!result.dryRun">{{ result.created }} / {{ result.updated }} / {{ result.openingStockPosted }}</span></p>
        <div v-if="result?.errors.length" class="mt-4 overflow-x-auto"><BsDataTable :value="result.errors"><Column field="row" :header="copy.row"/><Column field="field" :header="copy.field"/><Column field="code" :header="copy.issue"/></BsDataTable></div>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-extrabold">{{ copy.report }}</h2><BsButton severity="secondary" @click="exportLabels">{{ copy.labels }}</BsButton></div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3"><label class="space-y-2 text-sm font-bold">{{ copy.category }}<select v-model="categoryFilter" class="ls-select"><option value="">{{ copy.allCategories }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label class="space-y-2 text-sm font-bold">{{ copy.from }}<input v-model="reportFrom" type="date" class="ls-input"></label><label class="space-y-2 text-sm font-bold">{{ copy.to }}<input v-model="reportTo" type="date" class="ls-input"></label></div>
        <p v-if="reportPending" class="p-5 text-sm text-muted-foreground">{{ copy.validating }}</p>
        <div v-else class="mt-4 overflow-x-auto"><BsDataTable :value="salesReport.items"><Column field="name" :header="copy.item"/><Column field="category" :header="copy.category"/><Column field="quantity" :header="copy.quantity"/><Column :header="copy.amount"><template #body="{ data }">{{ money(Number(data.amount)) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noData }}</p></template></BsDataTable></div>
      </section>
    </template>
  </div>
</template>
