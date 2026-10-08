<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { businessModeSupportsProducts, businessModeSupportsServices } from '~/utils/businessMode'
import { addOrIncrementCartLine, captureBarcodeKey, cartTotal, emptyScanState } from '~/utils/pos'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
type CatalogItem = { id: string; itemType: 'product' | 'service'; name: string; sku: string | null; barcode: string | null; unitPrice: number; discount: number; stock: number | null }
type CartLine = CatalogItem & { key: string; sourceId: string; quantity: number }
type Appointment = { id: string; staffId: string; customerId: string | null; customerName: string; startsAt: string; status: string; service: CatalogItem }
type PosContext = { staff: Array<{ id: string; name: string }>; appointments: Appointment[]; customers: Array<{ id: string; name: string; phone: string | null }> }
type CatalogResult = { items: CatalogItem[]; total: number; page: number; pageSize: number; businessMode: 'product' | 'service' | 'mixed'; ambiguousBarcode: boolean }
type Category = { id: string; name: string }

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const route = useRoute()
const { t, locale } = useI18n()
const { current, currentId, currentLocationId, currentLocation, currentMembership, loading: shopLoading } = useShop()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const catalogSearch = ref('')
const debouncedSearch = ref('')
const itemType = ref<'all' | 'product' | 'service'>('all')
const categoryFilter = ref('')
const catalogPage = ref(1)
const customerSearch = ref('')
const debouncedCustomerSearch = ref('')
const catalogInput = ref<HTMLInputElement | null>(null)
const customerInput = ref<HTMLInputElement | null>(null)
const lines = ref<CartLine[]>([])
const staffId = ref('')
const appointmentId = ref('')
const customerId = ref('')
const customerName = ref('')
const paymentMethod = ref<PaymentMethod>('cash')
const paymentReference = ref('')
const notes = ref('')
const transactionLocationId = ref<string | null>(null)
const transactionLocationName = ref('')
const errorMessage = ref('')
const scanMessage = ref('')
const checkingOut = ref(false)
const confirmingCheckout = ref(false)
const availableItemTypes = computed(() => [
  'all',
  ...(businessModeSupportsProducts(current.value?.business_mode ?? 'mixed') ? ['product'] : []),
  ...(businessModeSupportsServices(current.value?.business_mode ?? 'mixed') ? ['service'] : []),
] as Array<'all' | 'product' | 'service'>)
const invoiceId = ref<string | null>(null)
const saveRequestId = ref<string | null>(null)
const checkoutRequestId = ref<string | null>(null)
const issueRequestId = ref<string | null>(null)
const paymentRequestId = ref<string | null>(null)
const appointmentRequestId = ref<string | null>(null)
const checkoutPaidAt = ref<string | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let customerTimer: ReturnType<typeof setTimeout> | undefined
let scanState = emptyScanState()

watch(catalogSearch, value => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { debouncedSearch.value = value.trim(); catalogPage.value = 1 }, 250) })
watch(customerSearch, value => { clearTimeout(customerTimer); customerTimer = setTimeout(() => { debouncedCustomerSearch.value = value.trim() }, 250) })
watch(itemType, () => { catalogPage.value = 1 })
watch(categoryFilter, () => { catalogPage.value = 1 })

const locationChanged = computed(() => Boolean(transactionLocationId.value && currentLocationId.value !== transactionLocationId.value))
const total = computed(() => cartTotal(lines.value))
const selectedStaff = computed(() => context.value.staff.find(member => member.id === staffId.value))

const { data: categories } = useAsyncData(() => `shop-data:pos-categories:${currentId.value ?? 'none'}`, async () => {
  if (!currentId.value) return []
  const { data, error } = await rpc.rpc('list_catalog_categories', { p_shop_id: currentId.value })
  if (error) throw error
  return data as Category[]
}, { watch: [currentId], default: () => [] })

const { data: catalog, pending: catalogPending, error: catalogError, refresh: refreshCatalog } = useAsyncData(
  () => `shop-data:pos-catalog:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${debouncedSearch.value}:${itemType.value}:${categoryFilter.value}:${catalogPage.value}`, async (): Promise<CatalogResult> => {
    if (!currentId.value || !currentLocationId.value) return { items: [], total: 0, page: 1, pageSize: 30, businessMode: 'mixed', ambiguousBarcode: false }
    const { data, error } = await rpc.rpc('pos_catalog_search_by_category', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_search: debouncedSearch.value || null, p_item_type: itemType.value === 'all' ? null : itemType.value, p_category_id: categoryFilter.value || null, p_page: catalogPage.value, p_page_size: 30 })
    if (error) throw error
    return data as CatalogResult
  }, { watch: [currentId, currentLocationId, debouncedSearch, itemType, categoryFilter, catalogPage], default: () => ({ items: [], total: 0, page: 1, pageSize: 30, businessMode: 'mixed', ambiguousBarcode: false }) },
)

const { data: context, pending: contextPending, error: contextError, refresh: refreshContext } = useAsyncData(
  () => `shop-data:pos-context:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${debouncedCustomerSearch.value}`, async (): Promise<PosContext> => {
    if (!currentId.value || !currentLocationId.value) return { staff: [], appointments: [], customers: [] }
    const { data, error } = await rpc.rpc('pos_checkout_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_customer_search: debouncedCustomerSearch.value.length >= 2 ? debouncedCustomerSearch.value : null })
    if (error) throw error
    return data as PosContext
  }, { watch: [currentId, currentLocationId, debouncedCustomerSearch], default: () => ({ staff: [], appointments: [], customers: [] }) },
)

function lockLocation() {
  if (!transactionLocationId.value) {
    transactionLocationId.value = currentLocationId.value
    transactionLocationName.value = currentLocation.value?.name ?? ''
  }
}
function invalidateRequests() {
  saveRequestId.value = null; checkoutRequestId.value = null; issueRequestId.value = null
  paymentRequestId.value = null; appointmentRequestId.value = null; checkoutPaidAt.value = null
}
function addItem(item: CatalogItem) {
  if (checkingOut.value || locationChanged.value) return
  lockLocation(); lines.value = addOrIncrementCartLine(lines.value, item) as CartLine[]
  errorMessage.value = ''; invalidateRequests(); scanMessage.value = t('pos.scanAdded', { name: item.name })
}
function setQuantity(line: CartLine, value: number) {
  line.quantity = Math.max(0.001, Math.min(1000000, Number(value) || 1)); invalidateRequests()
}
function removeLine(index: number) { lines.value.splice(index, 1); invalidateRequests() }
function chooseCustomer(customer: { id: string; name: string }) { lockLocation(); customerId.value = customer.id; customerName.value = customer.name; customerSearch.value = ''; invalidateRequests() }
function clearCustomer() { customerId.value = ''; customerName.value = ''; invalidateRequests() }
function chooseAppointment(value: string) {
  appointmentId.value = value; lockLocation(); invalidateRequests()
  const appointment = context.value.appointments.find(item => item.id === value)
  if (!appointment) return
  staffId.value = appointment.staffId
  customerId.value = appointment.customerId ?? ''
  customerName.value = appointment.customerName
  addItem(appointment.service)
}
async function requestReset() {
  if (checkingOut.value || confirmingCheckout.value) return
  if (lines.value.length && !await confirmation.ask(t('pos.resetConfirm'))) return
  resetSale()
}
function resetSale() {
  lines.value = []; staffId.value = context.value.staff.some(member => member.id === currentMembership.value?.id) ? currentMembership.value!.id : ''
  appointmentId.value = ''; customerId.value = ''; customerName.value = ''; paymentReference.value = ''; notes.value = ''
  transactionLocationId.value = null; transactionLocationName.value = ''; invoiceId.value = null; errorMessage.value = ''; scanMessage.value = ''; invalidateRequests()
  nextTick(() => catalogInput.value?.focus())
}
function readableError(message?: string) {
  if (message?.includes('SALE_OPEN_CASH_SHIFT_REQUIRED')) return t('sales.openCashShiftRequired')
  if (message?.includes('INSUFFICIENT_STOCK') || message?.includes('CROSS_LOCATION_STOCK')) return t('pos.insufficientStock')
  if (message?.includes('SHOP_PERMISSION_DENIED')) return t('pos.permissionDenied')
  if (message?.includes('FULL_PAYMENT') || message?.includes('OVERPAYMENT')) return t('sales.fullPaymentRequired')
  return t('pos.checkoutError')
}
async function scanBarcode(code: string) {
  if (!currentId.value || !currentLocationId.value || locationChanged.value) return
  catalogSearch.value = ''
  const { data, error } = await rpc.rpc('pos_catalog_search', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_barcode: code, p_page: 1, p_page_size: 2 })
  if (error) { errorMessage.value = readableError(error.message); return }
  const result = data as CatalogResult
  if (result.ambiguousBarcode) scanMessage.value = t('pos.ambiguousBarcode')
  else if (result.items.length === 1) addItem(result.items[0]!)
  else scanMessage.value = t('pos.unknownBarcode', { code })
  await nextTick(); catalogInput.value?.focus()
}
function handleKeyboard(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || checkingOut.value || confirmingCheckout.value) return
  const target = event.target instanceof HTMLElement ? event.target : null
  // Let shared dialogs and pickers own their Enter/Escape/focus behavior.
  if (confirmation.current.value || document.querySelector('[role="listbox"]')) return
  if (event.key === 'F2') { event.preventDefault(); catalogInput.value?.focus(); return }
  if (event.key === 'F4') { event.preventDefault(); customerInput.value?.focus(); return }
  if (event.key === 'F8') { event.preventDefault(); void checkout(); return }
  if (event.key === 'Escape') { errorMessage.value = ''; scanMessage.value = ''; return }
  if (target !== catalogInput.value && target?.closest('input, textarea, select, button, a, [role="combobox"], [contenteditable="true"]')) {
    scanState = emptyScanState(); return
  }
  const captured = captureBarcodeKey(scanState, event.key, performance.now())
  scanState = captured.state
  if (captured.code) { event.preventDefault(); void scanBarcode(captured.code) }
}

async function checkout() {
  if (!currentId.value || !transactionLocationId.value || checkingOut.value || confirmingCheckout.value || contextPending.value || Boolean(contextError.value) || locationChanged.value || !lines.value.length || !staffId.value) {
    errorMessage.value = locationChanged.value ? t('pos.locationChanged') : t('pos.invalid'); return
  }
  confirmingCheckout.value = true
  let confirmed = false
  try { confirmed = await confirmation.ask(t('pos.confirm')) }
  finally { confirmingCheckout.value = false }
  if (!confirmed) return
  checkingOut.value = true; errorMessage.value = ''
  saveRequestId.value ??= crypto.randomUUID(); checkoutRequestId.value ??= crypto.randomUUID(); issueRequestId.value ??= crypto.randomUUID(); paymentRequestId.value ??= crypto.randomUUID()
  if (appointmentId.value) appointmentRequestId.value ??= crypto.randomUUID()
  checkoutPaidAt.value ??= new Date().toISOString()
  try {
    const saved = await rpc.rpc('save_pos_sale_draft', { p_request_id: saveRequestId.value, p_shop_id: currentId.value, p_location_id: transactionLocationId.value, p_invoice_id: invoiceId.value, p_staff_membership_id: staffId.value, p_appointment_id: appointmentId.value || null, p_customer_id: customerId.value || null, p_notes: notes.value.trim() || null, p_lines: lines.value.map(line => ({ item_type: line.itemType, source_id: line.sourceId, quantity: Number(line.quantity) })) })
    if (saved.error) throw saved.error
    invoiceId.value = saved.data
    const completed = await rpc.rpc('checkout_pos_sale', { p_request_id: checkoutRequestId.value, p_issue_request_id: issueRequestId.value, p_payment_request_id: paymentRequestId.value, p_appointment_request_id: appointmentRequestId.value, p_shop_id: currentId.value, p_location_id: transactionLocationId.value, p_invoice_id: invoiceId.value!, p_amount: total.value, p_paid_at: checkoutPaidAt.value, p_method: paymentMethod.value, p_reference: paymentReference.value.trim() || null })
    if (completed.error) throw completed.error
    const completedId = completed.data
    await Promise.all([refreshCatalog(), refreshContext(), refreshNuxtData('shop-data:sales'), refreshNuxtData('shop-data:inventory-overview'), refreshNuxtData('shop-data:recent-invoices')])
    pushToast({ tone: 'success', title: t('pos.success') }); resetSale(); await navigateTo({ path: `/sales/${completedId}/receipt`, query: { origin: 'pos' } })
  } catch (error) { errorMessage.value = readableError(shopCommandErrorMessage(error)) }
  finally { checkingOut.value = false }
}

function money(value: number) { return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(value) }
function appointmentLabel(appointment: Appointment) { return `${new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(appointment.startsAt))} · ${appointment.customerName} · ${appointment.service.name}` }
onMounted(() => { window.addEventListener('keydown', handleKeyboard); nextTick(() => catalogInput.value?.focus()) })
onBeforeUnmount(() => { window.removeEventListener('keydown', handleKeyboard); clearTimeout(searchTimer); clearTimeout(customerTimer) })
watch(context, value => {
  if (!staffId.value && value.staff.some(member => member.id === currentMembership.value?.id)) staffId.value = currentMembership.value!.id
  const requested = typeof route.query.appointment === 'string' ? route.query.appointment : ''
  if (requested && value.appointments.some(item => item.id === requested) && !appointmentId.value) chooseAppointment(requested)
}, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-end justify-between gap-3"><div><h1 class="text-3xl font-extrabold tracking-tight">{{ t('pos.title') }}</h1><p class="mt-1 text-sm text-muted-foreground">{{ t('pos.subtitle') }}</p></div><BsButton severity="secondary" class="min-h-11" :disabled="checkingOut || confirmingCheckout" @click="requestReset">{{ t('pos.reset') }}</BsButton></header>
    <p v-if="!current && !shopLoading" class="ls-card p-8 text-center text-sm">{{ t('sales.noShop') }}</p>
    <template v-else-if="current">
      <section class="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-2 ls-card-flat p-3" :aria-label="t('pos.cart')">
        <p class="min-w-0 break-words text-sm"><strong>{{ t('pos.location') }}:</strong> {{ transactionLocationName || currentLocation?.name || '—' }} · <strong>{{ t('pos.staff') }}:</strong> {{ selectedStaff?.name || t('pos.selectStaff') }}</p>
        <div class="flex flex-wrap gap-2">
          <a href="#pos-catalog-title" class="ls-btn xl:hidden">{{ t('pos.catalog') }}</a>
          <a href="#pos-cart-title" class="ls-btn ls-btn-primary xl:hidden">{{ t('pos.reviewSale', { count: lines.length }) }} · {{ money(total) }}</a>
          <NuxtLink to="/cash-shifts" class="ls-btn">{{ t('pos.closeShift') }}</NuxtLink>
        </div>
      </section>
      <p v-if="locationChanged" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-4 text-sm text-[var(--bs-status-error)]">{{ t('pos.locationChanged') }}</p>
      <p v-if="errorMessage" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-4 text-sm text-[var(--bs-status-error)]">{{ errorMessage }}</p>
      <p class="sr-only" aria-live="polite">{{ scanMessage }}</p>
      <p v-if="checkingOut" role="status" class="text-sm font-bold">{{ t('pos.paying') }}</p>
      <fieldset :disabled="checkingOut" :inert="checkingOut" :aria-busy="checkingOut" class="min-w-0">
      <div class="grid min-h-[calc(100vh-12rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <section class="min-w-0 ls-card p-4" aria-labelledby="pos-catalog-title">
          <h2 id="pos-catalog-title" tabindex="-1" class="scroll-mt-64 text-lg font-extrabold">{{ t('pos.catalog') }}</h2>
          <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input ref="catalogInput" v-model="catalogSearch" type="search" class="ls-input min-h-11" :placeholder="t('pos.search')" :aria-label="t('pos.search')">
            <select v-model="categoryFilter" class="ls-select min-h-11" :aria-label="locale === 'ar' ? 'التصنيف' : 'Category'"><option value="">{{ locale === 'ar' ? 'كل التصنيفات' : 'All categories' }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select>
            <div class="flex rounded-xl border border-border p-1" :aria-label="t('pos.catalog')" role="group"><BsButton variant="chip" v-for="kind in availableItemTypes" :key="kind" type="button" class="min-h-11 rounded-lg px-3 text-sm font-bold" :aria-pressed="itemType === kind" @click="itemType = kind">{{ t(`pos.${kind === 'product' ? 'products' : kind === 'service' ? 'services' : 'all'}`) }}</BsButton></div>
          </div>
          <p v-if="scanMessage" class="mt-3 rounded-xl bg-muted p-3 text-sm">{{ scanMessage }}</p>
          <p v-if="catalogPending" role="status" class="p-8 text-center text-sm text-muted-foreground">{{ t('pos.loading') }}</p>
          <div v-else-if="catalogError" role="alert" class="p-8 text-center text-sm"><p>{{ catalogError?.message?.includes('SHOP_PERMISSION_DENIED') ? t('pos.permissionDenied') : t('pos.loadError') }}</p><BsButton severity="secondary" class="mt-3" @click="refreshCatalog()">{{ t('pos.retry') }}</BsButton></div>
          <p v-else-if="!catalog.items.length" class="p-8 text-center text-sm text-muted-foreground">{{ t('pos.noResults') }}</p>
          <ul v-else class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" :aria-label="t('pos.catalog')">
            <li v-for="item in catalog.items" :key="`${item.itemType}:${item.id}`"><BsButton variant="tile" type="button" class="min-h-20 p-3" :disabled="locationChanged || checkingOut" @click="addItem(item)"><strong class="block">{{ item.name }}</strong><span class="mt-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>{{ item.sku || (item.itemType === 'service' ? t('sales.service') : t('sales.product')) }}</span><span>{{ money(Math.max(0, item.unitPrice - item.discount)) }}</span></span><span v-if="item.stock != null" class="mt-1 block text-xs" :class="item.stock > 0 ? 'text-[var(--bs-status-success)]' : 'text-[var(--bs-status-error)]'">{{ t('pos.stock', { count: item.stock }) }}</span></BsButton></li>
          </ul>
          <div v-if="catalog.total > catalog.pageSize" class="mt-4 flex items-center justify-center gap-2"><BsButton severity="secondary" :disabled="catalogPage <= 1" :aria-label="t('customers.previous')" @click="catalogPage--"><span aria-hidden="true">{{ locale === 'ar' ? '›' : '‹' }}</span></BsButton><span class="text-sm">{{ catalogPage }}</span><BsButton severity="secondary" :disabled="catalogPage * catalog.pageSize >= catalog.total" :aria-label="t('customers.next')" @click="catalogPage++"><span aria-hidden="true">{{ locale === 'ar' ? '‹' : '›' }}</span></BsButton></div>
        </section>

        <aside class="flex min-h-0 min-w-0 flex-col ls-card p-4 xl:sticky xl:top-40 xl:max-h-[calc(100dvh-11rem)] xl:overflow-y-auto" aria-labelledby="pos-cart-title">
          <h2 id="pos-cart-title" tabindex="-1" class="scroll-mt-64 text-lg font-extrabold">{{ t('pos.cart') }}</h2>
          <p v-if="contextPending" role="status" class="mt-3 text-sm">{{ t('pos.loading') }}</p>
          <p v-else-if="contextError" role="alert" class="mt-3 rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ contextError?.message?.includes('SHOP_PERMISSION_DENIED') ? t('pos.permissionDenied') : t('pos.loadError') }} <BsButton variant="link" type="button" class="min-h-11 font-bold underline" @click="refreshContext()">{{ t('pos.retry') }}</BsButton></p>
          <div class="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted p-3 text-xs"><span class="font-bold">{{ t('pos.location') }}</span><span>{{ transactionLocationName || currentLocation?.name || '—' }}</span><span class="font-bold">{{ t('pos.staff') }}</span><span>{{ selectedStaff?.name || t('pos.selectStaff') }}</span></div>
          <p v-if="!lines.length" class="grid flex-1 place-items-center py-8 text-center text-sm text-muted-foreground">{{ t('pos.emptyCart') }}</p>
          <ul v-else class="mt-3 flex-1 space-y-2 overflow-y-auto pe-1"><li v-for="(line, index) in lines" :key="line.key" class="rounded-xl border border-border p-3"><div class="flex justify-between gap-2"><strong>{{ line.name }}</strong><BsButton variant="text" type="button" class="min-h-11 px-2 text-sm font-bold text-[var(--bs-status-error)]" @click="removeLine(index)">{{ t('pos.remove') }}</BsButton></div><div class="mt-2 flex items-center justify-between gap-3"><label class="text-xs font-bold">{{ t('pos.quantity') }}<input :value="line.quantity" type="number" min="0.001" max="1000000" step="1" class="ls-input mt-1 min-h-11 w-24" @change="setQuantity(line, Number(($event.target as HTMLInputElement).value))"></label><span class="font-extrabold">{{ money((line.unitPrice - line.discount) * line.quantity) }}</span></div></li></ul>
          <div class="mt-3 space-y-3 border-t border-border pt-3">
            <label class="grid gap-1 text-sm font-bold">{{ t('pos.appointment') }}<select :value="appointmentId" class="ls-select min-h-11" :disabled="checkingOut" @change="chooseAppointment(($event.target as HTMLSelectElement).value)"><option value="">{{ t('pos.walkIn') }}</option><option v-for="appointment in context.appointments" :key="appointment.id" :value="appointment.id">{{ appointmentLabel(appointment) }}</option></select></label>
            <label class="pos-staff-select grid min-w-0 gap-1 text-sm font-bold">{{ t('pos.staff') }}<BsSelect v-model="staffId" :label="t('pos.staff')" :options="context.staff" option-label="name" option-value="id" filter virtual :disabled="Boolean(appointmentId) || checkingOut" @change="lockLocation(); invalidateRequests()" /></label>
            <div><label class="text-sm font-bold" for="pos-customer">{{ t('pos.customer') }}</label><div v-if="customerId" class="mt-1 flex min-h-11 items-center justify-between rounded-xl border border-border px-3"><span>{{ customerName }}</span><BsButton variant="link" type="button" class="min-h-11 text-sm font-bold text-[var(--bs-link)]" :disabled="Boolean(appointmentId)" @click="clearCustomer">{{ t('pos.clearCustomer') }}</BsButton></div><template v-else><input id="pos-customer" ref="customerInput" v-model="customerSearch" type="search" class="ls-input mt-1 min-h-11" :placeholder="t('pos.customerSearch')"><ul v-if="customerSearch.length >= 2 && context.customers.length" class="mt-1 max-h-32 overflow-y-auto ls-card-flat p-1"><li v-for="customer in context.customers" :key="customer.id"><BsButton type="button" class="min-h-11 w-full rounded-lg px-3 text-start text-sm hover:bg-muted" @click="chooseCustomer(customer)">{{ customer.name }} <span class="text-muted-foreground">{{ customer.phone }}</span></BsButton></li></ul><p class="mt-1 text-xs text-muted-foreground">{{ t('pos.noCustomer') }}</p></template></div>
            <div class="grid grid-cols-2 gap-2"><label class="grid gap-1 text-sm font-bold">{{ t('pos.paymentMethod') }}<select v-model="paymentMethod" class="ls-select min-h-11"><option v-for="method in ['cash','card','bank_transfer','wallet','cheque','other']" :key="method" :value="method">{{ t(`payments.methods.${method}`) }}</option></select></label><label class="grid gap-1 text-sm font-bold">{{ t('pos.reference') }}<input v-model="paymentReference" maxlength="200" class="ls-input min-h-11"></label></div>
            <label class="grid gap-1 text-sm font-bold">{{ t('pos.notes') }}<input v-model="notes" maxlength="2000" class="ls-input min-h-11"></label>
            <div class="flex items-end justify-between gap-3"><span class="text-sm font-bold">{{ t('pos.total') }}</span><strong class="text-2xl">{{ money(total) }}</strong></div>
            <p class="text-xs text-muted-foreground">{{ t('pos.serverTotal') }}</p>
            <BsButton variant="primary" class="min-h-12 w-full" :pending="checkingOut" :disabled="checkingOut || confirmingCheckout || contextPending || Boolean(contextError) || locationChanged || !lines.length || !staffId" @click="checkout">{{ checkingOut ? t('pos.paying') : t('pos.pay', { amount: money(total) }) }}</BsButton>
            <p class="text-center text-xs text-muted-foreground">{{ t('pos.shortcuts') }}</p>
          </div>
        </aside>
      </div>
      </fieldset>
    </template>
  </div>
</template>

<style scoped>
.pos-staff-select :deep(.bs-select) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
</style>
