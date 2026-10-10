<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { PlanUsageResource } from '~/types/plans'
import type { ReceiptPaperSize } from '~/types/receipt'
import type { BusinessMode } from '~/utils/businessMode'
import type { ShopLocation } from '~/composables/useShop'
import { BUSINESS_MODES } from '~/utils/businessMode'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const confirmation = useConfirmation()
const { locale } = useI18n()
const { current, currentId, locations, loading, loadError: shopError, reload, loadLocations } = useShop()
const { success } = useToasts()
const ui = useUiCopy()
const profileForm = reactive({ displayName: '' })
const profilePending = ref(false)
const profileError = ref('')
const profileSuccess = ref('')
const selectedMode = ref<BusinessMode>('mixed')
const pending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const locationPending = ref(false)
const locationError = ref('')
const editingLocationId = ref<string | null>(null)
const locationForm = reactive({ name: '', code: '', address: '', phone: '' })
const { visible: locationDialogOpen, dirty: locationDirty } = useRecordAction(() => locationForm)
const receiptForm = reactive({ displayName: '', address: '', phone: '', footer: '', paperSize: 'thermal_80' as ReceiptPaperSize })
const receiptPending = ref(false)
const receiptError = ref('')
const receiptSuccess = ref('')
const isArabic = computed(() => locale.value === 'ar')
const { data: permissionAccess } = useAsyncData('shop-data:settings-permissions', async () => {
  if (!currentId.value) return { 'settings.manage': false }
  const { data, error } = await shopRpc.rpc('shop_permission_access', {
    p_shop_id: currentId.value, p_permission_keys: ['settings.manage'],
  })
  if (error) throw error
  return data
}, { watch: [currentId], default: () => ({ 'settings.manage': false }) })
const canManage = computed(() => permissionAccess.value?.['settings.manage'] === true)
const { data: locationUsage, refresh: refreshLocationUsage } = useAsyncData(
  () => `shop-data:settings-location-usage:${currentId.value ?? 'none'}`,
  async (): Promise<PlanUsageResource | null> => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('shop_plan_usage', { p_shop_id: currentId.value })
    if (error) throw error
    const resources = (data as { resources?: PlanUsageResource[] } | null)?.resources ?? []
    return resources.find(resource => resource.resource === 'active_locations') ?? null
  }, { watch: [currentId], default: () => null },
)
const locationCapacityFull = computed(() => locationUsage.value?.atLimit === true)
type ReceiptSettings = { displayName: string; address: string | null; phone: string | null; footer: string | null; paperSize: ReceiptPaperSize; canManage: boolean }
const { data: receiptSettings, pending: receiptLoading, error: receiptLoadError, refresh: refreshReceiptSettings } = useAsyncData(
  () => `shop-data:receipt-settings:${currentId.value ?? 'none'}`,
  async (): Promise<ReceiptSettings | null> => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('receipt_settings', { p_shop_id: currentId.value })
    if (error) throw error
    return data as ReceiptSettings
  }, { watch: [currentId], default: () => null },
)

const copy = computed(() => isArabic.value ? {
  title: 'إعدادات النشاط', subtitle: 'ظبط طريقة الشغل المناسبة لنشاطك.',
  profileTitle: 'ملف المتجر', profileHelp: 'هذا اسم المتجر الذي يظهر في التنقل والقوائم والسجلات المستقبلية المناسبة. لا يغيّر اسم حسابك الشخصي أو بريدك الإلكتروني أو المستندات السابقة.',
  shopDisplayName: 'اسم المتجر', profileLocationHelp: 'عنوان الفرع الرئيسي وهاتفه بيانات فرع. عدّلهما من قسم فروع النشاط أدناه حتى لا تتكرر بيانات متعارضة.',
  manageLocations: 'إدارة بيانات الفروع', saveProfile: 'حفظ ملف المتجر', savingProfile: 'بنحفظ…', profileSaved: 'اتحدّث ملف المتجر.', profileFailed: 'مقدرناش نحدّث ملف المتجر. حاول تاني.',
  profileOwnerOnly: 'محتاج صلاحية إدارة إعدادات النشاط عشان تعدّل ملف المتجر.',
  modeTitle: 'طريقة تشغيل النشاط', modeHelp: 'تتحكم هذه الإعدادات في ظهور مسارات المنتجات والمخزون والخدمات فقط. لا تغيّر خطة الاشتراك أو الحصص أو صلاحيات المستخدمين.',
  product: 'منتجات ومخزون', productBody: 'إظهار المنتجات والمخزون والمشتريات والموردين وإخفاء مسار الخدمات.',
  service: 'خدمات فقط', serviceBody: 'إظهار الخدمات دون فرض إنشاء منتجات أو سجلات مخزون.',
  mixed: 'منتجات وخدمات', mixedBody: 'إظهار مسارات المنتجات والمخزون والخدمات معًا.',
  preserve: 'لو غيّرت الطريقة، المنتجات والخدمات والمخزون والمشتريات وكل السجلات القديمة هتفضل محفوظة، وهتظهر تاني لما تشغّل المسار.',
  ownerOnly: 'محتاج صلاحية إدارة إعدادات النشاط. تقدر تشوف الطريقة الحالية من غير ما تعدّلها.',
  save: 'حفظ طريقة التشغيل', saving: 'بنحفظ…', success: 'اتحدّثت طريقة تشغيل النشاط.',
  failed: 'مقدرناش نحدّث طريقة تشغيل النشاط. حاول تاني.',
  locationsTitle: 'فروع النشاط', locationsHelp: 'ضيف فرع تاني وتحكّم في الفروع الشغالة من غير ما تحذف السجل القديم.',
  defaultLocation: 'افتراضي', archivedLocation: 'مؤرشف', locationName: 'اسم الفرع', locationCode: 'الرمز', locationAddress: 'العنوان', locationPhone: 'الهاتف',
  addLocation: 'إضافة فرع', editLocation: 'تعديل', saveLocation: 'حفظ الفرع', cancelEdit: 'إلغاء', addingLocation: 'بنحفظ…', archiveLocation: 'أرشفة', restoreLocation: 'استعادة', locationSaved: 'اتحفظ الفرع.', locationFailed: 'مقدرناش نحفظ الفرع.',
  locationCapacity: 'تستخدم {used} من {limit} فروع نشطة.', locationUnlimited: '{used} فروع نشطة · بلا حد', locationLimit: 'وصلت إلى حد الفروع النشطة في خطتك. أرشف فرعًا غير مستخدم أو اطلب خطة أعلى من الاشتراك والفوترة لإضافة أو استعادة فرع.', upgradePlan: 'فتح الاشتراك والفوترة',
  archiveLocationConfirm: 'تأرشف الفرع ده؟ المبيعات والمدفوعات والمواعيد القديمة هتفضل ظاهرة في السجل والتقارير.',
  receiptTitle: 'إعدادات الإيصال', receiptHelp: 'تُحفظ هذه البيانات داخل كل إيصال عند سداد البيعة بالكامل. التعديلات التالية لا تغيّر الإيصالات السابقة.',
  receiptDisplayName: 'اسم النشاط على الإيصال', receiptAddress: 'عنوان النشاط', receiptPhone: 'هاتف النشاط', receiptFooter: 'رسالة أسفل الإيصال',
  receiptPaper: 'المقاس الافتراضي', thermal80: 'حراري 80 مم', a4: 'A4 / PDF', saveReceipt: 'حفظ إعدادات الإيصال', savingReceipt: 'بنحفظ…',
  receiptSaved: 'اتحفظت إعدادات الإيصال للمبيعات الجديدة.', receiptFailed: 'مقدرناش نحمّل أو نحفظ إعدادات الإيصال.', receiptOwnerOnly: 'محتاج صلاحية إدارة الإعدادات عشان تعدّل شكل الإيصالات الجديدة.',
} : {
  title: 'Business settings', subtitle: 'Choose the workflows that fit this business.',
  profileTitle: 'Shop profile', profileHelp: 'This Shop name appears in navigation, selectors, and appropriate future records. It does not change your personal account name or email, or rewrite past documents.',
  shopDisplayName: 'Shop display name', profileLocationHelp: 'The main-location address and phone are location data. Edit them in Business locations below so conflicting copies are not created.',
  manageLocations: 'Manage location details', saveProfile: 'Save Shop profile', savingProfile: 'Saving…', profileSaved: 'Shop profile updated.', profileFailed: 'Could not update the Shop profile. Try again.',
  profileOwnerOnly: 'Business-settings permission is required to edit the Shop profile.',
  modeTitle: 'Business operation mode', modeHelp: 'This setting controls product, stock, and service workflow visibility only. It does not change the subscription plan, quotas, or user permissions.',
  product: 'Products and stock', productBody: 'Show products, inventory, purchasing, and supplier workflows while hiding services.',
  service: 'Services only', serviceBody: 'Show services without requiring products or stock records.',
  mixed: 'Products and services', mixedBody: 'Show product, stock, and service workflows together.',
  preserve: 'Changing mode preserves all existing products, services, inventory, purchases, and historical records. They appear again when their workflow is re-enabled.',
  ownerOnly: 'Business-settings permission is required. You can view the current mode without editing it.',
  save: 'Save operation mode', saving: 'Saving…', success: 'Business operation mode updated.',
  failed: 'Could not update the business operation mode. Try again.',
  locationsTitle: 'Business locations', locationsHelp: 'Add the second branch and manage active locations without deleting history.',
  defaultLocation: 'Default', archivedLocation: 'Archived', locationName: 'Location name', locationCode: 'Code', locationAddress: 'Address', locationPhone: 'Phone',
  addLocation: 'Add location', editLocation: 'Edit', saveLocation: 'Save location', cancelEdit: 'Cancel', addingLocation: 'Saving…', archiveLocation: 'Archive', restoreLocation: 'Restore', locationSaved: 'Location saved.', locationFailed: 'Could not save the location.',
  locationCapacity: 'Using {used} of {limit} active locations.', locationUnlimited: '{used} active locations · unlimited', locationLimit: 'Your plan’s active-location limit is full. Archive an unused location or request a higher plan from Subscription & billing to add or restore one.', upgradePlan: 'Open Subscription & billing',
  archiveLocationConfirm: 'Archive this location? Its historical sales, payments, and appointments will remain available in history and reports.',
  receiptTitle: 'Receipt settings', receiptHelp: 'These values are captured inside each receipt when a sale becomes fully paid. Later changes never rewrite previous receipts.',
  receiptDisplayName: 'Business name on receipt', receiptAddress: 'Business address', receiptPhone: 'Business phone', receiptFooter: 'Receipt footer message',
  receiptPaper: 'Default paper size', thermal80: '80 mm thermal', a4: 'A4 / PDF', saveReceipt: 'Save receipt settings', savingReceipt: 'Saving…',
  receiptSaved: 'Receipt settings saved for future sales.', receiptFailed: 'Could not load or save receipt settings.', receiptOwnerOnly: 'Settings permission is required to change future receipt presentation.',
})

const locationUsageLabel = computed(() => {
  const usage = locationUsage.value
  if (!usage) return ''
  const template = usage.unlimited ? copy.value.locationUnlimited : copy.value.locationCapacity
  return template.replace('{used}', String(usage.used)).replace('{limit}', String(usage.limit ?? ''))
})

const modeOptions = computed(() => BUSINESS_MODES.map(value => ({
  value,
  label: copy.value[value],
  body: copy.value[`${value}Body` as const],
})))

watch([currentId, () => current.value?.business_mode], ([, mode]) => {
  selectedMode.value = mode ?? 'mixed'
  errorMessage.value = ''; successMessage.value = ''
  cancelLocationEdit()
}, { immediate: true })

watch([currentId, () => current.value?.name], ([, name]) => {
  profileForm.displayName = name ?? ''
  profileError.value = ''
  profileSuccess.value = ''
}, { immediate: true })

watch(selectedMode, () => {
  errorMessage.value = ''
  successMessage.value = ''
})

watch(receiptSettings, (settings) => {
  if (!settings) return
  Object.assign(receiptForm, {
    displayName: settings.displayName,
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    footer: settings.footer ?? '',
    paperSize: settings.paperSize,
  })
  receiptError.value = ''
  receiptSuccess.value = ''
}, { immediate: true })

async function saveMode() {
  if (pending.value || !current.value || !canManage.value || selectedMode.value === current.value.business_mode) return
  pending.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { error } = await shopRpc.rpc('set_shop_business_mode', {
      p_shop_id: current.value.id,
      p_business_mode: selectedMode.value,
    })
    if (error) throw error
    await reload()
    successMessage.value = copy.value.success
    modeAction.complete()
    success(copy.value.success)
  } catch {
    errorMessage.value = copy.value.failed
  } finally {
    pending.value = false
  }
}

async function saveProfile() {
  const displayName = profileForm.displayName.trim()
  if (!current.value || !canManage.value || profilePending.value
    || displayName.length < 2 || displayName === current.value.name) return
  profilePending.value = true
  profileError.value = ''
  profileSuccess.value = ''
  try {
    const { error } = await shopRpc.rpc('save_shop_profile', {
      p_shop_id: current.value.id,
      p_display_name: displayName,
    })
    if (error) throw error
    await reload()
    profileSuccess.value = copy.value.profileSaved
    profileAction.complete()
    success(copy.value.profileSaved)
  } catch {
    profileError.value = copy.value.profileFailed
  } finally {
    profilePending.value = false
  }
}

function editLocation(location: ShopLocation) {
  editingLocationId.value = location.id
  Object.assign(locationForm, {
    name: location.name, code: location.code ?? '', address: location.address ?? '', phone: location.phone ?? '',
  })
  locationError.value = ''
  locationDialogOpen.value = true
}

function createLocation() {
  cancelLocationEdit()
  locationDialogOpen.value = true
}

function cancelLocationEdit() {
  locationDialogOpen.value = false
  editingLocationId.value = null
  Object.assign(locationForm, { name: '', code: '', address: '', phone: '' })
  locationError.value = ''
}

async function saveLocation() {
  const name = locationForm.name.trim()
  if (!currentId.value || !canManage.value || locationPending.value || name.length < 2
    || (!editingLocationId.value && locationCapacityFull.value)) return
  locationPending.value = true
  locationError.value = ''
  try {
    const { error } = await shopRpc.rpc('save_shop_location', {
      p_shop_id: currentId.value,
      p_location_id: editingLocationId.value,
      p_name: name,
      p_code: locationForm.code.trim() || null,
      p_address: locationForm.address.trim() || null,
      p_phone: locationForm.phone.trim() || null,
    })
    if (error) throw error
    cancelLocationEdit()
    await Promise.all([loadLocations(), refreshLocationUsage()])
    success(copy.value.locationSaved)
  } catch (error) {
    locationError.value = planQuotaMessage(error, locale.value) ?? copy.value.locationFailed
  } finally {
    locationPending.value = false
  }
}

async function archiveLocation(locationId: string) {
  if (!currentId.value || !canManage.value || locationPending.value
    || !await confirmation.ask(copy.value.archiveLocationConfirm)) return
  locationPending.value = true
  locationError.value = ''
  try {
    const { error } = await shopRpc.rpc('archive_shop_location', {
      p_shop_id: currentId.value,
      p_location_id: locationId,
    })
    if (error) throw error
    await Promise.all([loadLocations(), refreshLocationUsage()])
  } catch {
    locationError.value = copy.value.locationFailed
  } finally {
    locationPending.value = false
  }
}

async function restoreLocation(locationId: string) {
  if (!currentId.value || !canManage.value || locationPending.value || locationCapacityFull.value) return
  locationPending.value = true
  locationError.value = ''
  try {
    const { error } = await shopRpc.rpc('restore_shop_location', {
      p_shop_id: currentId.value,
      p_location_id: locationId,
    })
    if (error) throw error
    await Promise.all([loadLocations(), refreshLocationUsage()])
  } catch (error) {
    locationError.value = planQuotaMessage(error, locale.value) ?? copy.value.locationFailed
    await refreshLocationUsage()
  } finally {
    locationPending.value = false
  }
}

async function saveReceiptSettings() {
  if (!currentId.value || !canManage.value || receiptPending.value || receiptForm.displayName.trim().length < 2) return
  receiptPending.value = true
  receiptError.value = ''
  receiptSuccess.value = ''
  try {
    const { error } = await shopRpc.rpc('save_receipt_settings', {
      p_shop_id: currentId.value,
      p_display_name: receiptForm.displayName.trim(),
      p_address: receiptForm.address.trim() || null,
      p_phone: receiptForm.phone.trim() || null,
      p_footer: receiptForm.footer.trim() || null,
      p_paper_size: receiptForm.paperSize,
    })
    if (error) throw error
    await refreshReceiptSettings()
    receiptSuccess.value = copy.value.receiptSaved
    receiptAction.complete()
    success(copy.value.receiptSaved)
  }
  catch { receiptError.value = copy.value.receiptFailed }
  finally { receiptPending.value = false }
}

const profileAction = useRecordAction(() => profileForm)
const { visible: profileActionOpen, dirty: profileActionDirty } = profileAction

const modeAction = useRecordAction(() => selectedMode.value)
const { visible: modeActionOpen, dirty: modeActionDirty } = modeAction

const receiptAction = useRecordAction(() => receiptForm)
const { visible: receiptActionOpen, dirty: receiptActionDirty } = receiptAction
</script>

<template>
  <BsStack>
    <BsBox as="header">
      <BsText as="p" size="xs" emphasis="semibold">{{ current?.name }}</BsText>
      <BsHeading :level="1">{{ copy.title }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.subtitle }}</BsText>
    </BsBox>
    <BsText v-if="loading" role="status" as="p">{{ ui('loading') }}</BsText>
    <BsBox v-else-if="shopError" role="alert">{{ copy.failed }} <BsButton @click="reload()">{{ ui('retry') }}</BsButton>
    </BsBox>
    <BsText v-else-if="!current" role="status" as="p">{{ ui('empty') }}</BsText>
    <BsPanel v-else id="shop-profile" aria-labelledby="shop-profile-title" padding="md">
      <BsHeading id="shop-profile-title" :level="2">{{ copy.profileTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.profileHelp }}</BsText>
      <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.profileOwnerOnly }}</BsText>
      <BsText v-if="profileSuccess" role="status" as="p" size="sm">{{ profileSuccess }}</BsText>
      <BsStack>
        <BsText emphasis="semibold">{{ current?.name }}</BsText>
        <BsButton :disabled="!canManage" @click="profileAction.edit()">{{ copy.saveProfile }}</BsButton>
        <BsRecordActionDialog v-model:visible="profileActionOpen" :title="copy.profileTitle" :dirty="profileActionDirty" :pending="profilePending" :error="profileError" :submit-label="copy.saveProfile" :cancel-label="copy.cancelEdit" :submit-disabled="!canManage || profileForm.displayName.trim().length < 2 || profileForm.displayName.trim() === current?.name" @submit="saveProfile">
          <BsField v-slot="field" :label="(copy.shopDisplayName) + ' '">
            <BsInput :id="field.id" v-model="profileForm.displayName" :aria-describedby="field.describedby" autocomplete="organization" required :minlength="2" :maxlength="120" :disabled="!canManage"/>
          </BsField>
          <BsBox padding="md">
            <BsText as="p">{{ copy.profileLocationHelp }}</BsText>
            <BsLink to="#locations" external>{{ copy.manageLocations }}</BsLink>
          </BsBox>
        </BsRecordActionDialog>
      </BsStack>
    </BsPanel>
    <BsPanel v-if="current" padding="md">
      <BsHeading :level="2">{{ copy.modeTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.modeHelp }}</BsText>
      <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.ownerOnly }}</BsText>
      <BsText as="p" size="sm">{{ copy.preserve }}</BsText>
      <BsText v-if="successMessage" role="status" as="p" size="sm">{{ successMessage }}</BsText>
      <BsStack>
        <BsText>{{ modeOptions.find(mode => mode.value === current?.business_mode)?.label }}</BsText>
        <BsButton :disabled="!canManage" @click="modeAction.edit()">{{ copy.save }}</BsButton>
        <BsRecordActionDialog v-model:visible="modeActionOpen" :title="copy.modeTitle" :dirty="modeActionDirty" :pending="pending" :error="errorMessage" :submit-label="copy.save" :cancel-label="copy.cancelEdit" :submit-disabled="!canManage || !current || selectedMode === current.business_mode" @submit="saveMode">
          <BsChoiceGroup v-model="selectedMode" type="radio" :legend="copy.modeTitle" :options="modeOptions.map(mode => ({ value: mode.value, label: mode.label, description: mode.body }))" :disabled="!canManage || pending" />
        </BsRecordActionDialog>
      </BsStack>
    </BsPanel>
    <BsPanel v-if="current" id="locations" padding="md">
      <BsHeading :level="2">{{ copy.locationsTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.locationsHelp }}</BsText>
      <BsText v-if="locationUsageLabel" as="p" size="sm" tone="muted" emphasis="semibold">{{ locationUsageLabel }}</BsText>
      <BsBox v-if="locationCapacityFull && !editingLocationId" role="status" padding="md">
        <BsText as="p">{{ copy.locationLimit }}</BsText>
        <BsLink to="/billing">{{ copy.upgradePlan }}</BsLink>
      </BsBox>
      <BsDataTable :value="locations" data-key="id" :label="copy.locationsTitle" :capabilities="{ insert: canManage && !locationCapacityFull, edit: canManage, archive: canManage }" :action-labels="{ insert: copy.addLocation, edit: copy.editLocation, archive: copy.archiveLocation }" :can-row-action="(action, location) => action !== 'archive' || (!location.is_default && location.status === 'active')" :row-action-pending="locationPending" :columns="[{ key: 'name', header: copy.locationName, field: 'name' }, { key: 'column1', header: copy.locationCode }, { key: 'column2', header: copy.defaultLocation }]" @create="createLocation" @edit="editLocation" @archive="location => archiveLocation(location.id)">
        <template #cell-column1="{ row: location }">{{ location.code || location.address || '—' }}</template>
        <template #cell-column2="{ row: location }">
          <BsStatusBadge v-if="location.is_default" status="default" :label="copy.defaultLocation" tone="neutral"/>
          <BsStatusBadge v-else-if="location.status === 'archived'" status="archived" :label="copy.archivedLocation" tone="neutral"/>
        </template>
        <template #row-actions="{ row: location }">
          <BsButton v-if="canManage && location.status === 'archived'" variant="link" :disabled="locationPending || locationCapacityFull" @click="restoreLocation(location.id)">{{ copy.restoreLocation }}</BsButton>
        </template>
      </BsDataTable>
      <BsRecordActionDialog v-model:visible="locationDialogOpen" :title="editingLocationId ? copy.editLocation : copy.addLocation" :dirty="locationDirty" :pending="locationPending" :error="locationError" :submit-label="editingLocationId ? copy.saveLocation : copy.addLocation" :cancel-label="copy.cancelEdit" @submit="saveLocation">
        <BsField v-slot="field" :label="copy.locationName">
          <BsInput :id="field.id" v-model="locationForm.name" :aria-describedby="field.describedby" required :minlength="2" :maxlength="120"/>
        </BsField>
        <BsField v-slot="field" :label="copy.locationCode">
          <BsInput :id="field.id" v-model="locationForm.code" :aria-describedby="field.describedby" :maxlength="32"/>
        </BsField>
        <BsField v-slot="field" :label="copy.locationAddress">
          <BsInput :id="field.id" v-model="locationForm.address" :aria-describedby="field.describedby"/>
        </BsField>
        <BsField v-slot="field" :label="copy.locationPhone">
          <BsInput :id="field.id" v-model="locationForm.phone" :aria-describedby="field.describedby"/>
        </BsField>
      </BsRecordActionDialog>
    </BsPanel>
    <BsPanel v-if="current" aria-labelledby="receipt-settings-title" padding="md">
      <BsHeading id="receipt-settings-title" :level="2">{{ copy.receiptTitle }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.receiptHelp }}</BsText>
      <BsText v-if="receiptLoading" role="status" as="p">{{ ui('loading') }}</BsText>
      <BsText v-else-if="receiptLoadError" role="alert" as="p" size="sm" tone="danger">{{ copy.receiptFailed }} <BsButton variant="link" type="button" @click="refreshReceiptSettings()">{{ ui('retry') }}</BsButton>
      </BsText>
      <template v-else-if="receiptSettings">
        <BsText v-if="!canManage" role="status" as="p" size="sm" tone="warning">{{ copy.receiptOwnerOnly }}</BsText>
        <BsText v-if="receiptSuccess" role="status" as="p" size="sm">{{ receiptSuccess }}</BsText>
        <BsStack>
          <BsDescriptionList density="compact">
            <BsDescriptionItem :term="copy.receiptDisplayName">{{ receiptSettings.displayName }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptAddress">{{ receiptSettings.address || '—' }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptPhone">{{ receiptSettings.phone || '—' }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptFooter">{{ receiptSettings.footer || '—' }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy.receiptPaper">{{ receiptSettings.paperSize === 'thermal_80' ? copy.thermal80 : copy.a4 }}</BsDescriptionItem>
          </BsDescriptionList>
          <BsButton :disabled="!canManage" @click="receiptAction.edit()">{{ copy.saveReceipt }}</BsButton>
          <BsRecordActionDialog v-model:visible="receiptActionOpen" :title="copy.receiptTitle" :dirty="receiptActionDirty" :pending="receiptPending" :error="receiptError" :submit-label="copy.saveReceipt" :cancel-label="copy.cancelEdit" :submit-disabled="!canManage || receiptForm.displayName.trim().length < 2" @submit="saveReceiptSettings">
            <BsField v-slot="field" :label="copy.receiptDisplayName">
              <BsInput :id="field.id" v-model="receiptForm.displayName" :aria-describedby="field.describedby" required :minlength="2" :maxlength="160" :disabled="!canManage"/>
            </BsField>
            <BsField v-slot="field" :label="copy.receiptAddress">
              <BsInput :id="field.id" v-model="receiptForm.address" :aria-describedby="field.describedby" :maxlength="500" :disabled="!canManage"/>
            </BsField>
            <BsField v-slot="field" :label="copy.receiptPhone">
              <BsInput :id="field.id" v-model="receiptForm.phone" :aria-describedby="field.describedby" :maxlength="80" dir="auto" :disabled="!canManage"/>
            </BsField>
            <BsField v-slot="field" :label="copy.receiptFooter">
              <BsTextarea :id="field.id" v-model="receiptForm.footer" :aria-describedby="field.describedby" :rows="3" :maxlength="500" :disabled="!canManage"/>
            </BsField>
            <BsFieldGroup :disabled="!canManage || receiptPending" :legend="(copy.receiptPaper)">
              <BsGrid :columns="2">
                <BsRadio v-for="size in ['thermal_80', 'a4'] as const" :key="size" v-model="receiptForm.paperSize" name="receipt-paper" :value="size" :label="(size === 'thermal_80' ? copy.thermal80 : copy.a4)" />
              </BsGrid>
            </BsFieldGroup>
          </BsRecordActionDialog>
        </BsStack>
      </template>
    </BsPanel>
  </BsStack>
</template>
