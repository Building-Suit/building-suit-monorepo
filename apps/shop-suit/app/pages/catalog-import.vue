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
  <BsStack>
    <BsBox as="header">
      <BsHeading :level="1">{{ copy.title }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.subtitle }}</BsText>
    </BsBox>
    <BsText v-if="!current && !shopLoading" as="p" size="sm">{{ copy.noShop }}</BsText>
    <template v-else-if="current">
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.categories }}</BsHeading>
          <BsButton variant="primary" @click="categoryName = ''; categoryError = ''; categoryOpen = true">{{ copy.addCategory }}</BsButton>
        </BsInline>
        <BsInline>
          <BsText v-for="category in categories" :key="category.id" as="span">{{ category.name }}</BsText>
        </BsInline>
      </BsPanel>
      <BsRecordActionDialog v-model:visible="categoryOpen" :title="copy.addCategory" :dirty="categoryDirty" :pending="categoryPending" :error="categoryError" :submit-label="copy.addCategory" @submit="addCategory">
        <BsField :label="copy.categoryName">
          <BsInput v-model="categoryName" :minlength="2" :maxlength="80" required/>
        </BsField>
      </BsRecordActionDialog>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.importTitle }}</BsHeading>
          <BsButton severity="secondary" @click="template">{{ copy.template }}</BsButton>
        </BsInline>
        <BsGrid :columns="2">
          <BsField v-slot="field" :label="copy.importTitle">
            <BsSelect v-model="kind" :input-id="field.id" :aria-describedby="field.describedby" :disabled="pending" :label="copy.importTitle" :options="[{ value: 'products', label: (copy.products), disabled: false }, { value: 'customers', label: (copy.customers), disabled: false }, { value: 'suppliers', label: (copy.suppliers), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="copy.choose">
            <BsFileInput :input-id="field.id" :label="copy.choose" :describedby="field.describedby" :disabled="pending" accept=".csv,text/csv" @change="readFile"/>
          </BsField>
        </BsGrid>
        <BsText v-if="filename" as="p" size="sm">{{ filename }} · {{ rows.length }}</BsText>
        <BsText v-if="parsingError" role="alert" as="p" size="sm" tone="danger">{{ parsingError }}</BsText>
        <BsInline>
          <BsButton severity="secondary" :disabled="!rows.length || pending" @click="runImport(true)">{{ pending ? copy.validating : copy.validate }}</BsButton>
          <BsButton :pending="pending" :disabled="!result?.valid || !result.dryRun" @click="runImport(false)">{{ copy.apply }}</BsButton>
        </BsInline>
        <BsText v-if="result?.valid" role="status" as="p" size="sm">{{ result.dryRun ? copy.valid : copy.applied }} <BsText v-if="!result.dryRun" as="span">{{ result.created }} / {{ result.updated }} / {{ result.openingStockPosted }}</BsText>
        </BsText>
        <BsBox v-if="result?.errors.length" scroll="x">
          <BsDataTable :value="result.errors" :columns="[{ key: 'row', header: copy.row, field: 'row' }, { key: 'field', header: copy.field, field: 'field' }, { key: 'code', header: copy.issue, field: 'code' }]"/>
        </BsBox>
      </BsPanel>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.report }}</BsHeading>
          <BsButton severity="secondary" :pending="exporting" @click="exportLabels">{{ copy.labels }}</BsButton>
        </BsInline>
        <BsGrid :columns="3">
          <BsField v-slot="field" :label="copy.category">
            <BsSelect v-model="categoryFilter" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.category" :options="[{ value: '', label: (copy.allCategories), disabled: false }, ...(categories).map(category => ({ value: category.id, label: (category.name), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="copy.from">
            <BsInput :id="field.id" v-model="reportFrom" :aria-describedby="field.describedby" type="date"/>
          </BsField>
          <BsField v-slot="field" :label="copy.to">
            <BsInput :id="field.id" v-model="reportTo" :aria-describedby="field.describedby" type="date"/>
          </BsField>
        </BsGrid>
        <BsText v-if="reportPending" role="status" as="p" size="sm" tone="muted">{{ copy.validating }}</BsText>
        <BsBox v-else-if="reportError" role="alert">{{ copy.reportError }} <BsButton @click="refreshReport()">{{ copy.retry }}</BsButton>
        </BsBox>
        <BsBox v-else scroll="x">
          <BsDataTable :value="salesReport.items" :columns="[{ key: 'name', header: copy.item, field: 'name' }, { key: 'category', header: copy.category, field: 'category' }, { key: 'quantity', header: copy.quantity, field: 'quantity' }, { key: 'column3', header: copy.amount }]">
            <template #cell-column3="{ row: data }">{{ money(Number(data.amount)) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.noData }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
    </template>
  </BsStack>
</template>
