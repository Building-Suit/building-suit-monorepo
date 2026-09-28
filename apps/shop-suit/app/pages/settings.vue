<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { BusinessMode } from '~/utils/businessMode'
import { BUSINESS_MODES } from '~/utils/businessMode'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const confirmation = useConfirmation()
const { locale } = useI18n()
const { current, currentId, locations, loading, loadError: shopError, reload, loadLocations } = useShop()
const { success } = useToasts()
const ui = useUiCopy()
const selectedMode = ref<BusinessMode>('mixed')
const pending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const locationPending = ref(false)
const locationError = ref('')
const locationForm = reactive({ name: '', code: '', address: '', phone: '' })
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

const copy = computed(() => isArabic.value ? {
  title: 'إعدادات النشاط', subtitle: 'اضبط مسارات العمل المناسبة لنشاطك.',
  modeTitle: 'طريقة تشغيل النشاط', modeHelp: 'تتحكم هذه الإعدادات في ظهور مسارات المنتجات والمخزون والخدمات فقط. لا تغيّر خطة الاشتراك أو الحصص أو صلاحيات المستخدمين.',
  product: 'منتجات ومخزون', productBody: 'إظهار المنتجات والمخزون والمشتريات والموردين وإخفاء مسار الخدمات.',
  service: 'خدمات فقط', serviceBody: 'إظهار الخدمات دون فرض إنشاء منتجات أو سجلات مخزون.',
  mixed: 'منتجات وخدمات', mixedBody: 'إظهار مسارات المنتجات والمخزون والخدمات معًا.',
  preserve: 'عند تغيير الطريقة، تظل المنتجات والخدمات والمخزون والمشتريات وكل السجلات السابقة محفوظة، وتظهر مجددًا عند إعادة تفعيل المسار.',
  ownerOnly: 'تحتاج إلى صلاحية إدارة إعدادات النشاط. يمكنك رؤية الطريقة الحالية دون تعديلها.',
  save: 'حفظ طريقة التشغيل', saving: 'جارٍ الحفظ…', success: 'تم تحديث طريقة تشغيل النشاط.',
  failed: 'تعذّر تحديث طريقة تشغيل النشاط. حاول مرة أخرى.',
  locationsTitle: 'فروع النشاط', locationsHelp: 'أضف الفرع الثاني وأدر الفروع النشطة دون حذف السجل التاريخي.',
  defaultLocation: 'افتراضي', archivedLocation: 'مؤرشف', locationName: 'اسم الفرع', locationCode: 'الرمز', locationAddress: 'العنوان', locationPhone: 'الهاتف',
  addLocation: 'إضافة فرع', addingLocation: 'جارٍ الإضافة…', archiveLocation: 'أرشفة', locationSaved: 'تمت إضافة الفرع.', locationFailed: 'تعذّر حفظ الفرع.',
  archiveLocationConfirm: 'أرشفة هذا الفرع؟ ستبقى المبيعات والمدفوعات والمواعيد السابقة ظاهرة في السجل والتقارير.',
} : {
  title: 'Business settings', subtitle: 'Choose the workflows that fit this business.',
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
  addLocation: 'Add location', addingLocation: 'Adding…', archiveLocation: 'Archive', locationSaved: 'Location added.', locationFailed: 'Could not save the location.',
  archiveLocationConfirm: 'Archive this location? Its historical sales, payments, and appointments will remain available in history and reports.',
})

const modeOptions = computed(() => BUSINESS_MODES.map(value => ({
  value,
  label: copy.value[value],
  body: copy.value[`${value}Body` as const],
})))

watch([currentId, () => current.value?.business_mode], ([, mode]) => {
  selectedMode.value = mode ?? 'mixed'
  errorMessage.value = ''; successMessage.value = ''
}, { immediate: true })

watch(selectedMode, () => {
  errorMessage.value = ''
  successMessage.value = ''
})

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
    success(copy.value.success)
  } catch {
    errorMessage.value = copy.value.failed
  } finally {
    pending.value = false
  }
}

async function addLocation() {
  const name = locationForm.name.trim()
  if (!currentId.value || !canManage.value || locationPending.value || name.length < 2) return
  locationPending.value = true
  locationError.value = ''
  try {
    const { error } = await shopRpc.rpc('save_shop_location', {
      p_shop_id: currentId.value,
      p_location_id: null,
      p_name: name,
      p_code: locationForm.code.trim() || null,
      p_address: locationForm.address.trim() || null,
      p_phone: locationForm.phone.trim() || null,
    })
    if (error) throw error
    Object.assign(locationForm, { name: '', code: '', address: '', phone: '' })
    await loadLocations()
    success(copy.value.locationSaved)
  } catch {
    locationError.value = copy.value.locationFailed
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
    await loadLocations()
  } catch {
    locationError.value = copy.value.locationFailed
  } finally {
    locationPending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <header>
      <p class="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bs-link)]">{{ current?.name }}</p>
      <h1 class="mt-1 text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1>
      <p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p>
    </header>

    <p v-if="loading" role="status">{{ ui('loading') }}</p>
    <div v-else-if="shopError" role="alert" class="ls-error">{{ copy.failed }} <BsButton @click="reload()">{{ ui('retry') }}</BsButton></div>
    <p v-else-if="!current" role="status">{{ ui('empty') }}</p>
    <section v-else class="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 class="text-lg font-extrabold">{{ copy.modeTitle }}</h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{{ copy.modeHelp }}</p>

      <p v-if="!canManage" role="status" class="mt-5 rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm text-fg">{{ copy.ownerOnly }}</p>
      <p class="mt-5 rounded-xl border border-border bg-background p-4 text-sm leading-6">{{ copy.preserve }}</p>
      <p v-if="successMessage" role="status" class="mt-4 rounded-xl border border-[var(--bs-status-success)]/30 bg-[var(--bs-status-success-bg)] p-3 text-sm text-fg">{{ successMessage }}</p>

      <BsForm class="mt-5 space-y-5" :pending="pending" :error="errorMessage" @submit="saveMode">
        <fieldset class="grid gap-3 md:grid-cols-3" :disabled="!canManage || pending">
          <legend class="sr-only">{{ copy.modeTitle }}</legend>
          <label v-for="mode in modeOptions" :key="mode.value" class="cursor-pointer rounded-2xl border p-4 transition disabled:cursor-not-allowed" :class="selectedMode === mode.value ? 'border-[var(--bs-accent)] ring-2 ring-[var(--bs-accent)]/15' : 'border-border'">
            <span class="flex items-center gap-2">
              <input v-model="selectedMode" type="radio" name="business-mode" :value="mode.value">
              <strong>{{ mode.label }}</strong>
            </span>
            <span class="mt-2 block text-sm leading-6 text-muted-foreground">{{ mode.body }}</span>
          </label>
        </fieldset>
        <BsButton type="submit" class="ls-btn ls-btn-primary" :pending="pending" :disabled="!canManage || !current || selectedMode === current.business_mode">{{ pending ? copy.saving : copy.save }}</BsButton>
      </BsForm>
    </section>

    <section v-if="current" class="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 class="text-lg font-extrabold">{{ copy.locationsTitle }}</h2>
      <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ copy.locationsHelp }}</p>
      <p v-if="locationError" role="alert" class="mt-4 text-sm text-[var(--bs-status-error)]">{{ locationError }}</p>
      <ul class="mt-5 divide-y divide-border rounded-xl border border-border">
        <li v-for="location in locations" :key="location.id" class="flex items-center justify-between gap-4 p-4">
          <span>
            <strong class="block">{{ location.name }}</strong>
            <span class="text-xs text-muted-foreground">{{ location.code || location.address || '—' }}</span>
          </span>
          <span class="flex items-center gap-2">
            <span v-if="location.is_default" class="rounded-full bg-muted px-2 py-1 text-xs font-bold">{{ copy.defaultLocation }}</span>
            <span v-if="location.status === 'archived'" class="rounded-full bg-muted px-2 py-1 text-xs font-bold">{{ copy.archivedLocation }}</span>
            <BsButton v-if="canManage && !location.is_default && location.status === 'active'" type="button" severity="secondary" :disabled="locationPending" @click="archiveLocation(location.id)">{{ copy.archiveLocation }}</BsButton>
          </span>
        </li>
      </ul>
      <BsForm v-if="canManage" class="mt-5 grid gap-3 sm:grid-cols-2" :pending="locationPending" :error="locationError" @submit="addLocation">
        <label class="grid gap-1 text-sm"><span>{{ copy.locationName }}</span><input v-model="locationForm.name" class="ls-input" required minlength="2" maxlength="120"></label>
        <label class="grid gap-1 text-sm"><span>{{ copy.locationCode }}</span><input v-model="locationForm.code" class="ls-input" maxlength="32"></label>
        <label class="grid gap-1 text-sm"><span>{{ copy.locationAddress }}</span><input v-model="locationForm.address" class="ls-input"></label>
        <label class="grid gap-1 text-sm"><span>{{ copy.locationPhone }}</span><input v-model="locationForm.phone" class="ls-input"></label>
        <div class="sm:col-span-2"><BsButton type="submit" :pending="locationPending" :disabled="locationForm.name.trim().length < 2">{{ locationPending ? copy.addingLocation : copy.addLocation }}</BsButton></div>
      </BsForm>
    </section>
  </div>
</template>
