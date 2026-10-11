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
const catalogInput = ref<{ focus: () => void } | null>(null)
const customerInput = ref<{ focus: () => void } | null>(null)
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
  if (target?.id !== 'pos-catalog-search' && target?.closest('input, textarea, select, button, a, [role="combobox"], [contenteditable="true"]')) {
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
  <BsStack>
    <BsPageHeader  :title="t('pos.title')" :subtitle="t('pos.subtitle')">
      <template #actions>
        <BsButton severity="secondary" :disabled="checkingOut || confirmingCheckout" @click="requestReset">{{ t('pos.reset') }}</BsButton>
      </template>
    </BsPageHeader>
    <BsText v-if="!current && !shopLoading" as="p" size="sm">{{ t('sales.noShop') }}</BsText>
    <template v-else-if="current">
      <BsPanel :aria-label="t('pos.cart')" padding="md">
        <BsText as="p" size="sm">
          <BsText as="strong">{{ t('pos.location') }}:</BsText> {{ transactionLocationName || currentLocation?.name || '—' }} · <BsText as="strong">{{ t('pos.staff') }}:</BsText> {{ selectedStaff?.name || t('pos.selectStaff') }}</BsText>
        <BsInline>
          <BsLink to="#pos-catalog-title" external>{{ t('pos.catalog') }}</BsLink>
          <BsLink to="#pos-cart-title" external>{{ t('pos.reviewSale', { count: lines.length }) }} · {{ money(total) }}</BsLink>
          <BsLink to="/cash-shifts">{{ t('pos.closeShift') }}</BsLink>
        </BsInline>
      </BsPanel>
      <BsText v-if="locationChanged" role="alert" as="p" size="sm" tone="danger">{{ t('pos.locationChanged') }}</BsText>
      <BsText v-if="errorMessage" role="alert" as="p" size="sm" tone="danger">{{ errorMessage }}</BsText>
      <BsVisuallyHidden aria-live="polite">{{ scanMessage }}</BsVisuallyHidden>
      <BsText v-if="checkingOut" role="status" as="p" size="sm" emphasis="semibold">{{ t('pos.paying') }}</BsText>
      <BsFieldGroup :disabled="checkingOut" :inert="checkingOut" :aria-busy="checkingOut" :legend="''">
        <BsGrid :columns="2">
          <BsPanel aria-labelledby="pos-catalog-title" padding="md">
            <BsHeading id="pos-catalog-title" tabindex="-1" :level="2">{{ t('pos.catalog') }}</BsHeading>
            <BsFilterBar :label="t('pos.catalog')">
              <BsInput id="pos-catalog-search" ref="catalogInput" v-model="catalogSearch" type="search" :placeholder="t('pos.search')" :aria-label="t('pos.search')"/>
              <BsSelect v-model="categoryFilter" :label="locale === 'ar' ? 'التصنيف' : 'Category'" :options="[{ value: '', label: (locale === 'ar' ? 'كل التصنيفات' : 'All categories'), disabled: false }, ...(categories).map(category => ({ value: category.id, label: (category.name), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
              <BsInline :aria-label="t('pos.catalog')" role="group">
                <BsButton v-for="kind in availableItemTypes" :key="kind" variant="chip" type="button" :aria-pressed="itemType === kind" @click="itemType = kind">{{ t(`pos.${kind === 'product' ? 'products' : kind === 'service' ? 'services' : 'all'}`) }}</BsButton>
              </BsInline>
            </BsFilterBar>
            <BsText v-if="scanMessage" as="p" size="sm">{{ scanMessage }}</BsText>
            <BsText v-if="catalogPending" role="status" as="p" size="sm" tone="muted">{{ t('pos.loading') }}</BsText>
            <BsBox v-else-if="catalogError" role="alert" padding="md">
              <BsText as="p">{{ catalogError?.message?.includes('SHOP_PERMISSION_DENIED') ? t('pos.permissionDenied') : t('pos.loadError') }}</BsText>
              <BsButton severity="secondary" @click="refreshCatalog()">{{ t('pos.retry') }}</BsButton>
            </BsBox>
            <BsText v-else-if="!catalog.items.length" as="p" size="sm" tone="muted">{{ t('pos.noResults') }}</BsText>
            <BsList v-else :aria-label="t('pos.catalog')">
              <BsListItem v-for="item in catalog.items" :key="`${item.itemType}:${item.id}`">
                <BsActionTile type="button" :disabled="locationChanged || checkingOut" @click="addItem(item)">
                  <BsText as="strong">{{ item.name }}</BsText>
                  <BsText as="span" size="xs" tone="muted">
                    <BsText as="span">{{ item.sku || (item.itemType === 'service' ? t('sales.service') : t('sales.product')) }}</BsText>
                    <BsText as="span">{{ money(Math.max(0, item.unitPrice - item.discount)) }}</BsText>
                  </BsText>
                  <BsText v-if="item.stock != null" as="span" size="xs">{{ t('pos.stock', { count: item.stock }) }}</BsText>
                </BsActionTile>
              </BsListItem>
            </BsList>
            <BsInline v-if="catalog.total > catalog.pageSize">
              <BsButton severity="secondary" :disabled="catalogPage <= 1" :aria-label="t('customers.previous')" @click="catalogPage--">
                <BsText aria-hidden="true" as="span">{{ locale === 'ar' ? '›' : '‹' }}</BsText>
              </BsButton>
              <BsText as="span" size="sm">{{ catalogPage }}</BsText>
              <BsButton severity="secondary" :disabled="catalogPage * catalog.pageSize >= catalog.total" :aria-label="t('customers.next')" @click="catalogPage++">
                <BsText aria-hidden="true" as="span">{{ locale === 'ar' ? '‹' : '›' }}</BsText>
              </BsButton>
            </BsInline>
          </BsPanel>
          <BsPanel aria-labelledby="pos-cart-title" padding="md">
            <BsHeading id="pos-cart-title" tabindex="-1" :level="2">{{ t('pos.cart') }}</BsHeading>
            <BsText v-if="contextPending" role="status" as="p" size="sm">{{ t('pos.loading') }}</BsText>
            <BsText v-else-if="contextError" role="alert" as="p" size="sm" tone="danger">{{ contextError?.message?.includes('SHOP_PERMISSION_DENIED') ? t('pos.permissionDenied') : t('pos.loadError') }} <BsButton variant="link" type="button" @click="refreshContext()">{{ t('pos.retry') }}</BsButton>
            </BsText>
            <BsGrid :columns="2">
              <BsText as="span" emphasis="semibold">{{ t('pos.location') }}</BsText>
              <BsText as="span">{{ transactionLocationName || currentLocation?.name || '—' }}</BsText>
              <BsText as="span" emphasis="semibold">{{ t('pos.staff') }}</BsText>
              <BsText as="span">{{ selectedStaff?.name || t('pos.selectStaff') }}</BsText>
            </BsGrid>
            <BsText v-if="!lines.length" as="p" size="sm" tone="muted">{{ t('pos.emptyCart') }}</BsText>
            <BsLineItemsEditor v-else :items="lines.map(line => ({ id: line.key, line }))" :label="t('pos.cart')" :add-label="t('pos.catalog')" :remove-label="t('pos.remove')" :row-label="item => item.line.name" :show-add="false" :pending="checkingOut" @remove="item => removeLine(lines.findIndex(line => line.key === item.id))">
              <template #default="{ item: { line } }">
                <BsInline justify="between">
                  <BsText as="strong">{{ line.name }}</BsText>
                </BsInline>
                <BsInline justify="between">
                  <BsField v-slot="field" :label="(t('pos.quantity'))">
                    <BsQuantityInput :id="field.id" :aria-describedby="field.describedby" :model-value="line.quantity" :label="t('pos.quantity')"  :min="0.001" :max="1000000" :step="1" @update:model-value="value => setQuantity(line, Number(value))"/>
                  </BsField>
                  <BsText as="span" emphasis="semibold">{{ money((line.unitPrice - line.discount) * line.quantity) }}</BsText>
                </BsInline>
              </template>
            </BsLineItemsEditor>
            <BsStack>
              <BsField v-slot="field" :label="(t('pos.appointment'))">
                <BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="appointmentId" :disabled="checkingOut" :label="(t('pos.appointment'))" :options="[{ value: '', label: (t('pos.walkIn')), disabled: false }, ...(context.appointments).map(appointment => ({ value: appointment.id, label: (appointmentLabel(appointment)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="value => chooseAppointment(String(value ?? ''))"/>
              </BsField>
              <BsField v-slot="field" :label="(t('pos.staff'))">
                <BsSelect v-model="staffId" :input-id="field.id" :aria-describedby="field.describedby" :label="t('pos.staff')" :options="context.staff" option-label="name" option-value="id" filter virtual :disabled="Boolean(appointmentId) || checkingOut" @change="lockLocation(); invalidateRequests()"/>
              </BsField>
              <BsEntityPicker ref="customerInput" :model-value="customerId || null" :label="t('pos.customer')" :options="customerId ? [{ id: customerId, name: customerName }] : context.customers" option-label="name" option-value="id" :load-more-label="t('pos.customerSearch')" show-clear :disabled="Boolean(appointmentId) || checkingOut" :loading="contextPending" @search="customerSearch = $event" @update:model-value="value => { const customer = context.customers.find(item => item.id === value); if (customer) chooseCustomer(customer); else if (!value) clearCustomer() }" />
              <BsText v-if="!customerId" size="xs" tone="muted">{{ t('pos.noCustomer') }}</BsText>
              <BsGrid :columns="2">
                <BsField v-slot="field" :label="(t('pos.paymentMethod'))">
                  <BsSelect v-model="paymentMethod" :input-id="field.id" :aria-describedby="field.describedby" :label="(t('pos.paymentMethod'))" :options="[...(['cash','card','bank_transfer','wallet','cheque','other']).map(method => ({ value: method, label: (t(`payments.methods.${method}`)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
                </BsField>
                <BsField v-slot="field" :label="(t('pos.reference'))">
                  <BsInput :id="field.id" v-model="paymentReference" :aria-describedby="field.describedby" :maxlength="200"/>
                </BsField>
              </BsGrid>
              <BsField v-slot="field" :label="(t('pos.notes'))">
                <BsInput :id="field.id" v-model="notes" :aria-describedby="field.describedby" :maxlength="2000"/>
              </BsField>
              <BsInline justify="between">
                <BsText as="span" size="sm" emphasis="semibold">{{ t('pos.total') }}</BsText>
                <BsText as="strong" size="lg">{{ money(total) }}</BsText>
              </BsInline>
              <BsText as="p" size="xs" tone="muted">{{ t('pos.serverTotal') }}</BsText>
              <BsButton variant="primary" :pending="checkingOut" :disabled="checkingOut || confirmingCheckout || contextPending || Boolean(contextError) || locationChanged || !lines.length || !staffId" @click="checkout">{{ checkingOut ? t('pos.paying') : t('pos.pay', { amount: money(total) }) }}</BsButton>
              <BsText as="p" size="xs" tone="muted">{{ t('pos.shortcuts') }}</BsText>
            </BsStack>
          </BsPanel>
        </BsGrid>
      </BsFieldGroup>
    </template>
  </BsStack>
</template>
