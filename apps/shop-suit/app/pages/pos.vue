<script setup lang="ts">
import type { BsPointOfSaleCopy, BsPointOfSaleView, BsPointOfSaleCatalogItem, BsPointOfSaleCartLine, BsPointOfSalePaymentForm } from '@building-suit/ui/types/pointOfSalePresentation'
import { shopCommandErrorMessage } from '~/utils/shopCommandErrorMessage'
import { saleCopy } from '~/utils/saleCopy'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { businessModeSupportsProducts, businessModeSupportsServices } from '~/utils/businessMode'
import { posCustomerOptions } from '~/utils/posCustomer.js'
import { addOrIncrementCartLine, cartTotal } from '~/utils/pos'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
type CatalogItem = { id: string; itemType: 'product' | 'service'; name: string; imageUrl?: string | null; sku: string | null; barcode: string | null; unitPrice: number; discount: number; stock: number | null }
type CartLine = CatalogItem & { key: string; sourceId: string; quantity: number }
type Appointment = { id: string; staffId: string; customerId: string | null; customerName: string; startsAt: string; status: string; service: CatalogItem }
type Customer = { id: string; name: string; phone: string | null }
type PosContext = { customerQuery?: string; staff: Array<{ id: string; name: string }>; appointments: Appointment[]; customers: Array<{ id: string; name: string; phone: string | null }> }
type CatalogResult = { items: CatalogItem[]; total: number; page: number; pageSize: number; businessMode: 'product' | 'service' | 'mixed'; ambiguousBarcode: boolean }
type Category = { id: string; name: string }

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const media = useCatalogMedia()
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
const posPage = ref<{ focusCatalog: () => void } | null>(null)

const lines = ref<CartLine[]>([])
const staffId = ref('')
const appointmentId = ref('')
const customerId = ref('')
const customerName = ref('')
const customerPhone = ref<string | null>(null)
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
useDebouncedChange(catalogSearch, value => { debouncedSearch.value = value.trim(); catalogPage.value = 1 }, 250)
const customerSearchInteraction = useDebouncedChange(customerSearch, value => { debouncedCustomerSearch.value = value.trim() }, 250)
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
    const args = { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_search: debouncedSearch.value || null, p_item_type: itemType.value === 'all' ? null : itemType.value, p_category_id: categoryFilter.value || null, p_page: catalogPage.value, p_page_size: 30 }
    const { data, error } = await media.request('pos', args, () => rpc.rpc('pos_catalog_search_by_category', args))
    if (error) throw error
    return data as CatalogResult
  }, { watch: [currentId, currentLocationId, debouncedSearch, itemType, categoryFilter, catalogPage], default: () => ({ items: [], total: 0, page: 1, pageSize: 30, businessMode: 'mixed', ambiguousBarcode: false }) },
)

// Resolve the initial context before deriving appointment state in SSR and hydration.
const { data: context, pending: contextPending, error: contextError, refresh: refreshContext } = await useAsyncData(
  () => `shop-data:pos-context:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${debouncedCustomerSearch.value}`, async (): Promise<PosContext> => {
    if (!currentId.value || !currentLocationId.value) return { staff: [], appointments: [], customers: [] }
    const query = debouncedCustomerSearch.value
    const { data, error } = await rpc.rpc('pos_checkout_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_customer_search: debouncedCustomerSearch.value.length >= 2 ? debouncedCustomerSearch.value : null })
    if (error) throw error
    return { ...(data as PosContext), customerQuery: query }
  }, { watch: [currentId, currentLocationId, debouncedCustomerSearch], default: (): PosContext => ({ staff: [], appointments: [], customers: [] }) },
)

const customerOptions = computed(() => posCustomerOptions({
  search: customerSearch.value,
  resolvedSearch: context.value.customerQuery,
  pending: contextPending.value || Boolean(contextError.value),
  customers: context.value.customers,
  selected: customerId.value ? { id: customerId.value, name: customerName.value, phone: customerPhone.value } : null,
}))
const customerBusy = computed(() => contextPending.value || customerSearch.value.trim() !== debouncedCustomerSearch.value)
function setCustomer(value: string | number | null | undefined) {
  if (appointmentId.value || checkingOut.value || confirmingCheckout.value || locationChanged.value) return
  const customer = customerOptions.value.find(item => item.id === value)
  if (customer) chooseCustomer(customer)
  else if (!value) clearCustomer()
}
function resetCustomerSearch() {
  customerSearchInteraction.cancel(); customerSearch.value = ''; debouncedCustomerSearch.value = ''
}

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
function chooseCustomer(customer: Customer) { lockLocation(); customerId.value = customer.id; customerName.value = customer.name; customerPhone.value = customer.phone; invalidateRequests() }
function clearCustomer() {
  if (appointmentId.value || checkingOut.value || confirmingCheckout.value || locationChanged.value) return
  customerId.value = ''; customerName.value = ''; customerPhone.value = null; resetCustomerSearch(); invalidateRequests()
}
function chooseAppointment(value: string) {
  appointmentId.value = value; lockLocation(); invalidateRequests()
  const appointment = context.value.appointments.find(item => item.id === value)
  if (!appointment) return
  staffId.value = appointment.staffId
  customerId.value = appointment.customerId ?? ''
  customerName.value = appointment.customerName
  customerPhone.value = null; resetCustomerSearch()
  addItem(appointment.service)
}
async function requestReset() {
  if (checkingOut.value || confirmingCheckout.value) return
  if (lines.value.length && !await confirmation.ask(t('pos.resetConfirm'))) return
  resetSale()
}
function resetSale() {
  lines.value = []; staffId.value = context.value.staff.some(member => member.id === currentMembership.value?.id) ? currentMembership.value!.id : ''
  resetCustomerSearch(); customerPhone.value = null
  appointmentId.value = ''; customerId.value = ''; customerName.value = ''; paymentReference.value = ''; notes.value = ''
  transactionLocationId.value = null; transactionLocationName.value = ''; invoiceId.value = null; errorMessage.value = ''; scanMessage.value = ''; invalidateRequests()
  nextTick(() => posPage.value?.focusCatalog())
}
function readableError(message?: string) {
  if (message?.includes('SALE_OPEN_CASH_SHIFT_REQUIRED')) return t('sales.openCashShiftRequired')
  if (message?.includes('INSUFFICIENT_STOCK') || message?.includes('CROSS_LOCATION_STOCK')) return saleCopy(t, 'pos.insufficientStock', lines.value)
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
  await nextTick(); posPage.value?.focusCatalog()
}

async function checkout() {
  if (!currentId.value || !transactionLocationId.value || checkingOut.value || confirmingCheckout.value || contextPending.value || Boolean(contextError.value) || locationChanged.value || !lines.value.length || !staffId.value) {
    errorMessage.value = locationChanged.value ? t('pos.locationChanged') : t('pos.invalid'); return
  }
  confirmingCheckout.value = true
  let confirmed = false
  try { confirmed = await confirmation.ask(saleCopy(t, 'pos.confirm', lines.value)) }
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

watch(context, value => {
  if (!staffId.value && value.staff.some(member => member.id === currentMembership.value?.id)) staffId.value = currentMembership.value!.id
  const requested = typeof route.query.appointment === 'string' ? route.query.appointment : ''
  if (requested && value.appointments.some(item => item.id === requested) && !appointmentId.value) chooseAppointment(requested)
}, { immediate: true })

useShopRealtime('pos', () => lines.value.length > 0 || checkingOut.value || confirmingCheckout.value)

const posPaymentForm = computed<BsPointOfSalePaymentForm>({ get: () => ({ method: paymentMethod.value, reference: paymentReference.value, notes: notes.value }), set: value => { if (['cash','bank_transfer','card','wallet','cheque','other'].includes(value.method)) paymentMethod.value = value.method as PaymentMethod; paymentReference.value = value.reference; notes.value = value.notes } })
const posItemType = computed<string>({ get: () => itemType.value, set: value => { if (value === 'all' || value === 'product' || value === 'service') itemType.value = value } })
const posCatalogItems = computed<BsPointOfSaleCatalogItem[]>(() => catalog.value.items.map(item => ({ id: item.id, key: `${item.itemType}:${item.id}`, name: item.name, imageUrl: item.imageUrl, description: item.sku || t(item.itemType === 'service' ? 'sales.service' : 'sales.product'), price: money(Math.max(0, item.unitPrice - item.discount)), stock: item.stock != null ? t('pos.stock', { count: item.stock }) : '' })))
const posCartLines = computed<BsPointOfSaleCartLine[]>(() => lines.value.map(line => ({ id: line.key, name: line.name, quantity: line.quantity, total: money((line.unitPrice - line.discount) * line.quantity) })))
const posView = computed<BsPointOfSaleView>(() => ({ available: !!current.value, loadingContext: shopLoading.value, location: transactionLocationName.value || currentLocation.value?.name || '—', staff: selectedStaff.value?.name || t('pos.selectStaff'), locationChanged: locationChanged.value, error: errorMessage.value, scanMessage: scanMessage.value, checkingOut: checkingOut.value, confirming: confirmingCheckout.value, shortcutBlocked: checkingOut.value || confirmingCheckout.value || !!confirmation.current.value, catalogLoading: catalogPending.value, catalogError: catalogError.value ? t(catalogError.value.message?.includes('SHOP_PERMISSION_DENIED') ? 'pos.permissionDenied' : 'pos.loadError') : '', catalogTotal: catalog.value.total, catalogPageSize: catalog.value.pageSize, contextLoading: contextPending.value, contextError: contextError.value ? t(contextError.value.message?.includes('SHOP_PERMISSION_DENIED') ? 'pos.permissionDenied' : 'pos.loadError') : '', appointmentLocked: !!appointmentId.value, customerDisabled: !!appointmentId.value || checkingOut.value || confirmingCheckout.value || locationChanged.value, customerBusy: customerBusy.value, customerDisplay: customerId.value ? [customerName.value, customerPhone.value].filter(Boolean).join(' · ') : (appointmentId.value ? customerName.value || t('pos.noCustomer') : t('pos.noCustomer')), customerEmpty: customerBusy.value ? t('pos.loading') : t('pos.customerSearch'), customerEmptyFilter: customerBusy.value ? t('pos.loading') : (customerSearch.value.trim().length < 2 ? t('pos.customerSearch') : t('pos.customerNoResults')), hasCustomer: !!customerId.value, checkoutDisabled: checkingOut.value || confirmingCheckout.value || contextPending.value || !!contextError.value || locationChanged.value || !lines.value.length || !staffId.value, total: money(total.value), reviewLabel: t('pos.reviewSale', { count: lines.value.length }), payLabel: t('pos.pay', { amount: money(total.value) }) }))
function addPosItem(key: string) { const item = catalog.value.items.find(item => `${item.itemType}:${item.id}` === key); if (item) addItem(item) }
function removePosLine(id: string) { const index = lines.value.findIndex(line => line.key === id); if (index >= 0) removeLine(index) }
function setPosQuantity(id: string, value: number) { const line = lines.value.find(line => line.key === id); if (line) setQuantity(line, value) }
function setPosStaff(id: string) { staffId.value = id; lockLocation(); invalidateRequests() }
function dismissPosFeedback() { errorMessage.value = ''; scanMessage.value = '' }
const posCopy = computed<BsPointOfSaleCopy>(() => ({
  imagePlaceholder: locale.value === 'ar' ? 'بدون صورة' : 'No image',
  appointment: t('pos.appointment'),
  cart: t('pos.cart'),
  catalog: t('pos.catalog'),
  clearCustomer: t('pos.clearCustomer'),
  closeShift: t('pos.closeShift'),
  customer: t('pos.customer'),
  customerNoResults: t('pos.customerNoResults'),
  customerSearch: t('pos.customerSearch'),
  customerSearchHint: t('pos.customerSearchHint'),
  emptyCart: t('pos.emptyCart'),
  loadError: t('pos.loadError'),
  loading: t('pos.loading'),
  location: t('pos.location'),
  locationChanged: t('pos.locationChanged'),
  noCustomer: t('pos.noCustomer'),
  noResults: t('pos.noResults'),
  notes: t('pos.notes'),
  paying: t('pos.paying'),
  paymentMethod: t('pos.paymentMethod'),
  permissionDenied: t('pos.permissionDenied'),
  quantity: t('pos.quantity'),
  reference: t('pos.reference'),
  remove: t('pos.remove'),
  reset: t('pos.reset'),
  retry: t('pos.retry'),
  search: t('pos.search'),
  selectStaff: t('pos.selectStaff'),
  serverTotal: saleCopy(t, 'pos.serverTotal', lines.value),
  shortcuts: t('pos.shortcuts'),
  staff: t('pos.staff'),
  subtitle: t('pos.subtitle'),
  title: t('pos.title'),
  total: t('pos.total'),
  walkIn: t('pos.walkIn'),
  noShop: t('sales.noShop'), category: locale.value === 'ar' ? 'التصنيف' : 'Category', previous: t('customers.previous'), next: t('customers.next'), previousGlyph: locale.value === 'ar' ? '›' : '‹', nextGlyph: locale.value === 'ar' ? '‹' : '›',
}))
const posTypeOptions = computed(() => availableItemTypes.value.map(value => ({ value, label: t(`pos.${value === 'product' ? 'products' : value === 'service' ? 'services' : 'all'}`) })))
const posCategoryOptions = computed(() => [{ value: '', label: locale.value === 'ar' ? 'كل التصنيفات' : 'All categories' }, ...categories.value.map(category => ({ value: category.id, label: category.name }))])
const posAppointmentOptions = computed(() => [{ value: '', label: t('pos.walkIn') }, ...context.value.appointments.map(appointment => ({ value: appointment.id, label: appointmentLabel(appointment) }))])
const posStaffOptions = computed(() => context.value.staff.map(staff => ({ value: staff.id, label: staff.name })))
const posPaymentOptions = computed(() => ['cash','card','bank_transfer','wallet','cheque','other'].map(value => ({ value, label: t(`payments.methods.${value}`) })))
</script>

<template>
  <BsPointOfSalePage ref="posPage" v-model:catalog-search="catalogSearch" v-model:category-filter="categoryFilter" v-model:item-type="posItemType" v-model:catalog-page="catalogPage" v-model:payment-form="posPaymentForm" variant="shop" :copy="posCopy" :view="posView" :catalog-items="posCatalogItems" :cart-lines="posCartLines" :customer-options="customerOptions" :staff-id="staffId" :appointment-id="appointmentId" :customer-id="customerId" :item-type-options="posTypeOptions" :category-options="posCategoryOptions" :appointment-options="posAppointmentOptions" :staff-options="posStaffOptions" :payment-options="posPaymentOptions" @reset="requestReset" @checkout="checkout" @retry-catalog="refreshCatalog" @retry-context="refreshContext" @add="addPosItem" @remove="removePosLine" @quantity="setPosQuantity" @appointment="chooseAppointment" @staff="setPosStaff" @customer-search="customerSearch = $event" @reset-customer-search="resetCustomerSearch" @customer="setCustomer" @clear-customer="clearCustomer" @dismiss-feedback="dismissPosFeedback" @barcode="scanBarcode" />
</template>
