<script setup lang="ts">
import { validCatalogImage } from '~/utils/catalogMedia'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const { businessCurrency } = useShop()
const confirmation = useConfirmation()

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type Product = {
  id: string
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
type ProductPage = { supportsUploads?: boolean; supportsMedia?: boolean; items: Product[]; total: number; page: number; pageSize: number }
type Category = { id: string; name: string }

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
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
const form = reactive({ imageObjectName: null as string | null, imageUrl: '', name: '', sku: '', barcode: '', salePrice: 0, categoryId: '' })
const upload = useCatalogImageUpload(currentId, 'products', objectName => { form.imageObjectName = objectName; form.imageUrl = '' })
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => ({ ...form, imageSelection: upload.selectedName.value }))
function removeImage() { upload.reset(); form.imageUrl = ''; form.imageObjectName = null }
watch(showForm, visible => { if (!visible) upload.reset() })

const { data: permissionAccess } = useAsyncData('shop-data:product-permissions', async () => {
  if (!currentId.value) return { 'products.manage': false }
  const { data, error } = await shopRpc.rpc('shop_permission_access', {
    p_shop_id: currentId.value, p_permission_keys: ['products.manage'],
  })
  if (error) throw error
  return data
}, { watch: [currentId], default: () => ({ 'products.manage': false }) })
const canManage = computed(() => permissionAccess.value?.['products.manage'] === true)

const copy = computed(() => isArabic.value ? {
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

const { data: categories } = useAsyncData(() => `shop-data:product-categories:${currentId.value ?? 'none'}`, async () => {
  if (!currentId.value) return []
  const { data, error } = await shopRpc.rpc('list_catalog_categories', { p_shop_id: currentId.value })
  if (error) throw error
  return data as Category[]
}, { watch: [currentId], default: () => [] })
const emptyPage = (): ProductPage => ({ items: [], total: 0, page: 1, pageSize })
const { data: productPage, pending, error, refresh } = useAsyncData(
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

watch(currentId, resetForm)

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(product: Product) {
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
}

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
  if (!currentId.value || saving.value || ['uploading', 'error', 'invalid'].includes(upload.status.value) || !canManage.value) return
  actionError.value = ''
  const price = Number(form.salePrice)
  if (form.name.trim().length < 2 || form.name.trim().length > 160
    || !Number.isFinite(price) || price < 0 || price > 999999999.99) {
    actionError.value = copy.value.invalid
    return
  }
  if (!form.imageObjectName && !validCatalogImage(form.imageUrl)) { actionError.value = copy.value.imageInvalid; return }
  saving.value = true
  try {
    const args = {
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
    if (saveError) throw new Error(saveError.message)
    resetForm()
    await refresh()
  } catch (error) {
    actionError.value = planQuotaMessage(error, locale.value) ?? readableError(error instanceof Error ? error.message : undefined)
  } finally {
    saving.value = false
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
const itemViews = computed(() => products.value.map(product => ({ id: product.id, name: product.name, category: product.category_name || '—', sku: product.sku || '—', barcode: product.barcode || '—', price: money(Number(product.sale_price)), schedule: '' })))
const editorForm = computed({
  get: () => ({ imageUrl: form.imageUrl, name: form.name, description: '', sku: form.sku, barcode: form.barcode, price: form.salePrice, category: form.categoryId, discount: { type: '', value: 0 }, schedule: { enabled: false, duration: null, cleanup: 0, locations: [], staff: [] } }),
  set: (value: import('@building-suit/ui/types/cataloguePresentation').BsCatalogueForm) => Object.assign(form, { imageUrl: value.imageUrl ?? '', name: value.name, sku: value.sku, barcode: value.barcode, salePrice: value.price, categoryId: value.category }),
})
function editById(id: string) { const row = products.value.find(product => product.id === id); if (row) openEdit(row) }
function archiveById(id: string) { const row = products.value.find(product => product.id === id); if (row) return archive(row) }
</script>
<template>
  <BsCataloguePage v-model:form="editorForm" v-model:visible="showForm" v-model:category="categoryFilter" kind="product" :copy="copy" :context="{ available: Boolean(current), loading: shopLoading, dashboardTo: '/dashboard', importTo: '/catalog-import' }" :rows="itemViews" :categories="categoryOptions" :table="{ loading: pending, error: error ? copy.readError : null, canManage, archivePendingId: archivingId, pageSize, page, total: productPage.total, filtered: Boolean(search || categoryFilter) }" :editor="{ uploadBlocked: ['uploading', 'error', 'invalid'].includes(upload.status.value), mediaSupported: productPage.supportsUploads === true, editing: Boolean(editingId), dirty: formDirty, pending: saving, error: actionError }"  :upload="{ preview: upload.preview.value, status: upload.status.value }" @image-select="upload.select($event)" @image-remove="removeImage" @image-retry="upload.retry()" @search="search = $event" @page="page = $event" @retry="refresh()" @create="openCreate" @edit="editById" @archive="archiveById" @submit="save" />
</template>
