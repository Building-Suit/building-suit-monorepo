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
  categoryId: string | null
  categoryName: string | null
}
type Category = { id: string; name: string }
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
const categoryFilter = ref('')
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
  categoryId: '',
})
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)

const copy = computed(() => isArabic.value ? {
  title: 'الخدمات', subtitle: 'ظبط الخدمات وأسعارها، وشغّل الحجز بس للخدمات اللي محتاجة مواعيد.',
  add: 'إضافة خدمة', edit: 'تعديل', archive: 'أرشفة', cancel: 'إلغاء', save: 'حفظ الخدمة', saving: 'بنحفظ…',
  saved: 'اتحفظت الخدمة.', archived: 'اتأرشفت الخدمة.', name: 'اسم الخدمة', description: 'وصف اختياري',
  price: 'سعر البيع', discountType: 'نوع الخصم', discountValue: 'قيمة الخصم', amount: 'مبلغ', percent: 'نسبة مئوية', net: 'السعر بعد الخصم', category: 'التصنيف', allCategories: 'كل التصنيفات', import: 'الاستيراد والإعداد',
  scheduling: 'الحجز بالمواعيد', schedulingHelp: 'حدد مدة الخدمة والفروع والموظفين اللي يقدّموا الخدمة. باقي الخدمات هتفضل زي ما هي.',
  duration: 'مدة الخدمة (دقيقة)', cleanup: 'وقت التجهيز/التنظيف (دقيقة)', locations: 'الفروع المتاحة', staff: 'الموظفون المؤهلون', scheduleSummary: 'مدة الحجز',
  search: 'دوّر باسم الخدمة أو الوصف', empty: 'مفيش خدمات لسه.', noResults: 'مفيش نتايج مطابقة.',
  noShop: 'اعمل متجر الأول من لوحة التحكم.', dashboard: 'لوحة التحكم', loading: 'بنحمّل…',
  readError: 'مقدرناش نحمّل الخدمات.', writeError: 'مقدرناش نحفظ الخدمة.', retry: 'حاول تاني', previous: 'السابق', next: 'التالي',
  invalid: 'تحقق من الاسم والسعر والخصم. عند تفعيل المواعيد اختر مدة صحيحة وفرعًا وموظفًا واحدًا على الأقل.',
  limit: 'وصلت إلى حد الخدمات في خطتك.', access: 'الفترة التجريبية خلصت أو معندكش صلاحية التعديل.',
  mismatch: 'يجب أن يكون كل موظف مؤهلًا للعمل في فرع واحد على الأقل من الفروع المختارة.',
  archiveConfirm: 'تأرشف الخدمة دي؟ المبيعات القديمة هتفضل محفوظة.',
} : {
  title: 'Services', subtitle: 'Manage services and prices, and opt only appointment-based services into scheduling.',
  add: 'Add service', edit: 'Edit', archive: 'Archive', cancel: 'Cancel', save: 'Save service', saving: 'Saving…',
  saved: 'Service saved.', archived: 'Service archived.', name: 'Service name', description: 'Optional description',
  price: 'Sale price', discountType: 'Discount type', discountValue: 'Discount value', amount: 'Amount', percent: 'Percent', net: 'Net price', category: 'Category', allCategories: 'All categories', import: 'Import & setup',
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
const { data: categories } = useAsyncData(() => `shop-data:service-categories:${currentId.value ?? 'none'}`, async () => {
  if (!currentId.value) return []
  const { data, error } = await shopRpc.rpc('list_catalog_categories', { p_shop_id: currentId.value })
  if (error) throw error
  return data as Category[]
}, { watch: [currentId], default: () => [] })

const emptyPage = (): ServicePage => ({ items: [], total: 0, page: 1, pageSize })
const emptyOptions = (): SchedulingOptions => ({ locations: [], staff: [] })
const { data: servicesPage, pending, error, refresh } = useAsyncData(
  'shop-data:services', async (): Promise<ServicePage> => {
    if (!currentId.value) return emptyPage()
    const { data, error: queryError } = await shopRpc.rpc('list_services_by_category', {
      p_shop_id: currentId.value, p_search: search.value.trim() || null,
      p_category_id: categoryFilter.value || null,
      p_page: page.value, p_page_size: pageSize,
    })
    if (queryError) throw queryError
    return data as ServicePage
  }, { watch: [currentId, search, categoryFilter, page], default: emptyPage },
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
const readErrorMessage = computed(() => error.value instanceof Error && error.value.message.includes('SHOP_PERMISSION_DENIED')
  ? copy.value.access : copy.value.readError)

watch([search, categoryFilter], () => { page.value = 1 })
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
    schedulingEnabled: false, durationMinutes: 30, cleanupMinutes: 0, locationIds: [], staffMembershipIds: [], categoryId: '' })
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
    cleanupMinutes: Number(service.cleanupMinutes), locationIds: [...service.locationIds], staffMembershipIds: [...service.staffMembershipIds], categoryId: service.categoryId ?? '' })
  actionError.value = ''
  showForm.value = true
}
function readableError(message?: string) {
  const quotaMessage = planQuotaMessage(message, locale.value)
  if (quotaMessage) return quotaMessage
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
    const { error: saveError } = await shopRpc.rpc('save_service_with_category', {
      p_shop_id: currentId.value, p_service_id: editingId.value, p_name: form.name.trim(),
      p_description: form.description.trim() || null, p_base_sale_price: Number(form.price),
      p_discount_type: form.discountType, p_discount_value: Number(form.discountValue),
      p_scheduling_enabled: form.schedulingEnabled,
      p_duration_minutes: form.schedulingEnabled ? Number(form.durationMinutes) : null,
      p_cleanup_minutes: form.schedulingEnabled ? Number(form.cleanupMinutes) : 0,
      p_location_ids: form.schedulingEnabled ? form.locationIds : [],
      p_staff_membership_ids: form.schedulingEnabled ? form.staffMembershipIds : [],
      p_category_id: form.categoryId || null,
    })
    if (saveError) throw saveError
    resetForm(); await refresh(); pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { actionError.value = planQuotaMessage(caught, locale.value) ?? readableError(caught instanceof Error ? caught.message : undefined) }
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
  <BsStack>
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsInline v-if="current">
          <BsLink to="/catalog-import">{{ copy.import }}</BsLink>
        </BsInline>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!current && !shopLoading" padding="md">
      <BsText as="p">{{ copy.noShop }}</BsText>
      <BsLink to="/dashboard">{{ copy.dashboard }}</BsLink>
    </BsPanel>
    <template v-else-if="current">
      <BsText v-if="actionError && !showForm" role="alert" as="p" size="sm" tone="danger">{{ actionError }}</BsText>
      <BsRecordActionDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.add" :dirty="formDirty" :pending="saving" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="save">
        <BsField v-slot="field" :label="copy.name">
          <BsInput :id="field.id" v-model="form.name" :aria-describedby="field.describedby" type="text" :minlength="2" :maxlength="160" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.description">
          <BsTextarea :id="field.id" v-model="form.description" :aria-describedby="field.describedby" :maxlength="1000" :rows="2"/>
        </BsField>
        <BsField v-slot="field" :label="copy.price">
          <BsInput :id="field.id" v-model.number="form.price" :aria-describedby="field.describedby" type="number" :min="0" :max="999999999.99" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.discountType">
          <BsSelect v-model="form.discountType" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.discountType" :options="[{ value: 'amount', label: (copy.amount), disabled: false }, { value: 'percent', label: (copy.percent), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
        </BsField>
        <BsField v-slot="field" :label="copy.discountValue">
          <BsInput :id="field.id" v-model.number="form.discountValue" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.category">
          <BsSelect v-model="form.categoryId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.category" :options="[{ value: '', label: (copy.allCategories), disabled: false }, ...(categories).map(category => ({ value: category.id, label: (category.name), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
        </BsField>
        <BsFieldGroup :legend="''">
          <BsCheckbox  v-model="form.schedulingEnabled" :label="copy.scheduling" />
          <BsText as="p" size="sm" tone="muted">{{ copy.schedulingHelp }}</BsText>
          <BsText v-if="schedulingOptionsPending" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
          <BsText v-else-if="schedulingOptionsError" role="alert" as="p" size="sm" tone="danger">{{ readErrorMessage }}</BsText>
          <BsGrid v-if="form.schedulingEnabled" :columns="2">
            <BsField v-slot="field" :label="copy.duration">
              <BsInput :id="field.id" v-model.number="form.durationMinutes" :aria-describedby="field.describedby" type="number" :min="5" :max="1440" :step="1" required/>
            </BsField>
            <BsField v-slot="field" :label="copy.cleanup">
              <BsInput :id="field.id" v-model.number="form.cleanupMinutes" :aria-describedby="field.describedby" type="number" :min="0" :max="240" :step="1" required/>
            </BsField>
            <BsFieldGroup :legend="(copy.locations)">
              <BsCheckbox v-for="location in schedulingOptions.locations" :key="location.id" v-model="form.locationIds" :value="location.id" :label="location.name" />
            </BsFieldGroup>
            <BsFieldGroup :legend="(copy.staff)">
              <BsCheckbox v-for="member in schedulingOptions.staff" :key="member.membershipId" v-model="form.staffMembershipIds" :value="member.membershipId" :label="member.name" />
            </BsFieldGroup>
          </BsGrid>
        </BsFieldGroup>
      </BsRecordActionDialog>
      <BsPanel padding="md">
        <BsDataTable :value="services" :label="copy.title" :loading="pending" :error="error ? readErrorMessage : null" :capabilities="{ insert: canManage, edit: canManage, archive: canManage }" :action-labels="{ insert: copy.add, edit: copy.edit, archive: copy.archive }" :row-action-pending="(action, service) => action === 'archive' && archivingId === service.id" searchable :search-label="copy.search" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="servicesPage.total" :always-show-paginator="false" data-key="id" :columns="[{ key: 'column0', header: (copy.name) }, { key: 'column1', header: (copy.category) }, { key: 'column2', header: (copy.net), align: 'end' }, { key: 'column3', header: (copy.scheduleSummary) }]" @search="value => search = value" @page="page = $event.page + 1" @retry="refresh()" @create="openCreate" @edit="openEdit" @archive="archive">
          <template #cell-column0="{ row: service }">{{ service.name }}<BsText v-if="service.description" as="p" size="xs" tone="muted" emphasis="semibold">{{ service.description }}</BsText>
          </template>
          <template #cell-column1="{ row: service }">{{ service.categoryName || '—' }}</template>
          <template #cell-column2="{ row: service }">{{ money(netPrice(service)) }}</template>
          <template #cell-column3="{ row: service }">
            <BsText v-if="service.schedulingEnabled" as="span">{{ service.durationMinutes }} + {{ service.cleanupMinutes }} {{ isArabic ? 'دقيقة' : 'min' }}</BsText>
            <BsText v-else as="span">—</BsText>
          </template>
          <template #filters>
            <BsSelect v-model="categoryFilter" :label="copy.category" :options="[{ id: '', name: copy.allCategories }, ...categories]" option-label="name" option-value="id"/>
          </template>
          <template #empty>
            <BsStateSurface state="empty" :title="servicesPage.total ? copy.noResults : copy.empty"/>
          </template>
        </BsDataTable>
      </BsPanel>
    </template>
  </BsStack>
</template>
