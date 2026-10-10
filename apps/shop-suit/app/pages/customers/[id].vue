<script setup lang="ts">
import { receiptAllocations as validateReceiptAllocations } from '~/utils/receiptAllocations'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

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
type StatementEvent = { event_id: string; event_type: 'sale' | 'receipt' | 'reversal' | 'refund' | 'void' | 'full_return'; event_at: string; invoice_id: string; document_number: string; debit: number; credit: number; method: string | null; reference: string | null; running_balance: number }
type StatementPage = { items: StatementEvent[]; total: number; page: number; pageSize: number; outstanding: number }
type OutstandingInvoice = { id: string; invoice_number: string; total_amount: number; outstanding: number; due_date: string | null; settlement_state: 'unpaid' | 'partial'; overdue: boolean }
type OutstandingPage = { items: OutstandingInvoice[]; total: number }
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'

const route = useRoute()
const nuxtApp = useNuxtApp()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
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

const { data: paymentAccess } = useAsyncData(
  () => `shop-data:customer-payment-access:${currentId.value ?? 'none'}`,
  async () => {
    if (!currentId.value) return { can_receive: false }
    const { data, error } = await shopRpc.rpc('payment_access', { p_shop_id: currentId.value })
    if (error) throw error
    return data?.[0] ?? { can_receive: false }
  }, { watch: [currentId], default: () => ({ can_receive: false }) },
)

const { data: customer, pending, error, refresh } = useAsyncData(
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

const { data: statement, pending: statementPending, error: statementError, refresh: refreshStatement } = useAsyncData(
  () => `shop-data:customer-statement:${currentId.value ?? 'none'}:${customerId.value}:${statementPageNumber.value}`,
  async (): Promise<StatementPage> => {
    if (!currentId.value || !customerId.value) return { items: [], total: 0, page: 1, pageSize: statementPageSize, outstanding: 0 }
    const { data, error } = await shopRpc.rpc('customer_statement', { p_shop_id: currentId.value, p_customer_id: customerId.value, p_page: statementPageNumber.value, p_page_size: statementPageSize })
    if (error) throw error
    return data as StatementPage
  }, { watch: [currentId, customerId, statementPageNumber], default: () => ({ items: [], total: 0, page: 1, pageSize: statementPageSize, outstanding: 0 }) },
)

const { data: outstanding, pending: outstandingPending, error: outstandingError, refresh: refreshOutstanding } = useAsyncData(
  () => `shop-data:customer-outstanding:${currentId.value ?? 'none'}:${customerId.value}:${outstandingPage.value}`,
  async (): Promise<OutstandingPage> => {
    if (!currentId.value || !customerId.value) return { items: [], total: 0 }
    const { data, error } = await shopRpc.rpc('list_outstanding_invoices', { p_shop_id: currentId.value, p_customer_id: customerId.value, p_overdue_only: false, p_page: outstandingPage.value, p_page_size: outstandingPageSize })
    if (error) throw error
    return data as OutstandingPage
  }, { watch: [currentId, customerId, outstandingPage], default: () => ({ items: [], total: 0 }) },
)

const { data: overdue, refresh: refreshOverdue } = useAsyncData(
  () => `shop-data:customer-overdue:${currentId.value ?? 'none'}:${customerId.value}`,
  async (): Promise<OutstandingPage> => {
    if (!currentId.value || !customerId.value) return { items: [], total: 0 }
    const { data, error } = await shopRpc.rpc('list_outstanding_invoices', { p_shop_id: currentId.value, p_customer_id: customerId.value, p_overdue_only: true, p_page: 1, p_page_size: 1 })
    if (error) throw error
    return data as OutstandingPage
  }, { watch: [currentId, customerId], default: () => ({ items: [], total: 0 }) },
)

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
  if (!currentId.value || !customer.value || receiptPending.value) return
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
    await Promise.all([refreshOutstanding(), refreshOverdue(), refreshStatement(), refreshNuxtData(Object.keys(nuxtApp.payload.data).filter(key => key.startsWith(`shop-data:customer-outstanding:${currentId.value}:${customerId.value}:`) || key.startsWith(`shop-data:customer-statement:${currentId.value}:${customerId.value}:`) || key === 'shop-data:sales'))])
    pushToast({ tone: 'success', title: t('payments.saved') })
  }
  catch (error) {
    receiptError.value = error instanceof Error && error.message.includes('PAYMENT_OVERPAYMENT_REJECTED')
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
    actionError.value = readableError(saveError instanceof Error ? saveError.message : undefined)
  }
  finally {
    saving.value = false
  }
}

async function archive() {
  if (!currentId.value || !customer.value?.is_active || !customer.value.can_manage || archiving.value) return
  if (!await confirmation.ask(t('customers.archiveConfirm'))) return
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
    actionError.value = readableError(archiveError instanceof Error ? archiveError.message : undefined)
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
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(value)
}
const overdueCount = computed(() => overdue.value.total)
</script>

<template>
  <BsStack>
    <BsLink to="/customers">{{ t('customers.back') }}</BsLink>
    <BsStack v-if="pending">
      <BsSkeleton/>
      <BsSkeleton/>
    </BsStack>
    <BsBox v-else-if="error" role="alert" padding="md">
      <BsText as="p">{{ error.message.includes('SHOP_PERMISSION_DENIED') ? t('customers.permissionDenied') : t('customers.detailError') }}</BsText>
      <BsButton variant="link" type="button" @click="refresh()">{{ t('common.retry') }}</BsButton>
    </BsBox>
    <BsPanel v-else-if="!customer" padding="md">{{ t('customers.notFound') }}</BsPanel>
    <template v-else>
      <BsInline justify="between">
        <BsBox>
          <BsInline>
            <BsHeading :level="1">{{ customer.name }}</BsHeading>
            <BsText as="span">{{ customer.is_active ? t('customers.active') : t('customers.archived') }}</BsText>
          </BsInline>
          <BsText as="p" size="sm" tone="muted">{{ t('customers.details') }}</BsText>
        </BsBox>
        <BsInline v-if="customer.can_manage && customer.is_active">
          <BsButton type="button" @click="openEdit">{{ t('customers.edit') }}</BsButton>
          <BsButton type="button" :disabled="archiving" @click="archive">{{ t('customers.archive') }}</BsButton>
        </BsInline>
      </BsInline>
      <BsText v-if="actionError && !showForm" role="alert" as="p" size="sm" tone="danger">{{ actionError }}</BsText>
      <BsText v-if="!customer.can_manage" as="p" size="sm">{{ t('customers.manageDenied') }}</BsText>
      <BsGrid :columns="2">
        <BsPanel padding="md">
          <BsHeading :level="2">{{ t('customers.contact') }}</BsHeading>
          <BsDescriptionList>
            <BsDescriptionItem :term="(t('customers.phone'))">
              <BsText as="span">{{ customer.phone || '—' }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('customers.email'))">
              <BsText as="span">{{ customer.email || '—' }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('customers.address'))">
              <BsText as="span">{{ customer.address || '—' }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('customers.notes'))">
              <BsText as="span">{{ customer.notes || '—' }}</BsText>
            </BsDescriptionItem>
          </BsDescriptionList>
        </BsPanel>
        <BsPanel padding="md">
          <BsHeading :level="2">{{ t('customers.details') }}</BsHeading>
          <BsDescriptionList>
            <BsDescriptionItem :term="(t('customers.created'))">
              <BsText as="span">{{ formatDate(customer.created_at) }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('customers.updated'))">
              <BsText as="span">{{ formatDate(customer.updated_at) }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem v-if="customer.archived_at" :term="(t('customers.archivedOn'))">
              <BsText as="span">{{ formatDate(customer.archived_at) }}</BsText>
            </BsDescriptionItem>
          </BsDescriptionList>
        </BsPanel>
      </BsGrid>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsBox>
            <BsHeading :level="2">{{ t('customers.receivables') }}</BsHeading>
            <BsText as="p" size="sm" tone="muted">{{ t('customers.overdueCount', { count: overdueCount }) }}</BsText>
          </BsBox>
          <BsInline>
            <BsText as="p" size="lg" emphasis="semibold">{{ money(Number(statement.outstanding)) }}</BsText>
            <BsButton v-if="customer.is_active && paymentAccess?.can_receive && outstanding.total > 0" type="button" @click="openReceipt">{{ t('payments.recordReceipt') }}</BsButton>
          </BsInline>
        </BsInline>
        <BsText v-if="outstandingError" role="alert" as="p" size="sm">{{ t('payments.loadError') }} <BsButton variant="link" type="button" @click="refreshOutstanding()">{{ t('common.retry') }}</BsButton>
        </BsText>
        <BsBox v-else scroll="x">
          <BsDataTable :value="outstanding.items" :label="t('customers.receivables')" lazy paginator :rows="outstandingPageSize" :first="(outstandingPage - 1) * outstandingPageSize" :total-records="outstanding.total" :loading="outstandingPending" data-key="id" :columns="[{ key: 'column0', header: (t('sales.invoiceNumber')) }, { key: 'column1', header: (t('payments.settlementLabel')) }, { key: 'column2', header: (t('sales.dueDate')) }, { key: 'column3', header: (t('payments.outstanding')), align: 'end' }]" @page="outstandingPage = $event.page + 1">
            <template #cell-column0="{ row: invoice }">
              <BsLink :to="`/sales/${invoice.id}`">{{ invoice.invoice_number }}</BsLink>
            </template>
            <template #cell-column1="{ row: invoice }">{{ t(`payments.settlement.${invoice.settlement_state}`) }}</template>
            <template #cell-column2="{ row: invoice }">
              <BsText as="span">{{ invoice.due_date || '—' }}</BsText>
            </template>
            <template #cell-column3="{ row: invoice }">{{ money(Number(invoice.outstanding)) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ t('customers.noOutstanding') }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ t('customers.statement') }}</BsHeading>
        <BsText v-if="statementError" role="alert" as="p" size="sm">{{ t('payments.loadError') }} <BsButton variant="link" type="button" @click="refreshStatement()">{{ t('common.retry') }}</BsButton>
        </BsText>
        <BsBox v-else scroll="x">
          <BsDataTable :value="statement.items" :label="t('customers.statement')" lazy paginator :rows="statementPageSize" :first="(statementPageNumber - 1) * statementPageSize" :total-records="statement.total" :loading="statementPending" data-key="event_id" :columns="[{ key: 'column0', header: (t('sales.date')) }, { key: 'column1', header: (t('payments.event')) }, { key: 'column2', header: (t('payments.debit')), align: 'end' }, { key: 'column3', header: (t('payments.credit')), align: 'end' }, { key: 'column4', header: (t('payments.runningBalance')), align: 'end' }]" @page="statementPageNumber = $event.page + 1">
            <template #cell-column0="{ row: event }">{{ formatDate(event.event_at) }}</template>
            <template #cell-column1="{ row: event }">
              <BsText as="p" emphasis="semibold">{{ t(`payments.events.${event.event_type}`) }}</BsText>
              <BsLink :to="`/sales/${event.invoice_id}`">{{ event.document_number }}</BsLink>
            </template>
            <template #cell-column2="{ row: event }">{{ Number(event.debit) ? money(Number(event.debit)) : '—' }}</template>
            <template #cell-column3="{ row: event }">{{ Number(event.credit) ? money(Number(event.credit)) : '—' }}</template>
            <template #cell-column4="{ row: event }">{{ money(Number(event.running_balance)) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ t('customers.noStatement') }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsRecordActionDialog v-model:visible="receiptOpen" :title="t('payments.recordReceipt')" :dirty="receiptDirty" :pending="receiptPending" :error="receiptError" :submit-label="t('payments.save')" :cancel-label="t('customers.cancel')" :submit-disabled="receiptAmount <= 0" size="lg" @submit="saveReceipt">
        <BsText as="p" size="sm" tone="muted">{{ t('payments.allocateInvoices') }}</BsText>
        <BsDataTable :value="outstanding.items" :label="t('customers.receivables')" :loading="outstandingPending" :error="outstandingError ? t('payments.loadError') : null" lazy paginator :rows="outstandingPageSize" :first="(outstandingPage - 1) * outstandingPageSize" :total-records="outstanding.total" :columns="[{ key: 'column0', header: t('sales.invoiceNumber') }, { key: 'column1', header: t('payments.amount') }]" @page="outstandingPage = $event.page + 1" @retry="refreshOutstanding()">
          <template #cell-column0="{ row: invoice }">{{ invoice.invoice_number }}<BsText as="p">{{ t('payments.outstanding') }}: {{ money(Number(invoice.outstanding)) }}</BsText>
          </template>
          <template #cell-column1="{ row: invoice }">
            <BsInput v-model.number="receiptAllocations[invoice.id]" type="number" :min="0" :max="invoice.outstanding" :step="0.01" :aria-label="`${invoice.invoice_number} ${t('payments.amount')}`"/>
          </template>
        </BsDataTable>
        <BsText as="p" emphasis="semibold">{{ t('payments.amount') }}: {{ money(receiptAmount) }}</BsText>
        <BsGrid :columns="2">
          <BsField v-slot="field" :label="(t('payments.date'))">
            <BsInput :id="field.id" v-model="receiptDate" :aria-describedby="field.describedby" type="date" required/>
          </BsField>
          <BsField v-slot="field" :label="(t('payments.method'))">
            <BsSelect v-model="receiptMethod" :input-id="field.id" :aria-describedby="field.describedby" :label="(t('payments.method'))" :options="[...(['cash','bank_transfer','card','wallet','cheque','other']).map(method => ({ value: method, label: (t(`payments.methods.${method}`)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="(t('payments.reference'))">
            <BsInput :id="field.id" v-model="receiptReference" :aria-describedby="field.describedby" :maxlength="200"/>
          </BsField>
          <BsField v-slot="field" :label="(t('payments.notes'))">
            <BsInput :id="field.id" v-model="receiptNotes" :aria-describedby="field.describedby" :maxlength="2000"/>
          </BsField>
        </BsGrid>
      </BsRecordActionDialog>
      <BsRecordActionDialog v-model:visible="showForm" :title="t('customers.editTitle')" :dirty="formDirty" :pending="saving" :error="actionError" :submit-label="t('customers.save')" :cancel-label="t('customers.cancel')" @submit="save">
        <BsField v-slot="field" :label="(t('customers.name'))">
          <BsInput :id="field.id" v-model="form.name" :aria-describedby="field.describedby" type="text" :minlength="2" :maxlength="160" required/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.phone'))">
          <BsInput :id="field.id" v-model="form.phone" :aria-describedby="field.describedby" type="tel" :maxlength="50" autocomplete="tel"/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.email'))">
          <BsInput :id="field.id" v-model="form.email" :aria-describedby="field.describedby" type="email" :maxlength="254" autocomplete="email"/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.address'))">
          <BsTextarea :id="field.id" v-model="form.address" :aria-describedby="field.describedby" :maxlength="500" :rows="2"/>
        </BsField>
        <BsField v-slot="field" :label="(t('customers.notes'))">
          <BsTextarea :id="field.id" v-model="form.notes" :aria-describedby="field.describedby" :maxlength="2000" :rows="3"/>
        </BsField>
      </BsRecordActionDialog>
    </template>
  </BsStack>
</template>
