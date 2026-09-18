<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const confirmation = useConfirmation()

definePageMeta({ layout: 'default', middleware: ['auth'] })

type Service = {
  id: string
  name: string
  description: string | null
  base_sale_price: number
  default_discount_type: 'amount' | 'percent'
  default_discount_value: number
}

const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('shop_crm')
const { locale } = useI18n()
const { current, currentId, isOwner, loading: shopLoading } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const search = ref('')
const editingId = ref<string | null>(null)
const archivingId = ref<string | null>(null)
const actionError = ref('')
const form = reactive({
  name: '', description: '', price: 0,
  discountType: 'amount' as 'amount' | 'percent', discountValue: 0,
})
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)

const copy = computed(() => isArabic.value ? {
  title: 'الخدمات', subtitle: 'أضف خدمات متجرك وأسعارها وخصوماتها الافتراضية.',
  saleLater: 'إصدار فواتير الخدمات قيد العمل. هذه الشاشة لإدارة كتالوج الخدمات.',
  add: 'إضافة خدمة', edit: 'تعديل', archive: 'أرشفة', cancel: 'إلغاء', save: 'حفظ الخدمة', saving: 'جاري الحفظ...',
  name: 'اسم الخدمة', description: 'وصف اختياري', price: 'سعر البيع', discountType: 'نوع الخصم',
  discountValue: 'قيمة الخصم', amount: 'مبلغ', percent: 'نسبة مئوية', net: 'السعر بعد الخصم',
  search: 'ابحث عن خدمة', empty: 'لا توجد خدمات بعد.', noResults: 'لا توجد نتائج مطابقة.',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم',
  readError: 'تعذّر تحميل الخدمات.', writeError: 'تعذّر حفظ الخدمة.', retry: 'إعادة المحاولة',
  invalid: 'اكتب اسمًا من حرفين إلى 160 حرفًا وسعرًا وخصمًا صحيحين غير سالبين.',
  limit: 'وصلت إلى حد الخدمات في خطتك.', access: 'انتهت التجربة أو ليست لديك صلاحية التعديل.',
  archiveConfirm: 'هل تريد أرشفة هذه الخدمة؟ سيبقى سجلّها محفوظًا.',
} : {
  title: 'Services', subtitle: 'Create services, prices and default discounts for your shop.',
  saleLater: 'Service invoicing is in progress. This screen manages the service catalog.',
  add: 'Add service', edit: 'Edit', archive: 'Archive', cancel: 'Cancel', save: 'Save service', saving: 'Saving...',
  name: 'Service name', description: 'Optional description', price: 'Sale price', discountType: 'Discount type',
  discountValue: 'Discount value', amount: 'Amount', percent: 'Percent', net: 'Net price',
  search: 'Search services', empty: 'No services yet.', noResults: 'No matching services.',
  noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  readError: 'Could not load services.', writeError: 'Could not save the service.', retry: 'Retry',
  invalid: 'Enter a name of 2–160 characters and valid nonnegative price and discount.',
  limit: 'Your plan service limit has been reached.', access: 'Your trial has ended or you do not have permission to edit.',
  archiveConfirm: 'Archive this service? Its history will be kept.',
})

const { data: services, pending, error, refresh } = useAsyncData(
  'shop-data:services', async () => {
    if (!currentId.value) return []
    const { data, error: queryError } = await supabase.from('services')
      .select('id,name,description,base_sale_price,default_discount_type,default_discount_value')
      .eq('shop_id', currentId.value).eq('is_active', true)
      .order('name', { ascending: true }).limit(500)
    if (queryError) throw queryError
    return (data ?? []) as Service[]
  }, { watch: [currentId], default: () => [] },
)

const filteredServices = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return services.value ?? []
  return (services.value ?? []).filter(service =>
    [service.name, service.description].some(value => value?.toLocaleLowerCase().includes(query)))
})

function netPrice(service: Service) {
  const price = Number(service.base_sale_price)
  const discount = Number(service.default_discount_value)
  return Math.max(0, service.default_discount_type === 'percent'
    ? price * (1 - discount / 100) : price - discount)
}

function money(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency: 'EGP', maximumFractionDigits: 2,
  }).format(value)
}

function resetForm() {
  editingId.value = null
  showForm.value = false
  actionError.value = ''
  form.name = ''
  form.description = ''
  form.price = 0
  form.discountType = 'amount'
  form.discountValue = 0
}

watch(currentId, resetForm)

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(service: Service) {
  editingId.value = service.id
  form.name = service.name
  form.description = service.description ?? ''
  form.price = Number(service.base_sale_price)
  form.discountType = service.default_discount_type
  form.discountValue = Number(service.default_discount_value)
  actionError.value = ''
  showForm.value = true
}

function readableError(message?: string) {
  if (message === 'SERVICE_LIMIT_REACHED') return copy.value.limit
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message === 'INVALID_SERVICE') return copy.value.invalid
  return message || copy.value.writeError
}

async function save() {
  if (!currentId.value || saving.value || !isOwner.value) return
  actionError.value = ''
  const price = Number(form.price)
  const discount = Number(form.discountValue)
  if (form.name.trim().length < 2 || form.name.trim().length > 160
    || form.description.trim().length > 1000
    || !Number.isFinite(price) || price < 0 || price > 999999999.99
    || !Number.isFinite(discount) || discount < 0
    || (form.discountType === 'percent' && discount > 100)
    || (form.discountType === 'amount' && discount > price)) {
    actionError.value = copy.value.invalid
    return
  }
  saving.value = true
  try {
    const { error: saveError } = await shopRpc.rpc('save_service', {
      p_shop_id: currentId.value, p_service_id: editingId.value,
      p_name: form.name.trim(), p_description: form.description.trim() || null,
      p_base_sale_price: price, p_discount_type: form.discountType, p_discount_value: discount,
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

async function archive(service: Service) {
  if (!currentId.value || archivingId.value || !isOwner.value) return
  if (!await confirmation.ask(copy.value.archiveConfirm)) return
  actionError.value = ''
  archivingId.value = service.id
  try {
    const { error: archiveError } = await shopRpc.rpc('archive_service', {
      p_shop_id: currentId.value, p_service_id: service.id,
    })
    if (archiveError) throw archiveError
    await refresh()
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    archivingId.value = null
  }
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
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm dark:bg-[var(--bs-status-info-bg)]">{{ copy.saleLater }}</p>
      <p v-if="actionError && !showForm" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>

      <BsDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.add" :dirty="formDirty" :pending="saving"><template #default="{ close }"><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <p v-if="actionError" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)] sm:col-span-2">{{ actionError }}</p>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.name }}<input v-model="form.name" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.description }}<textarea v-model="form.description" maxlength="1000" rows="2" class="ls-input" /></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.price }}<input v-model.number="form.price" type="number" min="0" max="999999999.99" step="0.01" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.discountType }}<select v-model="form.discountType" class="ls-input"><option value="amount">{{ copy.amount }}</option><option value="percent">{{ copy.percent }}</option></select></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.discountValue }}<input v-model.number="form.discountValue" type="number" min="0" step="0.01" required class="ls-input"></label>
        <div class="flex items-end gap-2"><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving">{{ saving ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" :disabled="saving" @click="close">{{ copy.cancel }}</button></div>
      </form></template></BsDialog>

      <section class="rounded-2xl border border-border bg-card p-5">
        <input v-model="search" type="search" :placeholder="copy.search" class="ls-input">
        <p v-if="pending" class="text-sm text-muted-foreground">{{ isArabic ? 'جاري التحميل...' : 'Loading...' }}</p>
        <div v-else-if="error" class="text-sm"><p>{{ copy.readError }}</p><button type="button" class="mt-2 font-bold underline" @click="refresh()">{{ copy.retry }}</button></div>
        <p v-else-if="!filteredServices.length" class="py-8 text-center text-sm text-muted-foreground">{{ services.length ? copy.noResults : copy.empty }}</p>
        <div v-else class="overflow-x-auto"><BsDataTable :value="filteredServices" data-key="id" :row-class="() => 'border-b border-border last:border-0'">
  <Column header-class="py-3 text-start" body-class="py-3 font-semibold">
    <template #header>{{ copy.name }}</template>
    <template #body="{ data: service }">{{ service.name }}<p v-if="service.description" class="text-xs font-normal text-muted-foreground">{{ service.description }}</p></template>
  </Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end">
    <template #header>{{ copy.price }}</template>
    <template #body="{ data: service }">{{ money(Number(service.base_sale_price)) }}</template>
  </Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end">
    <template #header>{{ copy.net }}</template>
    <template #body="{ data: service }">{{ money(netPrice(service)) }}</template>
  </Column>
  <Column header-class="py-3 text-end" body-class="space-x-2 py-3 text-end">
    <template #header>{{ copy.edit }}</template>
    <template #body="{ data: service }"><button v-if="isOwner" type="button" class="font-bold text-[var(--bs-link)]" @click="openEdit(service)">{{ copy.edit }}</button><button v-if="isOwner" type="button" class="font-bold text-[var(--bs-status-error)]" :disabled="archivingId === service.id" @click="archive(service)">{{ copy.archive }}</button></template>
  </Column>
</BsDataTable></div>
      </section>
    </template>
  </div>
</template>
