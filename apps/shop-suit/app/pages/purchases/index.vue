<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type Vendor = {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  notes: string | null
  is_active: boolean
  payable: number
}
type Product = { id: string; name: string; sku: string | null }
type Purchase = {
  id: string
  vendorId: string | null
  vendorNameSnapshot: string
  invoiceNumber: string | null
  status: 'draft' | 'posted' | 'void'
  issuedAt: string | null
  totalAmount: number
  payable: number
  settlementState: 'unpaid' | 'partial' | 'paid'
  notes: string | null
  createdAt: string
}
type PurchaseLine = { key: number; productId: string; quantity: number; unitCost: number }
type VendorPage = { items: Vendor[]; total: number }
type PurchasePage = { items: Purchase[]; total: number; page: number; pageSize: number }

const confirmation = useConfirmation()
const captureScope = useShopTaskScope()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, loading: shopLoading } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const search = ref('')
const vendorFilter = ref('')
const statusFilter = ref<'posted' | 'void' | ''>('')
const settlementFilter = ref<'unpaid' | 'partial' | 'paid' | ''>('')
const fromFilter = ref('')
const toFilter = ref('')
const page = ref(1)
const pageSize = 20
const supplierSearch = ref('')
const supplierPage = ref(1)
const chosenVendors = ref<Array<{ id: string; name: string }>>([])
const chosenProducts = ref<Array<{ id: string; name: string }>>([])
const showArchivedSuppliers = ref(false)
const editingVendorId = ref<string | null>(null)
const archivingVendorId = ref<string | null>(null)
const actionError = ref('')
const successMessage = ref('')
const voidingId = ref<string | null>(null)
const requestId = ref<string | null>(null)
let lineKey = 0

function localToday() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-')
}

function newLine(): PurchaseLine {
  return { key: ++lineKey, productId: '', quantity: 1, unitCost: 0 }
}

const supplierForm = reactive({
  name: '', contactName: '', phone: '', email: '', address: '', taxNumber: '', notes: '',
})
const purchaseForm = reactive({
  vendorId: '', invoiceNumber: '', issuedOn: localToday(), notes: '', lines: [newLine()],
})
const {
  visible: supplierOpen,
  pending: supplierSaving,
  dirty: supplierDirty,
} = useRecordAction(() => supplierForm)
const {
  visible: purchaseOpen,
  pending: purchaseSaving,
  dirty: purchaseDirty,
} = useRecordAction(() => ({
  vendorId: purchaseForm.vendorId,
  invoiceNumber: purchaseForm.invoiceNumber,
  issuedOn: purchaseForm.issuedOn,
  notes: purchaseForm.notes,
  lines: purchaseForm.lines.map(line => ({ ...line })),
}))

const copy = computed(() => isArabic.value ? {
  title: 'المشتريات', subtitle: 'سجّل مشتريات الموردين وزِد المخزون بدُفعات FIFO محفوظة.',
  scope: 'إدارة الموردين والمشتريات والمدفوعات والأرصدة والمرتجعات مع ربط كامل بالمخزون.',
  addSupplier: 'إضافة مورد', newPurchase: 'تسجيل مشتريات', supplier: 'المورد', supplierName: 'اسم المورد',
  contactName: 'اسم جهة الاتصال', phone: 'الهاتف', email: 'البريد الإلكتروني', address: 'العنوان',
  taxNumber: 'الرقم الضريبي', notes: 'ملاحظات', saveSupplier: 'حفظ المورد', savePurchase: 'ترحيل المشتريات',
  saving: 'جاري الحفظ...', cancel: 'تراجع', invoiceNumber: 'رقم فاتورة المورد', optional: 'اختياري',
  date: 'تاريخ الشراء', product: 'المنتج', quantity: 'الكمية', unitCost: 'تكلفة الوحدة', lineTotal: 'إجمالي البند',
  addLine: 'إضافة بند', removeLine: 'حذف البند', total: 'الإجمالي', status: 'الحالة', posted: 'مرحّل', voided: 'ملغى',
  void: 'إلغاء', actions: 'إجراءات', recent: 'سجل المشتريات', search: 'ابحث في المشتريات',
  empty: 'لا توجد مشتريات بعد.', noResults: 'لا توجد نتائج مطابقة.', loading: 'جاري التحميل...',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم',
  noProducts: 'أضف منتجًا أولًا قبل تسجيل المشتريات.', products: 'المنتجات',
  noSuppliers: 'أضف موردًا قبل تسجيل المشتريات.', planUnavailable: 'مشتريات المخزون تتطلب اشتراكًا نشطًا يتيح إدارة المخزون.',
  permissionDenied: 'ليست لديك صلاحية إدارة مشتريات هذا المتجر.', readError: 'تعذّر تحميل بيانات المشتريات.', retry: 'إعادة المحاولة',
  invalidSupplier: 'اكتب اسم مورد صحيحًا وراجع بيانات الاتصال.', invalidPurchase: 'اختر موردًا وأضف بنودًا صحيحة بمنتجات غير مكررة.',
  writeError: 'تعذّر حفظ المشتريات.', access: 'انتهت التجربة أو ليست لديك صلاحية التعديل.', closed: 'الفترة المحاسبية مغلقة.',
  conflict: 'تعارض هذا الطلب مع محاولة سابقة. غيّر البيانات وحاول مرة أخرى.',
  crossReference: 'المورد أو أحد المنتجات غير متاح لهذا المتجر.', stockUsed: 'لا يمكن إلغاء المشتريات بعد استخدام جزء من مخزونها.',
  immutable: 'المشتريات المرحلة غير قابلة للتعديل.', supplierSaved: 'تم حفظ المورد.', purchaseSaved: 'تم ترحيل المشتريات وزيادة المخزون.',
  purchaseConfirm: 'ترحيل هذه المشتريات؟ ستزيد كميات المخزون ورصيد المورد المستحق بالقيمة المعروضة.', archived: 'مؤرشف', purchaseVoided: 'تم إلغاء المشتريات وتسجيل عكس المخزون.', voidConfirm: 'إلغاء هذه المشتريات وعكس مخزونها؟ لا يمكن ذلك إذا استُخدم جزء من الكمية.',
  suppliers: 'الموردون', supplierSearch: 'ابحث عن مورد', showArchived: 'عرض المؤرشفين', edit: 'تعديل', archive: 'أرشفة', archiveConfirm: 'أرشفة هذا المورد؟ ستظل هويته التاريخية محفوظة في المشتريات.', supplierUpdated: 'تم تحديث المورد.', supplierArchived: 'تمت أرشفة المورد.',
  settlement: 'السداد', unpaid: 'غير مدفوع', partial: 'جزئي', paid: 'مدفوع', all: 'الكل', from: 'من', to: 'إلى', previous: 'السابق', next: 'التالي', details: 'التفاصيل', payable: 'المتبقي', contact: 'الاتصال',
} : {
  title: 'Purchases', subtitle: 'Post supplier purchases into preserved FIFO inventory batches.',
  scope: 'Manage suppliers, purchases, payments, credits, and returns with complete inventory drill-through.',
  addSupplier: 'Add supplier', newPurchase: 'Record purchase', supplier: 'Supplier', supplierName: 'Supplier name',
  contactName: 'Contact name', phone: 'Phone', email: 'Email', address: 'Address',
  taxNumber: 'Tax number', notes: 'Notes', saveSupplier: 'Save supplier', savePurchase: 'Post purchase',
  saving: 'Saving...', cancel: 'Cancel', invoiceNumber: 'Supplier invoice number', optional: 'Optional',
  date: 'Purchase date', product: 'Product', quantity: 'Quantity', unitCost: 'Unit cost', lineTotal: 'Line total',
  addLine: 'Add line', removeLine: 'Remove line', total: 'Total', status: 'Status', posted: 'Posted', voided: 'Void',
  void: 'Void', actions: 'Actions', recent: 'Purchase history', search: 'Search purchases',
  empty: 'No purchases yet.', noResults: 'No matching purchases.', loading: 'Loading...',
  noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  noProducts: 'Add a product before recording a purchase.', products: 'Products',
  noSuppliers: 'Add a supplier before recording a purchase.', planUnavailable: 'Inventory purchases require an active subscription with inventory access.',
  permissionDenied: 'You do not have permission to manage purchases for this shop.', readError: 'Could not load purchase data.', retry: 'Retry',
  invalidSupplier: 'Enter a valid supplier name and review the contact details.', invalidPurchase: 'Choose a supplier and add valid, non-duplicated product lines.',
  writeError: 'Could not save the purchase.', access: 'Your trial has ended or you cannot manage purchases.', closed: 'The accounting period is closed.',
  conflict: 'This request conflicts with an earlier attempt. Change the data and retry.',
  crossReference: 'The supplier or one of the products is unavailable for this shop.', stockUsed: 'This purchase cannot be voided after some of its stock has been used.',
  immutable: 'Posted purchases cannot be edited.', supplierSaved: 'Supplier saved.', purchaseSaved: 'Purchase posted and inventory increased.',
  purchaseConfirm: 'Post this purchase? Stock quantities and supplier payable will increase by the amounts shown.', archived: 'Archived', purchaseVoided: 'Purchase voided and inventory reversal recorded.', voidConfirm: 'Void this purchase and reverse its stock? This is unavailable after any acquired stock is used.',
  suppliers: 'Suppliers', supplierSearch: 'Search suppliers', showArchived: 'Show archived', edit: 'Edit', archive: 'Archive', archiveConfirm: 'Archive this supplier? Historical identity remains preserved on purchases.', supplierUpdated: 'Supplier updated.', supplierArchived: 'Supplier archived.',
  settlement: 'Settlement', unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', all: 'All', from: 'From', to: 'To', previous: 'Previous', next: 'Next', details: 'Details', payable: 'Payable', contact: 'Contact',
})

const { data: access } = useAsyncData(
  () => `shop-data:supplier-access:${currentId.value ?? 'none'}`, async () => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('supplier_access', { p_shop_id: currentId.value })
    if (error) throw error
    return data?.[0] ?? null
  }, { watch: [currentId], default: () => null },
)
const canManageSuppliers = computed(() => access.value?.can_manage_suppliers === true)
const canManagePurchases = computed(() => access.value?.can_manage_purchases === true)

const { data: purchaseData, pending, error, refresh } = useAsyncData(
  () => `shop-data:purchases:${currentId.value ?? 'none'}:${search.value}:${vendorFilter.value}:${statusFilter.value}:${settlementFilter.value}:${fromFilter.value}:${toFilter.value}:${page.value}:${supplierSearch.value}:${showArchivedSuppliers.value}:${supplierPage.value}`, async () => {
    if (!currentId.value) return {
      vendors: [] as Vendor[], activeVendors: [] as Vendor[], products: [] as Product[], purchases: [] as Purchase[], total: 0, vendorTotal: 0,
    }
    const [vendorResult, activeVendorResult, productResult, purchaseResult] = await Promise.all([
      shopRpc.rpc('list_vendors', { p_shop_id: currentId.value, p_search: supplierSearch.value.trim() || null, p_is_active: showArchivedSuppliers.value ? null : true, p_page: supplierPage.value, p_page_size: pageSize }),
      shopRpc.rpc('list_vendors', { p_shop_id: currentId.value, p_search: null, p_is_active: true, p_page: 1, p_page_size: pageSize }),
      shopRpc.rpc('list_products', { p_shop_id: currentId.value, p_search: null, p_category_id: null, p_page: 1, p_page_size: pageSize }),
      shopRpc.rpc('list_purchases', { p_shop_id: currentId.value, p_search: search.value.trim() || null,
        p_vendor_id: vendorFilter.value || null, p_status: statusFilter.value || null,
        p_settlement: settlementFilter.value || null, p_from: fromFilter.value || null,
        p_to: toFilter.value || null, p_page: page.value, p_page_size: pageSize }),
    ])
    if (vendorResult.error) throw vendorResult.error
    if (activeVendorResult.error) throw activeVendorResult.error
    // Read-only supplier access need not include product-catalog permission.
    if (productResult.error && productResult.error.code !== '42501') throw productResult.error
    if (purchaseResult.error) throw purchaseResult.error
    const vendorPage = vendorResult.data as VendorPage
    const activeVendorPage = activeVendorResult.data as VendorPage
    const purchasePage = purchaseResult.data as PurchasePage
    return {
      vendors: vendorPage.items,
      vendorTotal: vendorPage.total,
      activeVendors: activeVendorPage.items,
      products: productResult.error ? [] : (productResult.data as { items: Product[] }).items,
      purchases: purchasePage.items,
      total: purchasePage.total,
    }
  }, {
    watch: [currentId, search, vendorFilter, statusFilter, settlementFilter, fromFilter, toFilter, page, supplierSearch, showArchivedSuppliers, supplierPage],
    default: () => ({ vendors: [] as Vendor[], activeVendors: [] as Vendor[], products: [] as Product[], purchases: [] as Purchase[], total: 0, vendorTotal: 0 }),
  },
)

const vendors = computed(() => purchaseData.value?.vendors ?? [])
const activeVendors = computed(() => [...(purchaseData.value?.activeVendors ?? []), ...chosenVendors.value])
const products = computed(() => [...(purchaseData.value?.products ?? []), ...chosenProducts.value])
const purchases = computed(() => purchaseData.value?.purchases ?? [])
const totalPurchases = computed(() => purchaseData.value?.total ?? 0)
const pages = computed(() => Math.max(1, Math.ceil(totalPurchases.value / pageSize)))
const formTotal = computed(() => purchaseForm.lines.reduce((total, line) =>
  total + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0))

watch(currentId, () => {
  supplierOpen.value = false
  purchaseOpen.value = false
  actionError.value = ''
  successMessage.value = ''
  requestId.value = null
})
watch([supplierSearch, showArchivedSuppliers], () => { supplierPage.value = 1 })
watch([search, vendorFilter, statusFilter, settlementFilter, fromFilter, toFilter], () => { page.value = 1 })
watch(() => purchaseForm, () => {
  requestId.value = null
  actionError.value = ''
}, { deep: true })

function money(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency: 'EGP', maximumFractionDigits: 2,
  }).format(value)
}

function displayDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Africa/Cairo',
  }).format(new Date(value))
}

function statusLabel(status: Purchase['status']) {
  return status === 'void' ? copy.value.voided : copy.value.posted
}
function settlementLabel(status: Purchase['settlementState']) {
  return copy.value[status]
}

function readableError(message?: string) {
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message === 'PURCHASES_NOT_IN_PLAN') return copy.value.planUnavailable
  if (message === 'ACCOUNTING_PERIOD_CLOSED') return copy.value.closed
  if (message === 'PURCHASE_REQUEST_CONFLICT') return copy.value.conflict
  if (message === 'VENDOR_NOT_FOUND' || message === 'PRODUCT_NOT_FOUND') return copy.value.crossReference
  if (message === 'PURCHASE_STOCK_ALREADY_USED') return copy.value.stockUsed
  if (message === 'POSTED_PURCHASE_IMMUTABLE') return copy.value.immutable
  if (message === 'INVALID_VENDOR') return copy.value.invalidSupplier
  if (message === 'INVALID_PURCHASE') return copy.value.invalidPurchase
  return message || copy.value.writeError
}

function resetSupplier() {
  supplierForm.name = ''
  supplierForm.contactName = ''
  supplierForm.phone = ''
  supplierForm.email = ''
  supplierForm.address = ''
  supplierForm.taxNumber = ''
  supplierForm.notes = ''
  actionError.value = ''
}

function resetPurchase() {
  purchaseForm.vendorId = activeVendors.value[0]?.id ?? ''
  purchaseForm.invoiceNumber = ''
  purchaseForm.issuedOn = localToday()
  purchaseForm.notes = ''
  purchaseForm.lines = [newLine()]
  purchaseForm.lines[0]!.productId = products.value[0]?.id ?? ''
  requestId.value = null
  actionError.value = ''
}

function openSupplierForm(vendor?: Vendor) {
  resetSupplier()
  editingVendorId.value = vendor?.id ?? null
  if (vendor) Object.assign(supplierForm, { name: vendor.name, contactName: vendor.contact_name ?? '', phone: vendor.phone ?? '', email: vendor.email ?? '', address: vendor.address ?? '', taxNumber: vendor.tax_number ?? '', notes: vendor.notes ?? '' })
  successMessage.value = ''
  supplierOpen.value = true
}

function openPurchaseForm() {
  resetPurchase()
  successMessage.value = ''
  purchaseOpen.value = true
}

function addLine() {
  const used = new Set(purchaseForm.lines.map(line => line.productId))
  const line = newLine()
  line.productId = products.value.find(product => !used.has(product.id))?.id ?? ''
  purchaseForm.lines.push(line)
}

function removeLine(key: number) {
  if (purchaseForm.lines.length === 1) return
  purchaseForm.lines = purchaseForm.lines.filter(line => line.key !== key)
}

async function saveSupplier() {
  if (!currentId.value || !canManageSuppliers.value || supplierSaving.value) return
  actionError.value = ''
  successMessage.value = ''
  const name = supplierForm.name.trim()
  const email = supplierForm.email.trim()
  if (name.length < 2 || name.length > 160
    || supplierForm.contactName.trim().length > 160
    || supplierForm.phone.trim().length > 40
    || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+$/.test(email))
    || supplierForm.address.trim().length > 500
    || supplierForm.taxNumber.trim().length > 80
    || supplierForm.notes.trim().length > 1000) {
    actionError.value = copy.value.invalidSupplier
    return
  }
  supplierSaving.value = true
  try {
    const { data, error: saveError } = await shopRpc.rpc('save_vendor', {
      p_shop_id: currentId.value,
      p_vendor_id: editingVendorId.value,
      p_name: name,
      p_contact_name: supplierForm.contactName.trim() || null,
      p_phone: supplierForm.phone.trim() || null,
      p_email: email || null,
      p_address: supplierForm.address.trim() || null,
      p_tax_number: supplierForm.taxNumber.trim() || null,
      p_notes: supplierForm.notes.trim() || null,
    })
    if (saveError) throw saveError
    supplierOpen.value = false
    supplierSearch.value = name
    supplierPage.value = 1
    chosenVendors.value.push({ id: data, name })
    await refresh()
    purchaseForm.vendorId = data
    successMessage.value = editingVendorId.value ? copy.value.supplierUpdated : copy.value.supplierSaved
    editingVendorId.value = null
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    supplierSaving.value = false
  }
}

async function savePurchase() {
  if (!currentId.value || !canManagePurchases.value || purchaseSaving.value) return
  actionError.value = ''
  successMessage.value = ''
  const productIds = purchaseForm.lines.map(line => line.productId)
  const linesValid = purchaseForm.lines.length > 0 && purchaseForm.lines.length <= 100
    && new Set(productIds).size === productIds.length
    && purchaseForm.lines.every(line => {
      const quantity = Number(line.quantity)
      const unitCost = Number(line.unitCost)
      return products.value.some(product => product.id === line.productId)
        && Number.isFinite(quantity) && quantity > 0 && quantity <= 1000000
        && Math.abs(Math.round(quantity * 1000) - quantity * 1000) < 0.000001
        && Number.isFinite(unitCost) && unitCost >= 0 && unitCost <= 999999999.99
        && Math.abs(Math.round(unitCost * 100) - unitCost * 100) < 0.000001
    })
  if (!activeVendors.value.some(vendor => vendor.id === purchaseForm.vendorId)
    || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseForm.issuedOn)
    || purchaseForm.invoiceNumber.trim().length > 120
    || purchaseForm.notes.trim().length > 1000 || !linesValid) {
    actionError.value = copy.value.invalidPurchase
    return
  }
  const inScope = captureScope()
  purchaseSaving.value = true
  try {
    if (!await confirmation.ask(`${copy.value.purchaseConfirm} ${copy.value.total}: ${money(formTotal.value)}`) || !inScope()) return
    requestId.value ||= crypto.randomUUID()
    const { error: saveError } = await shopRpc.rpc('create_supplier_purchase', {
      p_request_id: requestId.value,
      p_shop_id: currentId.value,
      p_vendor_id: purchaseForm.vendorId,
      p_invoice_number: purchaseForm.invoiceNumber.trim() || null,
      p_issued_on: purchaseForm.issuedOn,
      p_notes: purchaseForm.notes.trim() || null,
      p_items: purchaseForm.lines.map(line => ({
        product_id: line.productId,
        quantity: Number(line.quantity),
        unit_cost: Number(line.unitCost),
      })),
    })
    if (!inScope()) return
    if (saveError) throw saveError
    requestId.value = null
    purchaseOpen.value = false
    page.value = 1
    await refresh()
    if (inScope()) successMessage.value = copy.value.purchaseSaved
  } catch (error) {
    if (inScope()) actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    purchaseSaving.value = false
  }
}

async function voidPurchase(purchase: Purchase) {
  if (!currentId.value || !canManagePurchases.value || voidingId.value) return
  if (!await confirmation.ask(copy.value.voidConfirm)) return
  actionError.value = ''
  successMessage.value = ''
  voidingId.value = purchase.id
  try {
    const { error: voidError } = await shopRpc.rpc('void_supplier_purchase', {
      p_shop_id: currentId.value, p_purchase_id: purchase.id,
    })
    if (voidError) throw voidError
    await refresh()
    successMessage.value = copy.value.purchaseVoided
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    voidingId.value = null
  }
}

async function archiveVendor(vendor: Vendor) {
  if (!currentId.value || !canManageSuppliers.value || archivingVendorId.value || !await confirmation.ask(copy.value.archiveConfirm)) return
  archivingVendorId.value = vendor.id
  actionError.value = ''
  try {
    const { error } = await shopRpc.rpc('archive_vendor', { p_shop_id: currentId.value, p_vendor_id: vendor.id })
    if (error) throw error
    await refresh()
    successMessage.value = copy.value.supplierArchived
  } catch (error) { actionError.value = readableError(error instanceof Error ? error.message : undefined) }
  finally { archivingVendorId.value = null }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <div v-if="current" class="flex flex-wrap gap-2"><BsButton v-if="canManageSuppliers" type="button" class="ls-btn" @click="openSupplierForm()">{{ copy.addSupplier }}</BsButton><BsButton v-if="canManagePurchases" type="button" class="ls-btn ls-btn-primary" :disabled="!activeVendors.length || !products.length" @click="openPurchaseForm">{{ copy.newPurchase }}</BsButton></div>
    </header>

    <div v-if="!current && !shopLoading" class="ls-card p-8 text-center text-sm"><p>{{ copy.noShop }}</p><NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.dashboard }}</NuxtLink></div>
    <template v-else-if="current">
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm dark:bg-[var(--bs-status-info-bg)]">{{ copy.scope }}</p>
      <p v-if="successMessage" role="status" class="rounded-xl bg-[var(--bs-status-success-bg)] p-4 text-sm text-[var(--bs-status-success)]">{{ successMessage }}</p>
      <p v-if="actionError && !supplierOpen && !purchaseOpen" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-4 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>
      <div v-if="!products.length && !pending" class="ls-card-flat p-5 text-sm"><p>{{ copy.noProducts }}</p><NuxtLink to="/products" class="mt-2 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.products }}</NuxtLink></div>
      <p v-if="!activeVendors.length && !pending" class="ls-card-flat p-5 text-sm">{{ copy.noSuppliers }}</p>

      <section class="ls-card p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 class="font-extrabold">{{ copy.suppliers }}</h2><div class="flex flex-wrap items-center gap-3"><input v-model="supplierSearch" :aria-label="copy.supplierSearch" type="search" :placeholder="copy.supplierSearch" class="ls-input max-w-xs"><label class="flex min-h-11 items-center gap-2 text-sm font-semibold"><input v-model="showArchivedSuppliers" type="checkbox">{{ copy.showArchived }}</label></div></div>
        <div class="overflow-x-auto"><BsDataTable :value="vendors" :label="copy.suppliers" lazy paginator :rows="pageSize" :first="(supplierPage - 1) * pageSize" :total-records="purchaseData.vendorTotal" :always-show-paginator="false" data-key="id" :loading="pending" :row-class="() => 'border-t border-border'" @page="supplierPage = $event.page + 1"><Column header-class="px-3 py-3 text-start" body-class="px-3 py-3 font-bold"><template #header>{{ copy.supplier }}</template><template #body="{ data: vendor }">{{ vendor.name }}<span v-if="!vendor.is_active" class="ms-2 text-xs text-muted-foreground">({{ copy.archived }})</span></template></Column><Column header-class="px-3 py-3 text-start" body-class="px-3 py-3"><template #header>{{ copy.contact }}</template><template #body="{ data: vendor }"><p>{{ vendor.contact_name || '—' }}</p><p class="text-xs text-muted-foreground">{{ vendor.phone || vendor.email || '—' }}</p></template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end font-bold"><template #header>{{ copy.payable }}</template><template #body="{ data: vendor }">{{ money(Number(vendor.payable)) }}</template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end"><template #header>{{ copy.actions }}</template><template #body="{ data: vendor }"><span v-if="canManageSuppliers && vendor.is_active" class="inline-flex gap-3"><BsButton variant="link" class="text-[var(--bs-link)]" @click="openSupplierForm(vendor)">{{ copy.edit }}</BsButton><BsButton variant="text" class="text-[var(--bs-status-error)]" :disabled="archivingVendorId === vendor.id" @click="archiveVendor(vendor)">{{ copy.archive }}</BsButton></span></template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noSuppliers }}</p></template></BsDataTable></div>
      </section>

      <BsRecordActionDialog v-model:visible="supplierOpen" :title="editingVendorId ? copy.edit : copy.addSupplier" :dirty="supplierDirty" :pending="supplierSaving" :error="actionError" :submit-label="copy.saveSupplier" :cancel-label="copy.cancel" @submit="saveSupplier">
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.supplierName }}<input v-model="supplierForm.name" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.contactName }}<input v-model="supplierForm.contactName" type="text" maxlength="160" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.phone }}<input v-model="supplierForm.phone" type="tel" maxlength="40" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.email }}<input v-model="supplierForm.email" type="email" maxlength="254" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.taxNumber }}<input v-model="supplierForm.taxNumber" type="text" maxlength="80" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.address }}<textarea v-model="supplierForm.address" rows="2" maxlength="500" class="ls-input" /></label>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.notes }}<textarea v-model="supplierForm.notes" rows="2" maxlength="1000" class="ls-input" /></label>
      </BsRecordActionDialog>

      <BsRecordActionDialog v-model:visible="purchaseOpen" :title="copy.newPurchase" :dirty="purchaseDirty" :pending="purchaseSaving" :error="actionError" :submit-label="copy.savePurchase" :cancel-label="copy.cancel" size="lg" @submit="savePurchase">
        <div class="grid gap-4 sm:grid-cols-2">
          <PurchaseEntityPicker v-model="purchaseForm.vendorId" kind="supplier" :label="copy.supplier" :selected="activeVendors.find(item => item.id === purchaseForm.vendorId)" @selected="chosenVendors.push($event)" />
          <label class="space-y-2 text-sm font-bold">{{ copy.date }}<input v-model="purchaseForm.issuedOn" type="date" required class="ls-input"></label>
          <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.invoiceNumber }} ({{ copy.optional }})<input v-model="purchaseForm.invoiceNumber" type="text" maxlength="120" class="ls-input"></label>
        </div>
        <fieldset class="space-y-3"><legend class="text-sm font-extrabold">{{ copy.product }}</legend>
          <div v-for="(line, index) in purchaseForm.lines" :key="line.key" class="grid gap-3 rounded-xl border border-border p-3 lg:grid-cols-[minmax(0,1fr)_8rem_9rem_auto]">
            <PurchaseEntityPicker v-model="line.productId" kind="product" :label="`${copy.product} ${index + 1}`" :selected="products.find(item => item.id === line.productId)" @selected="chosenProducts.push($event)" />
            <label class="space-y-2 text-sm font-bold">{{ copy.quantity }}<input v-model.number="line.quantity" type="number" min="0.001" max="1000000" step="0.001" required class="ls-input"></label>
            <label class="space-y-2 text-sm font-bold">{{ copy.unitCost }}<input v-model.number="line.unitCost" type="number" min="0" max="999999999.99" step="0.01" required class="ls-input"></label>
            <div class="flex items-end"><BsButton type="button" class="ls-btn" :disabled="purchaseForm.lines.length === 1" :aria-label="`${copy.removeLine} ${index + 1}`" @click="removeLine(line.key)">×</BsButton></div>
          </div>
          <BsButton v-if="purchaseForm.lines.length < 100" type="button" class="ls-btn" @click="addLine">{{ copy.addLine }}</BsButton>
        </fieldset>
        <label class="block space-y-2 text-sm font-bold">{{ copy.notes }}<textarea v-model="purchaseForm.notes" rows="2" maxlength="1000" class="ls-input" /></label>
        <p class="border-t border-border pt-4 text-lg font-extrabold">{{ copy.total }}: {{ money(formTotal) }}</p>
      </BsRecordActionDialog>

      <section class="ls-card p-5">
        <div class="mb-4 space-y-3"><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-extrabold">{{ copy.recent }}</h2><input v-model="search" :aria-label="copy.search" type="search" :placeholder="copy.search" class="ls-input max-w-sm"></div><div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><PurchaseEntityPicker v-model="vendorFilter" kind="supplier" :label="copy.supplier" :selected="activeVendors.find(item => item.id === vendorFilter)" clearable @selected="chosenVendors.push($event)" /><select v-model="statusFilter" :aria-label="copy.status" class="ls-input"><option value="">{{ copy.all }} — {{ copy.status }}</option><option value="posted">{{ copy.posted }}</option><option value="void">{{ copy.voided }}</option></select><select v-model="settlementFilter" :aria-label="copy.settlement" class="ls-input"><option value="">{{ copy.all }} — {{ copy.settlement }}</option><option value="unpaid">{{ copy.unpaid }}</option><option value="partial">{{ copy.partial }}</option><option value="paid">{{ copy.paid }}</option></select><label class="text-xs font-bold">{{ copy.from }}<input v-model="fromFilter" type="date" class="ls-input mt-1"></label><label class="text-xs font-bold">{{ copy.to }}<input v-model="toFilter" type="date" class="ls-input mt-1"></label></div></div>
        <p v-if="pending" role="status" class="text-sm text-muted-foreground">{{ copy.loading }}</p>
        <div v-else-if="error" role="alert" class="text-sm"><p>{{ copy.readError }}</p><BsButton class="mt-2" @click="refresh()">{{ copy.retry }}</BsButton></div>
        <p v-else-if="!purchases.length" class="py-8 text-center text-sm text-muted-foreground">{{ totalPurchases ? copy.noResults : copy.empty }}</p>
        <div v-else class="overflow-x-auto"><BsDataTable :value="purchases" :label="copy.recent" data-key="id" :row-class="() => 'border-b border-border last:border-0'">
  <Column header-class="py-3 text-start" body-class="py-3"><template #header>{{ copy.date }}</template><template #body="{ data: purchase }">{{ displayDate(purchase.issuedAt) }}</template></Column>
  <Column header-class="py-3 text-start" body-class="py-3 font-semibold"><template #header>{{ copy.supplier }}</template><template #body="{ data: purchase }"><NuxtLink :to="`/purchases/${purchase.id}`" class="inline-flex min-h-11 min-w-11 items-center text-[var(--bs-link)] hover:underline">{{ purchase.vendorNameSnapshot }}</NuxtLink><p v-if="purchase.invoiceNumber" class="text-xs font-normal text-muted-foreground">{{ purchase.invoiceNumber }}</p></template></Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end font-bold"><template #header>{{ copy.total }}</template><template #body="{ data: purchase }">{{ money(Number(purchase.totalAmount)) }}</template></Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end font-bold"><template #header>{{ copy.payable }}</template><template #body="{ data: purchase }">{{ money(Number(purchase.payable)) }}<p class="text-xs font-normal text-muted-foreground">{{ settlementLabel(purchase.settlementState) }}</p></template></Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end"><template #header>{{ copy.status }}</template><template #body="{ data: purchase }">{{ statusLabel(purchase.status) }}</template></Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end"><template #header>{{ copy.actions }}</template><template #body="{ data: purchase }"><span class="inline-flex gap-3"><NuxtLink :to="`/purchases/${purchase.id}`" class="ls-btn ls-btn-sm text-[var(--bs-link)]">{{ copy.details }}</NuxtLink><BsButton variant="text" v-if="canManagePurchases && purchase.status === 'posted' && Number(purchase.payable) === Number(purchase.totalAmount)" type="button" class="text-[var(--bs-status-error)]" :disabled="voidingId === purchase.id" @click="voidPurchase(purchase)">{{ copy.void }}</BsButton></span></template></Column>
</BsDataTable><div v-if="totalPurchases > pageSize" class="mt-4 flex items-center justify-between text-sm"><BsButton class="ls-btn ls-btn-sm" :disabled="page === 1" @click="page--">{{ copy.previous }}</BsButton><span>{{ page }} / {{ pages }}</span><BsButton class="ls-btn ls-btn-sm" :disabled="page === pages" @click="page++">{{ copy.next }}</BsButton></div></div>
      </section>
    </template>
  </div>
</template>
