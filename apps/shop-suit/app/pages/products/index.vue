<script setup lang="ts">
import type { BsCataloguePackagingForm } from '@building-suit/ui/types/cataloguePresentation'
import type { ProductTechnicalOptions } from '~/types/electrical'
import { measurementUnits, convertMeasurement } from '~/utils/measurement'
import type { ProductMeasurementOptions } from '~/types/measurement'
import { validCatalogImage } from '~/utils/catalogMedia'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const { businessCurrency } = useShop()
const confirmation = useConfirmation()
const captureTaskScope = useShopTaskScope()

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type Product = {
  id: string
  base_unit_code?: string
  measurement_status?: string
  technical_details?: import('~/types/electrical').ProductTechnicalSnapshot
  imageUrl?: string | null
  imageObjectName?: string | null
  name: string
  sku: string | null
  barcode: string | null
  sale_price: number
  category_id: string | null
  category_name: string | null
  created_at: string
}
type ProductPage = { supportsTechnicalDetails?: boolean; supportsMeasurements?: boolean; supportsUploads?: boolean; supportsMedia?: boolean; items: Product[]; total: number; page: number; pageSize: number }
type Category = { id: string; name: string }

const shopRpc = useShopClient<ShopRpcDatabase>().schema('public')
const media = useCatalogMedia()
const { locale } = useI18n()
const { current, currentId, loading: shopLoading } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const search = ref('')
const categoryFilter = ref('')
const page = ref(1)
const pageSize = 20
const editingId = ref<string | null>(null)
const archivingId = ref<string | null>(null)
const actionError = ref('')
const technicalContext = ref<ProductTechnicalOptions | null>(null)
const technicalLoading = ref(false)
let technicalRequest = 0
const packagingForm = ref<BsCataloguePackagingForm>()
const packagingPending = ref(false)
let packagingCommand: { payload: string; requestId: string } | null = null
const measurementContext = ref<ProductMeasurementOptions | null>(null)
const measurementLoading = ref(false)
let measurementLoad = 0
const form = reactive({ technical: { enabled: false, family: '', reelTracking: false, unopenedResellable: true, cutRequiresManagerApproval: true, attributes: [] as { code: string; value: string }[] }, measurement: { enabled: true, baseUnit: 'ea', increment: '1', saleUnits: ['ea'] }, imageObjectName: null as string | null, imageUrl: '', name: '', sku: '', barcode: '', salePrice: 0, categoryId: '' })
const upload = useCatalogImageUpload(currentId, 'products', objectName => { form.imageObjectName = objectName; form.imageUrl = '' })
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => ({ ...form, imageSelection: upload.selectedName.value, packaging: packagingForm.value }))
function removeImage() { upload.reset(); form.imageUrl = ''; form.imageObjectName = null }
watch(showForm, visible => { if (!visible) upload.reset() })

const { data: permissionAccess } = useShopQuery('shop-data:product-permissions', async () => {
  if (!currentId.value) return { 'products.manage': false }
  const { data, error } = await shopRpc.rpc('shop_permission_access', {
    p_shop_id: currentId.value, p_permission_keys: ['products.manage'],
  })
  if (error) throw error
  return data
}, { watch: [currentId], default: () => ({ 'products.manage': false }) })
const canManage = computed(() => permissionAccess.value?.['products.manage'] === true)

const copy = computed(() => isArabic.value ? {
  technical: { title: 'المواصفات الفنية والعائلات', enabled: 'إعداد المواصفات الفنية', help: 'المواصفات مثل مساحة المقطع ٢٫٥ مم² تصف المنتج ولا تغير وحدة المخزون.', family: 'عائلة المتغيرات (اختياري)', familyHelp: 'يحتاج كل لون أو مقاس إلى رمز منتج مستقل ومخزون منفصل.', attributes: 'المواصفات', attribute: 'المواصفة', value: 'القيمة', add: 'إضافة مواصفة', remove: 'إزالة المواصفة', reelTracking: 'تتبع البكرات المنفردة', unopenedResellable: 'السماح بإعادة بيع البكرات المرتجعة غير المفتوحة', cutRequiresManagerApproval: 'اشتراط موافقة مدير لمرتجعات الكابل المقطوع', reelHelp: 'للمنتجات المقاسة بالطول فقط. تُسجل البكرات والكميات المتصلة والفاقد مع المخزون نفسه.', locked: 'لا يمكن تغيير تتبع البكرات بعد تسجيل حركة للمنتج.' },
  packaging: { title: 'عبوات المنتج', help: 'احفظ المنتج بوحدة قياس أولاً، ثم افتحه لتعريف محتويات كل عبوة. يُنشئ التعديل إصداراً جديداً ويحفظ السجل السابق.', add: 'إضافة عبوة', code: 'رمز العبوة', name: 'اسم العبوة', unit: 'نوع العبوة', contents: 'الكمية داخل العبوة', contentsUnit: 'وحدة المحتوى', barcode: 'باركود العبوة', salePrice: 'سعر بيع العبوة (اختياري)', priceHelp: 'اتركه فارغاً لاستخدام سعر الوحدة × المحتوى.', canPurchase: 'متاحة للشراء', canSell: 'متاحة للبيع', defaultPurchase: 'افتراضية للشراء', defaultSale: 'افتراضية للبيع', save: 'حفظ العبوة', archive: 'أرشفة', edit: 'تعديل', cancel: 'عبوة جديدة' },
  measurement: { enabled: 'تفعيل وحدات القياس', baseUnit: 'وحدة المخزون وسعر البيع', increment: 'أصغر كمية مسموحة', saleUnits: 'وحدات البيع المسموحة', help: 'يُحفظ المخزون بوحدة أساسية واحدة. لا يمكن تغييرها بعد تسجيل حركة.', locked: 'الوحدة ثابتة للحفاظ على المخزون والسجل المالي.' },
  imageUpload: { choose: 'اختيار صورة', replace: 'استبدال الصورة', remove: 'إزالة', retry: 'إعادة المحاولة', help: 'اختر صورة JPEG أو PNG أو WebP، حتى ٥ ميجابايت و١٦ مليون بكسل.', uploading: 'جارٍ رفع الصورة…', uploaded: 'تم رفع الصورة', error: 'تعذّر رفع الصورة. أعد المحاولة أو اختر صورة أخرى.', invalid: 'اختر صورة JPEG أو PNG أو WebP صالحة، حتى ٥ ميجابايت و١٦ مليون بكسل.', placeholder: 'بدون صورة' },
  imagePlaceholder: 'بدون صورة', imageLabel: 'الصورة (اختياري)', imageUnavailable: 'تعديل الصور غير متاح لهذا الكتالوج بعد.', imageInvalid: 'الصورة المحفوظة غير صالحة. أزلها أو استبدلها.',
  title: 'المنتجات', subtitle: 'ضيف منتجات متجرك وحدد سعر البيع.',
  add: 'إضافة منتج', edit: 'تعديل', editTitle: 'تعديل المنتج', archive: 'أرشفة', cancel: 'إلغاء', save: 'حفظ المنتج', saving: 'بنحفظ...', loading: 'بنحمّل المنتجات…',
  name: 'اسم المنتج', sku: 'رمز المنتج', barcode: 'الباركود', price: 'سعر البيع', category: 'التصنيف', allCategories: 'كل التصنيفات', previous: 'السابق', next: 'التالي', import: 'الاستيراد والإعداد',
  search: 'دوّر باسم المنتج أو الرمز', empty: 'مفيش منتجات لسه.', noResults: 'مفيش نتايج مطابقة.',
  noShop: 'اعمل متجر الأول من لوحة التحكم.', dashboard: 'لوحة التحكم',
  readError: 'مقدرناش نحمّل المنتجات.', writeError: 'مقدرناش نحفظ المنتج.', retry: 'حاول تاني',
  invalid: 'اكتب اسمًا من حرفين إلى 160 حرفًا وسعرًا صحيحًا غير سالب.',
  limit: 'وصلت إلى حد المنتجات في خطتك.', duplicate: 'رمز المنتج أو الباركود مستخدم لمنتج نشط آخر.',
  access: 'الفترة التجريبية خلصت أو معندكش صلاحية التعديل.',
  archiveConfirm: 'تأرشف المنتج ده؟ سجله هيفضل محفوظ.',
  stockLater: 'تقدر تسجل الكميات يدويًا في المخزون أو من صفحة المشتريات.',
} : {
  technical: { title: 'Technical specifications and families', enabled: 'Configure technical details', help: 'Specifications such as a 2.5 mm² cross-section describe the product and do not change its stock unit.', family: 'Variant family (optional)', familyHelp: 'Each stocked color or size needs its own SKU and independent stock.', attributes: 'Specifications', attribute: 'Specification', value: 'Value', add: 'Add specification', remove: 'Remove specification', reelTracking: 'Track individual reels', unopenedResellable: 'Allow resellable returns of unopened reels', cutRequiresManagerApproval: 'Require manager approval for cut cable returns', reelHelp: 'For products measured by length. Reels, continuous lengths and cutting loss reconcile to the same stock balance.', locked: 'Reel tracking cannot change after product activity.' },
  packaging: { title: 'Product packaging', help: 'Save the measured product first, then reopen it to define each package’s contents. Editing creates a new version and preserves history.', add: 'Add packaging', code: 'Packaging code', name: 'Packaging name', unit: 'Package type', contents: 'Contained quantity', contentsUnit: 'Content unit', barcode: 'Package barcode', salePrice: 'Package sale price (optional)', priceHelp: 'Leave blank to use the unit price × contents.', canPurchase: 'Available for purchasing', canSell: 'Available for sales', defaultPurchase: 'Default for purchasing', defaultSale: 'Default for sales', save: 'Save packaging', archive: 'Archive', edit: 'Edit', cancel: 'New packaging' },
  measurement: { enabled: 'Enable measurement units', baseUnit: 'Stock and sale-price unit', increment: 'Smallest allowed quantity', saleUnits: 'Allowed sale units', help: 'Stock uses one base unit. It cannot change after activity is recorded.', locked: 'The unit is fixed to preserve stock and financial history.' },
  imageUpload: { choose: 'Choose image', replace: 'Replace image', remove: 'Remove', retry: 'Retry', help: 'Choose JPEG, PNG or WebP, up to 5 MB and 16 million pixels.', uploading: 'Uploading image…', uploaded: 'Image uploaded', error: 'Image upload failed. Retry or choose another image.', invalid: 'Choose a valid JPEG, PNG or WebP image up to 5 MB and 16 million pixels.', placeholder: 'No image' },
  imagePlaceholder: 'No image', imageLabel: 'Image (optional)', imageUnavailable: 'Image editing is not available for this catalog yet.', imageInvalid: 'The saved image is invalid. Remove or replace it.',
  title: 'Products', subtitle: 'Create your shop catalog and sale prices.',
  add: 'Add product', edit: 'Edit', editTitle: 'Edit product', archive: 'Archive', cancel: 'Cancel', save: 'Save product', saving: 'Saving...', loading: 'Loading products…',
  name: 'Product name', sku: 'SKU', barcode: 'Barcode', price: 'Sale price', category: 'Category', allCategories: 'All categories', previous: 'Previous', next: 'Next', import: 'Import & setup',
  search: 'Search name or code', empty: 'No products yet.', noResults: 'No matching products.',
  noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  readError: 'Could not load products.', writeError: 'Could not save the product.', retry: 'Retry',
  invalid: 'Enter a name of 2–160 characters and a valid nonnegative price.',
  limit: 'Your plan product limit has been reached.', duplicate: 'Another active product already uses this SKU or barcode.',
  access: 'Your trial has ended or you do not have permission to edit.',
  archiveConfirm: 'Archive this product? Its history will be kept.',
  stockLater: 'Record quantities manually in Inventory or receive them through Purchases.',
})

const { data: categories } = useShopQuery(() => `shop-data:product-categories:${currentId.value ?? 'none'}`, async () => {
  if (!currentId.value) return []
  const { data, error } = await shopRpc.rpc('list_catalog_categories', { p_shop_id: currentId.value })
  if (error) throw error
  return data as Category[]
}, { watch: [currentId], default: () => [] })
const emptyPage = (): ProductPage => ({ items: [], total: 0, page: 1, pageSize })
const { data: productPage, pending, error, refresh } = useShopQuery(
  'shop-data:products', async () => {
    if (!currentId.value) return emptyPage()
    const args = {
      p_shop_id: currentId.value, p_search: search.value.trim() || null,
      p_category_id: categoryFilter.value || null, p_page: page.value, p_page_size: pageSize,
    }
    const { data, error: queryError } = await media.request('products', args, () => shopRpc.rpc('list_products', args))
    if (queryError) throw queryError
    return data as ProductPage
  }, { watch: [currentId, search, categoryFilter, page], default: emptyPage },
)
const products = computed(() => productPage.value.items)
watch([search, categoryFilter], () => { page.value = 1 })

function resetForm() {
  upload.reset()
  technicalRequest++; technicalLoading.value = false; technicalContext.value = null
  form.technical = { enabled: false, family: '', reelTracking: false, unopenedResellable: true, cutRequiresManagerApproval: true, attributes: [] }
  packagingForm.value = undefined; packagingCommand = null
  measurementLoad++; measurementLoading.value = false; measurementContext.value = null
  form.measurement = { enabled: true, baseUnit: 'ea', increment: '1', saleUnits: ['ea'] }
  form.imageObjectName = null
  editingId.value = null
  showForm.value = false
  actionError.value = ''
  form.imageUrl = ''
  form.name = ''
  form.sku = ''
  form.barcode = ''
  form.salePrice = 0
  form.categoryId = ''
}

watch(currentId, () => { saving.value = false; resetForm() }, { flush: 'sync' })

function openCreate() {
  resetForm()
  showForm.value = true
  void loadTechnicalOptions(null)
}

async function openEdit(product: Product) {
  void loadTechnicalOptions(product.id)
  packagingForm.value = undefined; packagingCommand = null
  upload.reset(product.imageUrl ?? '')
  form.imageObjectName = product.imageObjectName ?? null
  editingId.value = product.id
  form.imageUrl = product.imageUrl ?? ''
  form.name = product.name
  form.sku = product.sku ?? ''
  form.barcode = product.barcode ?? ''
  form.salePrice = Number(product.sale_price)
  form.categoryId = product.category_id ?? ''
  actionError.value = ''
  showForm.value = true
  measurementContext.value = null
  form.measurement.enabled = false
  if (!productPage.value.supportsMeasurements || !currentId.value) return
  const request = ++measurementLoad
  const shop = currentId.value
  measurementLoading.value = true
  try {
    const { data, error } = await shopRpc.rpc('product_measurement_options', { p_shop_id: shop, p_product_id: product.id })
    if (request !== measurementLoad || currentId.value !== shop || editingId.value !== product.id) return
    if (error) throw error
    measurementContext.value = data
    if (data) form.measurement = { enabled: data.status === 'active', baseUnit: data.baseUnitCode, increment: data.increment, saleUnits: data.saleUnits }
  } catch (error) {
    if (request === measurementLoad) actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally { if (request === measurementLoad) measurementLoading.value = false }
}

async function loadTechnicalOptions(product: string | null) {
  if (!productPage.value.supportsTechnicalDetails || !currentId.value) return
  const request = ++technicalRequest; const shop = currentId.value
  technicalLoading.value = true; technicalContext.value = null
  form.technical = { enabled: false, family: '', reelTracking: false, unopenedResellable: true, cutRequiresManagerApproval: true, attributes: [] }
  try {
    const result = await shopRpc.rpc('product_technical_options', { p_shop_id: shop, p_product_id: product })
    if (request !== technicalRequest || currentId.value !== shop || editingId.value !== product) return
    if (result.error) throw new Error(result.error.message)
    technicalContext.value = result.data
    if (result.data) form.technical = { enabled: result.data.revision > 0, family: result.data.familyName ?? '', reelTracking: result.data.reelTracking, unopenedResellable: result.data.reelReturnPolicy.unopenedResellable, cutRequiresManagerApproval: result.data.reelReturnPolicy.cutRequiresManagerApproval, attributes: Object.entries(result.data.attributes).map(([code,value]) => ({ code, value: String(value) })) }
  } catch (error) { if (request === technicalRequest) actionError.value = readableError(error instanceof Error ? error.message : undefined) }
  finally { if (request === technicalRequest) technicalLoading.value = false }
}
const technicalView = computed(() => productPage.value.supportsTechnicalDetails ? { definitions: (technicalContext.value?.definitions ?? []).map(definition => ({ code: definition.code, label: isArabic.value ? definition.nameAr : definition.nameEn, type: definition.type, unit: definition.unit })), loading: technicalLoading.value, existing: (technicalContext.value?.revision ?? 0) > 0, trackingAllowed: form.measurement.enabled && measurementUnits.find(unit => unit.code === form.measurement.baseUnit)?.dimension === 'length', trackingLocked: technicalContext.value?.trackingLocked === true } : undefined)
const unitOptions = computed(() => measurementUnits.filter(unit => unit.dimension !== 'package').map(unit => ({ value: unit.code, label: isArabic.value ? unit.nameAr : unit.nameEn })))
const saleUnitOptions = computed(() => {
  const base = measurementUnits.find(unit => unit.code === form.measurement.baseUnit)
  return measurementUnits.filter(unit => unit.dimension === base?.dimension).map(unit => ({ value: unit.code, label: isArabic.value ? unit.nameAr : unit.nameEn }))
})


function readableError(message?: string) {
  if (message === 'INVALID_CATALOG_IMAGE') return copy.value.imageInvalid
  if (message === 'CATALOG_MEDIA_UNAVAILABLE') return copy.value.imageUnavailable
  const quotaMessage = planQuotaMessage(message, locale.value)
  if (quotaMessage) return quotaMessage
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message?.includes('products_shop_active_sku_unique') || message?.includes('products_shop_active_barcode_unique')) return copy.value.duplicate
  return message || copy.value.writeError
}

async function save() {
  if (!currentId.value || technicalLoading.value || (productPage.value.supportsTechnicalDetails && !technicalContext.value) || packagingPending.value || measurementLoading.value || (editingId.value && productPage.value.supportsMeasurements && !measurementContext.value) || saving.value || ['uploading', 'error', 'invalid'].includes(upload.status.value) || !canManage.value) return
  actionError.value = ''
  const price = Number(form.salePrice)
  if (form.name.trim().length < 2 || form.name.trim().length > 160
    || !Number.isFinite(price) || price < 0 || price > 999999999.99) {
    actionError.value = copy.value.invalid
    return
  }
  if (!form.imageObjectName && !validCatalogImage(form.imageUrl)) { actionError.value = copy.value.imageInvalid; return }
  if (productPage.value.supportsMeasurements && form.measurement.enabled) {
    try { convertMeasurement(form.measurement.increment, form.measurement.baseUnit, form.measurement.baseUnit, form.measurement.increment) }
    catch { actionError.value = isArabic.value ? 'أدخل كمية مسموحة للوحدة المختارة.' : 'Enter a valid increment for the selected unit.'; return }
  }
  if (form.technical.enabled && (new Set(form.technical.attributes.map(attribute => attribute.code)).size !== form.technical.attributes.length || form.technical.attributes.some(attribute => !attribute.code || !attribute.value.trim()))) { actionError.value = isArabic.value ? 'اختر مواصفات مختلفة وأدخل قيمها.' : 'Choose distinct specifications and enter their values.'; return }
  const inScope = captureTaskScope(); const editorRequest = technicalRequest
  saving.value = true
  try {
    const args = {
      ...(productPage.value.supportsTechnicalDetails && form.technical.enabled ? { p_technical_enabled: true, p_technical_revision: technicalContext.value?.revision ?? 0, p_family_name: form.technical.family.trim() || null, p_technical_attributes: JSON.stringify(Object.fromEntries(form.technical.attributes.map(attribute => [attribute.code, technicalContext.value?.definitions.find(definition => definition.code === attribute.code)?.type === 'boolean' ? attribute.value === 'true' : attribute.value]))), p_reel_tracking: form.technical.reelTracking, p_reel_return_policy: JSON.stringify({ unopenedResellable: form.technical.unopenedResellable, cutRequiresManagerApproval: form.technical.cutRequiresManagerApproval }), p_technical_reason: 'Product technical configuration' } : {}),
      ...(productPage.value.supportsMeasurements && form.measurement.enabled ? { p_measurement_enabled: true, p_base_unit_code: form.measurement.baseUnit, p_quantity_increment: form.measurement.increment, p_sale_unit_codes: form.measurement.saleUnits, p_measurement_reason: 'Product measurement configuration' } : {}),
      ...(productPage.value.supportsUploads ? { imageObjectName: form.imageObjectName } : {}),
      p_shop_id: currentId.value,
      p_product_id: editingId.value,
      p_name: form.name.trim(),
      p_sku: form.sku.trim() || null,
      p_barcode: form.barcode.trim() || null,
      p_sale_price: price,
      p_category_id: form.categoryId || null,
    }
    const { error: saveError } = await media.request('save_product', args, () => shopRpc.rpc('save_product_with_category', args), !form.imageObjectName && form.imageUrl.trim() ? new URL(form.imageUrl.trim()).href : null, productPage.value.supportsMedia === true)
    if (!inScope() || editorRequest !== technicalRequest) return
    if (saveError) throw new Error(saveError.message)
    resetForm()
    await refresh()
  } catch (error) {
    if (inScope() && editorRequest === technicalRequest) actionError.value = planQuotaMessage(error, locale.value) ?? readableError(error instanceof Error ? error.message : undefined)
  } finally {
    if (inScope()) saving.value = false
  }
}

async function archive(product: Product) {
  if (!currentId.value || archivingId.value || !canManage.value) return
  if (!await confirmation.ask(copy.value.archiveConfirm)) return
  actionError.value = ''
  archivingId.value = product.id
  try {
    const { error: archiveError } = await shopRpc.rpc('archive_product', {
      p_shop_id: currentId.value,
      p_product_id: product.id,
    })
    if (archiveError) throw archiveError
    await refresh()
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    archivingId.value = null
  }
}

function money(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 20,
  }).format(value)
}

useShopRealtime('products', () => formDirty.value)

const categoryOptions = computed(() => [{ value: '', label: copy.value.allCategories }, ...categories.value.map(category => ({ value: category.id, label: category.name }))])
const itemViews = computed(() => products.value.map(product => ({ id: product.id, name: product.name, description: product.technical_details?.familyName || undefined, category: product.category_name || '—', sku: product.sku || '—', barcode: product.barcode || '—', price: `${money(Number(product.sale_price))}${product.measurement_status === 'active' ? ' / ' + (isArabic.value ? measurementUnits.find(unit => unit.code === product.base_unit_code)?.nameAr : measurementUnits.find(unit => unit.code === product.base_unit_code)?.nameEn) : ''}`, schedule: '' })))
const editorForm = computed({
  get: () => ({ technical: productPage.value.supportsTechnicalDetails ? form.technical : undefined, packaging: packagingForm.value, measurement: productPage.value.supportsMeasurements ? form.measurement : undefined, imageUrl: form.imageUrl, name: form.name, description: '', sku: form.sku, barcode: form.barcode, price: form.salePrice, category: form.categoryId, discount: { type: '', value: 0 }, schedule: { enabled: false, duration: null, cleanup: 0, locations: [], staff: [] } }),
  set: (value: import('@building-suit/ui/types/cataloguePresentation').BsCatalogueForm) => {
    if (value.measurement && value.measurement.baseUnit !== form.measurement.baseUnit) {
      const unit = measurementUnits.find(entry => entry.code === value.measurement?.baseUnit)
      value.measurement = { ...value.measurement, increment: unit?.allowedPrecision === 0 ? '1' : '0.001', saleUnits: [value.measurement.baseUnit] }
    }
    packagingForm.value = value.packaging
    Object.assign(form, { technical: value.technical ?? form.technical, measurement: value.measurement ?? form.measurement, imageUrl: value.imageUrl ?? '', name: value.name, sku: value.sku, barcode: value.barcode, salePrice: value.price, categoryId: value.category })
  },
})
function resetPackaging() {
  packagingForm.value = { id: null, code: '', name: '', unitCode: 'reel', containedQuantity: '100', containedUnitCode: measurementContext.value?.baseUnitCode ?? 'ea', barcode: '', salePrice: '', canPurchase: true, canSell: true, defaultPurchase: false, defaultSale: false }
  packagingCommand = null
}
function editPackaging(id: string) {
  const pack = measurementContext.value?.packages.find(pack => pack.id === id)
  if (!pack) return
  packagingForm.value = { ...pack, salePrice: pack.salePrice == null ? '' : String(pack.salePrice), barcode: pack.barcode ?? '' }
  packagingCommand = null
}
async function savePackaging(archiveId?: string) {
  if (!currentId.value || !editingId.value || saving.value || packagingPending.value || !canManage.value) return
  const draft = packagingForm.value
  if (!archiveId && (!draft || !draft.code.trim() || !draft.name.trim())) return
  if (archiveId && !await confirmation.ask(isArabic.value ? 'أرشفة هذه العبوة؟' : 'Archive this packaging?')) return
  const product = editingId.value; const shop = currentId.value
  const definition: Record<string, string | number | boolean | null> = archiveId ? { archive: true } : { code: draft!.code.trim(), name: draft!.name.trim(), unitCode: draft!.unitCode, containedQuantity: draft!.containedQuantity, containedUnitCode: draft!.containedUnitCode, barcode: draft!.barcode.trim() || null, salePrice: draft!.salePrice.trim() || null, canPurchase: draft!.canPurchase, canSell: draft!.canSell, defaultPurchase: draft!.defaultPurchase, defaultSale: draft!.defaultSale }
  const packageId = archiveId || draft!.id
  const payload = JSON.stringify([shop, product, packageId, definition])
  if (packagingCommand?.payload !== payload) packagingCommand = { payload, requestId: crypto.randomUUID() }
  const inScope = () => currentId.value === shop && editingId.value === product
  packagingPending.value = true; actionError.value = ''
  try {
    const result = await shopRpc.rpc('save_product_packaging', { p_request_id: packagingCommand.requestId, p_shop_id: shop, p_product_id: product, p_package_id: packageId, p_definition: definition })
    if (!inScope()) return
    if (result.error) throw new Error(result.error.message)
    const options = await shopRpc.rpc('product_measurement_options', { p_shop_id: shop, p_product_id: product })
    if (!inScope()) return
    if (options.error) throw new Error(options.error.message)
    measurementContext.value = options.data; packagingForm.value = undefined; packagingCommand = null
  } catch (error) { if (inScope()) actionError.value = readableError(error instanceof Error ? error.message : undefined) }
  finally { packagingPending.value = false }
}
const packagingView = computed(() => productPage.value.supportsMeasurements ? { available: measurementContext.value?.status === 'active', items: (measurementContext.value?.packages ?? []).map(pack => ({ id: pack.id, label: `${pack.name} — ${pack.baseQuantity} ${measurementContext.value?.baseUnitCode} · v${pack.version}` })), units: measurementUnits.filter(unit => unit.dimension === 'package').map(unit => ({ value: unit.code, label: isArabic.value ? unit.nameAr : unit.nameEn })), contentUnits: saleUnitOptions.value, pending: packagingPending.value } : undefined)
function editById(id: string) { const row = products.value.find(product => product.id === id); if (row) openEdit(row) }
function archiveById(id: string) { const row = products.value.find(product => product.id === id); if (row) return archive(row) }
</script>
<template>
  <BsCataloguePage v-model:form="editorForm" v-model:visible="showForm" v-model:category="categoryFilter" kind="product" :copy="copy" :context="{ available: Boolean(current), loading: shopLoading, dashboardTo: '/dashboard', importTo: '/catalog-import' }" :rows="itemViews" :categories="categoryOptions" :table="{ loading: pending, error: error ? copy.readError : null, canManage, archivePendingId: archivingId, pageSize, page, total: productPage.total, filtered: Boolean(search || categoryFilter) }" :technical="technicalView" :packaging="packagingView" :measurement="productPage.supportsMeasurements ? { units: unitOptions, saleUnits: saleUnitOptions, locked: measurementContext?.locked === true, loading: measurementLoading } : undefined" :editor="{ uploadBlocked: technicalLoading || Boolean(productPage.supportsTechnicalDetails && !technicalContext) || measurementLoading || Boolean(editingId && productPage.supportsMeasurements && !measurementContext) || ['uploading', 'error', 'invalid'].includes(upload.status.value), mediaSupported: productPage.supportsUploads === true, editing: Boolean(editingId), dirty: formDirty, pending: saving || packagingPending, error: actionError }" :upload="{ preview: upload.preview.value, status: upload.status.value }" @save-packaging="savePackaging()" @edit-packaging="editPackaging" @archive-packaging="savePackaging($event)"  @reset-packaging="resetPackaging" @image-select="upload.select($event)" @image-remove="removeImage" @image-retry="upload.retry()" @search="search = $event" @page="page = $event" @retry="refresh()" @create="openCreate" @edit="editById" @archive="archiveById" @submit="save" />
</template>
