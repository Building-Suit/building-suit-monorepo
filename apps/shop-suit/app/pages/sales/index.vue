<script setup lang="ts">
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
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value.trim(); page.value = 1 }, 300)
})
watch([statusFilter, fromDate, toDate], () => { page.value = 1 })
watch([currentId, currentLocationId], () => { closeEditor(); page.value = 1 })
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
  if (message?.includes('INSUFFICIENT_STOCK')) return t('sales.insufficientStock')
  if (message?.includes('OUTSTANDING_SALE_REQUIRES_CUSTOMER')) return t('sales.customerRequired')
  if (message?.includes('CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT')) return t('sales.fullPaymentRequired')
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
  if (!validDraft()) { editorError.value = t('sales.invalid'); return }
  if (await persistDraft()) {
    closeEditor()
    pushToast({ tone: 'success', title: t('sales.draftSuccess') })
  }
}

async function issue() {
  if (!currentId.value || !currentLocationId.value || issuing.value || !salePage.value?.canIssue) return
  if (!validDraft()) { editorError.value = t('sales.invalid'); return }
  if (!customerId.value && !paymentAccess.value.can_receive) { editorError.value = t('sales.checkoutDenied'); return }
  if (!await confirmation.ask(customerId.value ? t('sales.issueConfirm') : t('sales.checkoutConfirm'))) return
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
    pushToast({ tone: 'success', title: t(customerId.value ? 'sales.issuedSuccess' : 'sales.checkoutSuccess') })
    await navigateTo(`/sales/${invoiceId}`)
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
</script>

<template>
  <BsStack>
    <BsPageHeader  :title="t('sales.title')" :subtitle="t('sales.subtitle')">
      <template #actions>
        <BsButton v-if="current && salePage?.canManage" type="button" :disabled="catalogPending" @click="openCreate">{{ t('sales.newSale') }}</BsButton>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!current && !shopLoading" padding="md">{{ t('sales.noShop') }}</BsPanel>
    <template v-else-if="current">
      <BsText v-if="salePage?.permissionDenied" role="alert" as="p" size="sm" tone="warning">{{ t('sales.permissionDenied') }}</BsText>
      <BsText v-else-if="salePage && !salePage.canManage" as="p" size="sm">{{ t('sales.manageDenied') }}</BsText>
      <BsText as="p" size="sm">{{ t('sales.paymentBoundary') }}</BsText>
      <BsPanel v-if="!salePage?.permissionDenied" padding="md">
        <BsGrid :columns="2">
          <BsInput v-model="search" type="search" :placeholder="t('sales.search')" :aria-label="t('sales.search')"/>
          <BsSelect v-model="statusFilter" :label="t('sales.status')" :options="[{ value: 'all', label: (t('sales.allStatuses')), disabled: false }, { value: 'draft', label: (t('sales.draft')), disabled: false }, { value: 'issued', label: (t('sales.issued')), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
          <BsField v-slot="field" :label="(t('sales.from'))">
            <BsInput :id="field.id" v-model="fromDate" :aria-describedby="field.describedby" type="date"/>
          </BsField>
          <BsField v-slot="field" :label="(t('sales.to'))">
            <BsInput :id="field.id" v-model="toDate" :aria-describedby="field.describedby" type="date"/>
          </BsField>
        </BsGrid>
        <BsDataTable :value="salePage?.items ?? []" :loading="pending" :error="error ? t('sales.loadError') : null" :label="t('sales.title')" data-key="id" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="salePage?.total ?? 0" :always-show-paginator="false" :columns="[{ key: 'column0', header: (t('sales.invoiceNumber')) }, { key: 'column1', header: (t('sales.customer')) }, { key: 'column2', header: (t('sales.status')) }, { key: 'column3', header: (t('sales.total')), align: 'end' }, { key: 'column4', header: (t('sales.date')), align: 'end' }]" @page="handlePage" @retry="refresh()">
          <template #cell-column0="{ row: sale }">
            <BsLink :to="`/sales/${sale.id}`">{{ sale.invoice_number || t('sales.draftNumber') }}</BsLink>
            <BsText as="p" size="xs" tone="muted">{{ sale.line_count }} {{ t('sales.lines') }}</BsText>
          </template>
          <template #cell-column1="{ row: sale }">{{ sale.client_name_snapshot || '—' }}</template>
          <template #cell-column2="{ row: sale }">
            <BsText as="span">{{ t(`sales.${sale.status}`) }}</BsText>
          </template>
          <template #cell-column3="{ row: sale }">{{ money(Number(sale.total_amount)) }}</template>
          <template #cell-column4="{ row: sale }">
            <BsText as="p">{{ formatDate(sale.issued_at || sale.created_at) }}</BsText>
            <BsButton v-if="sale.status === 'draft' && salePage?.canManage" variant="link" type="button" @click="openEdit(sale.id)">{{ t('sales.edit') }}</BsButton>
          </template>
          <template #empty>
            <BsText as="p" size="sm" tone="muted">{{ t('sales.empty') }}</BsText>
          </template>
        </BsDataTable>
      </BsPanel>
    </template>
    <BsText v-if="editorError && !editorOpen" role="alert" as="p">{{ editorError }}</BsText>
    <BsRecordActionDialog v-model:visible="editorOpen" :title="editingId ? t('sales.editDraft') : t('sales.newSale')" :dirty="editorDirty" :pending="saving || issuing" :error="editorError" size="lg" @submit="saveDraft">
      <BsText v-if="catalogError" role="alert" as="p">{{ t('sales.catalogError') }} <BsButton @click="refreshCatalog()">{{ t('common.retry') }}</BsButton>
      </BsText>
      <BsGrid :columns="2">
        <BsField v-slot="field" :label="(t('sales.customer'))">
          <BsSelect v-model="customerId" :input-id="field.id" :aria-describedby="field.describedby" :label="t('sales.customer')" :options="[{ id: '', name: t('sales.selectCustomer') }, ...(catalog?.customers ?? [])]" option-label="name" option-value="id" filter virtual :disabled="catalogPending || saving || issuing"/>
        </BsField>
        <BsField v-slot="field" :label="(t('sales.dueDate'))">
          <BsInput :id="field.id" v-model="dueDate" :aria-describedby="field.describedby" type="date" :disabled="!customerId"/>
        </BsField>
        <BsField v-slot="field" :label="(t('sales.notes'))">
          <BsInput :id="field.id" v-model="notes" :aria-describedby="field.describedby" :maxlength="2000"/>
        </BsField>
      </BsGrid>
      <BsGrid v-if="!customerId" :columns="2">
        <BsText as="p" size="sm">{{ t('sales.customerlessNotice') }}</BsText>
        <BsField v-slot="field" :label="(t('payments.method'))">
          <BsSelect v-model="paymentMethod" :input-id="field.id" :aria-describedby="field.describedby" :label="(t('payments.method'))" :options="[...(['cash','bank_transfer','card','wallet','cheque','other']).map(method => ({ value: method, label: (t(`payments.methods.${method}`)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
        </BsField>
        <BsField v-slot="field" :label="(t('payments.reference'))">
          <BsInput :id="field.id" v-model="paymentReference" :aria-describedby="field.describedby" :maxlength="200"/>
        </BsField>
      </BsGrid>
      <BsStack>
        <BsInline justify="between">
          <BsHeading :level="2">{{ t('sales.lines') }}</BsHeading>
          <BsButton type="button" @click="addLine">{{ t('sales.addLine') }}</BsButton>
        </BsInline>
        <BsGrid v-for="(line, index) in lines" :key="line.key" :columns="2">
          <BsField v-slot="field" :label="(t('sales.lines'))">
            <BsSelect v-model="line.itemType" :input-id="field.id" :aria-describedby="field.describedby" :label="(t('sales.lines'))" :options="[...(availableLineTypes).map(type => ({ value: type, label: (t(`sales.${type}`)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled" @change="changeLineType(line)"/>
          </BsField>
          <BsField v-slot="field" :label="(t('sales.item'))">
            <BsSelect v-model="line.sourceId" :input-id="field.id" :aria-describedby="field.describedby" :label="t('sales.item')" :options="lineCatalog(line)" :option-label="itemLabel" option-value="id" :placeholder="t('sales.selectItem')" :invalid="Boolean(editorError) && !line.sourceId" :aria-required="true" :disabled="catalogPending || saving || issuing" filter virtual/>
          </BsField>
          <BsField v-slot="field" :label="(t('sales.quantity'))">
            <BsInput :id="field.id" v-model.number="line.quantity" :aria-describedby="field.describedby" type="number" :min="0.001" :max="1000000" :step="0.001" required/>
          </BsField>
          <BsBox>
            <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ t('sales.lineTotal') }}</BsText>
            <BsText as="p" emphasis="semibold">{{ money(lineAmounts(line).total) }}</BsText>
            <BsText v-if="lineAmounts(line).discount" as="p" size="xs" tone="muted">{{ t('sales.discount') }}: {{ money(lineAmounts(line).discount) }}</BsText>
          </BsBox>
          <BsInline>
            <BsButton type="button" :disabled="lines.length === 1" @click="removeLine(index)">{{ t('sales.removeLine') }}</BsButton>
          </BsInline>
        </BsGrid>
      </BsStack>
      <BsBox padding="md">
        <BsText as="p" size="sm">{{ t('sales.previewNotice') }}</BsText>
        <BsText as="p" size="sm">{{ t('sales.stockNotice') }}</BsText>
        <BsText as="p" size="lg" emphasis="semibold">{{ t('sales.total') }}: {{ money(previewTotal) }}</BsText>
      </BsBox>
      <template #actions="{ close }">
        <BsButton type="submit" :disabled="saving || issuing">{{ saving ? t('sales.saving') : t('sales.saveDraft') }}</BsButton>
        <BsButton v-if="salePage?.canIssue" type="button" variant="primary" :disabled="saving || issuing" @click="issue">{{ issuing ? t('sales.issuing') : t(customerId ? 'sales.issue' : 'sales.checkout') }}</BsButton>
        <BsButton type="button" :disabled="saving || issuing" @click="close">{{ t('sales.cancel') }}</BsButton>
      </template>
    </BsRecordActionDialog>
  </BsStack>
</template>
