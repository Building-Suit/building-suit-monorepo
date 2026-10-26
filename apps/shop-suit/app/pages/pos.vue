<script setup lang="ts">
import { parseGs1WeightBarcode, capturedWeightQuantity, cartQuantityFromDecimal, assertCapturedStock } from '~/utils/weightBarcodes.js'
import { scaleFailure } from '~/utils/scaleCaptureCopy'
import type { ScaleCaptureInput, ScaleCaptureResolution, ScaleCaptureSnapshot } from '~/types/scales'
import type { Gs1WeightCapture, WeightBarcodeResolution } from '~/types/weightBarcodes'
import { tradePricePresentation } from '~/utils/tradePricing'
import { measurementUnits } from '~/utils/measurement'
import type { PosReelOptions, PosReel, ReelAvailability } from '~/types/electrical'
import type { PosMeasurement } from '~/types/measurement'
import { estimateOfferDiscount, type CatalogOffer } from '#shared/catalogOffers'
import type { BsOfferCardView } from '@building-suit/ui/types/storefrontBuilderPresentation'
import type { BsPointOfSaleCopy, BsPointOfSaleView, BsPointOfSaleCatalogItem, BsPointOfSaleCartLine, BsPointOfSalePaymentForm } from '@building-suit/ui/types/pointOfSalePresentation'
import { shopCommandErrorMessage } from '~/utils/shopCommandErrorMessage'
import { saleCopy } from '~/utils/saleCopy'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { businessModeSupportsProducts, businessModeSupportsServices } from '~/utils/businessMode'
import { posCustomerOptions } from '~/utils/posCustomer.js'
import { addOrIncrementCartLine, cartTotal, nextCartQuantity, cartQuantityLimit, cartLineKey, saleLineInput, cartQuantityStep, selectedMeasurement, measuredBaseQuantity, selectedUnitPrice, physicalCartError, cachedReelBarcodeItem } from '~/utils/pos'
const { refreshShopQueries } = useShopInvalidation()

const { businessCurrency } = useShop()

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
type CatalogItem = { stockOnHand?: string; stockReserved?: string; reelId?: string; reelBarcode?: string; reelRemaining?: string; reelPrice?: number | null; reelStatus?: string; reelSummary?: ReelAvailability; catalogStock?: number; allowSplit?: boolean; cuttingLoss?: string; measurement?: PosMeasurement | null; unitSelection?: string; id: string; itemType: 'product' | 'service'; name: string; imageUrl?: string | null; sku: string | null; barcode: string | null; unitPrice: number; discount: number; stock: number | null }
type CartLine = CatalogItem & { measurementCapture?: Gs1WeightCapture | ScaleCaptureInput; scaleSnapshot?: ScaleCaptureSnapshot; overridePrice?: string; overrideReason?: string; key: string; sourceId: string; quantity: number }
type Appointment = { id: string; staffId: string; customerId: string | null; customerName: string; startsAt: string; status: string; service: CatalogItem }
type Customer = { id: string; name: string; phone: string | null }
type PosContext = { customerQuery?: string; staff: Array<{ id: string; name: string }>; appointments: Appointment[]; customers: Array<{ id: string; name: string; phone: string | null }> }
type CatalogResult = { items: CatalogItem[]; total: number; page: number; pageSize: number; businessMode: 'product' | 'service' | 'mixed'; ambiguousBarcode: boolean }
type Category = { id: string; name: string }

const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const media = useCatalogMedia()
const counter = useOfflineCounter()
const offlineView = useOfflineCounterView(counter)
const posReceipt = usePosReceipt()
const route = useRoute()
const { t, locale } = useI18n()
const { current, currentId, currentLocationId, currentLocation, currentMembership, loading: shopLoading } = useShop()
const confirmation = useConfirmation()
const captureScope = useShopTaskScope()
const actor = useSupabaseUser()
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
const physicalPickers = reactive<Record<string, { items: PosReel[]; total: number; page: number; query: string; pending: boolean; error: string | null; request: number; summary?: ReelAvailability }>>({})
let physicalRequest = 0
const staffId = ref('')
const appointmentId = ref('')
const consumedAppointmentLink = ref('')
const customerId = ref('')
watch(customerId, () => { lines.value = lines.value.map(line => ({ ...line, overridePrice: undefined, overrideReason: undefined })) }, { flush: 'sync' })
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
const saveInvoiceInput = ref<string | null>(null)
const checkoutRequestId = ref<string | null>(null)
const issueRequestId = ref<string | null>(null)
const paymentRequestId = ref<string | null>(null)
const appointmentRequestId = ref<string | null>(null)
const checkoutPaidAt = ref<string | null>(null)
useDebouncedChange(catalogSearch, value => { debouncedSearch.value = value.trim(); catalogPage.value = 1 }, 250)
const customerSearchInteraction = useDebouncedChange(customerSearch, value => { debouncedCustomerSearch.value = value.trim() }, 250)
watch(itemType, () => { catalogPage.value = 1 })
watch(categoryFilter, () => { catalogPage.value = 1 })

const offlinePhysicalError = computed(() => counter.online.value ? null : lines.value.map(physicalCartError).find(Boolean) ?? null)
const locationChanged = computed(() => Boolean(transactionLocationId.value && currentLocationId.value !== transactionLocationId.value))
const {open:scaleOpen,form:scaleForm,view:scaleView,copy:scaleCopy,show:openScale,profile:scaleProfile,product:scaleProduct,query:scaleSearch,more:scaleMore,retry:scaleRetry,connect:scaleConnect,disconnect:scaleDisconnect,read:scaleRead,tare:scaleTare,submit:scaleSubmit}=useScaleCounter(counter.online,()=>checkingOut.value||confirmingCheckout.value||locationChanged.value,addScaleCapture)
const taxLines = computed(() => lines.value.map(saleLineInput))
const { data: pricePermission } = useShopQuery('shop-data:price-approval-access', async () => {
 if (!currentId.value) return false
 const r = await rpc.rpc('shop_permission_access', { p_shop_id: currentId.value, p_permission_keys: ['products.manage'] })
 if (r.error) throw r.error
 return r.data?.['products.manage'] === true
}, { watch: [currentId], default: () => false })
const { data: taxQuote, pending: taxPending, error: taxError, refresh: refreshPosQuote } = useSaleTaxQuote(currentId, currentLocationId, taxLines, counter, true, customerId, invoiceId)
const total = computed(() => Number(counter.online.value ? taxQuote.value?.total ?? cartTotal(lines.value) : Math.max(0, Math.round((cartTotal(lines.value)-offlineOffers.value.discount)*100)/100)))
const selectedStaff = computed(() => context.value.staff.find(member => member.id === staffId.value))

const offerQuery = useShopQuery(() => `shop-data:pos-offers:${currentId.value}:${currentLocationId.value}:${counter.online.value}`, async (): Promise<CatalogOffer[]> => {
 if (!currentId.value || !currentLocationId.value) return []
 if (!counter.online.value) return await counter.cached<CatalogOffer[]>('pos-catalog-offers') ?? []
 const valid = captureScope()
 const result = await rpc.rpc('pos_catalog_offers', { p_shop_id: currentId.value, p_location_id: currentLocationId.value })
 if (result.error) throw result.error
 if (!valid()) return []
 const offers = result.data ?? []
 if (counter.ready.value) await counter.cache('pos-catalog-offers', offers)
 return offers
}, { scope: 'location', server: false, enabled: () => !!currentId.value && !!currentLocationId.value, watch: [counter.ready], default: () => [] })
const offlineOffers = computed(() => estimateOfferDiscount(offerQuery.data.value, lines.value.filter(line => !selectedMeasurement(line).startsWith('package:') && !(line.reelId && line.reelPrice != null)).flatMap(line => { try { return [{ ...line, quantity: Number(measuredBaseQuantity(line)) }] } catch { return [] } })))
const appliedOffers = computed(() => counter.online.value ? taxQuote.value?.offers ?? [] : offlineOffers.value.offers)
const offerCards = computed<BsOfferCardView[]>(() => offerQuery.data.value.filter(o => o.oldPrice !== null && o.price < o.oldPrice).map(offer => ({
 id: offer.id, name: offer.name, description: offer.description, price: money(offer.price), oldPrice: money(offer.oldPrice!), saving: `${locale.value === 'ar' ? 'وفّر' : 'Save'} ${money(offer.oldPrice! - offer.price)}`, items: offer.lines.map(l => `${l.quantity} × ${l.name}`).join(' · '), images: [],
 disabled: checkingOut.value || confirmingCheckout.value || locationChanged.value || offerQuery.isLoading.value || offer.lines.some(l => l.kind === 'product' && l.stock != null && l.stock < (lines.value.find(v => v.itemType === l.kind && v.sourceId === l.sourceId)?.quantity ?? 0) + l.quantity),
})))
function selectOffer(id: string) {
 if (checkingOut.value || confirmingCheckout.value || locationChanged.value || offerQuery.isLoading.value || offerQuery.error.value) return
 const offer = offerQuery.data.value.find(o => o.id === id)
 if (!offer || !offer.active || offer.ends_at && Date.parse(offer.ends_at) <= Date.now() || offer.starts_at && Date.parse(offer.starts_at) > Date.now()) return
 const additions: CartLine[] = []
 for (const line of offer.lines) {
  const item: CatalogItem = { id: line.sourceId, itemType: line.kind, name: line.name, sku: null, barcode: null, unitPrice: line.unitPrice, discount: line.discount, stock: line.stock ?? null, measurement: line.measurement }
  const existing = lines.value.find(v => v.key === cartLineKey(item))
  if (!line.available || (existing?.quantity ?? 0) + line.quantity > cartQuantityLimit(item)) { errorMessage.value = readableError('INSUFFICIENT_STOCK'); return }
  additions.push({ ...item, key: cartLineKey(item), sourceId: line.sourceId, quantity: line.quantity })
 }
 lockLocation()
 const next = lines.value.map(line => ({ ...line }))
 for (const addition of additions) { const line = next.find(l => l.key === addition.key); if (line) line.quantity = Math.round((line.quantity + addition.quantity) * 1000) / 1000; else next.push(addition) }
 if (next.length > 100) { errorMessage.value = t('pos.invalid'); return }
 try {
  const checked = new Set<string>()
  for (const captured of lines.value) if (captured.measurementCapture && !checked.has(captured.sourceId)) {
   checked.add(captured.sourceId); assertCapturedStock(next, { id: captured.sourceId }, '0', String(captured.stock ?? 0))
  }
 } catch (cause) { errorMessage.value = readableError((cause as Error).message); return }
 lines.value = next; errorMessage.value = ''; invalidateRequests(); scanMessage.value = offer.name
}

const { data: categories } = useShopQuery(() => `shop-data:pos-categories:${currentId.value ?? 'none'}`, async () => {
  if (!currentId.value) return []
  if (import.meta.client && !counter.online.value) return await counter.cached<Category[]>('categories') ?? []
  const { data, error } = await rpc.rpc('list_catalog_categories', { p_shop_id: currentId.value })
  if (error) throw error
  return data as Category[]
}, { watch: [currentId], default: () => [] })

const { data: catalog, pending: catalogPending, error: catalogError, refresh: refreshCatalog } = useShopQuery(
  () => `shop-data:pos-catalog:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${debouncedSearch.value}:${itemType.value}:${categoryFilter.value}:${catalogPage.value}`, async (): Promise<CatalogResult> => {
    if (!currentId.value || !currentLocationId.value) return { items: [], total: 0, page: 1, pageSize: 30, businessMode: 'mixed', ambiguousBarcode: false }
    if (import.meta.client && !counter.online.value) {
      const cached = await counter.cached<CatalogResult>('catalog')
      if (!cached) throw new Error('OFFLINE_CACHE_EXPIRED')
      const search = debouncedSearch.value.toLowerCase()
      const items = cached.items.filter(item => (!search || [item.name,item.sku,item.barcode].some(value => value?.toLowerCase().includes(search))) && (itemType.value === 'all' || item.itemType === itemType.value))
      const offset = (catalogPage.value - 1) * 30
      return { ...cached, items: items.slice(offset,offset + 30), total: items.length, page: catalogPage.value }
    }
    const args = { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_search: debouncedSearch.value || null, p_item_type: itemType.value === 'all' ? null : itemType.value, p_category_id: categoryFilter.value || null, p_page: catalogPage.value, p_page_size: 30 }
    const { data, error } = await media.request('pos', args, () => rpc.rpc('pos_catalog_search_by_category', args))
    if (error) throw error
    return data as CatalogResult
  }, { watch: [currentId, currentLocationId, debouncedSearch, itemType, categoryFilter, catalogPage], default: (): CatalogResult => ({ items: [], total: 0, page: 1, pageSize: 30, businessMode: 'mixed', ambiguousBarcode: false }) },
)

// Resolve the initial context before deriving appointment state in SSR and hydration.
const contextQuery = useShopQuery(
  () => `shop-data:pos-context:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${debouncedCustomerSearch.value}`, async (): Promise<PosContext> => {
    if (!currentId.value || !currentLocationId.value) return { staff: [], appointments: [], customers: [] }
    if (import.meta.client && !counter.online.value) {
      const cached = await counter.cached<PosContext>('context')
      if (!cached) throw new Error('OFFLINE_CACHE_EXPIRED')
      return cached
    }
    const query = debouncedCustomerSearch.value
    const { data, error } = await rpc.rpc('pos_checkout_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_customer_search: debouncedCustomerSearch.value.length >= 2 ? debouncedCustomerSearch.value : null })
    if (error) throw error
    return { ...(data as PosContext), customerQuery: query }
  }, { watch: [currentId, currentLocationId, debouncedCustomerSearch], default: (): PosContext => ({ staff: [], appointments: [], customers: [] }) },
)
const { data: context, pending: contextPending, error: contextError, refresh: refreshContext } = contextQuery
// Resolve server-rendered dependencies; client reads remain reactive.
if (import.meta.server) await contextQuery.ensure()

async function cacheCounterData() {
  if (!counter.ready.value || !counter.online.value || !currentId.value || !currentLocationId.value) return
  const capturedScope = counter.scope.value
  const old = await counter.cached<CatalogResult>('catalog')
  if (capturedScope !== counter.scope.value) return
  const merged = new Map((old?.items ?? []).map(item => [`${item.itemType}:${item.id}`, item]))
  for (const item of catalog.value.items) merged.set(`${item.itemType}:${item.id}`, { ...item, imageUrl: null })
  await counter.cache('catalog', { ...catalog.value, items: Array.from(merged.values()).slice(-3000) })
  if (capturedScope !== counter.scope.value) return
  await counter.cache('context', { staff: context.value.staff, appointments: [], customers: [], customerQuery: '' })
  if (capturedScope !== counter.scope.value) return
  await counter.cache('categories', categories.value)
  if (capturedScope !== counter.scope.value) return
  const shift = await rpc.rpc('cash_shift_dashboard', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_page: 1, p_page_size: 1 })
  if (!shift.error && capturedScope === counter.scope.value) {
    const value = shift.data as { active: Record<string, unknown> | null; canManage: boolean; canAdjust: boolean; currentMembershipId: string }
    await counter.cache('shift', { active: value.active ? { ...value.active, notes: null, closingNotes: null, events: [] } : null, canManage: value.canManage, canAdjust: value.canAdjust, currentMembershipId: value.currentMembershipId, items: [], total: 0, cashiers: [], page: 1, pageSize: 20 })
  }
}
watch([counter.ready, catalog, context], () => { void cacheCounterData() })
watch(counter.online, value => { if (!value) categoryFilter.value = ''; void refreshCatalog(); void refreshContext() })
watch(counter.ready, value => { if (value && !counter.online.value) { void refreshCatalog(); void refreshContext() } })
onMounted(() => { if (counter.online.value) void preloadRouteComponents('/cash-shifts').catch(() => {}) })

watch(counter.busy, value => { if (!value && counter.online.value) { void refreshCatalog(); void refreshContext() } })

watch(() => counter.scope.value ? JSON.stringify(JSON.parse(counter.scope.value).slice(0, 3)) : '', () => { checkingOut.value = false; confirmingCheckout.value = false; resetSale() })

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
  saveRequestId.value = null; saveInvoiceInput.value = null; checkoutRequestId.value = null; issueRequestId.value = null
  paymentRequestId.value = null; appointmentRequestId.value = null; checkoutPaidAt.value = null
}
function addItem(item: CatalogItem) {
  if (checkingOut.value || confirmingCheckout.value || locationChanged.value) return
  const existing = lines.value.find(line => line.key === cartLineKey(item))
  const nextQuantity = nextCartQuantity(existing?.quantity ?? 0, item)
  if (nextQuantity === null) { errorMessage.value = readableError('INSUFFICIENT_STOCK'); return }
  if (item.measurement && lines.value.some(line => line.sourceId === item.id && line.measurementCapture)) {
    try { assertCapturedStock(lines.value.filter(line => line !== existing), item, measuredBaseQuantity({ ...item, quantity: nextQuantity }), String(item.stock ?? 0)) }
    catch (cause) { errorMessage.value = readableError((cause as Error).message); return }
  }
  lockLocation(); lines.value = addOrIncrementCartLine(lines.value, item) as CartLine[]
  const added = lines.value.find(line => line.key === cartLineKey(item))
  if (added) { added.quantity = nextQuantity; added.imageUrl = item.imageUrl; if (added.measurement?.reelTracking) void loadPhysical(added.key) }
  errorMessage.value = ''; invalidateRequests(); scanMessage.value = t('pos.scanAdded', { name: item.name })
}
function setQuantity(line: CartLine, value: number) {
  if (line.measurementCapture || checkingOut.value || confirmingCheckout.value || locationChanged.value) return
  if (line.measurement && lines.value.some(other => other.sourceId === line.sourceId && other.measurementCapture)) {
    try { assertCapturedStock(lines.value.filter(other => other !== line), { id: line.sourceId }, measuredBaseQuantity({ ...line, quantity: value }), String(line.stock ?? 0)) }
    catch (cause) { errorMessage.value = readableError((cause as Error).message); return }
  }
  line.quantity = Number(value); invalidateRequests()
}
function removeLine(index: number) { if (checkingOut.value || confirmingCheckout.value || locationChanged.value) return; lines.value.splice(index, 1); invalidateRequests() }
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
function resetSale(focus = true) {
  lines.value = []; staffId.value = context.value.staff.some(member => member.id === currentMembership.value?.id) ? currentMembership.value!.id : ''
  resetCustomerSearch(); customerPhone.value = null
  paymentMethod.value = 'cash'; appointmentId.value = ''; customerId.value = ''; customerName.value = ''; paymentReference.value = ''; notes.value = ''
  transactionLocationId.value = null; transactionLocationName.value = ''; invoiceId.value = null; errorMessage.value = ''; scanMessage.value = ''; invalidateRequests()
  if (focus) nextTick(() => posPage.value?.focusCatalog())
}
function readableError(message?: string) {
  if (message?.includes('SCALE_') || message?.includes('APPROVED_MASS_LENGTH')) return scaleFailure(new Error(message), locale.value === 'ar')
  if (message?.includes('WEIGHT_') || message?.includes('FIXED_BARCODE_USE_NORMAL_SCAN')) return locale.value === 'ar' ? 'تعذّر اعتماد وزن الملصق. راجع باركود الصنف ووحدة المخزون أو أعد المسح.' : 'Could not verify the label weight. Review the product barcode and stock unit, or scan again.'
  if (message?.includes('TRADE_OFFLINE_QUOTE_REQUIRED')) return locale.value === 'ar' ? 'يلزم الاتصال للتحقق من أسعار التعاقد والكميات قبل إتمام البيع.' : 'Connect to verify customer and quantity prices before checkout.'
  if (message?.includes('PRICE_OVERRIDE_PERMISSION_DENIED') || message?.includes('PRICE_APPROVAL_CONTEXT_CHANGED')) return locale.value === 'ar' ? 'يلزم اعتماد مدير لهذا السعر بعد تغيير العميل أو الكمية أو الوحدة.' : 'A manager must approve this price after changing the customer, quantity or unit.'
  if (message?.includes('INVALID_PRICE_OVERRIDE')) return locale.value === 'ar' ? 'أدخل سعرًا صالحًا وسببًا واضحًا للتعديل.' : 'Enter a valid price and a clear adjustment reason.'

  if (message?.includes('SALE_OPEN_CASH_SHIFT_REQUIRED')) return t('sales.openCashShiftRequired')
  if (message?.includes('REEL_STOCK_UNCONFIRMED')) return locale.value === 'ar' ? 'اتصل مرة لتحميل أطوال البكرات قبل تسجيل هذا القطع دون اتصال.' : 'Connect once to load reel lengths before recording this cut offline.'
  if (message?.includes('CONTINUOUS_LENGTH_UNAVAILABLE')) return locale.value === 'ar' ? 'لا توجد بكرة واحدة توفر هذا الطول. اختر بكرة أخرى أو اسمح بقطع منفصلة.' : 'No single reel can supply this length. Choose another reel or allow separate pieces.'
  if (message?.includes('REEL_NOT_AVAILABLE') || message?.includes('REEL_PLAN_CHANGED') || message?.includes('SELECTED_REEL_CANNOT_FULFILL')) return locale.value === 'ar' ? 'تغيرت البكرة أو لا تكفي. حدّث خيارات البكرات وراجع الطول.' : 'The selected reel changed or cannot supply this length. Refresh the reel choices and review the quantity.'
  if (message?.includes('INSUFFICIENT_SEALED_REELS')) return locale.value === 'ar' ? 'لا توجد بكرات كاملة غير مفتوحة كافية لهذه العبوة.' : 'There are not enough unopened full reels for this package.'
  if (message?.includes('INVALID_REEL_CUT') || message?.includes('INVALID_SEALED_REEL_SALE')) return locale.value === 'ar' ? 'راجع فاقد القطع بوحدة المخزون. فاقد البكرة الكاملة يجب أن يساوي صفرًا.' : 'Review cutting loss in the stock unit. A full reel package requires zero loss.'
  if (message?.includes('INSUFFICIENT_REEL_LENGTH')) return locale.value === 'ar' ? 'أطوال البكرات المتاحة لا تكفي.' : 'Available reel lengths are insufficient.'
  if (message?.includes('MEASUREMENT_CONTEXT_CHANGED') || message?.includes('PACKAGE_CONTEXT_CHANGED')) return locale.value === 'ar' ? 'تغيرت وحدة المنتج أو العبوة. أزل الصنف وأضفه من الكتالوج المحدّث.' : 'The product unit or packaging changed. Remove the item and add it from the refreshed catalog.'
  if (message?.includes('MEASUREMENT') || message?.includes('PACKAGE_QUANTITY')) return locale.value === 'ar' ? 'راجع كمية الصنف ووحدة البيع المختارة.' : 'Review the item quantity and selected sale unit.'
  if (message?.includes('INSUFFICIENT_STOCK') || message?.includes('CROSS_LOCATION_STOCK')) return saleCopy(t, 'pos.insufficientStock', lines.value)
  if (message?.includes('SHOP_PERMISSION_DENIED')) return t('pos.permissionDenied')
  if (message?.includes('POS_CHECKOUT_REQUIRES_FULL_PAYMENT') || message?.includes('TAX_QUOTE_CHANGED')) return locale.value === 'ar' ? 'تغير السعر أو العرض. راجع الإجمالي المحدّث قبل الدفع.' : 'A price or offer changed. Review the refreshed total before paying.'
  if (message?.includes('FULL_PAYMENT') || message?.includes('OVERPAYMENT')) return t('sales.fullPaymentRequired')
  return t('pos.checkoutError')
}
function addScaleCapture(result: ScaleCaptureResolution) {
  if (checkingOut.value || confirmingCheckout.value || locationChanged.value) throw new Error('SCALE_CONTEXT_CHANGED')
  if (lines.value.length >= 100) throw new Error('SCALE_CART_LIMIT')
  if (lines.value.some(line => line.measurementCapture?.kind === 'scale' && line.measurementCapture.id === result.id)) throw new Error('SCALE_CAPTURE_ALREADY_ASSIGNED')
  assertCapturedStock(lines.value, result.item, result.quantity, result.availableQuantity)
  const measurementCapture: ScaleCaptureInput = { kind: 'scale', id: result.id }
  const selected = { ...result.item, unitSelection: `unit:${result.unitCode}`, measurementCapture, scaleSnapshot: result.snapshot }
  const line: CartLine = { ...selected, sourceId: selected.id, key: cartLineKey(selected), quantity: cartQuantityFromDecimal(result.quantity), unitPrice: selectedUnitPrice(selected) }
  lockLocation(); lines.value = [...lines.value, line]; invalidateRequests(); errorMessage.value = ''; scanMessage.value = t('pos.scanAdded', { name: line.name })
}
function addCapturedWeight(result: WeightBarcodeResolution) {
  if (checkingOut.value || confirmingCheckout.value || locationChanged.value) return
  if (lines.value.length >= 100) { errorMessage.value = t('pos.invalid'); return }
  const parsed = parseGs1WeightBarcode(result.raw)
  if (!parsed || result.gtin !== parsed.gtin || result.weightUnitCode !== 'kg' || result.netQuantity !== parsed.netQuantity
    || result.unitCode !== result.item.measurement?.baseUnitCode || capturedWeightQuantity(parsed, result.item) !== result.quantity
    || typeof result.availableQuantity !== 'string') throw new Error('INVALID_WEIGHT_BARCODE_RESPONSE')
  assertCapturedStock(lines.value, result.item, result.quantity, result.availableQuantity)
  const measurementCapture: Gs1WeightCapture = { kind: 'gs1', id: crypto.randomUUID(), raw: parsed.raw }
  const selected = { ...result.item, unitSelection: `unit:${result.unitCode}`, measurementCapture }
  const line: CartLine = { ...selected, sourceId: selected.id, key: cartLineKey(selected), quantity: cartQuantityFromDecimal(result.quantity), unitPrice: selectedUnitPrice(selected) }
  lockLocation(); lines.value = [...lines.value, line]; invalidateRequests(); errorMessage.value = ''; scanMessage.value = t('pos.scanAdded', { name: line.name })
}
async function scanBarcode(code: string) {
  if (!currentId.value || !currentLocationId.value || locationChanged.value) return
  const scanScope = captureScope()
  catalogSearch.value = ''
  if (!counter.online.value) {
    const cached = await counter.cached<CatalogResult>('catalog')
    if (!scanScope()) return
    const matches = cached?.items.flatMap(item => {
      if (item.barcode === code) return [item]
      return (item.measurement?.packages ?? []).filter(pack => pack.canSell && pack.barcode === code).map(pack => { const selected = { ...item, unitSelection: `package:${pack.id}`, barcode: code }; return { ...selected, unitPrice: selectedUnitPrice(selected) } })
    }) ?? []
    const physical = await Promise.all((cached?.items ?? []).filter(item => item.measurement?.reelTracking).map(async item => cachedReelBarcodeItem(item, await counter.cached<PosReelOptions>(`reels:${item.id}`), code)))
    if (!scanScope()) return
    matches.push(...physical.filter(item => item !== null) as CatalogItem[])
    if (matches.length === 1) addItem(matches[0]!)
    else if (matches.length) scanMessage.value = t('pos.ambiguousBarcode', { code })
    else {
      try { scanMessage.value = parseGs1WeightBarcode(code) ? locale.value === 'ar' ? 'اتصل للتحقق من ملصق الوزن، أو أدخل الكمية المقاسة يدويًا.' : 'Connect to verify the weight label, or enter the measured quantity manually.' : t('pos.unknownBarcode', { code }) }
      catch { errorMessage.value = readableError('INVALID_WEIGHT_BARCODE') }
    }
    return
  }
  const { data, error } = await rpc.rpc('pos_catalog_search', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_barcode: code, p_page: 1, p_page_size: 2 })
  if (!scanScope()) return
  if (error) { errorMessage.value = readableError(error.message); return }
  const result = data as CatalogResult
  if (result.ambiguousBarcode) scanMessage.value = t('pos.ambiguousBarcode')
  else if (result.items.length === 1) addItem(result.items[0]!)
  else {
    try {
      if (!parseGs1WeightBarcode(code)) scanMessage.value = t('pos.unknownBarcode', { code })
      else {
        const captured = await rpc.rpc('resolve_weight_barcode', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_barcode: code })
        if (!scanScope()) return
        if (captured.error) throw captured.error
        if (!captured.data || typeof captured.data.raw !== 'string') throw new Error('INVALID_WEIGHT_BARCODE_RESPONSE')
        addCapturedWeight(captured.data)
      }
    } catch (cause) { if (scanScope()) errorMessage.value = readableError((cause as Error)?.message || 'INVALID_WEIGHT_BARCODE') }
  }
  await nextTick(); posPage.value?.focusCatalog()
}

async function checkout() {
  if (Boolean(offlinePhysicalError.value) || taxPending.value || Boolean(taxError.value) || counter.shiftClosing.value || !currentId.value || !transactionLocationId.value || checkingOut.value || confirmingCheckout.value || contextPending.value || Boolean(contextError.value) || locationChanged.value || !lines.value.length || !staffId.value) {
    errorMessage.value = locationChanged.value ? t('pos.locationChanged') : t('pos.invalid'); return
  }
  const inScope = captureScope()
  checkingOut.value = true; errorMessage.value = ''
  if (!saveRequestId.value) { saveRequestId.value = crypto.randomUUID(); saveInvoiceInput.value = invoiceId.value }
  checkoutRequestId.value ??= crypto.randomUUID(); issueRequestId.value ??= crypto.randomUUID(); paymentRequestId.value ??= crypto.randomUUID()
  if (appointmentId.value) appointmentRequestId.value ??= crypto.randomUUID()
  checkoutPaidAt.value ??= new Date().toISOString()
  try {
    const shift = counter.ready.value ? await counter.cached<{ active: { id: string } | null }>('shift') : null
    if (!inScope()) return
    // Eligible counter commands are durable before the first network attempt, including online-to-offline loss.
    if ((shift?.active && !saveInvoiceInput.value) || !counter.online.value || counter.records.value.some(record => record.state !== 'synced' && record.resolution?.phase !== 'reconciled')) {
      if (!shift?.active || !counter.ready.value) throw new Error('SALE_OPEN_CASH_SHIFT_REQUIRED')
      if (saveInvoiceInput.value) throw new Error('EXISTING_DRAFT_REQUIRES_CONNECTION')
      const queued = await counter.enqueue({ kind: 'sale', args: {
        p_request_id: checkoutRequestId.value, p_save_request_id: saveRequestId.value,
        p_issue_request_id: issueRequestId.value, p_payment_request_id: paymentRequestId.value,
        p_appointment_request_id: appointmentRequestId.value, p_shop_id: currentId.value,
        p_location_id: transactionLocationId.value, p_shift_id: shift.active.id,
        p_staff_membership_id: staffId.value, p_appointment_id: appointmentId.value || null,
        p_customer_id: customerId.value || null, p_notes: notes.value.trim() || null,
        p_lines: lines.value.map(saleLineInput),
        p_amount: total.value, p_paid_at: checkoutPaidAt.value, p_method: paymentMethod.value,
        p_reference: paymentReference.value.trim() || null,
      } }, checkoutRequestId.value)
      if (!inScope()) return
      if (counter.online.value) {
        await counter.sync()
        if (!inScope()) return
        const result = counter.records.value.find(record => record.envelope.localId === queued.envelope.localId)
        if (result?.state === 'synced' && result.result) {
          pushToast({ tone: 'success', title: t('pos.success') }); resetSale(false)
          await posReceipt.completed(result.result); return
        }
      }
      resetSale(); scanMessage.value = `${offlineView.value.records.find(record => record.id === queued.envelope.localId)?.status} · ${queued.envelope.localId}`
      return
    }
    const saved = await rpc.rpc('save_pos_sale_draft', { p_request_id: saveRequestId.value, p_shop_id: currentId.value, p_location_id: transactionLocationId.value, p_invoice_id: saveInvoiceInput.value, p_staff_membership_id: staffId.value, p_appointment_id: appointmentId.value || null, p_customer_id: customerId.value || null, p_notes: notes.value.trim() || null, p_lines: lines.value.map(saleLineInput) })
    if (!inScope()) return
    if (saved.error) throw saved.error
    invoiceId.value = saved.data
    const completed = await rpc.rpc('checkout_pos_sale', { p_request_id: checkoutRequestId.value, p_issue_request_id: issueRequestId.value, p_payment_request_id: paymentRequestId.value, p_appointment_request_id: appointmentRequestId.value, p_shop_id: currentId.value, p_location_id: transactionLocationId.value, p_invoice_id: invoiceId.value!, p_amount: total.value, p_paid_at: checkoutPaidAt.value, p_method: paymentMethod.value, p_reference: paymentReference.value.trim() || null })
    if (!inScope()) return
    if (completed.error) throw completed.error
    const completedId = completed.data
    await Promise.all([refreshCatalog(), refreshContext(), refreshShopQueries('shop-data:sales'), refreshShopQueries('shop-data:inventory-overview'), refreshShopQueries('shop-data:recent-invoices')])
    if (!inScope()) return
    pushToast({ tone: 'success', title: t('pos.success') }); resetSale(false); await posReceipt.completed(completedId!)
  } catch (error) {
    if (inScope()) {
      const message = shopCommandErrorMessage(error)
      if (message?.includes('POS_CHECKOUT_REQUIRES_FULL_PAYMENT') || message?.includes('TAX_QUOTE_CHANGED')) { invalidateRequests(); await refreshPosQuote() }
      if (inScope()) errorMessage.value = readableError(message)
    }
  }
  finally { if (inScope()) checkingOut.value = false }
}

function money(value: number) { return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 20 }).format(value) }
function appointmentLabel(appointment: Appointment) { return `${new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(appointment.startsAt))} · ${appointment.customerName} · ${appointment.service.name}` }

watch([context, () => route.query.appointment], ([value]) => {
  if (!staffId.value && value.staff.some(member => member.id === currentMembership.value?.id)) staffId.value = currentMembership.value!.id
  const requested = typeof route.query.appointment === 'string' ? route.query.appointment : ''
  if (requested && requested !== consumedAppointmentLink.value && value.appointments.some(item => item.id === requested) && !appointmentId.value) { consumedAppointmentLink.value = requested; chooseAppointment(requested) }
}, { immediate: true })

useShopRealtime('pos', () => lines.value.length > 0 || checkingOut.value || confirmingCheckout.value)

const posPaymentForm = computed<BsPointOfSalePaymentForm>({ get: () => ({ method: paymentMethod.value, reference: paymentReference.value, notes: notes.value }), set: value => { if (['cash','bank_transfer','card','wallet','cheque','other'].includes(value.method)) paymentMethod.value = value.method as PaymentMethod; paymentReference.value = value.reference; notes.value = value.notes } })
const posItemType = computed<string>({ get: () => itemType.value, set: value => { if (value === 'all' || value === 'product' || value === 'service') itemType.value = value } })
const posCatalogItems = computed<BsPointOfSaleCatalogItem[]>(() => catalog.value.items.map(item => ({ id: item.id, key: cartLineKey(item), name: item.name, quantity: lines.value.find(line => line.key === cartLineKey(item))?.quantity ?? 0, maximumQuantity: cartQuantityLimit(item), disabled: item.itemType === 'product' && item.stock != null && item.stock <= 0, imageUrl: item.imageUrl, description: item.sku || t(item.itemType === 'service' ? 'sales.service' : 'sales.product'), price: money(Math.max(0, item.unitPrice - item.discount)), stock: item.stock != null ? item.stockReserved && item.stockReserved !== '0' ? (locale.value === 'ar' ? `المتاح: ${item.stock} · المحجوز: ${item.stockReserved} · الموجود: ${item.stockOnHand}` : `Available: ${item.stock} · Reserved: ${item.stockReserved} · On hand: ${item.stockOnHand}`) : t('pos.stock', { count: item.stock }) : '' })))
function setPriceApproval(id: string, value: string, reason = false) {
 if (!pricePermission.value || !counter.online.value || checkingOut.value || confirmingCheckout.value) return
 lines.value = lines.value.map(line => line.key === id && line.itemType === 'product' ? { ...line, ...(reason ? { overrideReason: value } : { overridePrice: value }) } : line)
 invalidateRequests()
}
const posCartLines = computed<BsPointOfSaleCartLine[]>(() => lines.value.map((line, index) => ({ id: line.key, quantityLocked: !!line.measurementCapture, quantityNotice: line.measurementCapture?.kind === 'scale' ? (locale.value === 'ar' ? `وزن مؤكد: ${line.scaleSnapshot?.netQuantity} ${unitLabel(line.scaleSnapshot?.unitCode || '')}. احذف البند وأعد الوزن لتغيير الكمية.` : `Confirmed weight: ${line.scaleSnapshot?.netQuantity} ${unitLabel(line.scaleSnapshot?.unitCode || '')}. Remove the line and weigh again to change its quantity.`) : line.measurementCapture ? (locale.value === 'ar' ? 'وزن محفوظ من الملصق. احذف البند وأعد المسح لتغيير الوزن.' : 'Weight retained from the label. Remove the line and scan again to change it.') : undefined, pricing: line.itemType === 'product' ? tradePricePresentation(line, counter.online.value ? taxQuote.value?.lines[index]?.pricing?.source : undefined, pricePermission.value && counter.online.value, locale.value === 'ar', businessCurrency.value) : undefined, physical: physicalView(line), quantityStep: line.measurement ? cartQuantityStep(line) : 1, unitValue: selectedMeasurement(line), unitChoices: line.measurement ? [...line.measurement.saleUnits.map(unit => ({ value: `unit:${unit}`, label: unitLabel(unit) })), ...line.measurement.packages.filter(pack => pack.canSell).map(pack => ({ value: `package:${pack.id}`, label: `${pack.name} (${pack.baseQuantity} ${unitLabel(line.measurement!.baseUnitCode)})` }))] : undefined, baseEquivalent: baseEquivalent(line), imageUrl: line.imageUrl, name: line.name, quantity: line.quantity, maximumQuantity: cartQuantityLimit(line), total: money(counter.online.value ? taxQuote.value?.lines[index]?.total ?? (line.unitPrice - line.discount) * line.quantity : (line.unitPrice - line.discount) * line.quantity) })))
const posView = computed<BsPointOfSaleView>(() => ({ cartCount: locale.value === 'ar' ? `${lines.value.length} أصناف` : `${lines.value.length} ${lines.value.length === 1 ? 'item' : 'items'}`, available: !!current.value, loadingContext: shopLoading.value, location: transactionLocationName.value || currentLocation.value?.name || '—', staff: selectedStaff.value?.name || t('pos.selectStaff'), locationChanged: locationChanged.value, error: errorMessage.value || (offlinePhysicalError.value ? readableError(offlinePhysicalError.value) : '') || (taxError.value ? readableError(taxError.value.message) : ''), scanMessage: scanMessage.value, checkingOut: checkingOut.value, confirming: confirmingCheckout.value, shortcutBlocked: scaleOpen.value || posReceipt.visible.value || checkingOut.value || confirmingCheckout.value || !!confirmation.current.value, catalogLoading: catalogPending.value, catalogError: catalogError.value ? t(catalogError.value.message?.includes('SHOP_PERMISSION_DENIED') ? 'pos.permissionDenied' : 'pos.loadError') : '', catalogTotal: catalog.value.total, catalogPageSize: catalog.value.pageSize, contextLoading: contextPending.value, contextError: contextError.value ? t(contextError.value.message?.includes('SHOP_PERMISSION_DENIED') ? 'pos.permissionDenied' : 'pos.loadError') : '', appointmentLocked: !!appointmentId.value, customerDisabled: !counter.online.value || !!appointmentId.value || checkingOut.value || confirmingCheckout.value || locationChanged.value, customerBusy: customerBusy.value, customerDisplay: customerId.value ? [customerName.value, customerPhone.value].filter(Boolean).join(' · ') : (appointmentId.value ? customerName.value || t('pos.noCustomer') : t('pos.noCustomer')), customerEmpty: customerBusy.value ? t('pos.loading') : t('pos.customerSearch'), customerEmptyFilter: customerBusy.value ? t('pos.loading') : (customerSearch.value.trim().length < 2 ? t('pos.customerSearch') : t('pos.customerNoResults')), hasCustomer: !!customerId.value, checkoutDisabled: Boolean(offlinePhysicalError.value) || taxPending.value || Boolean(taxError.value) || counter.shiftClosing.value || checkingOut.value || confirmingCheckout.value || contextPending.value || !!contextError.value || locationChanged.value || !lines.value.length || !staffId.value, total: money(total.value), reviewLabel: t('pos.reviewSale', { count: lines.value.length }), payLabel: t('pos.pay', { amount: money(total.value) }) }))
function addPosItem(key: string) { const item = catalog.value.items.find(item => cartLineKey(item) === key); if (item) addItem(item) }
function removePosLine(id: string) { const index = lines.value.findIndex(line => line.key === id); if (index >= 0) removeLine(index) }
function setPosQuantity(id: string, value: number) { const line = lines.value.find(line => line.key === id); if (line) setQuantity(line, value) }
function unitLabel(code: string) { const unit = measurementUnits.find(unit => unit.code === code); return (locale.value === 'ar' ? unit?.nameAr : unit?.nameEn) || code }
function baseEquivalent(line: CartLine) {
  if (!line.measurement) return undefined
  try { return `${measuredBaseQuantity(line)} ${unitLabel(line.measurement.baseUnitCode)}` }
  catch { return locale.value === 'ar' ? 'الكمية غير صالحة للوحدة المختارة.' : 'The quantity is invalid for the selected unit.' }
}
function setPosUnit(id: string, value: string) {
  if (checkingOut.value || confirmingCheckout.value || locationChanged.value) return
  const line = lines.value.find(line => line.key === id)
  if (line?.measurementCapture || !line?.measurement || !value.startsWith('unit:') && !value.startsWith('package:')) return
  const next = { ...line, unitSelection: value }
  if (value.startsWith('unit:') ? !line.measurement.saleUnits.includes(value.slice(5)) : !line.measurement.packages.some(pack => pack.canSell && pack.id === value.slice(8))) return
  next.key = cartLineKey(next)
  if (lines.value.some(other => other !== line && other.key === next.key)) { errorMessage.value = locale.value === 'ar' ? 'هذه الوحدة موجودة بالفعل في السلة.' : 'This unit is already in the cart.'; return }
  next.overridePrice = undefined; next.overrideReason = undefined
  next.unitPrice = selectedUnitPrice(next)
  if (lines.value.some(other => other.sourceId === line.sourceId && other.measurementCapture)) {
    try { assertCapturedStock(lines.value.filter(other => other !== line), { id: line.sourceId }, measuredBaseQuantity(next), String(line.stock ?? 0)) }
    catch (cause) { errorMessage.value = readableError((cause as Error).message); return }
  }
  lines.value = lines.value.map(other => other === line ? next : other); invalidateRequests()
}
async function loadPhysical(id: string, query?: string, more = false) {
  const line = lines.value.find(line => line.key === id)
  if (!line?.measurement?.reelTracking || !currentId.value || !currentLocationId.value) return
  const product = line.sourceId; const previous = physicalPickers[product]
  if (more && previous?.pending) return
  const request = ++physicalRequest; const valid = captureScope()
  const nextPage = more ? (previous?.page ?? 1) + 1 : 1
  const search = query ?? previous?.query ?? ''
  physicalPickers[product] = { items: more ? previous?.items ?? [] : [], total: previous?.total ?? 0, page: nextPage, query: search, pending: true, error: null, request }
  try {
    let result: PosReelOptions | null
    if (!counter.online.value) result = await counter.cached<PosReelOptions>(`reels:${product}`)
    else {
      const response = await rpc.rpc('pos_reel_options', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_product_id: product, p_search: search || null, p_page: nextPage })
      if (response.error) throw new Error(response.error.message)
      result = response.data
    }
    if (!valid() || physicalPickers[product]?.request !== request) return
    if (!result) throw new Error('REEL_CACHE_UNAVAILABLE')
    physicalPickers[product]!.items = more ? [...physicalPickers[product]!.items, ...result.items] : result.items
    physicalPickers[product]!.total = result.total; physicalPickers[product]!.summary = result.summary
    if (counter.online.value && counter.ready.value && nextPage === 1 && !search) await counter.cache(`reels:${product}`, result)
    if (!valid() || physicalPickers[product]?.request !== request) return
    for (const cart of lines.value.filter(line => line.sourceId === product)) {
      if (result.summary.available != null) { cart.catalogStock = Number(result.summary.available); cart.stock = cart.catalogStock }
      cart.reelSummary = result.summary
      const selected = result.items.find(reel => reel.id === cart.reelId)
      if (selected) { cart.reelRemaining = selected.remainingLength; cart.reelStatus = selected.status; cart.reelPrice = selected.classification === 'discounted' ? selected.price : null; cart.unitPrice = selectedUnitPrice(cart) }
    }
    invalidateRequests()
    if (counter.online.value) await refreshPosQuote()
  } catch { if (valid() && physicalPickers[product]?.request === request) physicalPickers[product]!.error = locale.value === 'ar' ? 'تعذر تحميل البكرات. اتصل وأعد المحاولة.' : 'Could not load reels. Connect and retry.' }
  finally { if (valid() && physicalPickers[product]?.request === request) physicalPickers[product]!.pending = false }
}
function physicalView(line: CartLine) {
  if (!line.measurement?.reelTracking) return undefined
  const picker = physicalPickers[line.sourceId]
  const choices = (picker?.items ?? []).map(reel => ({ value: reel.id, label: `${reel.barcode} · ${reel.remainingLength} ${unitLabel(line.measurement!.baseUnitCode)}${reel.reservedLength && reel.reservedLength !== '0' ? (locale.value === 'ar' ? ` متاح · ${reel.reservedLength} محجوز` : ` available · ${reel.reservedLength} reserved`) : ''}${reel.storagePosition ? ' · ' + reel.storagePosition : ''}${reel.classification === 'discounted' ? ' · ' + money(Number(reel.price)) : ''}` }))
  if (line.reelId && !choices.some(choice => choice.value === line.reelId)) choices.unshift({ value: line.reelId, label: `${line.reelBarcode || line.reelId} · ${line.reelRemaining || '—'} ${unitLabel(line.measurement.baseUnitCode)}` })
  return { source: line.reelId ?? '', split: line.allowSplit ?? false, loss: line.cuttingLoss || '0', unit: unitLabel(line.measurement.baseUnitCode), choices: [{ value: '', label: locale.value === 'ar' ? 'اختيار تلقائي' : 'Automatic allocation' }, ...choices], loading: picker?.pending ?? false, error: picker?.error ?? null, hasMore: counter.online.value && (picker?.items.length ?? 0) < (picker?.total ?? 0), canSplit: !line.reelId && !selectedMeasurement(line).startsWith('package:') }
}
function physicalEditable() { return !checkingOut.value && !confirmingCheckout.value && !locationChanged.value }
function setPhysicalSource(id: string, value: string) {
 if (!physicalEditable()) return
 const line = lines.value.find(line => line.key === id); if (!line?.measurement?.reelTracking) return
 const reel = physicalPickers[line.sourceId]?.items.find(reel => reel.id === value)
 if (value && !reel) return
 const next = { ...line, reelId: value || undefined, reelBarcode: reel?.barcode, reelRemaining: reel?.remainingLength, reelStatus: reel?.status, reelPrice: reel?.classification === 'discounted' ? reel.price : null }
 next.key = cartLineKey(next)
 if (lines.value.some(other => other !== line && other.key === next.key)) { errorMessage.value = locale.value === 'ar' ? 'هذا المصدر والوحدة موجودان في السلة.' : 'This source and unit are already in the cart.'; return }
 next.unitPrice = selectedUnitPrice(next); lines.value = lines.value.map(other => other === line ? next : other); invalidateRequests()
}
function setPhysicalSplit(id: string, value: boolean) { if (!physicalEditable()) return; const line = lines.value.find(line => line.key === id); if (line?.measurement?.reelTracking && !line.reelId && !selectedMeasurement(line).startsWith('package:')) { line.allowSplit = value; invalidateRequests() } }
function setPhysicalLoss(id: string, value: string) { if (!physicalEditable()) return; const line = lines.value.find(line => line.key === id); if (line?.measurement?.reelTracking) { line.cuttingLoss = value; invalidateRequests() } }
watch([currentId,currentLocationId, () => actor.value?.id], () => { physicalRequest++; for (const key of Object.keys(physicalPickers)) Reflect.deleteProperty(physicalPickers,key) }, { flush: 'sync' })
function setPosStaff(id: string) { staffId.value = id; lockLocation(); invalidateRequests() }
function dismissPosFeedback() { errorMessage.value = ''; scanMessage.value = '' }
const posCopy = computed<BsPointOfSaleCopy>(() => ({
  physicalSource: locale.value === 'ar' ? 'البكرة المصدر' : 'Source reel', physicalSplit: locale.value === 'ar' ? 'السماح بقطع منفصلة عند الاختيار التلقائي' : 'Allow separate pieces with automatic allocation', physicalLoss: locale.value === 'ar' ? 'فاقد القطع' : 'Cutting loss', physicalLossHelp: locale.value === 'ar' ? 'يُخصم من المخزون ولا يُحمّل على العميل. البكرة الكاملة تتطلب فاقدًا صفريًا.' : 'Deducted from stock without charging the customer. Full reel packages require zero loss.', physicalMore: locale.value === 'ar' ? 'بكرات إضافية' : 'More reels',
  unit: locale.value === 'ar' ? 'وحدة البيع' : 'Sale unit',
  reviewStep: locale.value === 'ar' ? 'مراجعة الأصناف' : 'Review items', paymentStep: locale.value === 'ar' ? 'الدفع' : 'Payment', continueToPayment: locale.value === 'ar' ? 'متابعة للدفع' : 'Continue to payment', backToCart: locale.value === 'ar' ? 'العودة للأصناف' : 'Back to items', optionalDetails: locale.value === 'ar' ? 'تفاصيل اختيارية' : 'Optional details', add: locale.value === 'ar' ? 'إضافة' : 'Add',
  decrease: locale.value === 'ar' ? 'تقليل الكمية' : 'Decrease quantity', increase: locale.value === 'ar' ? 'زيادة الكمية' : 'Increase quantity',
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
const posCategoryOptions = computed(() => [{ value: '', label: locale.value === 'ar' ? 'كل التصنيفات' : 'All categories' }, ...(counter.online.value ? categories.value : []).map(category => ({ value: category.id, label: category.name }))])
const posAppointmentOptions = computed(() => [{ value: '', label: t('pos.walkIn') }, ...context.value.appointments.map(appointment => ({ value: appointment.id, label: appointmentLabel(appointment) }))])
const posStaffOptions = computed(() => context.value.staff.map(staff => ({ value: staff.id, label: staff.name })))
const posPaymentOptions = computed(() => ['cash','card','bank_transfer','wallet','cheque','other'].map(value => ({ value, label: t(`payments.methods.${value}`), icon: ({ cash: 'cash', card: 'card', bank_transfer: 'bank', wallet: 'wallet', cheque: 'invoice', other: 'transactions' } as Record<string, string>)[value] })))
</script>

<template>
  <BsPointOfSalePage
    ref="posPage"
    v-model:scale-visible="scaleOpen"
    v-model:receipt-visible="posReceipt.visible.value"
    v-model:catalog-search="catalogSearch"
    v-model:category-filter="categoryFilter"
    v-model:item-type="posItemType"
    v-model:catalog-page="catalogPage"
    v-model:payment-form="posPaymentForm"
    :scale="scaleView"
    :scale-copy="scaleCopy"
    :scale-form="scaleForm"
    :receipt-preview="posReceipt.view.value"
    :offers="offerCards"
    :offers-title="locale === 'ar' ? 'العروض والباقات' : 'Promos & offers'"
    :offer-select-label="locale === 'ar' ? 'إضافة الباقة' : 'Add bundle'"
    :offers-error="offerQuery.error.value ? (locale === 'ar' ? 'تعذر تحميل العروض. أعد المحاولة.' : 'Could not load offers. Retry.') : ''"
    :offer-summary="appliedOffers.map(o => `${o.name} × ${o.quantity} (−${money(o.saving)})`).join(' · ')"
    :offline="offlineView"
    variant="shop"
    :copy="posCopy"
    :view="posView"
    :catalog-items="posCatalogItems"
    :cart-lines="posCartLines"
    :customer-options="customerOptions"
    :staff-id="staffId"
    :appointment-id="appointmentId"
    :customer-id="customerId"
    :item-type-options="posTypeOptions"
    :category-options="posCategoryOptions"
    :appointment-options="posAppointmentOptions"
    :staff-options="posStaffOptions"
    :payment-options="posPaymentOptions"
    @open-receipt="posReceipt.open"
    @select-receipt="posReceipt.select"
    @receipt-language="posReceipt.setLanguage"
    @receipt-paper="posReceipt.setPaper"
    @retry-receipt="posReceipt.refresh"
    @share-receipt="posReceipt.share"
    @download-receipt="posReceipt.download"
    @printed-receipt="posReceipt.printed"
    @scale-open="openScale"
    @scale-profile="scaleProfile"
    @scale-product="scaleProduct"
    @scale-search="scaleSearch"
    @scale-more="scaleMore"
    @scale-retry="scaleRetry"
    @scale-connect="scaleConnect"
    @scale-disconnect="scaleDisconnect"
    @scale-read="scaleRead"
    @scale-tare="scaleTare"
    @scale-submit="scaleSubmit"
    @select-offer="selectOffer"
    @retry-offers="offerQuery.refresh()"
    @retry-offline="counter.retry($event)"
    @reconcile-offline="counter.reconcile($event)"
    @reset="requestReset"
    @price-override="(id, value) => setPriceApproval(id, value)" @price-reason="(id, value) => setPriceApproval(id, value, true)"
    @checkout="checkout"
    @retry-catalog="refreshCatalog"
    @retry-context="refreshContext"
    @add="addPosItem"
    @remove="removePosLine"
    @quantity="setPosQuantity"
    @unit="setPosUnit"
    @physical-source="setPhysicalSource"
    @physical-split="setPhysicalSplit"
    @physical-loss="setPhysicalLoss"
    @physical-search="(id, query) => loadPhysical(id, query)"
    @physical-more="id => loadPhysical(id, undefined, true)"
    @physical-retry="id => loadPhysical(id)"
    @appointment="chooseAppointment"
    @staff="setPosStaff"
    @customer-search="customerSearch = $event"
    @reset-customer-search="resetCustomerSearch"
    @customer="setCustomer"
    @clear-customer="clearCustomer"
    @dismiss-feedback="dismissPosFeedback"
    @barcode="scanBarcode"
  />
</template>
