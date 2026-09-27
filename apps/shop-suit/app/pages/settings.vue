<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { BusinessMode } from '~/utils/businessMode'
import { BUSINESS_MODES } from '~/utils/businessMode'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, isOwner, reload } = useShop()
const selectedMode = ref<BusinessMode>('mixed')
const pending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isArabic = computed(() => locale.value === 'ar')

const copy = computed(() => isArabic.value ? {
  title: 'إعدادات النشاط', subtitle: 'اضبط مسارات العمل المناسبة لنشاطك.',
  modeTitle: 'طريقة تشغيل النشاط', modeHelp: 'تتحكم هذه الإعدادات في ظهور مسارات المنتجات والمخزون والخدمات فقط. لا تغيّر خطة الاشتراك أو الحصص أو صلاحيات المستخدمين.',
  product: 'منتجات ومخزون', productBody: 'إظهار المنتجات والمخزون والمشتريات والموردين وإخفاء مسار الخدمات.',
  service: 'خدمات فقط', serviceBody: 'إظهار الخدمات دون فرض إنشاء منتجات أو سجلات مخزون.',
  mixed: 'منتجات وخدمات', mixedBody: 'إظهار مسارات المنتجات والمخزون والخدمات معًا.',
  preserve: 'عند تغيير الطريقة، تظل المنتجات والخدمات والمخزون والمشتريات وكل السجلات السابقة محفوظة، وتظهر مجددًا عند إعادة تفعيل المسار.',
  ownerOnly: 'يمكن لمالك النشاط فقط تغيير هذا الإعداد. يمكنك رؤية الطريقة الحالية دون تعديلها.',
  save: 'حفظ طريقة التشغيل', saving: 'جارٍ الحفظ…', success: 'تم تحديث طريقة تشغيل النشاط.',
  failed: 'تعذّر تحديث طريقة تشغيل النشاط. حاول مرة أخرى.',
} : {
  title: 'Business settings', subtitle: 'Choose the workflows that fit this business.',
  modeTitle: 'Business operation mode', modeHelp: 'This setting controls product, stock, and service workflow visibility only. It does not change the subscription plan, quotas, or user permissions.',
  product: 'Products and stock', productBody: 'Show products, inventory, purchasing, and supplier workflows while hiding services.',
  service: 'Services only', serviceBody: 'Show services without requiring products or stock records.',
  mixed: 'Products and services', mixedBody: 'Show product, stock, and service workflows together.',
  preserve: 'Changing mode preserves all existing products, services, inventory, purchases, and historical records. They appear again when their workflow is re-enabled.',
  ownerOnly: 'Only the business owner can change this setting. You can view the current mode without editing it.',
  save: 'Save operation mode', saving: 'Saving…', success: 'Business operation mode updated.',
  failed: 'Could not update the business operation mode. Try again.',
})

const modeOptions = computed(() => BUSINESS_MODES.map(value => ({
  value,
  label: copy.value[value],
  body: copy.value[`${value}Body` as const],
})))

watch(() => current.value?.business_mode, (mode) => {
  if (mode) selectedMode.value = mode
}, { immediate: true })

watch(selectedMode, () => {
  errorMessage.value = ''
  successMessage.value = ''
})

async function saveMode() {
  if (pending.value || !current.value || !isOwner.value || selectedMode.value === current.value.business_mode) return
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
  } catch {
    errorMessage.value = copy.value.failed
  } finally {
    pending.value = false
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

    <section class="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 class="text-lg font-extrabold">{{ copy.modeTitle }}</h2>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{{ copy.modeHelp }}</p>

      <p v-if="!isOwner" role="status" class="mt-5 rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm text-[var(--bs-status-warning)]">{{ copy.ownerOnly }}</p>
      <p class="mt-5 rounded-xl border border-border bg-background p-4 text-sm leading-6">{{ copy.preserve }}</p>
      <p v-if="errorMessage" role="alert" class="mt-4 rounded-xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ errorMessage }}</p>
      <p v-if="successMessage" role="status" class="mt-4 rounded-xl border border-[var(--bs-status-success)]/30 bg-[var(--bs-status-success-bg)] p-3 text-sm text-[var(--bs-status-success)]">{{ successMessage }}</p>

      <form class="mt-5 space-y-5" @submit.prevent="saveMode">
        <fieldset class="grid gap-3 md:grid-cols-3" :disabled="!isOwner || pending">
          <legend class="sr-only">{{ copy.modeTitle }}</legend>
          <label v-for="mode in modeOptions" :key="mode.value" class="cursor-pointer rounded-2xl border p-4 transition disabled:cursor-not-allowed" :class="selectedMode === mode.value ? 'border-[var(--bs-accent)] ring-2 ring-[var(--bs-accent)]/15' : 'border-border'">
            <span class="flex items-center gap-2">
              <input v-model="selectedMode" type="radio" name="business-mode" :value="mode.value">
              <strong>{{ mode.label }}</strong>
            </span>
            <span class="mt-2 block text-sm leading-6 text-muted-foreground">{{ mode.body }}</span>
          </label>
        </fieldset>
        <button type="submit" class="ls-btn ls-btn-primary" :disabled="!isOwner || pending || !current || selectedMode === current.business_mode">{{ pending ? copy.saving : copy.save }}</button>
      </form>
    </section>
  </div>
</template>
