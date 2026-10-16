<script setup lang="ts">
import { readRasterImage } from '@building-suit/ux'
import type { BsBusinessProfileForm, BsBusinessLocationForm, BsBusinessReceiptForm, BsBusinessLocationsView, BsBusinessCashPolicyView, BsBusinessReceiptSummary, BsBusinessSettingsCopy, BsBusinessCurrencyView } from '@building-suit/ui/types/businessSettingsPresentation'
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
const { current, currentId, locations, loading, loadError: shopError, reload, loadLocations, refreshBusinessCurrency } = useShop()
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
const receiptForm = reactive({ displayName: '', address: '', phone: '', footer: '', paperSize: 'thermal_80' as ReceiptPaperSize, documentLabel: '', referenceLabel: '', documentLanguage: 'ar', documentDirection: 'auto', showDescriptions: true, notes: '', logoDataUrl: '' })
type BusinessCurrencySettings = { currency: string; locked: boolean; supportedCurrencies: string[] }
const currencySelection = ref<string | null>(null)
const currencyPending = ref(false)
const currencyError = ref('')
const currencySuccess = ref('')
const { data: currencySettings, pending: currencyLoading, error: currencyLoadError, refresh: refreshCurrencySettings } = useAsyncData(
  () => `shop-data:business-currency:${currentId.value ?? 'none'}`,
  async (): Promise<BusinessCurrencySettings | null> => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('business_currency_settings', { p_shop_id: currentId.value })
    if (error) throw error
    return data as BusinessCurrencySettings
  }, { watch: [currentId], default: () => null },
)
const selectedBusinessCurrency = computed<string>({
  get: () => currencySettings.value?.locked ? currencySettings.value.currency : currencySelection.value ?? currencySettings.value?.currency ?? current.value?.business_currency ?? 'EGP',
  set: value => { currencySelection.value = value },
})
watch(currentId, () => { currencySelection.value = null; currencyError.value = ''; currencySuccess.value = '' })
const currencyView = computed<BsBusinessCurrencyView>(() => ({
  code: currencySettings.value?.currency ?? 'EGP', locked: currencySettings.value?.locked ?? true,
  loading: currencyLoading.value, loadError: Boolean(currencyLoadError.value), pending: currencyPending.value, error: currencyError.value, success: currencySuccess.value,
  title: isArabic.value ? 'عملة النشاط' : 'Business currency',
  help: isArabic.value ? 'تتغير العملة قبل أول مستند مالي فقط. أسعار الكتالوج والمسودات تحتفظ بنفس الأرقام بدون تحويل. رسوم الاشتراك منفصلة وتظل بالجنيه المصري.' : 'Change currency before the first monetary document only. Catalog and draft prices keep their numeric values with no conversion. Subscription fees are separate and remain in EGP.',
  lockedHelp: isArabic.value ? 'العملة ثابتة بعد وجود سجل مالي، بما فيه المبيعات والمشتريات والمصروفات والمدفوعات ورصيد المخزون ووردية الخزنة.' : 'Currency is fixed once financial history exists, including sales, purchases, expenses, payments, opening stock or a cashier shift.',
  failed: isArabic.value ? 'مقدرناش نحمّل أو نحفظ العملة.' : 'Could not load or save business currency.', retry: isArabic.value ? 'حاول تاني' : 'Retry', save: isArabic.value ? 'حفظ العملة' : 'Save currency',
  options: [...new Set([...(currencySettings.value?.supportedCurrencies ?? []), currencySettings.value?.currency ?? 'EGP'])].map(value => ({ value, label: value })),
}))
async function saveBusinessCurrency() {
  const shopId = currentId.value
  const code = selectedBusinessCurrency.value
  if (!shopId || !canManage.value || currencyPending.value || !currencySettings.value || currencySettings.value.locked || code === currencySettings.value.currency) return
  const accepted = await confirmation.ask(isArabic.value ? `تغيير عملة النشاط إلى ${code}؟ أسعار الكتالوج والمسودات تحتفظ بنفس الأرقام بدون تحويل العملة.` : `Change business currency to ${code}? Catalog and draft amounts keep their numeric values; no currency conversion occurs.`)
  if (!accepted || currentId.value !== shopId || !canManage.value) return
  currencyPending.value = true; currencyError.value = ''; currencySuccess.value = ''
  try {
    const { error } = await shopRpc.rpc('save_business_currency', { p_shop_id: shopId, p_currency: code })
    if (error) throw error
    await refreshBusinessCurrency(shopId)
    await refreshCurrencySettings()
    currencySelection.value = null
    if (currentId.value === shopId) currencySuccess.value = isArabic.value ? 'اتحفظت عملة النشاط.' : 'Business currency saved.'
  } catch {
    await refreshCurrencySettings()
    if (currentId.value === shopId) currencyError.value = currencyView.value.locked ? currencyView.value.lockedHelp : currencyView.value.failed
  } finally { currencyPending.value = false }
}
const receiptPending = ref(false)
const logoPending = ref(false)
const receiptError = ref('')
const receiptSuccess = ref('')
const isArabic = computed(() => locale.value === 'ar')
const { data: permissionAccess, pending: permissionPending, error: permissionError, refresh: refreshPermissions } = useAsyncData('shop-data:settings-permissions', async () => {
  if (!currentId.value) return { 'settings.manage': false }
  const { data, error } = await shopRpc.rpc('shop_permission_access', {
    p_shop_id: currentId.value, p_permission_keys: ['settings.manage'],
  })
  if (error) throw error
  return data
}, { watch: [currentId], default: () => ({ 'settings.manage': false }) })
const canManage = computed(() => !permissionPending.value && !permissionError.value && permissionAccess.value?.['settings.manage'] === true)
const { form: websiteProfileForm, optIn: websiteOwnerOptIn, open: websiteProfileOpen, view: websiteProfileView, edit: editWebsiteProfile, save: saveWebsiteProfile, logo: selectWebsiteLogo, publish: publishWebsiteProfile, unpublish: unpublishWebsiteProfile, refresh: refreshWebsiteProfile } = useWebsiteProfile(canManage)
const { form: websiteCatalogForm, open: websiteCatalogOpen, search: websiteCatalogSearch, view: websiteCatalogView, edit: editWebsiteCatalog, save: saveWebsiteCatalog, publish: publishWebsiteCatalog, image: selectWebsiteCatalogImage, refresh: refreshWebsiteCatalog, setPage: setWebsiteCatalogPage } = useWebsiteCatalog(canManage, refreshWebsiteProfile)
const { slug: websiteSlug, open: websiteOpen, view: websiteAddressView, edit: editWebsiteAddress, save: saveWebsiteAddress, refresh: refreshWebsiteAddress } = useWebsiteAddress(canManage)
async function retrySettings() { await Promise.all([reload(), refreshPermissions()]) }
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
type ReceiptSettings = { documentLabel?: string | null; referenceLabel?: string | null; documentLanguage?: string; documentDirection?: string; showDescriptions?: boolean; notes?: string | null; logoDataUrl?: string | null; displayName: string; address: string | null; phone: string | null; footer: string | null; paperSize: ReceiptPaperSize; canManage: boolean }
const { data: receiptSettings, pending: receiptLoading, error: receiptLoadError, refresh: refreshReceiptSettings } = useAsyncData(
  () => `shop-data:receipt-settings:${currentId.value ?? 'none'}`,
  async (): Promise<ReceiptSettings | null> => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('receipt_settings', { p_shop_id: currentId.value })
    if (error) throw error
    return data as ReceiptSettings
  }, { watch: [currentId], default: () => null },
)

const cashRequired = ref(false)
const cashPending = ref(false)
const cashError = ref('')
const cashSuccess = ref('')
const { data: cashPolicy, pending: cashLoading, error: cashLoadError, refresh: refreshCashPolicy } = useAsyncData(
  () => `shop-data:cash-policy:${currentId.value ?? 'none'}`,
  async () => {
    if (!currentId.value) return null
    const { data, error } = await shopRpc.rpc('shop_cash_policy', { p_shop_id: currentId.value })
    if (error) throw error
    return data
  }, { watch: [currentId], default: () => null },
)
watch([currentId, cashPolicy], () => {
  cashRequired.value = cashPolicy.value === true
  cashError.value = ''; cashSuccess.value = ''
}, { immediate: true })
async function saveCashPolicy() {
  if (!currentId.value || !canManage.value || cashPending.value || cashPolicy.value === null) return
  const shopId = currentId.value
  cashPending.value = true; cashError.value = ''; cashSuccess.value = ''
  try {
    const { error } = await shopRpc.rpc('set_shop_cash_policy', { p_shop_id: shopId, p_required: cashRequired.value })
    if (error) throw error
    await refreshCashPolicy()
    if (currentId.value === shopId) cashSuccess.value = isArabic.value ? 'اتحفظت سياسة ورديات الخزنة.' : 'Cashier shift policy saved.'
  } catch {
    if (currentId.value === shopId) cashError.value = isArabic.value ? 'مقدرناش نحفظ سياسة ورديات الخزنة. حاول تاني.' : 'Could not save the cashier shift policy. Try again.'
  } finally { cashPending.value = false }
}

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

watch(currentId, () => {
  Object.assign(receiptForm, { displayName: '', address: '', phone: '', footer: '', paperSize: 'thermal_80', documentLabel: '', referenceLabel: '', documentLanguage: 'ar', documentDirection: 'auto', showDescriptions: true, notes: '', logoDataUrl: '' })
  receiptError.value = ''; receiptSuccess.value = ''
})

watch(receiptSettings, (settings) => {
  if (!settings) return
  Object.assign(receiptForm, {
    displayName: settings.displayName,
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    footer: settings.footer ?? '',
    paperSize: settings.paperSize,
    documentLabel: settings.documentLabel ?? '', referenceLabel: settings.referenceLabel ?? '', documentLanguage: settings.documentLanguage ?? 'ar', documentDirection: settings.documentDirection ?? 'auto', showDescriptions: settings.showDescriptions ?? true, notes: settings.notes ?? '', logoDataUrl: settings.logoDataUrl ?? '',
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
  if (!currentId.value || !canManage.value || receiptPending.value || logoPending.value || receiptForm.displayName.trim().length < 2) return
  receiptPending.value = true
  receiptError.value = ''
  receiptSuccess.value = ''
  try {
    const { error } = await shopRpc.rpc('save_document_settings', { p_shop_id: currentId.value, p_settings: { ...receiptForm } })
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

const settingsCopy = computed<BsBusinessSettingsCopy>(() => ({ ...copy.value,
  editProfile: isArabic.value ? 'تعديل ملف المتجر' : 'Edit shop profile',
  editMode: isArabic.value ? 'تغيير طريقة التشغيل' : 'Change business mode',
  documentLabel: isArabic.value ? 'عنوان المستند' : 'Document label',
  referenceLabel: isArabic.value ? 'عنوان رقم المستند' : 'Document number label',
  documentLanguage: isArabic.value ? 'لغة المستند الافتراضية' : 'Default document language',
  documentDirection: isArabic.value ? 'اتجاه المستند' : 'Document direction',
  autoDirection: isArabic.value ? 'حسب اللغة' : 'Follow language',
  showDescriptions: isArabic.value ? 'إظهار وصف البنود' : 'Show line descriptions',
  documentNotes: isArabic.value ? 'ملاحظات المستند' : 'Document notes',
  documentLogo: isArabic.value ? 'شعار النشاط' : 'Business logo',
  logoHelp: isArabic.value ? 'PNG أو JPEG حتى 128 كيلوبايت. تُحفظ الصورة داخل المستند عند الإصدار.' : 'PNG or JPEG, up to 128 KiB. Image bytes are captured inside the issued document.',
  removeLogo: isArabic.value ? 'إزالة الشعار' : 'Remove logo',
  editReceipt: isArabic.value ? 'تعديل إعدادات الإيصال' : 'Edit receipt settings',
  loading: ui('loading'), retry: ui('retry'), empty: isArabic.value ? 'افتح لوحة التحكم لاختيار متجر أو إعداد متجرك.' : 'Open Dashboard to choose or set up your Shop.',
  failed: isArabic.value ? 'مقدرناش نحمّل إعدادات النشاط. حاول تاني.' : 'Could not load business settings. Try again.',
  cashTitle: isArabic.value ? 'سياسة ورديات الخزنة' : 'Cashier shift policy',
  cashHelp: isArabic.value ? 'عند التفعيل، إصدار المبيعات والدفع يتطلبان وردية مفتوحة للخزنة الرئيسية في الفرع المحدد، حتى للدفع غير النقدي. حفظ المسودات يظل متاحًا. التغييرات مسجلة في سجل المراجعة.' : 'When enabled, issuing sales and taking payment require an open main cashier shift at the selected location, including non-cash payments. Draft saving remains available. Changes are audited.',
  cashRequired: isArabic.value ? 'اشتراط وردية خزنة مفتوحة للمبيعات' : 'Require an open cashier shift for sales',
  cashSave: isArabic.value ? 'حفظ سياسة الخزنة' : 'Save cashier policy',
}))
const cashView = computed<BsBusinessCashPolicyView>(() => ({ loading: cashLoading.value, loadError: Boolean(cashLoadError.value), pending: cashPending.value, error: cashError.value, success: cashSuccess.value, disabled: !canManage.value || cashPolicy.value === null, submitDisabled: cashPolicy.value === null || cashRequired.value === cashPolicy.value }))
const profileEditor = computed(() => ({ pending: profilePending.value, error: profileError.value, success: profileSuccess.value, dirty: profileActionDirty.value, submitDisabled: !canManage.value || profileForm.displayName.trim().length < 2 || profileForm.displayName.trim() === current.value?.name }))
const modeEditor = computed(() => ({ pending: pending.value, error: errorMessage.value, success: successMessage.value, dirty: modeActionDirty.value, submitDisabled: !canManage.value || !current.value || selectedMode.value === current.value.business_mode }))
const receiptEditor = computed(() => ({ pending: receiptPending.value || logoPending.value, error: receiptError.value, success: receiptSuccess.value, dirty: receiptActionDirty.value, loading: receiptLoading.value, loadError: Boolean(receiptLoadError.value), submitDisabled: !canManage.value || receiptForm.displayName.trim().length < 2 }))
const receiptSummary = computed<BsBusinessReceiptSummary | null>(() => receiptSettings.value ? ({ displayName: receiptSettings.value.displayName, address: receiptSettings.value.address || '—', phone: receiptSettings.value.phone || '—', footer: receiptSettings.value.footer || '—', paperLabel: receiptSettings.value.paperSize === 'thermal_80' ? copy.value.thermal80 : copy.value.a4 }) : null)
const locationsView = computed<BsBusinessLocationsView>(() => ({
  rows: locations.value.map(location => ({ id: location.id, name: location.name, summary: location.code || location.address || '—', badge: location.is_default ? 'default' : location.status === 'archived' ? 'archived' : null, canArchive: !location.is_default && location.status === 'active', canRestore: canManage.value && location.status === 'archived' })),
  pending: locationPending.value, error: locationError.value, dirty: locationDirty.value, editing: Boolean(editingLocationId.value), usageLabel: locationUsageLabel.value, canCreate: canManage.value && !locationCapacityFull.value, capacityNotice: locationCapacityFull.value && !editingLocationId.value, restoreDisabled: locationPending.value || locationCapacityFull.value,
}))
const profileModel = computed<BsBusinessProfileForm>({ get: () => ({ ...profileForm }), set: value => Object.assign(profileForm, value) })
const locationModel = computed<BsBusinessLocationForm>({ get: () => ({ ...locationForm }), set: value => Object.assign(locationForm, value) })
const receiptModel = computed<BsBusinessReceiptForm>({ get: () => ({ ...receiptForm }), set: value => { Object.assign(receiptForm, { ...value, paperSize: value.paperSize === 'a4' ? 'a4' : 'thermal_80' }) } })
const modeModel = computed<string>({ get: () => selectedMode.value, set: value => { if (BUSINESS_MODES.includes(value as BusinessMode)) selectedMode.value = value as BusinessMode } })
const modeLabel = computed(() => modeOptions.value.find(mode => mode.value === current.value?.business_mode)?.label || '')
function editLocationById(id: string) { const location = locations.value.find(location => location.id === id); if (location) editLocation(location) }
let logoSelectionVersion = 0
async function selectDocumentLogo(selection: File | File[] | null) {
  const file = Array.isArray(selection) ? selection[0] : selection
  if (!file || !canManage.value || receiptPending.value || logoPending.value) return
  logoPending.value = true
  const shopId = currentId.value
  const version = ++logoSelectionVersion
  try {
    const dataUrl = await readRasterImage(file)
    if (version === logoSelectionVersion && shopId === currentId.value && canManage.value) receiptForm.logoDataUrl = dataUrl
  } catch {
    if (shopId === currentId.value) receiptError.value = isArabic.value ? 'اختار صورة PNG أو JPEG صحيحة حتى 128 كيلوبايت.' : 'Choose a valid PNG or JPEG image up to 128 KiB.'
  } finally { logoPending.value = false }
}
</script>
<template>
  <BsBusinessSettingsPage
    v-model:website-catalog-form="websiteCatalogForm"
    v-model:website-catalog-open="websiteCatalogOpen"
    v-model:website-catalog-search="websiteCatalogSearch"
    v-model:website-profile-form="websiteProfileForm"
    v-model:website-profile-open="websiteProfileOpen"
    v-model:website-owner-opt-in="websiteOwnerOptIn"
    v-model:website-slug="websiteSlug"
    v-model:website-open="websiteOpen"
    v-model:business-currency="selectedBusinessCurrency"
    v-model:profile-form="profileModel"
    v-model:location-form="locationModel"
    v-model:receipt-form="receiptModel"
    v-model:mode="modeModel"
    v-model:cash-required="cashRequired"
    v-model:profile-open="profileActionOpen"
    v-model:mode-open="modeActionOpen"
    v-model:receipt-open="receiptActionOpen"
    v-model:location-open="locationDialogOpen"
    :website-catalog-view="websiteCatalogView"
    :website-profile-view="websiteProfileView"
    :website-address-view="websiteAddressView"
    :currency-view="currencyView"
    :context="current ? { name: current.name } : null"
    :loading="loading || permissionPending"
    :shop-error="Boolean(shopError || permissionError)"
    :can-manage="canManage"
    :copy="settingsCopy"
    :cash="cashView"
    :profile-editor="profileEditor"
    :mode-editor="modeEditor"
    :receipt-editor="receiptEditor"
    :receipt-summary="receiptSummary"
    :locations-view="locationsView"
    :mode-options="modeOptions"
    :mode-label="modeLabel"
    @edit-website-catalog="editWebsiteCatalog"
    @save-website-catalog="saveWebsiteCatalog"
    @retry-website-catalog="refreshWebsiteCatalog()"
    @publish-website-catalog="publishWebsiteCatalog($event,true)"
    @unpublish-website-catalog="publishWebsiteCatalog($event,false)"
    @website-catalog-page="setWebsiteCatalogPage"
    @select-website-catalog-image="selectWebsiteCatalogImage"
    @edit-website-profile="editWebsiteProfile"
    @save-website-profile="saveWebsiteProfile"
    @retry-website-profile="refreshWebsiteProfile()"
    @publish-website-profile="publishWebsiteProfile"
    @unpublish-website-profile="unpublishWebsiteProfile"
    @select-website-logo="selectWebsiteLogo"
    @remove-website-logo="selectWebsiteLogo(null)"
    @edit-website-address="editWebsiteAddress"
    @save-website-address="saveWebsiteAddress().then(() => refreshWebsiteProfile())"
    @retry-website-address="refreshWebsiteAddress()"
    @save-currency="saveBusinessCurrency"
    @retry-currency="refreshCurrencySettings()"
    @select-logo="selectDocumentLogo"
    @edit-profile="profileAction.edit()"
    @edit-mode="modeAction.edit()"
    @edit-receipt="receiptAction.edit()"
    @retry="retrySettings"
    @retry-cash="refreshCashPolicy()"
    @retry-receipt="refreshReceiptSettings()"
    @save-cash="saveCashPolicy"
    @save-profile="saveProfile"
    @save-mode="saveMode"
    @save-location="saveLocation"
    @save-receipt="saveReceiptSettings"
    @create-location="createLocation"
    @edit-location="editLocationById"
    @archive-location="archiveLocation"
    @restore-location="restoreLocation"
  />
</template>
