<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type SaleLine = {
  id: string
  item_type: 'product' | 'service'
  item_name: string
  quantity: number
  unit_price: number
  discount_amount: number
  total_amount: number
  product_id: string | null
  service_id: string | null
  product_sku_snapshot: string | null
  product_barcode_snapshot: string | null
  discount_type_snapshot: string | null
  discount_value_snapshot: number | null
}
type SaleMovement = {
  id: string
  productId: string
  invoiceItemId: string
  batchId: string
  quantityChange: number
  unitCostSnapshot: number
  createdAt: string
}
type SaleDetail = {
  id: string
  invoice_number: string | null
  status: 'draft' | 'issued'
  created_at: string
  issued_at: string | null
  total_amount: number
  discount_amount: number
  notes: string | null
  client_id: string | null
  client_name_snapshot: string | null
  client_phone_snapshot: string | null
  client_email_snapshot: string | null
  client_address_snapshot: string | null
  canManage: boolean
  canIssue: boolean
  lines: SaleLine[]
  movements: SaleMovement[]
}

const route = useRoute()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { currentId } = useShop()
const { t, locale } = useI18n()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const saleId = computed(() => String(route.params.id ?? ''))
const issuing = ref(false)
const actionError = ref('')
const issueRequestId = ref<string | null>(null)

const { data: sale, pending, error, refresh } = useAsyncData(
  () => `shop-data:sale:${currentId.value ?? 'none'}:${saleId.value}`,
  async (): Promise<SaleDetail | null> => {
    if (!currentId.value || !saleId.value) return null
    const { data, error: queryError } = await shopRpc.rpc('get_sale', {
      p_shop_id: currentId.value, p_invoice_id: saleId.value,
    })
    if (queryError) throw queryError
    return data as SaleDetail | null
  }, { watch: [currentId, saleId], default: () => null },
)

function readableError(message?: string) {
  if (message?.includes('INSUFFICIENT_STOCK')) return t('sales.insufficientStock')
  if (message?.includes('OUTSTANDING_SALE_REQUIRES_CUSTOMER')) return t('sales.customerRequired')
  return message || t('sales.issueError')
}

async function issue() {
  if (!currentId.value || !sale.value || sale.value.status !== 'draft' || !sale.value.canIssue || issuing.value) return
  if (!sale.value.client_id) { actionError.value = t('sales.customerRequired'); return }
  if (!await confirmation.ask(t('sales.issueConfirm'))) return
  issuing.value = true
  actionError.value = ''
  issueRequestId.value ??= crypto.randomUUID()
  try {
    const { error } = await shopRpc.rpc('issue_sale', {
      p_request_id: issueRequestId.value,
      p_shop_id: currentId.value,
      p_invoice_id: sale.value.id,
    })
    if (error) throw error
    issueRequestId.value = null
    await Promise.all([
      refresh(),
      refreshNuxtData('shop-data:sales'),
      refreshNuxtData('shop-data:inventory'),
      refreshNuxtData('shop-data:recent-invoices'),
    ])
    pushToast({ tone: 'success', title: t('sales.issuedSuccess') })
  }
  catch (issueError) { actionError.value = readableError(issueError instanceof Error ? issueError.message : undefined) }
  finally { issuing.value = false }
}

function money(value: number) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(value)
}
function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function lineMovements(lineId: string) { return sale.value?.movements.filter(movement => movement.invoiceItemId === lineId) ?? [] }
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/sales" class="inline-flex font-semibold text-[var(--bs-link)] underline-offset-4 hover:underline">{{ t('sales.back') }}</NuxtLink>
    <div v-if="pending" class="space-y-4"><div class="h-10 w-64 animate-pulse rounded-lg bg-muted"/><div class="h-64 animate-pulse rounded-2xl bg-muted"/></div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-5 text-sm text-[var(--bs-status-error)]"><p>{{ t('sales.loadError') }}</p><button type="button" class="mt-3 font-bold underline" @click="refresh()">{{ t('sales.retry') }}</button></div>
    <div v-else-if="!sale" class="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{{ t('sales.notFound') }}</div>
    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div><div class="flex flex-wrap items-center gap-3"><h1 class="text-3xl font-extrabold tracking-tight">{{ sale.invoice_number || t('sales.draftNumber') }}</h1><span class="ls-badge" :class="sale.status === 'issued' ? 'bg-[var(--bs-status-success-bg)] text-[var(--bs-status-success)]' : 'bg-muted text-muted-foreground'">{{ t(`sales.${sale.status}`) }}</span></div><p class="mt-2 text-sm text-muted-foreground">{{ t('sales.details') }}</p></div>
        <div v-if="sale.status === 'draft'" class="flex flex-wrap gap-2"><NuxtLink v-if="sale.canManage" :to="{ path: '/sales', query: { edit: sale.id } }" class="ls-btn">{{ t('sales.editDraft') }}</NuxtLink><button v-if="sale.canIssue" type="button" class="ls-btn ls-btn-primary" :disabled="issuing" @click="issue">{{ issuing ? t('sales.issuing') : t('sales.issue') }}</button></div>
      </header>
      <p v-if="actionError" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>
      <p v-if="sale.status === 'issued'" class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ t('sales.immutable') }}</p>
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ t('sales.paymentBoundary') }}</p>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-bold">{{ t('sales.customerSnapshot') }}</h2><div v-if="sale.client_name_snapshot" class="mt-4 space-y-2 text-sm"><p class="font-bold"><NuxtLink v-if="sale.client_id" :to="`/customers/${sale.client_id}`" class="text-[var(--bs-link)]">{{ sale.client_name_snapshot }}</NuxtLink><template v-else>{{ sale.client_name_snapshot }}</template></p><p>{{ sale.client_phone_snapshot || '—' }}</p><p>{{ sale.client_email_snapshot || '—' }}</p><p>{{ sale.client_address_snapshot || '—' }}</p></div><p v-else class="mt-4 text-sm text-muted-foreground">{{ t('sales.noCustomer') }}</p></section>
        <section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-bold">{{ t('sales.details') }}</h2><dl class="mt-4 grid gap-4 sm:grid-cols-2"><div><dt class="text-xs font-bold text-muted-foreground">{{ t('sales.createdAt') }}</dt><dd>{{ formatDate(sale.created_at) }}</dd></div><div><dt class="text-xs font-bold text-muted-foreground">{{ t('sales.issuedAt') }}</dt><dd>{{ formatDate(sale.issued_at) }}</dd></div><div class="sm:col-span-2"><dt class="text-xs font-bold text-muted-foreground">{{ t('sales.notes') }}</dt><dd class="whitespace-pre-wrap">{{ sale.notes || '—' }}</dd></div><div><dt class="text-xs font-bold text-muted-foreground">{{ t('sales.discount') }}</dt><dd>{{ money(Number(sale.discount_amount)) }}</dd></div><div><dt class="text-xs font-bold text-muted-foreground">{{ t('sales.total') }}</dt><dd class="text-xl font-extrabold">{{ money(Number(sale.total_amount)) }}</dd></div></dl></section>
      </div>

      <section class="overflow-hidden rounded-2xl border border-border bg-card"><h2 class="border-b border-border p-5 text-lg font-bold">{{ t('sales.lines') }}</h2><div class="overflow-x-auto"><BsDataTable :value="sale.lines" data-key="id" :row-class="() => 'border-t border-border'"><Column header-class="px-5 py-3 text-start" body-class="px-5 py-4"><template #header>{{ t('sales.item') }}</template><template #body="{ data: line }"><p class="font-bold">{{ line.item_name }}</p><p class="text-xs text-muted-foreground">{{ t(`sales.${line.item_type}`) }}<template v-if="line.product_sku_snapshot"> · {{ line.product_sku_snapshot }}</template></p></template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ t('sales.quantity') }}</template><template #body="{ data: line }">{{ Number(line.quantity) }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ t('sales.unitPrice') }}</template><template #body="{ data: line }">{{ money(Number(line.unit_price)) }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end"><template #header>{{ t('sales.discount') }}</template><template #body="{ data: line }">{{ money(Number(line.discount_amount)) }}</template></Column><Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end font-bold"><template #header>{{ t('sales.lineTotal') }}</template><template #body="{ data: line }">{{ money(Number(line.total_amount)) }}</template></Column></BsDataTable></div></section>

      <section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-bold">{{ t('sales.inventoryTrace') }}</h2><p v-if="!sale.movements.length" class="mt-4 text-sm text-muted-foreground">{{ t('sales.noInventoryEffect') }}</p><div v-else class="mt-4 space-y-4"><template v-for="line in sale.lines.filter(item => item.item_type === 'product')" :key="line.id"><div v-for="movement in lineMovements(line.id)" :key="movement.id" class="grid gap-2 rounded-xl border border-border p-4 text-sm sm:grid-cols-4"><p class="font-bold">{{ line.item_name }}</p><p><span class="text-muted-foreground">{{ t('sales.movement') }}:</span> {{ Math.abs(Number(movement.quantityChange)) }}</p><p class="break-all"><span class="text-muted-foreground">{{ t('sales.batch') }}:</span> {{ movement.batchId }}</p><NuxtLink :to="`/inventory?product=${movement.productId}`" class="font-bold text-[var(--bs-link)]">{{ t('sales.open') }}</NuxtLink></div></template></div></section>
    </template>
  </div>
</template>
