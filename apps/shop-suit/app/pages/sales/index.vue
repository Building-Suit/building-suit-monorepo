<script setup lang="ts">
import { saleCopy } from '~/utils/saleCopy'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type SaleStatus = 'draft' | 'issued'
type SaleRow = {
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

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
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
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value.trim(); page.value = 1 }, 300)
})
watch([statusFilter, fromDate, toDate], () => { page.value = 1 })
watch([currentId, currentLocationId], () => { closeEditor(); fastPayAttempt.value = null; page.value = 1 })
watch([customerId, dueDate, notes, paymentMethod, paymentReference, lines], () => {
  if (!saving.value && !issuing.value) {
    draftRequestId.value = null
    issueRequestId.value = null
    checkoutPaidAt.value = null
  }
}, { deep: true })
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })

const { data: catalog, pending: catalogPending, error: catalogError, refresh: refreshCatalog } = useAsyncData(
  'shop-data:sale-catalog', async (): Promise<SaleCatalog | null> => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('sale_catalog', { p_shop_id: currentId.value })
    if (error) throw error
    return data as SaleCatalog
  }, { watch: [currentId], default: () => null },
)

const { data: paymentAccess } = useAsyncData('shop-data:payment-access', async () => {
  if (!currentId.value) return { can_receive: false }
  const { data, error } = await shopRpc.rpc('payment_access', { p_shop_id: currentId.value })
  if (error) throw error
  return data?.[0] ?? { can_receive: false }
}, { watch: [currentId], default: () => ({ can_receive: false }) })

const { data: salePage, pending, error, refresh } = useAsyncData(
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

const previewTotal = computed(() => lines.value.reduce((sum, line) => sum + lineAmounts(line).total, 0))

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
      refreshNuxtData('shop-data:inventory-overview'),
      refreshNuxtData('shop-data:recent-invoices'),
    ])
    pushToast({ tone: 'success', title: saleCopy(t, customerId.value ? 'sales.issuedSuccess' : 'sales.checkoutSuccess', lines.value) })
    await navigateTo(`/sales/${invoiceId}`)
  }
  catch (error) { editorError.value = readableError(shopCommandErrorMessage(error)) }
  finally { issuing.value = false }
}

async function fastPay() {
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
      refresh(), refreshCatalog(), refreshNuxtData('shop-data:inventory-overview'),
      refreshNuxtData('shop-data:recent-invoices'), refreshNuxtData('shop-data:customer-statement'),
      refreshNuxtData('shop-data:cash-shifts'),
    ])
    await navigateTo(`/sales/${data}/receipt`)
  }
  catch (error) { editorError.value = readableError(shopCommandErrorMessage(error)) }
  finally { issuing.value = false }
}

function money(value: number) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(value)
}
function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function handlePage(event: { page: number }) { page.value = event.page + 1 }

useShopRealtime('sales', () => editorDirty.value)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ t('sales.title') }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ t('sales.subtitle') }}</p></div>
      <BsButton v-if="current && salePage?.canManage" type="button" class="ls-btn ls-btn-primary" :disabled="catalogPending" @click="openCreate">{{ t('sales.newSale') }}</BsButton>
    </header>

    <div v-if="!current && !shopLoading" class="ls-card p-8 text-center text-sm">{{ t('sales.noShop') }}</div>
    <template v-else-if="current">
      <p v-if="salePage?.permissionDenied" role="alert" class="rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm">{{ t('sales.permissionDenied') }}</p>
      <p v-else-if="salePage && !salePage.canManage" class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ t('sales.manageDenied') }}</p>
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ t('sales.paymentBoundary') }}</p>

      <div v-if="!salePage?.permissionDenied" class="overflow-hidden ls-card">
        <div class="grid gap-3 border-b border-border p-4 sm:grid-cols-2 xl:grid-cols-5">
          <input v-model="search" type="search" :placeholder="t('sales.search')" :aria-label="t('sales.search')" class="ls-input xl:col-span-2">
          <select v-model="statusFilter" :aria-label="t('sales.status')" class="ls-select"><option value="all">{{ t('sales.allStatuses') }}</option><option value="draft">{{ t('sales.draft') }}</option><option value="issued">{{ t('sales.issued') }}</option></select>
          <label class="text-xs font-bold text-muted-foreground">{{ t('sales.from') }}<input v-model="fromDate" type="date" class="ls-input mt-1"></label>
          <label class="text-xs font-bold text-muted-foreground">{{ t('sales.to') }}<input v-model="toDate" type="date" class="ls-input mt-1"></label>
        </div>
        <BsDataTable :value="salePage?.items ?? []" :loading="pending" :error="error ? t('sales.loadError') : null" :label="t('sales.title')" data-key="id" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="salePage?.total ?? 0" :always-show-paginator="false" :row-class="() => 'border-t border-border'" @page="handlePage" @retry="refresh()">
          <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4"><template #header>{{ t('sales.invoiceNumber') }}</template><template #body="{ data: sale }"><NuxtLink :to="`/sales/${sale.id}`" class="font-bold text-[var(--bs-link)]">{{ sale.invoice_number || t('sales.draftNumber') }}</NuxtLink><p class="text-xs text-muted-foreground">{{ sale.line_count }} {{ t('sales.lines') }}</p></template></Column>
          <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4"><template #header>{{ t('sales.customer') }}</template><template #body="{ data: sale }">{{ sale.client_name_snapshot || '—' }}</template></Column>
          <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4"><template #header>{{ t('sales.status') }}</template><template #body="{ data: sale }"><span class="ls-badge" :class="sale.status === 'issued' ? 'bg-[var(--bs-status-success-bg)] text-fg' : 'bg-muted text-muted-foreground'">{{ t(`sales.${sale.status}`) }}</span></template></Column>
          <Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ t('sales.total') }}</template><template #body="{ data: sale }">{{ money(Number(sale.total_amount)) }}</template></Column>
          <Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ t('sales.date') }}</template><template #body="{ data: sale }"><p>{{ formatDate(sale.issued_at || sale.created_at) }}</p><BsButton variant="link" v-if="sale.status === 'draft' && salePage?.canManage" type="button" class="mt-1 text-sm font-bold text-[var(--bs-link)]" @click="openEdit(sale.id)">{{ t('sales.edit') }}</BsButton></template></Column>
          <template #empty><p class="p-8 text-center text-sm text-muted-foreground">{{ t('sales.empty') }}</p></template>
        </BsDataTable>
      </div>
    </template>

    <p v-if="editorError && !editorOpen" role="alert" class="ls-error">{{ editorError }}</p>
    <BsRecordActionDialog v-model:visible="editorOpen" :title="editingId ? t('sales.editDraft') : t('sales.newSale')" :dirty="editorDirty" :pending="saving || issuing" :error="editorError" size="lg" @submit="saveDraft">
          <p v-if="fastPayAttempt" role="status" class="text-sm text-muted-foreground">{{ t('sales.fastPayRetry') }}</p>
          <fieldset :disabled="Boolean(fastPayAttempt)" class="space-y-5">
          <p v-if="catalogError" role="alert">{{ t('sales.catalogError') }} <BsButton @click="refreshCatalog()">{{ t('common.retry') }}</BsButton></p>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-2 text-sm font-bold">{{ t('sales.customer') }}<BsSelect v-model="customerId" :label="t('sales.customer')" :options="[{ id: '', name: t('sales.selectCustomer') }, ...(catalog?.customers ?? [])]" option-label="name" option-value="id" filter virtual :disabled="catalogPending || saving || issuing || Boolean(fastPayAttempt)" /></label>
            <label class="space-y-2 text-sm font-bold">{{ t('sales.dueDate') }}<input v-model="dueDate" type="date" class="ls-input" :disabled="!customerId"></label>
            <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ t('sales.notes') }}<input v-model="notes" maxlength="2000" class="ls-input"></label>
          </div>
          <div v-if="paymentAccess.can_receive" class="grid gap-4 sm:grid-cols-2">
            <p v-if="!customerId" class="text-sm sm:col-span-2">{{ t('sales.customerlessNotice') }}</p>
            <label class="space-y-2 text-sm font-bold">{{ t('payments.method') }}<select v-model="paymentMethod" class="ls-select"><option v-for="method in ['cash','bank_transfer','card','wallet','cheque','other']" :key="method" :value="method">{{ t(`payments.methods.${method}`) }}</option></select></label>
            <label class="space-y-2 text-sm font-bold">{{ t('payments.reference') }}<input v-model="paymentReference" maxlength="200" class="ls-input"></label>
          </div>
          <div class="space-y-3">
            <div class="flex items-center justify-between"><h2 class="font-bold">{{ t('sales.lines') }}</h2><BsButton type="button" class="ls-btn ls-btn-sm" @click="addLine">{{ t('sales.addLine') }}</BsButton></div>
            <div v-for="(line, index) in lines" :key="line.key" class="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-6">
              <label class="space-y-1 text-xs font-bold"><span>{{ t('sales.lines') }}</span><select v-model="line.itemType" class="ls-select" @change="changeLineType(line)"><option v-for="type in availableLineTypes" :key="type" :value="type">{{ t(`sales.${type}`) }}</option></select></label>
              <label class="space-y-1 text-xs font-bold sm:col-span-2"><span>{{ t('sales.item') }}</span><BsSelect v-model="line.sourceId" :label="t('sales.item')" :options="lineCatalog(line)" :option-label="itemLabel" option-value="id" :placeholder="t('sales.selectItem')" :invalid="Boolean(editorError) && !line.sourceId" :aria-required="true" :disabled="catalogPending || saving || issuing || Boolean(fastPayAttempt)" filter virtual /></label>
              <label class="space-y-1 text-xs font-bold"><span>{{ t('sales.quantity') }}</span><input v-model.number="line.quantity" type="number" min="0.001" max="1000000" step="0.001" required class="ls-input"></label>
              <div class="text-sm"><p class="text-xs font-bold text-muted-foreground">{{ t('sales.lineTotal') }}</p><p class="mt-2 font-bold">{{ money(lineAmounts(line).total) }}</p><p v-if="lineAmounts(line).discount" class="text-xs text-muted-foreground">{{ t('sales.discount') }}: {{ money(lineAmounts(line).discount) }}</p></div>
              <div class="flex items-end justify-end"><BsButton type="button" class="text-sm font-bold text-fg disabled:opacity-40" :disabled="lines.length === 1" @click="removeLine(index)">{{ t('sales.removeLine') }}</BsButton></div>
            </div>
          </div>
          <div class="rounded-xl bg-muted p-4"><p class="text-sm">{{ t('sales.previewNotice') }}</p><p class="mt-1 text-sm">{{ saleCopy(t, 'sales.stockNotice', lines) }}</p><p class="mt-3 text-xl font-extrabold">{{ t('sales.total') }}: {{ money(previewTotal) }}</p></div>
          </fieldset>
      <template #actions="{ close }"><BsButton type="submit" :disabled="saving || issuing || Boolean(fastPayAttempt)">{{ saving ? t('sales.saving') : t('sales.saveDraft') }}</BsButton><BsButton v-if="salePage?.canIssue" type="button" variant="primary" :disabled="saving || issuing || Boolean(fastPayAttempt)" @click="issue">{{ issuing ? t('sales.issuing') : t(customerId ? 'sales.issue' : 'sales.checkout') }}</BsButton><BsButton v-if="salePage?.canIssue && paymentAccess.can_receive" type="button" variant="primary" :pending="issuing" :disabled="saving || issuing" @click="fastPay">{{ t('sales.fastPay') }}</BsButton><BsButton type="button" :disabled="saving || issuing" @click="close">{{ t('sales.cancel') }}</BsButton></template>
    </BsRecordActionDialog>
  </div>
</template>
