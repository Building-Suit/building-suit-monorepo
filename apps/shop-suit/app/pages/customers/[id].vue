<script setup lang="ts">
import type { BsCustomerIdentityForm } from '@building-suit/ui/types/customerDirectoryPresentation'
import type { BsCustomerProfileView, BsCustomerReceivablesView, BsCustomerStatementView, BsCustomerProfileCopy, BsCustomerReceiptForm } from '@building-suit/ui/types/customerProfilePresentation'
import { receiptAllocations as validateReceiptAllocations } from '~/utils/receiptAllocations'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const { refreshShopQueries } = useShopInvalidation()

const { businessCurrency } = useShop()

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type CustomerDetail = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at: string | null
  can_manage: boolean
}
type StatementEvent = { event_id: string; event_type: 'sale' | 'receipt' | 'reversal' | 'refund' | 'void' | 'full_return'; event_at: string; invoice_id: string | null; order_id?: string | null; document_number: string; debit: number; credit: number; method: string | null; reference: string | null; running_balance: number }
type StatementPage = { items: StatementEvent[]; total: number; page: number; pageSize: number; outstanding: number }
type OutstandingInvoice = { id: string; invoice_number: string; total_amount: number; outstanding: number; due_date: string | null; settlement_state: 'unpaid' | 'partial'; overdue: boolean }
type OutstandingPage = { items: OutstandingInvoice[]; total: number }
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'

const route = useRoute()
const shopRpc = useShopClient<ShopRpcDatabase>().schema('public')
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const { t, locale } = useI18n()
const { currentId } = useShop()
const customerId = computed(() => String(route.params.id ?? ''))
const form = reactive({ name: '', phone: '', email: '', address: '', notes: '' })
const actionError = ref('')
const statementPageNumber = ref(1)
const statementPageSize = 20
const archiving = ref(false)
const outstandingPage = ref(1)
const outstandingPageSize = 20
const receiptInvoices = ref<Record<string, OutstandingInvoice>>({})
const receiptOpen = ref(false)
const receiptPending = ref(false)
const receiptError = ref('')
const receiptDate = ref(new Date().toISOString().slice(0, 10))
const receiptMethod = ref<PaymentMethod>('cash')
const receiptReference = ref('')
const receiptNotes = ref('')
const receiptAllocations = ref<Record<string, number>>({})
const { dirty: receiptDirty } = useRecordAction(() => ({ date: receiptDate.value, method: receiptMethod.value, reference: receiptReference.value, notes: receiptNotes.value, allocations: receiptAllocations.value }), receiptOpen)
const receiptRequestId = ref<string | null>(null)
const receiptAmount = computed(() => Math.round(Object.values(receiptAllocations.value).reduce((total, amount) => total + Number(amount || 0), 0) * 100) / 100)
watch([receiptDate, receiptMethod, receiptReference, receiptNotes, receiptAllocations], () => {
  if (!receiptPending.value) receiptRequestId.value = null
}, { deep: true })
const { visible: showForm, pending: saving, dirty: formDirty, complete } = useRecordAction(() => form)

const { data: paymentAccess } = useShopQuery(
  () => `shop-data:customer-payment-access:${currentId.value ?? 'none'}`,
  async () => {
    if (!currentId.value) return { can_receive: false }
    const { data, error } = await shopRpc.rpc('payment_access', { p_shop_id: currentId.value })
    if (error) throw error
    return data?.[0] ?? { can_receive: false }
  }, { watch: [currentId], default: () => ({ can_receive: false }) },
)

const { data: customer, pending, error, refresh } = useShopQuery(
  () => `shop-data:customer:${currentId.value ?? 'none'}:${customerId.value}`,
  async (): Promise<CustomerDetail | null> => {
    if (!currentId.value || !customerId.value) return null
    const { data, error: queryError } = await shopRpc.rpc('get_customer', {
      p_shop_id: currentId.value,
      p_customer_id: customerId.value,
    })
    if (queryError) throw queryError
    return data?.[0] ?? null
  },
  { watch: [currentId, customerId], default: () => null },
)

const { data: statement, pending: statementPending, error: statementError, refresh: refreshStatement } = useShopQuery(
  () => `shop-data:customer-statement:${currentId.value ?? 'none'}:${customerId.value}:${statementPageNumber.value}`,
  async (): Promise<StatementPage> => {
    if (!currentId.value || !customerId.value) return { items: [], total: 0, page: 1, pageSize: statementPageSize, outstanding: 0 }
    const { data, error } = await shopRpc.rpc('customer_statement', { p_shop_id: currentId.value, p_customer_id: customerId.value, p_page: statementPageNumber.value, p_page_size: statementPageSize })
    if (error) throw error
    return data as StatementPage
  }, { watch: [currentId, customerId, statementPageNumber], default: () => ({ items: [], total: 0, page: 1, pageSize: statementPageSize, outstanding: 0 }) },
)

const { data: outstanding, pending: outstandingPending, error: outstandingError, refresh: refreshOutstanding } = useShopQuery(
  () => `shop-data:customer-outstanding:${currentId.value ?? 'none'}:${customerId.value}:${outstandingPage.value}`,
  async (): Promise<OutstandingPage> => {
    if (!currentId.value || !customerId.value) return { items: [], total: 0 }
    const { data, error } = await shopRpc.rpc('list_outstanding_invoices', { p_shop_id: currentId.value, p_customer_id: customerId.value, p_overdue_only: false, p_page: outstandingPage.value, p_page_size: outstandingPageSize })
    if (error) throw error
    return data as OutstandingPage
  }, { watch: [currentId, customerId, outstandingPage], default: () => ({ items: [], total: 0 }) },
)

const { data: overdue, pending: overduePending, error: overdueError, refresh: refreshOverdue } = useShopQuery(
  () => `shop-data:customer-overdue:${currentId.value ?? 'none'}:${customerId.value}`,
  async (): Promise<OutstandingPage> => {
    if (!currentId.value || !customerId.value) return { items: [], total: 0 }
    const { data, error } = await shopRpc.rpc('list_outstanding_invoices', { p_shop_id: currentId.value, p_customer_id: customerId.value, p_overdue_only: true, p_page: 1, p_page_size: 1 })
    if (error) throw error
    return data as OutstandingPage
  }, { watch: [currentId, customerId], default: () => ({ items: [], total: 0 }) },
)
async function retryOutstanding() { await Promise.all([refreshOutstanding(), refreshOverdue()]) }

watch([currentId, customerId], () => {
  receiptOpen.value = false; showForm.value = false
  receiptAllocations.value = {}; receiptInvoices.value = {}; receiptRequestId.value = null
  outstandingPage.value = 1; statementPageNumber.value = 1
  actionError.value = ''; receiptError.value = ''
})
watch(outstanding, (value) => {
  if (receiptOpen.value) for (const invoice of value.items) receiptInvoices.value[invoice.id] = invoice
})

function openReceipt() {
  if (!customer.value?.is_active || !paymentAccess.value?.can_receive || outstandingPending.value || outstandingError.value) return
  receiptInvoices.value = Object.fromEntries(outstanding.value.items.map(invoice => [invoice.id, invoice]))
  receiptError.value = ''
  receiptAllocations.value = {}
  receiptDate.value = new Date().toISOString().slice(0, 10)
  receiptMethod.value = 'cash'
  receiptReference.value = ''
  receiptNotes.value = ''
  receiptRequestId.value = null
  receiptOpen.value = true
}

async function saveReceipt() {
  if (!currentId.value || !customer.value?.is_active || !paymentAccess.value?.can_receive || receiptPending.value || outstandingPending.value || outstandingError.value) return
  const allocations = validateReceiptAllocations(receiptAllocations.value, receiptInvoices.value)
  if (!allocations) {
    receiptError.value = t('payments.invalidAllocation')
    return
  }
  receiptPending.value = true
  receiptError.value = ''
  receiptRequestId.value ??= crypto.randomUUID()
  try {
    const { error } = await shopRpc.rpc('record_customer_receipt', {
      p_request_id: receiptRequestId.value, p_shop_id: currentId.value,
      p_customer_id: customer.value.id, p_amount: receiptAmount.value,
      p_paid_at: new Date(`${receiptDate.value}T12:00:00`).toISOString(),
      p_method: receiptMethod.value, p_reference: receiptReference.value.trim() || null,
      p_notes: receiptNotes.value.trim() || null, p_allocations: allocations,
    })
    if (error) throw error
    receiptOpen.value = false
    receiptRequestId.value = null
    await Promise.all([refreshOutstanding(), refreshOverdue(), refreshStatement(), refreshShopQueries(key => key.startsWith(`shop-data:customer-outstanding:${currentId.value}:${customerId.value}:`) || key.startsWith(`shop-data:customer-statement:${currentId.value}:${customerId.value}:`) || key === 'shop-data:sales')])
    pushToast({ tone: 'success', title: t('payments.saved') })
  }
  catch (error) {
    receiptError.value = commandErrorMessage(error)?.includes('PAYMENT_OVERPAYMENT_REJECTED')
      ? t('payments.overpayment') : t('customers.writeError')
  }
  finally { receiptPending.value = false }
}

function openEdit() {
  if (!customer.value?.is_active || !customer.value.can_manage) return
  form.name = customer.value.name
  form.phone = customer.value.phone ?? ''
  form.email = customer.value.email ?? ''
  form.address = customer.value.address ?? ''
  form.notes = customer.value.notes ?? ''
  actionError.value = ''
  showForm.value = true
}

function readableError(message?: string) {
  if (message === 'INVALID_CUSTOMER') return t('customers.invalid')
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return t('customers.manageDenied')
  if (message === 'CUSTOMER_NOT_FOUND') return t('customers.notFound')
  return t('customers.writeError')
}
function commandErrorMessage(caught: unknown) {
  return typeof caught === 'object' && caught !== null && 'message' in caught && typeof caught.message === 'string' ? caught.message : undefined
}

async function save() {
  if (!currentId.value || !customer.value || saving.value || !customer.value.can_manage) return
  actionError.value = ''
  const email = form.email.trim()
  if (form.name.trim().length < 2 || form.name.trim().length > 160
    || form.phone.trim().length > 50 || email.length > 254
    || (email && (!email.includes('@') || email.startsWith('@')))
    || form.address.trim().length > 500 || form.notes.trim().length > 2000) {
    actionError.value = t('customers.invalid')
    return
  }
  saving.value = true
  try {
    const { error: saveError } = await shopRpc.rpc('save_customer', {
      p_shop_id: currentId.value,
      p_customer_id: customer.value.id,
      p_name: form.name.trim(),
      p_phone: form.phone.trim() || null,
      p_email: email || null,
      p_address: form.address.trim() || null,
      p_notes: form.notes.trim() || null,
    })
    if (saveError) throw saveError
    complete()
    await refresh()
    pushToast({ tone: 'success', title: t('customers.updatedSuccess') })
  }
  catch (saveError) {
    actionError.value = readableError(commandErrorMessage(saveError))
  }
  finally {
    saving.value = false
  }
}

async function archive() {
  if (!currentId.value || !customer.value?.is_active || !customer.value.can_manage || archiving.value) return
  if (!await confirmation.ask({ title: t('customers.archive'), message: `${customer.value.name} · ${t('customers.archiveConfirm')}`, confirmLabel: t('customers.archive'), cancelLabel: t('customers.cancel'), tone: 'danger' })) return
  archiving.value = true
  actionError.value = ''
  try {
    const { error: archiveError } = await shopRpc.rpc('archive_customer', {
      p_shop_id: currentId.value,
      p_customer_id: customer.value.id,
    })
    if (archiveError) throw archiveError
    await refresh()
    pushToast({ tone: 'success', title: t('customers.archivedSuccess') })
  }
  catch (archiveError) {
    actionError.value = readableError(commandErrorMessage(archiveError))
  }
  finally {
    archiving.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function money(value: number) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 20 }).format(value)
}
const overdueCount = computed(() => overdue.value.total)

useShopRealtime('customers', () => receiptDirty.value || formDirty.value)

const customerView = computed<BsCustomerProfileView | null>(() => customer.value ? ({
  name: customer.value.name, status: t(customer.value.is_active ? 'customers.active' : 'customers.archived'),
  phone: customer.value.phone || '—', email: customer.value.email || '—', address: customer.value.address || '—', notes: customer.value.notes || '—',
  created: formatDate(customer.value.created_at), updated: formatDate(customer.value.updated_at), archived: customer.value.archived_at ? formatDate(customer.value.archived_at) : null,
  canManage: customer.value.can_manage, canEdit: customer.value.can_manage && customer.value.is_active,
  canReceive: customer.value.is_active && Boolean(paymentAccess.value?.can_receive) && !outstandingPending.value && !outstandingError.value && outstanding.value.total > 0,
}) : null)
const outstandingView = computed<BsCustomerReceivablesView>(() => ({
  rows: outstanding.value.items.map(invoice => ({ id: invoice.id, number: invoice.invoice_number, href: `/sales/${invoice.id}`, settlement: t(`payments.settlement.${invoice.settlement_state}`), due: invoice.due_date || '—', amount: money(Number(invoice.outstanding)), amountLimit: invoice.outstanding })),
  page: outstandingPage.value, pageSize: outstandingPageSize, total: outstanding.value.total, loading: outstandingPending.value, error: outstandingError.value ? t('payments.loadError') : null,
  balance: statementPending.value || statementError.value ? '' : money(Number(statement.value.outstanding)),
  overdue: overduePending.value || overdueError.value ? '' : t('customers.overdueCount', { count: overdueCount.value }),
}))
const statementView = computed<BsCustomerStatementView>(() => ({
  rows: statement.value.items.map(event => ({ id: event.event_id, date: formatDate(event.event_at), type: t(`payments.events.${event.event_type}`), href: event.invoice_id ? `/sales/${event.invoice_id}` : event.order_id ? `/orders?order=${encodeURIComponent(event.order_id)}` : '', document: event.document_number, debit: Number(event.debit) ? money(Number(event.debit)) : '—', credit: Number(event.credit) ? money(Number(event.credit)) : '—', balance: money(Number(event.running_balance)) })),
  page: statementPageNumber.value, pageSize: statementPageSize, total: statement.value.total, loading: statementPending.value, error: statementError.value ? t('payments.loadError') : null,
}))
const profileCopy = computed<BsCustomerProfileCopy>(() => ({
  customers_back: t('customers.back'),
  common_retry: t('common.retry'),
  customers_notFound: t('customers.notFound'),
  customers_details: t('customers.details'),
  customers_edit: t('customers.edit'),
  customers_archive: t('customers.archive'),
  customers_manageDenied: t('customers.manageDenied'),
  customers_contact: t('customers.contact'),
  customers_phone: t('customers.phone'),
  customers_email: t('customers.email'),
  customers_address: t('customers.address'),
  customers_notes: t('customers.notes'),
  customers_created: t('customers.created'),
  customers_updated: t('customers.updated'),
  customers_archivedOn: t('customers.archivedOn'),
  customers_receivables: t('customers.receivables'),
  payments_recordReceipt: t('payments.recordReceipt'),
  payments_loadError: t('payments.loadError'),
  sales_invoiceNumber: t('sales.invoiceNumber'),
  payments_settlementLabel: t('payments.settlementLabel'),
  sales_dueDate: t('sales.dueDate'),
  payments_outstanding: t('payments.outstanding'),
  customers_noOutstanding: t('customers.noOutstanding'),
  customers_statement: t('customers.statement'),
  sales_date: t('sales.date'),
  payments_event: t('payments.event'),
  payments_debit: t('payments.debit'),
  payments_credit: t('payments.credit'),
  payments_runningBalance: t('payments.runningBalance'),
  customers_noStatement: t('customers.noStatement'),
  payments_save: t('payments.save'),
  customers_cancel: t('customers.cancel'),
  payments_allocateInvoices: t('payments.allocateInvoices'),
  payments_amount: t('payments.amount'),
  payments_date: t('payments.date'),
  payments_method: t('payments.method'),
  payments_reference: t('payments.reference'),
  payments_notes: t('payments.notes'),
  customers_editTitle: t('customers.editTitle'),
  customers_save: t('customers.save'),
  customers_name: t('customers.name'),
}))
const editorForm = computed<BsCustomerIdentityForm>({ get: () => ({ ...form }), set: value => Object.assign(form, value) })
const receiptForm = computed<BsCustomerReceiptForm>({
  get: () => ({ date: receiptDate.value, method: receiptMethod.value, reference: receiptReference.value, notes: receiptNotes.value, allocations: { ...receiptAllocations.value } }),
  set: value => {
    receiptDate.value = value.date
    if (['cash', 'bank_transfer', 'card', 'wallet', 'cheque', 'other'].includes(value.method)) receiptMethod.value = value.method as PaymentMethod
    receiptReference.value = value.reference; receiptNotes.value = value.notes; receiptAllocations.value = { ...value.allocations }
  },
})
const receiptEditor = computed(() => ({ dirty: receiptDirty.value, pending: receiptPending.value, error: receiptError.value, amount: money(receiptAmount.value), submitDisabled: receiptAmount.value <= 0 || outstandingPending.value || Boolean(outstandingError.value) || !customer.value?.is_active || !paymentAccess.value?.can_receive }))
const methodOptions = computed(() => ['cash', 'bank_transfer', 'card', 'wallet', 'cheque', 'other'].map(value => ({ value, label: t(`payments.methods.${value}`), disabled: false })))
const profileError = computed(() => error.value ? (error.value.message.includes('SHOP_PERMISSION_DENIED') ? t('customers.permissionDenied') : t('customers.detailError')) : null)
</script>
<template>
  <BsCustomerProfilePage v-model:visible="showForm" v-model:receipt-open="receiptOpen" v-model:form="editorForm" v-model:receipt-form="receiptForm" :customer="customerView" :copy="profileCopy" :pending="pending" :error="profileError" :outstanding="outstandingView" :statement="statementView" :archiving="archiving" :action-error="actionError" :saving="saving" :editor-dirty="formDirty" :receipt-editor="receiptEditor" :method-options="methodOptions" @retry="refresh()" @retry-outstanding="retryOutstanding" @retry-statement="refreshStatement()" @edit="openEdit" @archive="archive" @receive="openReceipt" @save="save" @save-receipt="saveReceipt" @outstanding-page="outstandingPage = $event" @statement-page="statementPageNumber = $event"/>
</template>
