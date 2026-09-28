<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type Service = {
  id: string
  name: string
  description: string | null
  baseSalePrice: number
  defaultDiscountType: 'amount' | 'percent'
  defaultDiscountValue: number
  schedulingEnabled: boolean
  durationMinutes: number | null
  cleanupMinutes: number
  locationIds: string[]
  staffMembershipIds: string[]
}
type ServicePage = { items: Service[]; total: number; page: number; pageSize: number }
type SchedulingOptions = {
  locations: Array<{ id: string; name: string }>
  staff: Array<{ membershipId: string; name: string; locationIds: string[] }>
}

const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, loading: shopLoading } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const search = ref('')
const page = ref(1)
const pageSize = 20
const editingId = ref<string | null>(null)
const archivingId = ref<string | null>(null)
const actionError = ref('')
const form = reactive({
  name: '', description: '', price: 0,
  discountType: 'amount' as 'amount' | 'percent', discountValue: 0,
  schedulingEnabled: false, durationMinutes: 30 as number | null, cleanupMinutes: 0,
  locationIds: [] as string[], staffMembershipIds: [] as string[],
})
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)

const copy = computed(() => isArabic.value ? {
  title: 'الخدمات', subtitle: 'أدر الخدمات والأسعار، وفعّل الحجز فقط للخدمات التي تحتاج مواعيد.',
  add: 'إضافة خدمة', edit: 'تعديل', archive: 'أرشفة', cancel: 'إلغاء', save: 'حفظ الخدمة', saving: 'جاري الحفظ…',
  saved: 'تم حفظ الخدمة.', archived: 'تمت أرشفة الخدمة.', name: 'اسم الخدمة', description: 'وصف اختياري',
  price: 'سعر البيع', discountType: 'نوع الخصم', discountValue: 'قيمة الخصم', amount: 'مبلغ', percent: 'نسبة مئوية', net: 'السعر بعد الخصم',
  scheduling: 'الحجز بالمواعيد', schedulingHelp: 'حدد مدة الخدمة والفروع والموظفين المؤهلين. الخدمات الأخرى تستمر دون أي تغيير.',
  duration: 'مدة الخدمة (دقيقة)', cleanup: 'وقت التجهيز/التنظيف (دقيقة)', locations: 'الفروع المتاحة', staff: 'الموظفون المؤهلون', scheduleSummary: 'مدة الحجز',
  search: 'ابحث باسم الخدمة أو الوصف', empty: 'لا توجد خدمات بعد.', noResults: 'لا توجد نتائج مطابقة.',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم', loading: 'جاري التحميل…',
  readError: 'تعذّر تحميل الخدمات.', writeError: 'تعذّر حفظ الخدمة.', retry: 'إعادة المحاولة', previous: 'السابق', next: 'التالي',
  invalid: 'تحقق من الاسم والسعر والخصم. عند تفعيل المواعيد اختر مدة صحيحة وفرعًا وموظفًا واحدًا على الأقل.',
  limit: 'وصلت إلى حد الخدمات في خطتك.', access: 'انتهت التجربة أو ليست لديك صلاحية التعديل.',
  mismatch: 'يجب أن يكون كل موظف مؤهلًا للعمل في فرع واحد على الأقل من الفروع المختارة.',
  archiveConfirm: 'هل تريد أرشفة هذه الخدمة؟ ستبقى المبيعات السابقة محفوظة.',
} : {
  title: 'Services', subtitle: 'Manage services and prices, and opt only appointment-based services into scheduling.',
  add: 'Add service', edit: 'Edit', archive: 'Archive', cancel: 'Cancel', save: 'Save service', saving: 'Saving…',
  saved: 'Service saved.', archived: 'Service archived.', name: 'Service name', description: 'Optional description',
  price: 'Sale price', discountType: 'Discount type', discountValue: 'Discount value', amount: 'Amount', percent: 'Percent', net: 'Net price',
  scheduling: 'Appointment scheduling', schedulingHelp: 'Set service duration, available locations, and eligible staff. Other services remain unchanged.',
  duration: 'Service duration (minutes)', cleanup: 'Cleanup/buffer (minutes)', locations: 'Available locations', staff: 'Eligible staff', scheduleSummary: 'Booked time',
  search: 'Search service name or description', empty: 'No services yet.', noResults: 'No matching services.',
  noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard', loading: 'Loading…',
  readError: 'Could not load services.', writeError: 'Could not save the service.', retry: 'Retry', previous: 'Previous', next: 'Next',
  invalid: 'Check the name, price, and discount. Scheduled services also need a valid duration, location, and eligible staff member.',
  limit: 'Your plan service limit has been reached.', access: 'Your trial has ended or you do not have permission to edit.',
  mismatch: 'Every eligible staff member must work at one or more selected locations.',
  archiveConfirm: 'Archive this service? Historical sales will remain unchanged.',
})

const { data: permissionAccess } = useAsyncData('shop-data:service-permissions', async () => {
  if (!currentId.value) return { 'services.manage': false }
  const { data, error } = await shopRpc.rpc('shop_permission_access', {
    p_shop_id: currentId.value, p_permission_keys: ['services.manage'],
  })
  if (error) throw error
  return data
}, { watch: [currentId], default: () => ({ 'services.manage': false }) })
const canManage = computed(() => permissionAccess.value?.['services.manage'] === true)

const emptyPage = (): ServicePage => ({ items: [], total: 0, page: 1, pageSize })
const emptyOptions = (): SchedulingOptions => ({ locations: [], staff: [] })
const { data: servicesPage, pending, error, refresh } = useAsyncData(
  'shop-data:services', async (): Promise<ServicePage> => {
    if (!currentId.value) return emptyPage()
    const { data, error: queryError } = await shopRpc.rpc('list_services', {
      p_shop_id: currentId.value, p_search: search.value.trim() || null,
      p_page: page.value, p_page_size: pageSize,
    })
    if (queryError) throw queryError
    return data as ServicePage
  }, { watch: [currentId, search, page], default: emptyPage },
)
const { data: schedulingOptions, pending: schedulingOptionsPending, error: schedulingOptionsError } = useAsyncData(
  'shop-data:service-scheduling-options', async (): Promise<SchedulingOptions> => {
    if (!currentId.value || !canManage.value) return emptyOptions()
    const { data, error: optionsError } = await shopRpc.rpc('service_scheduling_options', { p_shop_id: currentId.value })
    if (optionsError) throw optionsError
    return data as SchedulingOptions
  }, { watch: [currentId, canManage], default: emptyOptions },
)
const services = computed(() => servicesPage.value.items)
const pageCount = computed(() => Math.max(1, Math.ceil(servicesPage.value.total / pageSize)))
const readErrorMessage = computed(() => error.value instanceof Error && error.value.message.includes('SHOP_PERMISSION_DENIED')
  ? copy.value.access : copy.value.readError)

watch(search, () => { page.value = 1 })
watch(currentId, () => { page.value = 1; resetForm() })

function netPrice(service: Service) {
  const price = Number(service.baseSalePrice)
  const discount = Number(service.defaultDiscountValue)
  return Math.max(0, service.defaultDiscountType === 'percent' ? price * (1 - discount / 100) : price - discount)
}
function money(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(value)
}
function resetForm() {
  editingId.value = null
  showForm.value = false
  actionError.value = ''
  Object.assign(form, { name: '', description: '', price: 0, discountType: 'amount', discountValue: 0,
    schedulingEnabled: false, durationMinutes: 30, cleanupMinutes: 0, locationIds: [], staffMembershipIds: [] })
}
function openCreate() {
  resetForm()
  if (schedulingOptions.value.locations.length === 1) form.locationIds = [schedulingOptions.value.locations[0]!.id]
  showForm.value = true
}
function openEdit(service: Service) {
  editingId.value = service.id
  Object.assign(form, { name: service.name, description: service.description ?? '', price: Number(service.baseSalePrice),
    discountType: service.defaultDiscountType, discountValue: Number(service.defaultDiscountValue),
    schedulingEnabled: service.schedulingEnabled, durationMinutes: service.durationMinutes ?? 30,
    cleanupMinutes: Number(service.cleanupMinutes), locationIds: [...service.locationIds], staffMembershipIds: [...service.staffMembershipIds] })
  actionError.value = ''
  showForm.value = true
}
function readableError(message?: string) {
  if (message === 'SERVICE_LIMIT_REACHED') return copy.value.limit
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message === 'SERVICE_STAFF_LOCATION_MISMATCH') return copy.value.mismatch
  if (message?.startsWith('INVALID_SERVICE')) return copy.value.invalid
  return message || copy.value.writeError
}
function isFormValid() {
  const price = Number(form.price); const discount = Number(form.discountValue)
  return form.name.trim().length >= 2 && form.name.trim().length <= 160 && form.description.trim().length <= 1000
    && Number.isFinite(price) && price >= 0 && price <= 999999999.99 && Number.isFinite(discount) && discount >= 0
    && (form.discountType !== 'percent' || discount <= 100) && (form.discountType !== 'amount' || discount <= price)
    && (!form.schedulingEnabled || (Number.isInteger(Number(form.durationMinutes)) && Number(form.durationMinutes) >= 5
      && Number(form.durationMinutes) <= 1440 && Number.isInteger(form.cleanupMinutes) && form.cleanupMinutes >= 0
      && form.cleanupMinutes <= 240 && form.locationIds.length > 0 && form.staffMembershipIds.length > 0))
}
async function save() {
  if (!currentId.value || saving.value || !canManage.value) return
  actionError.value = ''
  if (!isFormValid()) { actionError.value = copy.value.invalid; return }
  saving.value = true
  try {
    const { error: saveError } = await shopRpc.rpc('save_service', {
      p_shop_id: currentId.value, p_service_id: editingId.value, p_name: form.name.trim(),
      p_description: form.description.trim() || null, p_base_sale_price: Number(form.price),
      p_discount_type: form.discountType, p_discount_value: Number(form.discountValue),
      p_scheduling_enabled: form.schedulingEnabled,
      p_duration_minutes: form.schedulingEnabled ? Number(form.durationMinutes) : null,
      p_cleanup_minutes: form.schedulingEnabled ? Number(form.cleanupMinutes) : 0,
      p_location_ids: form.schedulingEnabled ? form.locationIds : [],
      p_staff_membership_ids: form.schedulingEnabled ? form.staffMembershipIds : [],
    })
    if (saveError) throw saveError
    resetForm(); await refresh(); pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { actionError.value = readableError(caught instanceof Error ? caught.message : undefined) }
  finally { saving.value = false }
}
async function archive(service: Service) {
  if (!currentId.value || archivingId.value || !canManage.value || !await confirmation.ask(copy.value.archiveConfirm)) return
  actionError.value = ''; archivingId.value = service.id
  try {
    const { error: archiveError } = await shopRpc.rpc('archive_service', { p_shop_id: currentId.value, p_service_id: service.id })
    if (archiveError) throw archiveError
    await refresh(); pushToast({ tone: 'success', title: copy.value.archived })
  } catch (caught) { actionError.value = readableError(caught instanceof Error ? caught.message : undefined) }
  finally { archivingId.value = null }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <BsButton v-if="current && canManage" type="button" @click="openCreate">{{ copy.add }}</BsButton>
    </header>

    <div v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm"><p>{{ copy.noShop }}</p><NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.dashboard }}</NuxtLink></div>
    <template v-else-if="current">
      <p v-if="actionError && !showForm" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>

      <BsDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.add" :dirty="formDirty" :pending="saving">
        <template #default="{ close }">
          <BsForm class="grid gap-4 sm:grid-cols-2" :pending="saving" :error="actionError" @submit="save">
            <label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.name }}<input v-model="form.name" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
            <label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.description }}<textarea v-model="form.description" maxlength="1000" rows="2" class="ls-input" /></label>
            <label class="grid gap-2 text-sm font-bold">{{ copy.price }}<input v-model.number="form.price" type="number" min="0" max="999999999.99" step="0.01" required class="ls-input"></label>
            <label class="grid gap-2 text-sm font-bold">{{ copy.discountType }}<select v-model="form.discountType" class="ls-input"><option value="amount">{{ copy.amount }}</option><option value="percent">{{ copy.percent }}</option></select></label>
            <label class="grid gap-2 text-sm font-bold">{{ copy.discountValue }}<input v-model.number="form.discountValue" type="number" min="0" step="0.01" required class="ls-input"></label>
            <fieldset class="rounded-xl border border-border p-4 sm:col-span-2">
              <label class="flex items-center gap-3 font-bold"><input v-model="form.schedulingEnabled" type="checkbox">{{ copy.scheduling }}</label>
              <p class="mt-2 text-sm text-muted-foreground">{{ copy.schedulingHelp }}</p>
              <p v-if="schedulingOptionsPending" role="status" class="mt-3 text-sm text-muted-foreground">{{ copy.loading }}</p>
              <p v-else-if="schedulingOptionsError" role="alert" class="mt-3 text-sm text-[var(--bs-status-error)]">{{ readErrorMessage }}</p>
              <div v-if="form.schedulingEnabled" class="mt-4 grid gap-4 sm:grid-cols-2">
                <label class="grid gap-2 text-sm font-bold">{{ copy.duration }}<input v-model.number="form.durationMinutes" type="number" min="5" max="1440" step="1" required class="ls-input"></label>
                <label class="grid gap-2 text-sm font-bold">{{ copy.cleanup }}<input v-model.number="form.cleanupMinutes" type="number" min="0" max="240" step="1" required class="ls-input"></label>
                <fieldset><legend class="text-sm font-bold">{{ copy.locations }}</legend><label v-for="location in schedulingOptions.locations" :key="location.id" class="mt-2 flex items-center gap-2 text-sm"><input v-model="form.locationIds" type="checkbox" :value="location.id">{{ location.name }}</label></fieldset>
                <fieldset><legend class="text-sm font-bold">{{ copy.staff }}</legend><label v-for="member in schedulingOptions.staff" :key="member.membershipId" class="mt-2 flex items-center gap-2 text-sm"><input v-model="form.staffMembershipIds" type="checkbox" :value="member.membershipId">{{ member.name }}</label></fieldset>
              </div>
            </fieldset>
            <div class="flex items-end gap-2 sm:col-span-2"><BsButton type="submit" :pending="saving">{{ saving ? copy.saving : copy.save }}</BsButton><BsButton type="button" severity="secondary" :disabled="saving" @click="close">{{ copy.cancel }}</BsButton></div>
          </BsForm>
        </template>
      </BsDialog>

      <section class="rounded-2xl border border-border bg-card p-5">
        <input v-model="search" type="search" :placeholder="copy.search" class="ls-input" :aria-label="copy.search">
        <p v-if="pending" role="status" class="py-5 text-sm text-muted-foreground">{{ copy.loading }}</p>
        <div v-else-if="error" role="alert" class="py-5 text-sm"><p>{{ readErrorMessage }}</p><BsButton type="button" severity="secondary" class="mt-2" @click="refresh()">{{ copy.retry }}</BsButton></div>
        <p v-else-if="!services.length" class="py-8 text-center text-sm text-muted-foreground">{{ servicesPage.total ? copy.noResults : copy.empty }}</p>
        <div v-else class="overflow-x-auto"><BsDataTable :value="services" data-key="id" :row-class="() => 'border-b border-border last:border-0'">
          <Column header-class="py-3 text-start" body-class="py-3 font-semibold"><template #header>{{ copy.name }}</template><template #body="{ data: service }">{{ service.name }}<p v-if="service.description" class="text-xs font-normal text-muted-foreground">{{ service.description }}</p></template></Column>
          <Column header-class="py-3 text-end" body-class="py-3 text-end"><template #header>{{ copy.net }}</template><template #body="{ data: service }">{{ money(netPrice(service)) }}</template></Column>
          <Column header-class="py-3 text-start" body-class="py-3 text-start"><template #header>{{ copy.scheduleSummary }}</template><template #body="{ data: service }"><span v-if="service.schedulingEnabled">{{ service.durationMinutes }} + {{ service.cleanupMinutes }} {{ isArabic ? 'دقيقة' : 'min' }}</span><span v-else>—</span></template></Column>
          <Column header-class="py-3 text-end" body-class="space-x-2 py-3 text-end"><template #header>{{ copy.edit }}</template><template #body="{ data: service }"><button v-if="canManage" type="button" class="font-bold text-[var(--bs-link)]" @click="openEdit(service)">{{ copy.edit }}</button><button v-if="canManage" type="button" class="font-bold text-[var(--bs-status-error)]" :disabled="archivingId === service.id" @click="archive(service)">{{ copy.archive }}</button></template></Column>
        </BsDataTable></div>
        <nav v-if="servicesPage.total > pageSize" class="mt-4 flex items-center justify-between gap-3" :aria-label="copy.title"><BsButton type="button" severity="secondary" :disabled="page <= 1 || pending" @click="page--">{{ copy.previous }}</BsButton><span class="text-sm text-muted-foreground">{{ page }} / {{ pageCount }}</span><BsButton type="button" severity="secondary" :disabled="page >= pageCount || pending" @click="page++">{{ copy.next }}</BsButton></nav>
      </section>
    </template>
  </div>
</template>
