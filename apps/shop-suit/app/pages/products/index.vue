<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const confirmation = useConfirmation()

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type Product = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price: number
  category_id: string | null
  category_name: string | null
  created_at: string
}
type ProductPage = { items: Product[]; total: number; page: number; pageSize: number }
type Category = { id: string; name: string }

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
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
const form = reactive({ name: '', sku: '', barcode: '', salePrice: 0, categoryId: '' })
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)

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
  title: 'المنتجات', subtitle: 'أنشئ منتجات متجرك وحدد سعر البيع.',
  add: 'إضافة منتج', edit: 'تعديل', archive: 'أرشفة', cancel: 'إلغاء', save: 'حفظ المنتج', saving: 'جاري الحفظ...', loading: 'جاري تحميل المنتجات…',
  name: 'اسم المنتج', sku: 'رمز المنتج', barcode: 'الباركود', price: 'سعر البيع', category: 'التصنيف', allCategories: 'كل التصنيفات', previous: 'السابق', next: 'التالي', import: 'الاستيراد والإعداد',
  search: 'ابحث عن منتج أو رمز', empty: 'لا توجد منتجات بعد.', noResults: 'لا توجد نتائج مطابقة.',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم',
  readError: 'تعذّر تحميل المنتجات.', writeError: 'تعذّر حفظ المنتج.', retry: 'إعادة المحاولة',
  invalid: 'اكتب اسمًا من حرفين إلى 160 حرفًا وسعرًا صحيحًا غير سالب.',
  limit: 'وصلت إلى حد المنتجات في خطتك.', duplicate: 'رمز المنتج أو الباركود مستخدم لمنتج نشط آخر.',
  access: 'انتهت التجربة أو ليست لديك صلاحية التعديل.',
  archiveConfirm: 'هل تريد أرشفة هذا المنتج؟ سيبقى سجلّه محفوظًا.',
  stockLater: 'يمكنك تسجيل الكميات يدويًا في المخزون أو تسجيلها من صفحة المشتريات.',
} : {
  title: 'Products', subtitle: 'Create your shop catalog and sale prices.',
  add: 'Add product', edit: 'Edit', archive: 'Archive', cancel: 'Cancel', save: 'Save product', saving: 'Saving...', loading: 'Loading products…',
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
    const { data, error: queryError } = await shopRpc.rpc('list_products', {
      p_shop_id: currentId.value, p_search: search.value.trim() || null,
      p_category_id: categoryFilter.value || null, p_page: page.value, p_page_size: pageSize,
    })
    if (queryError) throw queryError
    return data as ProductPage
  }, { watch: [currentId, search, categoryFilter, page], default: emptyPage },
)
const products = computed(() => productPage.value.items)
const pageCount = computed(() => Math.max(1, Math.ceil(productPage.value.total / pageSize)))
watch([search, categoryFilter], () => { page.value = 1 })

function resetForm() {
  editingId.value = null
  showForm.value = false
  actionError.value = ''
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
  editingId.value = product.id
  form.name = product.name
  form.sku = product.sku ?? ''
  form.barcode = product.barcode ?? ''
  form.salePrice = Number(product.sale_price)
  form.categoryId = product.category_id ?? ''
  actionError.value = ''
  showForm.value = true
}

function readableError(message?: string) {
  if (message === 'PRODUCT_LIMIT_REACHED') return copy.value.limit
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message?.includes('products_shop_active_sku_unique') || message?.includes('products_shop_active_barcode_unique')) return copy.value.duplicate
  return message || copy.value.writeError
}

async function save() {
  if (!currentId.value || saving.value || !canManage.value) return
  actionError.value = ''
  const price = Number(form.salePrice)
  if (form.name.trim().length < 2 || form.name.trim().length > 160
    || !Number.isFinite(price) || price < 0 || price > 999999999.99) {
    actionError.value = copy.value.invalid
    return
  }
  saving.value = true
  try {
    const { error: saveError } = await shopRpc.rpc('save_product_with_category', {
      p_shop_id: currentId.value,
      p_product_id: editingId.value,
      p_name: form.name.trim(),
      p_sku: form.sku.trim() || null,
      p_barcode: form.barcode.trim() || null,
      p_sale_price: price,
      p_category_id: form.categoryId || null,
    })
    if (saveError) throw saveError
    resetForm()
    await refresh()
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
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
    style: 'currency', currency: 'EGP', maximumFractionDigits: 2,
  }).format(value)
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <div v-if="current" class="flex flex-wrap gap-2"><NuxtLink to="/catalog-import" class="ls-btn">{{ copy.import }}</NuxtLink><button v-if="canManage" type="button" class="ls-btn ls-btn-primary" @click="openCreate">{{ copy.add }}</button></div>
    </header>

    <div v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm"><p>{{ copy.noShop }}</p><NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.dashboard }}</NuxtLink></div>
    <template v-else-if="current">
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm dark:bg-[var(--bs-status-info-bg)]">{{ copy.stockLater }}</p>
      <p v-if="actionError && !showForm" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>

      <BsDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.add" :dirty="formDirty" :pending="saving"><template #default="{ close }"><BsForm class="grid gap-4 sm:grid-cols-2" :pending="saving" :error="actionError" @submit="save">
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.name }}<input v-model="form.name" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.sku }}<input v-model="form.sku" type="text" maxlength="80" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.barcode }}<input v-model="form.barcode" type="text" maxlength="80" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.price }}<input v-model.number="form.salePrice" type="number" min="0" step="0.01" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.category }}<select v-model="form.categoryId" class="ls-select"><option value="">{{ copy.allCategories }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
        <div class="flex items-end gap-2"><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving">{{ saving ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" @click="close">{{ copy.cancel }}</button></div>
      </BsForm></template></BsDialog>

      <div class="overflow-hidden rounded-2xl border border-border bg-card">
        <div class="grid gap-3 border-b border-border p-4 sm:grid-cols-2"><input v-model="search" :aria-label="copy.search" type="search" :placeholder="copy.search" class="ls-input"><select v-model="categoryFilter" :aria-label="copy.category" class="ls-select"><option value="">{{ copy.allCategories }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></div>
        <div v-if="pending" role="status" :aria-label="copy.loading" class="space-y-3 p-5"><div v-for="index in 3" :key="index" class="h-11 animate-pulse rounded-lg bg-muted" /></div>
        <p v-else-if="error" role="alert" class="p-5 text-sm text-[var(--bs-status-error)]">{{ copy.readError }} <BsButton @click="refresh()">{{ copy.retry }}</BsButton></p>
        <p v-else-if="!products.length" class="p-8 text-center text-sm text-muted-foreground">{{ search || categoryFilter ? copy.noResults : copy.empty }}</p>
        <div v-else class="overflow-x-auto"><BsDataTable :value="products" data-key="id" :row-class="() => 'border-t border-border'">
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4 font-bold">
    <template #header>{{ copy.name }}</template>
    <template #body="{ data: product }">{{ product.name }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
    <template #header>{{ copy.category }}</template>
    <template #body="{ data: product }">{{ product.category_name || '—' }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
    <template #header>{{ copy.sku }}</template>
    <template #body="{ data: product }">{{ product.sku || '—' }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
    <template #header>{{ copy.barcode }}</template>
    <template #body="{ data: product }">{{ product.barcode || '—' }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end">
    <template #header>{{ copy.price }}</template>
    <template #body="{ data: product }">{{ money(Number(product.sale_price)) }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-end" body-class="whitespace-nowrap px-5 py-4 text-end">
    <template #header/>
    <template #body="{ data: product }"><BsButton v-if="canManage" type="button" class="me-3 font-semibold text-[var(--bs-link)]" @click="openEdit(product)">{{ copy.edit }}</BsButton><BsButton v-if="canManage" type="button" class="font-semibold text-[var(--bs-status-error)] disabled:opacity-50" :disabled="archivingId === product.id" @click="archive(product)">{{ copy.archive }}</BsButton></template>
  </Column>
</BsDataTable></div>
        <div v-if="productPage.total > pageSize" class="flex items-center justify-center gap-3 border-t border-border p-4"><BsButton severity="secondary" :disabled="page <= 1" @click="page--">{{ copy.previous }}</BsButton><span>{{ page }} / {{ pageCount }}</span><BsButton severity="secondary" :disabled="page >= pageCount" @click="page++">{{ copy.next }}</BsButton></div>
      </div>
    </template>
  </div>
</template>
