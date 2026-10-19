<script setup lang="ts">
import type { BsSalesDirectoryCopy, BsSalesDirectoryView, BsSalesDirectoryRow, BsSalesDraftForm, BsSalesLineView } from '@building-suit/ui/types/salesDirectoryPresentation'
import { shopCommandErrorMessage } from '~/utils/shopCommandErrorMessage'
import { saleCopy } from '~/utils/saleCopy'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const { refreshShopQueries } = useShopInvalidation()

const { businessCurrency } = useShop()

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type SaleStatus = 'draft' | 'issued'
type SaleRow = {
  currency?: string
  id: string
  invoice_number: string | null
  status: SaleStatus
  client_id: string | null
  client_name_snapshot: string | null
  total_amount: number
  created_at: string
  issued_at: string | null
  line_count: number
}
type SalePage = {
  items: SaleRow[]
  total: number
  page: number
  pageSize: number
  canManage: boolean
  canIssue: boolean
  permissionDenied?: boolean
}
type CatalogProduct = { id: string; name: string; sku: string | null; barcode: string | null; unitPrice: number; stock: number }
type CatalogService = { id: string; name: string; unitPrice: number; discountType: 'amount' | 'percent'; discountValue: number }
type CatalogCustomer = { id: string; name: string }
type SaleCatalog = {
  businessMode: 'product' | 'service' | 'mixed'
  canIssue: boolean
  products: CatalogProduct[]
  services: CatalogService[]
  customers: CatalogCustomer[]
}
type DraftLine = { key: string; itemType: 'product' | 'service'; sourceId: string; quantity: number }
type SaleDetail = { id: string; status: SaleStatus; client_id: string | null; due_date: string | null; notes: string | null; canManage: boolean; lines: Array<{ item_type: 'product' | 'service'; product_id: string | null; service_id: string | null; quantity: number }> }
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'

const shopRpc = useShopClient<ShopRpcDatabase>().schema('public')
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { current, currentId, currentLocationId, loading: shopLoading } = useShop()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const search = ref('')
const debouncedSearch = ref('')
const statusFilter = ref<'all' | SaleStatus>('all')
const queryDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
const fromDate = ref(queryDate(route.query.from))
const toDate = ref(queryDate(route.query.to))
const page = ref(1)
const pageSize = 20
const editorOpen = ref(false)
const saving = ref(false)
const issuing = ref(false)
const editorError = ref('')
const editingId = ref<string | null>(null)
const customerId = ref('')
const dueDate = ref('')
const notes = ref('')
const paymentMethod = ref<PaymentMethod>('cash')
const paymentReference = ref('')
const lines = ref<DraftLine[]>([])
const { dirty: editorDirty } = useRecordAction(() => ({ customerId: customerId.value, dueDate: dueDate.value, notes: notes.value, paymentMethod: paymentMethod.value, paymentReference: paymentReference.value, lines: lines.value }), editorOpen)
const draftRequestId = ref<string | null>(null)
const issueRequestId = ref<string | null>(null)
const checkoutPaidAt = ref<string | null>(null)
// Keep the exact confirmed command after an uncertain response. Retry must
// neither regenerate its timestamp/key nor save an independently issued draft.
const fastPayAttempt = ref<ShopRpcDatabase['public']['Functions']['fast_pay_location_sale']['Args'] | null>(null)
const searchInteraction = useDebouncedChange<string>(search, value => { debouncedSearch.value = value.trim(); page.value = 1 }, 300)


watch([statusFilter, fromDate, toDate], () => { page.value = 1 })
watch([currentId, currentLocationId], () => { searchInteraction.cancel(); closeEditor(); fastPayAttempt.value = null; page.value = 1 })
watch([customerId, dueDate, notes, paymentMethod, paymentReference, lines], () => {
  if (!saving.value && !issuing.value) {
    draftRequestId.value = null
    issueRequestId.value = null
    checkoutPaidAt.value = null
  }
}, { deep: true })


const { data: catalog, pending: catalogPending, error: catalogError, refresh: refreshCatalog } = useShopQuery(
  'shop-data:sale-catalog', async (): Promise<SaleCatalog | null> => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('sale_catalog', { p_shop_id: currentId.value })
    if (error) throw error
    return data as SaleCatalog
  }, { watch: [currentId], default: () => null },
)

const { data: paymentAccess } = useShopQuery('shop-data:payment-access', async () => {
  if (!currentId.value) return { can_receive: false }
  const { data, error } = await shopRpc.rpc('payment_access', { p_shop_id: currentId.value })
  if (error) throw error
  return data?.[0] ?? { can_receive: false }
}, { watch: [currentId], default: () => ({ can_receive: false }) })

const { data: salePage, pending, error, refresh } = useShopQuery(
  'shop-data:sales', async (): Promise<SalePage> => {
    if (!currentId.value || !currentLocationId.value) return { items: [], total: 0, page: 1, pageSize, canManage: false, canIssue: false }
    const { data: accessRows, error: accessError } = await shopRpc.rpc('sale_access', { p_shop_id: currentId.value })
    if (accessError) throw accessError
    const access = accessRows?.[0]
    if (!access?.can_view) return { items: [], total: 0, page: page.value, pageSize, canManage: false, canIssue: false, permissionDenied: true }
    const { data, error: listError } = await shopRpc.rpc('list_location_sales', {
      p_shop_id: currentId.value,
      p_location_id: currentLocationId.value,
      p_search: debouncedSearch.value || null,
      p_status: statusFilter.value === 'all' ? null : statusFilter.value,
      p_from: fromDate.value || null,
      p_to: toDate.value || null,
      p_page: page.value,
      p_page_size: pageSize,
    })
    if (listError) throw listError
    return data as SalePage
  }, {
    watch: [currentId, currentLocationId, debouncedSearch, statusFilter, fromDate, toDate, page],
    default: (): SalePage => ({ items: [], total: 0, page: 1, pageSize, canManage: false, canIssue: false }),
  },
)

const availableLineTypes = computed<Array<'product' | 'service'>>(() => {
  if (catalog.value?.businessMode === 'product') return ['product']
  if (catalog.value?.businessMode === 'service') return ['service']
  return ['product', 'service']
})

function newLine(type = availableLineTypes.value[0] ?? 'service'): DraftLine {
  return { key: crypto.randomUUID(), itemType: type, sourceId: '', quantity: 1 }
}

function lineCatalog(line: DraftLine) {
  return line.itemType === 'product' ? (catalog.value?.products ?? []) : (catalog.value?.services ?? [])
}

function itemLabel(item: CatalogProduct | CatalogService) {
  return 'stock' in item ? `${item.name} · ${item.stock}` : item.name
}

function selectedItem(line: DraftLine) {
  return lineCatalog(line).find(item => item.id === line.sourceId)
}

function lineAmounts(line: DraftLine) {
  const item = selectedItem(line)
  const price = Number(item?.unitPrice ?? 0)
  const quantity = Number(line.quantity || 0)
  let discount = 0
  if (item && line.itemType === 'service') {
    const service = item as CatalogService
    const unitDiscount = service.discountType === 'percent'
      ? Math.round(price * Number(service.discountValue)) / 100
      : Number(service.discountValue)
    discount = Math.round(unitDiscount * quantity * 100) / 100
  }
  return { price, discount, total: Math.max(0, Math.round((price * quantity - discount) * 100) / 100) }
}

const taxLines = computed(() => lines.value.map(line => ({ item_type: line.itemType, source_id: line.sourceId, quantity: Number(line.quantity) })))
const { data: taxQuote, pending: taxPending, error: taxError } = useSaleTaxQuote(currentId, currentLocationId, taxLines)
const previewTotal = computed(() => Number(taxQuote.value?.total ?? lines.value.reduce((sum, line) => sum + lineAmounts(line).total, 0)))

function resetEditor() {
  fastPayAttempt.value = null
  editingId.value = null
  customerId.value = ''
  dueDate.value = ''
  notes.value = ''
  paymentMethod.value = 'cash'
  paymentReference.value = ''
  lines.value = [newLine()]
  editorError.value = ''
  draftRequestId.value = null
  issueRequestId.value = null
  checkoutPaidAt.value = null
}

function openCreate() {
  resetEditor()
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  editorError.value = ''
}

async function openEdit(saleId: string) {
  if (!currentId.value) return
  editorError.value = ''
  const { data, error } = await shopRpc.rpc('get_sale', { p_shop_id: currentId.value, p_invoice_id: saleId })
  if (error) { editorError.value = readableError(error.message); return }
  const sale = data as SaleDetail | null
  if (!sale || sale.status !== 'draft' || !sale.canManage) return
  fastPayAttempt.value = null
  editingId.value = sale.id
  customerId.value = sale.client_id ?? ''
  dueDate.value = sale.due_date ?? ''
  notes.value = sale.notes ?? ''
  lines.value = sale.lines.map(line => ({
    key: crypto.randomUUID(),
    itemType: line.item_type,
    sourceId: line.product_id ?? line.service_id ?? '',
    quantity: Number(line.quantity),
  }))
  draftRequestId.value = null
  issueRequestId.value = null
  checkoutPaidAt.value = null
  editorOpen.value = true
}

watch(() => route.query.edit, (value) => {
  if (typeof value === 'string' && value) void openEdit(value).finally(() => router.replace({ query: {} }))
}, { immediate: true })

function changeLineType(line: DraftLine) {
  line.sourceId = ''
  line.quantity = 1
}

function addLine() { lines.value.push(newLine()) }
function removeLine(index: number) { if (lines.value.length > 1) lines.value.splice(index, 1) }

function validDraft(requireCustomer = false) {
  return (!requireCustomer || Boolean(customerId.value)) && lines.value.length > 0
    && lines.value.every(line => line.sourceId && Number.isFinite(Number(line.quantity))
      && Number(line.quantity) > 0 && Number(line.quantity) <= 1000000)
}

function readableError(message?: string) {
  if (message?.includes('SALE_OPEN_CASH_SHIFT_REQUIRED')) return t('sales.openCashShiftRequired')
  if (message?.includes('INSUFFICIENT_STOCK')) return saleCopy(t, 'sales.insufficientStock', lines.value)
  if (message?.includes('OUTSTANDING_SALE_REQUIRES_CUSTOMER')) return t('sales.customerRequired')
  if (message?.includes('CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT')) return t('sales.fullPaymentRequired')
  if (message?.includes('FAST_PAY_REQUIRES_FULL_PAYMENT')) return t('sales.fullPaymentRequired')
  if (message?.includes('INVALID_SALE') || message?.includes('UNSUPPORTED_SALE')) return t('sales.invalid')
  if (message?.includes('SHOP_PERMISSION_DENIED') || message?.includes('SHOP_SUBSCRIPTION_INACTIVE')) return t('sales.manageDenied')
  return t('sales.saveError')
}

async function persistDraft() {
  if (!currentId.value || !currentLocationId.value || saving.value || !salePage.value?.canManage || !validDraft()) return null
  saving.value = true
  editorError.value = ''
  draftRequestId.value ??= crypto.randomUUID()
  try {
    const { data, error } = await shopRpc.rpc('save_location_sale_draft', {
      p_request_id: draftRequestId.value,
      p_shop_id: currentId.value,
      p_location_id: currentLocationId.value,
      p_invoice_id: editingId.value,
      p_customer_id: customerId.value || null,
      p_due_date: customerId.value && dueDate.value ? dueDate.value : null,
      p_notes: notes.value.trim() || null,
      p_lines: lines.value.map(line => ({ item_type: line.itemType, source_id: line.sourceId, quantity: Number(line.quantity) })),
    })
    if (error) throw error
    editingId.value = data
    draftRequestId.value = null
    await refresh()
    return data
  }
  catch (error) {
    editorError.value = readableError(shopCommandErrorMessage(error))
    return null
  }
  finally { saving.value = false }
}

async function saveDraft() {
  if (fastPayAttempt.value || issuing.value || saving.value) return
  if (!validDraft()) { editorError.value = t('sales.invalid'); return }
  if (await persistDraft()) {
    closeEditor()
    pushToast({ tone: 'success', title: t('sales.draftSuccess') })
  }
}

async function issue() {
  if (!currentId.value || !currentLocationId.value || issuing.value || saving.value || fastPayAttempt.value || !salePage.value?.canIssue) return
  if (!validDraft()) { editorError.value = t('sales.invalid'); return }
  if (!customerId.value && !paymentAccess.value.can_receive) { editorError.value = t('sales.checkoutDenied'); return }
  if (!await confirmation.ask(customerId.value ? saleCopy(t, 'sales.issueConfirm', lines.value) : saleCopy(t, 'sales.checkoutConfirm', lines.value))) return
  const invoiceId = issueRequestId.value && editingId.value ? editingId.value : await persistDraft()
  if (!invoiceId) return
  issuing.value = true
  issueRequestId.value ??= crypto.randomUUID()
  if (!customerId.value) checkoutPaidAt.value ??= new Date().toISOString()
  try {
    const { error } = customerId.value
      ? await shopRpc.rpc('issue_location_sale', {
          p_request_id: issueRequestId.value, p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_invoice_id: invoiceId,
        })
      : await shopRpc.rpc('checkout_location_sale', {
          p_request_id: issueRequestId.value, p_shop_id: currentId.value,
          p_location_id: currentLocationId.value,
          p_invoice_id: invoiceId, p_amount: previewTotal.value,
          p_paid_at: checkoutPaidAt.value!, p_method: paymentMethod.value,
          p_reference: paymentReference.value.trim() || null,
        })
    if (error) throw error
    issueRequestId.value = null
    checkoutPaidAt.value = null
    closeEditor()
    await Promise.all([
      refresh(), refreshCatalog(),
      refreshShopQueries('shop-data:inventory-overview'),
      refreshShopQueries('shop-data:recent-invoices'),
    ])
    pushToast({ tone: 'success', title: saleCopy(t, customerId.value ? 'sales.issuedSuccess' : 'sales.checkoutSuccess', lines.value) })
    await navigateTo(`/sales/${invoiceId}`)
  }
  catch (error) { editorError.value = readableError(shopCommandErrorMessage(error)) }
  finally { issuing.value = false }
}

async function fastPay() {
  if (taxPending.value || taxError.value || !taxQuote.value) return
  if (!currentId.value || !currentLocationId.value || saving.value || issuing.value
    || !salePage.value?.canManage || !salePage.value.canIssue || !paymentAccess.value.can_receive) return
  if (!validDraft() || previewTotal.value <= 0) { editorError.value = t('sales.invalid'); return }
  issuing.value = true
  editorError.value = ''
  try {
    if (!fastPayAttempt.value) {
      const shopId = currentId.value
      const locationId = currentLocationId.value
      if (!await confirmation.ask(saleCopy(t, 'sales.fastPayConfirm', lines.value, { amount: money(previewTotal.value), method: t(`payments.methods.${paymentMethod.value}`) }))) return
      if (currentId.value !== shopId || currentLocationId.value !== locationId || !editorOpen.value) return
      fastPayAttempt.value = {
        p_request_id: crypto.randomUUID(), p_shop_id: shopId,
        p_location_id: locationId, p_invoice_id: editingId.value,
        p_customer_id: customerId.value || null,
        p_due_date: customerId.value && dueDate.value ? dueDate.value : null,
        p_notes: notes.value.trim() || null,
        p_lines: lines.value.map(line => ({ item_type: line.itemType, source_id: line.sourceId, quantity: Number(line.quantity) })),
        p_amount: previewTotal.value, p_paid_at: new Date().toISOString(),
        p_method: paymentMethod.value, p_reference: paymentReference.value.trim() || null,
      }
    }
    const attempt = fastPayAttempt.value
    const { data, error } = await shopRpc.rpc('fast_pay_location_sale', attempt)
    if (error) throw error
    if (!data) throw new Error('FAST_PAY_RESULT_MISSING')
    if (currentId.value !== attempt.p_shop_id || currentLocationId.value !== attempt.p_location_id) return
    closeEditor()
    // Refresh failures must not prevent handing off a committed payment.
    void Promise.allSettled([
      refresh(), refreshCatalog(), refreshShopQueries('shop-data:inventory-overview'),
      refreshShopQueries('shop-data:recent-invoices'), refreshShopQueries('shop-data:customer-statement'),
      refreshShopQueries('shop-data:cash-shifts'),
    ])
    await navigateTo(`/sales/${data}/receipt`)
  }
  catch (error) { editorError.value = readableError(shopCommandErrorMessage(error)) }
  finally { issuing.value = false }
}

function money(value: number, currency = businessCurrency.value) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 20 }).format(value)
}
function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}


useShopRealtime('sales', () => editorDirty.value)

const salesForm = computed<BsSalesDraftForm>({
  get: () => ({ customerId: customerId.value, dueDate: dueDate.value, notes: notes.value, paymentMethod: paymentMethod.value, paymentReference: paymentReference.value, lines: lines.value }),
  set: value => { customerId.value = value.customerId; dueDate.value = value.dueDate; notes.value = value.notes; paymentReference.value = value.paymentReference; if (['cash','bank_transfer','card','wallet','cheque','other'].includes(value.paymentMethod)) paymentMethod.value = value.paymentMethod as PaymentMethod; lines.value = value.lines.map(line => ({ ...line, itemType: line.itemType === 'product' ? 'product' : 'service' })) },
})
const salesStatus = computed<string>({ get: () => statusFilter.value, set: value => { if (value === 'all' || value === 'draft' || value === 'issued') statusFilter.value = value } })
const salesRows = computed<BsSalesDirectoryRow[]>(() => (salePage.value?.items ?? []).map(sale => ({ id: sale.id, number: sale.invoice_number || t('sales.draftNumber'), lineCount: `${sale.line_count} ${t('sales.lines')}`, customer: sale.client_name_snapshot || '—', status: t(`sales.${sale.status}`), statusTone: sale.status === 'issued' ? 'success' : 'neutral', total: money(Number(sale.total_amount), sale.status === 'draft' ? businessCurrency.value : sale.currency || businessCurrency.value), date: formatDate(sale.issued_at || sale.created_at), editable: sale.status === 'draft' && !!salePage.value?.canManage, href: `/sales/${sale.id}` })))
const salesLines = computed<BsSalesLineView[]>(() => lines.value.map(line => ({ key: line.key, options: lineCatalog(line).map(item => ({ value: item.id, label: itemLabel(item) })), total: money(lineAmounts(line).total), discount: lineAmounts(line).discount ? money(lineAmounts(line).discount) : '' })))
const salesView = computed<BsSalesDirectoryView>(() => ({ available: !!current.value, loadingContext: shopLoading.value, denied: !!salePage.value?.permissionDenied, canManage: !!salePage.value?.canManage, canIssue: !!salePage.value?.canIssue, canFastPay: !!salePage.value?.canManage && !!salePage.value.canIssue && paymentAccess.value.can_receive && !taxPending.value && !taxError.value, loading: pending.value, error: error.value ? t('sales.loadError') : '', total: salePage.value?.total ?? 0, pageSize, catalogLoading: catalogPending.value, catalogError: !!catalogError.value, editing: !!editingId.value, saving: saving.value, issuing: issuing.value, errorMessage: editorError.value || (taxError.value ? (locale.value === 'ar' ? 'تعذر تأكيد حساب الضريبة. حاول تاني.' : 'Unable to confirm tax calculation. Retry.') : ''), dirty: editorDirty.value, locked: !!fastPayAttempt.value, previewTotal: money(previewTotal.value) }))
function updateLineType(index: number, value: string) { const line = lines.value[index]; if (!line || (value !== 'product' && value !== 'service') || !availableLineTypes.value.includes(value)) return; line.itemType = value; changeLineType(line) }
const salesCopy = computed<BsSalesDirectoryCopy>(() => ({
  addLine: t('sales.addLine'),
  allStatuses: t('sales.allStatuses'),
  cancel: t('sales.cancel'),
  catalogError: t('sales.catalogError'),
  customer: t('sales.customer'),
  customerlessNotice: t('sales.customerlessNotice'),
  date: t('sales.date'),
  discount: t('sales.discount'),
  draft: t('sales.draft'),
  draftNumber: t('sales.draftNumber'),
  dueDate: t('sales.dueDate'),
  edit: t('sales.edit'),
  editDraft: t('sales.editDraft'),
  empty: t('sales.empty'),
  fastPay: t('sales.fastPay'),
  fastPayRetry: t('sales.fastPayRetry'),
  from: t('sales.from'),
  invoiceNumber: t('sales.invoiceNumber'),
  issued: t('sales.issued'),
  issuing: t('sales.issuing'),
  item: t('sales.item'),
  lineTotal: t('sales.lineTotal'),
  lines: t('sales.lines'),
  loadError: t('sales.loadError'),
  manageDenied: t('sales.manageDenied'),
  newSale: t('sales.newSale'),
  noShop: t('sales.noShop'),
  notes: t('sales.notes'),
  paymentBoundary: t('sales.paymentBoundary'),
  permissionDenied: t('sales.permissionDenied'),
  previewNotice: t('sales.previewNotice'),
  quantity: t('sales.quantity'),
  removeLine: t('sales.removeLine'),
  saveDraft: t('sales.saveDraft'),
  saving: t('sales.saving'),
  search: t('sales.search'),
  selectCustomer: t('sales.selectCustomer'),
  selectItem: t('sales.selectItem'),
  status: t('sales.status'),
  subtitle: t('sales.subtitle'),
  title: t('sales.title'),
  to: t('sales.to'),
  total: t('sales.total'),
  retry: t('common.retry'), paymentMethod: t('payments.method'), paymentReference: t('payments.reference'), stockNotice: saleCopy(t, 'sales.stockNotice', lines.value), issueLabel: t(customerId.value ? 'sales.issue' : 'sales.checkout'),
}))
const salesStatusOptions = computed(() => ['all','draft','issued'].map(value => ({ value, label: t(value === 'all' ? 'sales.allStatuses' : `sales.${value}`) })))
const salesCustomerOptions = computed(() => [{ value: '', label: t('sales.selectCustomer') }, ...(catalog.value?.customers ?? []).map(item => ({ value: item.id, label: item.name }))])
const salesPaymentOptions = computed(() => ['cash','bank_transfer','card','wallet','cheque','other'].map(value => ({ value, label: t(`payments.methods.${value}`) })))
const salesLineTypeOptions = computed(() => availableLineTypes.value.map(value => ({ value, label: t(`sales.${value}`) })))
</script>

<template>
  <BsSalesDirectoryPage v-model:form="salesForm" v-model:search="search" v-model:status="salesStatus" v-model:from-date="fromDate" v-model:to-date="toDate" v-model:page="page" v-model:editor-open="editorOpen" :copy="salesCopy" :view="salesView" :rows="salesRows" :line-views="salesLines" :status-options="salesStatusOptions" :customer-options="salesCustomerOptions" :payment-options="salesPaymentOptions" :line-type-options="salesLineTypeOptions" @create="openCreate" @retry="refresh" @retry-catalog="refreshCatalog" @save="saveDraft" @issue="issue" @fast-pay="fastPay" @add-line="addLine" @remove-line="removeLine" @line-type="updateLineType" @edit="openEdit" @page="page = $event" />
</template>
