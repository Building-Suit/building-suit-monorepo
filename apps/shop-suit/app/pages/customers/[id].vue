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
type StatementEvent = { event_id: string; event_type: 'sale' | 'receipt' | 'reversal' | 'refund'; event_at: string; invoice_id: string; document_number: string; debit: number; credit: number; method: string | null; reference: string | null; running_balance: number }
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
  <div class="space-y-6">
    <NuxtLink to="/customers" class="inline-flex font-semibold text-[var(--bs-link)] underline-offset-4 hover:underline">{{ t('customers.back') }}</NuxtLink>

    <div v-if="pending" class="space-y-4">
      <div class="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div class="h-52 animate-pulse rounded-2xl bg-muted" />
    </div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-5 text-sm text-fg">
      <p>{{ error.message.includes('SHOP_PERMISSION_DENIED') ? t('customers.permissionDenied') : t('customers.detailError') }}</p>
      <BsButton type="button" class="mt-3 font-bold underline" @click="refresh()">{{ t('common.retry') }}</BsButton>
    </div>
    <div v-else-if="!customer" class="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      {{ t('customers.notFound') }}
    </div>

    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-3xl font-extrabold tracking-tight">{{ customer.name }}</h1>
            <span class="ls-badge" :class="customer.is_active ? 'bg-[var(--bs-status-success-bg)] text-fg' : 'bg-muted text-muted-foreground'">
              {{ customer.is_active ? t('customers.active') : t('customers.archived') }}
            </span>
          </div>
          <p class="mt-2 text-sm text-muted-foreground">{{ t('customers.details') }}</p>
        </div>
        <div v-if="customer.can_manage && customer.is_active" class="flex flex-wrap gap-2">
          <BsButton type="button" class="ls-btn" @click="openEdit">{{ t('customers.edit') }}</BsButton>
          <BsButton type="button" class="ls-btn text-fg" :disabled="archiving" @click="archive">{{ t('customers.archive') }}</BsButton>
        </div>
      </header>

      <p v-if="actionError && !showForm" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-fg">{{ actionError }}</p>
      <p v-if="!customer.can_manage" class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ t('customers.manageDenied') }}</p>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-2xl border border-border bg-card p-5">
          <h2 class="text-lg font-bold">{{ t('customers.contact') }}</h2>
          <dl class="mt-4 grid gap-4 sm:grid-cols-2">
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.phone') }}</dt><dd class="mt-1 break-words">{{ customer.phone || '—' }}</dd></div>
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.email') }}</dt><dd class="mt-1 break-words">{{ customer.email || '—' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.address') }}</dt><dd class="mt-1 whitespace-pre-wrap">{{ customer.address || '—' }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.notes') }}</dt><dd class="mt-1 whitespace-pre-wrap">{{ customer.notes || '—' }}</dd></div>
          </dl>
        </section>
        <section class="rounded-2xl border border-border bg-card p-5">
          <h2 class="text-lg font-bold">{{ t('customers.details') }}</h2>
          <dl class="mt-4 space-y-4">
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.created') }}</dt><dd class="mt-1">{{ formatDate(customer.created_at) }}</dd></div>
            <div><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.updated') }}</dt><dd class="mt-1">{{ formatDate(customer.updated_at) }}</dd></div>
            <div v-if="customer.archived_at"><dt class="text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ t('customers.archivedOn') }}</dt><dd class="mt-1">{{ formatDate(customer.archived_at) }}</dd></div>
          </dl>
        </section>
      </div>

      <section class="rounded-2xl border border-border bg-card p-5"><div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="text-lg font-bold">{{ t('customers.receivables') }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ t('customers.overdueCount', { count: overdueCount }) }}</p></div><div class="flex flex-wrap items-center gap-3"><p class="text-2xl font-extrabold">{{ money(Number(statement.outstanding)) }}</p><BsButton v-if="customer.is_active && paymentAccess?.can_receive && outstanding.total > 0" type="button" class="ls-btn ls-btn-primary" @click="openReceipt">{{ t('payments.recordReceipt') }}</BsButton></div></div><p v-if="outstandingError" role="alert" class="mt-4 text-sm text-fg">{{ t('payments.loadError') }} <BsButton type="button" class="font-bold underline" @click="refreshOutstanding()">{{ t('common.retry') }}</BsButton></p><div v-else class="mt-4 overflow-x-auto"><BsDataTable :value="outstanding.items" :label="t('customers.receivables')" lazy paginator :rows="outstandingPageSize" :first="(outstandingPage - 1) * outstandingPageSize" :total-records="outstanding.total" :loading="outstandingPending" data-key="id" :row-class="() => 'border-t border-border'" @page="outstandingPage = $event.page + 1"><Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ t('sales.invoiceNumber') }}</template><template #body="{ data: invoice }"><NuxtLink :to="`/sales/${invoice.id}`" class="font-bold text-[var(--bs-link)]">{{ invoice.invoice_number }}</NuxtLink></template></Column><Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ t('payments.settlementLabel') }}</template><template #body="{ data: invoice }">{{ t(`payments.settlement.${invoice.settlement_state}`) }}</template></Column><Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ t('sales.dueDate') }}</template><template #body="{ data: invoice }"><span :class="invoice.overdue ? 'font-bold text-fg' : ''">{{ invoice.due_date || '—' }}</span></template></Column><Column header-class="px-4 py-3 text-end" body-class="px-4 py-3 text-end font-bold"><template #header>{{ t('payments.outstanding') }}</template><template #body="{ data: invoice }">{{ money(Number(invoice.outstanding)) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ t('customers.noOutstanding') }}</p></template></BsDataTable></div></section>

      <section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-bold">{{ t('customers.statement') }}</h2><p v-if="statementError" role="alert" class="mt-4 text-sm text-fg">{{ t('payments.loadError') }} <BsButton type="button" class="font-bold underline" @click="refreshStatement()">{{ t('common.retry') }}</BsButton></p><div v-else class="mt-4 overflow-x-auto"><BsDataTable :value="statement.items" :label="t('customers.statement')" lazy paginator :rows="statementPageSize" :first="(statementPageNumber - 1) * statementPageSize" :total-records="statement.total" :loading="statementPending" data-key="event_id" :row-class="() => 'border-t border-border'" @page="statementPageNumber = $event.page + 1"><Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ t('sales.date') }}</template><template #body="{ data: event }">{{ formatDate(event.event_at) }}</template></Column><Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ t('payments.event') }}</template><template #body="{ data: event }"><p class="font-bold">{{ t(`payments.events.${event.event_type}`) }}</p><NuxtLink :to="`/sales/${event.invoice_id}`" class="text-[var(--bs-link)]">{{ event.document_number }}</NuxtLink></template></Column><Column header-class="px-4 py-3 text-end" body-class="px-4 py-3 text-end"><template #header>{{ t('payments.debit') }}</template><template #body="{ data: event }">{{ Number(event.debit) ? money(Number(event.debit)) : '—' }}</template></Column><Column header-class="px-4 py-3 text-end" body-class="px-4 py-3 text-end"><template #header>{{ t('payments.credit') }}</template><template #body="{ data: event }">{{ Number(event.credit) ? money(Number(event.credit)) : '—' }}</template></Column><Column header-class="px-4 py-3 text-end" body-class="px-4 py-3 text-end font-bold"><template #header>{{ t('payments.runningBalance') }}</template><template #body="{ data: event }">{{ money(Number(event.running_balance)) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ t('customers.noStatement') }}</p></template></BsDataTable></div></section>

      <BsDialog v-model:visible="receiptOpen" :title="t('payments.recordReceipt')" :dirty="receiptDirty" :pending="receiptPending">
        <template #default="{ close }">
          <BsForm class="space-y-4" :pending="receiptPending" :error="receiptError" @submit="saveReceipt">
            <p class="text-sm text-muted-foreground">{{ t('payments.allocateInvoices') }}</p>
            <BsDataTable :value="outstanding.items" :label="t('customers.receivables')" :loading="outstandingPending" :error="outstandingError ? t('payments.loadError') : null" lazy paginator :rows="outstandingPageSize" :first="(outstandingPage - 1) * outstandingPageSize" :total-records="outstanding.total" @page="outstandingPage = $event.page + 1" @retry="refreshOutstanding()">
              <Column :header="t('sales.invoiceNumber')"><template #body="{ data: invoice }">{{ invoice.invoice_number }}<p>{{ t('payments.outstanding') }}: {{ money(Number(invoice.outstanding)) }}</p></template></Column>
              <Column :header="t('payments.amount')"><template #body="{ data: invoice }"><input v-model.number="receiptAllocations[invoice.id]" type="number" min="0" :max="invoice.outstanding" step="0.01" class="ls-input w-36" :aria-label="`${invoice.invoice_number} ${t('payments.amount')}`"></template></Column>
            </BsDataTable>
            <p class="font-bold">{{ t('payments.amount') }}: {{ money(receiptAmount) }}</p>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="space-y-2 text-sm font-bold">{{ t('payments.date') }}<input v-model="receiptDate" type="date" required class="ls-input"></label>
              <label class="space-y-2 text-sm font-bold">{{ t('payments.method') }}<select v-model="receiptMethod" class="ls-select"><option v-for="method in ['cash','bank_transfer','card','wallet','cheque','other']" :key="method" :value="method">{{ t(`payments.methods.${method}`) }}</option></select></label>
              <label class="space-y-2 text-sm font-bold">{{ t('payments.reference') }}<input v-model="receiptReference" maxlength="200" class="ls-input"></label>
              <label class="space-y-2 text-sm font-bold">{{ t('payments.notes') }}<input v-model="receiptNotes" maxlength="2000" class="ls-input"></label>
            </div>
            <div class="flex gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="receiptPending || receiptAmount <= 0">{{ t('payments.save') }}</BsButton><BsButton type="button" class="ls-btn" :disabled="receiptPending" @click="close">{{ t('customers.cancel') }}</BsButton></div>
          </BsForm>
        </template>
      </BsDialog>

      <BsDialog v-model:visible="showForm" :title="t('customers.editTitle')" :dirty="formDirty" :pending="saving">
        <template #default="{ close }">
          <BsForm class="grid gap-4 sm:grid-cols-2" :pending="saving" :error="actionError" @submit="save">
            <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ t('customers.name') }}<input v-model="form.name" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
            <label class="space-y-2 text-sm font-bold">{{ t('customers.phone') }}<input v-model="form.phone" type="tel" maxlength="50" autocomplete="tel" class="ls-input"></label>
            <label class="space-y-2 text-sm font-bold">{{ t('customers.email') }}<input v-model="form.email" type="email" maxlength="254" autocomplete="email" class="ls-input"></label>
            <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ t('customers.address') }}<textarea v-model="form.address" maxlength="500" rows="2" class="ls-input" /></label>
            <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ t('customers.notes') }}<textarea v-model="form.notes" maxlength="2000" rows="3" class="ls-input" /></label>
            <div class="flex flex-wrap gap-2 sm:col-span-2">
              <BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="saving">{{ saving ? t('customers.saving') : t('customers.save') }}</BsButton>
              <BsButton type="button" class="ls-btn" :disabled="saving" @click="close">{{ t('customers.cancel') }}</BsButton>
            </div>
          </BsForm>
        </template>
      </BsDialog>
    </template>
  </div>
</template>
