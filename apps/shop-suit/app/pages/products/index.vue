<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const confirmation = useConfirmation()

definePageMeta({ layout: 'default', middleware: ['auth'] })

type Product = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price: number
  created_at: string
}

const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, isOwner, loading: shopLoading } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const search = ref('')
const editingId = ref<string | null>(null)
const archivingId = ref<string | null>(null)
const actionError = ref('')
const form = reactive({ name: '', sku: '', barcode: '', salePrice: 0 })
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)

const copy = computed(() => isArabic.value ? {
  title: 'المنتجات', subtitle: 'أنشئ منتجات متجرك وحدد سعر البيع.',
  add: 'إضافة منتج', edit: 'تعديل', archive: 'أرشفة', cancel: 'إلغاء', save: 'حفظ المنتج', saving: 'جاري الحفظ...',
  name: 'اسم المنتج', sku: 'رمز المنتج', barcode: 'الباركود', price: 'سعر البيع',
  search: 'ابحث عن منتج أو رمز', empty: 'لا توجد منتجات بعد.', noResults: 'لا توجد نتائج مطابقة.',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم',
  readError: 'تعذّر تحميل المنتجات.', writeError: 'تعذّر حفظ المنتج.', retry: 'إعادة المحاولة',
  invalid: 'اكتب اسمًا من حرفين إلى 160 حرفًا وسعرًا صحيحًا غير سالب.',
  limit: 'وصلت إلى حد المنتجات في خطتك.', duplicate: 'هذا الرمز مستخدم لمنتج نشط آخر.',
  access: 'انتهت التجربة أو ليست لديك صلاحية التعديل.',
  archiveConfirm: 'هل تريد أرشفة هذا المنتج؟ سيبقى سجلّه محفوظًا.',
  stockLater: 'يمكنك تسجيل الكميات يدويًا في المخزون. مشتريات الموردين قيد العمل.',
} : {
  title: 'Products', subtitle: 'Create your shop catalog and sale prices.',
  add: 'Add product', edit: 'Edit', archive: 'Archive', cancel: 'Cancel', save: 'Save product', saving: 'Saving...',
  name: 'Product name', sku: 'SKU', barcode: 'Barcode', price: 'Sale price',
  search: 'Search name or code', empty: 'No products yet.', noResults: 'No matching products.',
  noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  readError: 'Could not load products.', writeError: 'Could not save the product.', retry: 'Retry',
  invalid: 'Enter a name of 2–160 characters and a valid nonnegative price.',
  limit: 'Your plan product limit has been reached.', duplicate: 'Another active product already uses this SKU.',
  access: 'Your trial has ended or you do not have permission to edit.',
  archiveConfirm: 'Archive this product? Its history will be kept.',
  stockLater: 'You can record quantities manually in Inventory. Supplier purchases are in progress.',
})

const { data: products, pending, error, refresh } = useAsyncData(
  'shop-data:products', async () => {
    if (!currentId.value) return []
    const { data, error: queryError } = await supabase.from('products')
      .select('id,name,sku,barcode,sale_price,created_at')
      .eq('shop_id', currentId.value).eq('is_active', true)
      .order('name', { ascending: true }).limit(1000)
    if (queryError) throw queryError
    return (data ?? []) as Product[]
  }, { watch: [currentId], default: () => [] },
)

const filteredProducts = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return products.value ?? []
  return (products.value ?? []).filter(product => [product.name, product.sku, product.barcode]
    .some(value => value?.toLocaleLowerCase().includes(query)))
})

function resetForm() {
  editingId.value = null
  showForm.value = false
  actionError.value = ''
  form.name = ''
  form.sku = ''
  form.barcode = ''
  form.salePrice = 0
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
  actionError.value = ''
  showForm.value = true
}

function readableError(message?: string) {
  if (message === 'PRODUCT_LIMIT_REACHED') return copy.value.limit
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message?.includes('products_shop_active_sku_unique')) return copy.value.duplicate
  return message || copy.value.writeError
}

async function save() {
  if (!currentId.value || saving.value || !isOwner.value) return
  actionError.value = ''
  const price = Number(form.salePrice)
  if (form.name.trim().length < 2 || form.name.trim().length > 160
    || !Number.isFinite(price) || price < 0 || price > 999999999.99) {
    actionError.value = copy.value.invalid
    return
  }
  saving.value = true
  try {
    const { error: saveError } = await shopRpc.rpc('save_product', {
      p_shop_id: currentId.value,
      p_product_id: editingId.value,
      p_name: form.name.trim(),
      p_sku: form.sku.trim() || null,
      p_barcode: form.barcode.trim() || null,
      p_sale_price: price,
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
  if (!currentId.value || archivingId.value || !isOwner.value) return
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
      <button v-if="current && isOwner" type="button" class="ls-btn ls-btn-primary" @click="openCreate">{{ copy.add }}</button>
    </header>

    <div v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm"><p>{{ copy.noShop }}</p><NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.dashboard }}</NuxtLink></div>
    <template v-else-if="current">
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm dark:bg-[var(--bs-status-info-bg)]">{{ copy.stockLater }}</p>
      <p v-if="actionError && !showForm" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>

      <BsDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.add" :dirty="formDirty" :pending="saving"><template #default="{ close }"><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <p v-if="actionError" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)] sm:col-span-2">{{ actionError }}</p>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.name }}<input v-model="form.name" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.sku }}<input v-model="form.sku" type="text" maxlength="80" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.barcode }}<input v-model="form.barcode" type="text" maxlength="80" class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.price }}<input v-model.number="form.salePrice" type="number" min="0" step="0.01" required class="ls-input"></label>
        <div class="flex items-end gap-2"><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving">{{ saving ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" @click="close">{{ copy.cancel }}</button></div>
      </form></template></BsDialog>

      <div class="overflow-hidden rounded-2xl border border-border bg-card">
        <div class="border-b border-border p-4"><input v-model="search" type="search" :placeholder="copy.search" class="ls-input sm:max-w-sm"></div>
        <div v-if="pending" class="space-y-3 p-5"><div v-for="index in 3" :key="index" class="h-11 animate-pulse rounded-lg bg-muted" /></div>
        <p v-else-if="error" role="alert" class="p-5 text-sm text-[var(--bs-status-error)]">{{ copy.readError }} <button type="button" class="underline" @click="refresh()">{{ copy.retry }}</button></p>
        <p v-else-if="!products?.length" class="p-8 text-center text-sm text-muted-foreground">{{ copy.empty }}</p>
        <p v-else-if="!filteredProducts.length" class="p-8 text-center text-sm text-muted-foreground">{{ copy.noResults }}</p>
        <div v-else class="overflow-x-auto"><BsDataTable :value="filteredProducts" data-key="id" :row-class="() => 'border-t border-border'">
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4 font-bold">
    <template #header>{{ copy.name }}</template>
    <template #body="{ data: product }">{{ product.name }}</template>
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
    <template #body="{ data: product }"><button v-if="isOwner" type="button" class="me-3 font-semibold text-[var(--bs-link)]" @click="openEdit(product)">{{ copy.edit }}</button><button v-if="isOwner" type="button" class="font-semibold text-[var(--bs-status-error)] disabled:opacity-50" :disabled="archivingId === product.id" @click="archive(product)">{{ copy.archive }}</button></template>
  </Column>
</BsDataTable></div>
      </div>
    </template>
  </div>
</template>
