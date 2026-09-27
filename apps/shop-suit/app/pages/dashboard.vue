<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { BusinessMode } from '~/utils/businessMode'
import { BUSINESS_MODES } from '~/utils/businessMode'

definePageMeta({ layout: 'default', middleware: ['auth'] })

type Subscription = { status: string; trial_end_at: string | null; current_period_end: string | null; plan_id: string }
type Invoice = { id: string; invoice_number: string; client_name_snapshot: string | null; total_amount: number; created_at: string }

const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const route = useRoute()
const { locale } = useI18n()
const { current, currentId, currentMembership, isOwner, reload } = useShop()
const { data: plans, isLoading: plansPending, error: plansError, refresh: refreshPlans } = usePlans()
const isArabic = computed(() => locale.value === 'ar')
const selectablePlans = computed(() => plans.value?.filter(plan => !plan.is_coming_soon && plan.trial_days > 0) ?? [])
const selectedPlan = ref('')
const setupName = ref('')
const setupMode = ref<BusinessMode>('mixed')
const setupPending = ref(false)
const setupError = ref('')

watchEffect(() => {
  if (!selectablePlans.value.some(plan => plan.slug === selectedPlan.value)) {
    selectedPlan.value = selectablePlans.value[0]?.slug ?? ''
  }
})

const copy = computed(() => isArabic.value ? {
  title: 'لوحة التحكم', subtitle: 'راجع متجرك والميزات المتاحة حاليًا.',
  setupTitle: 'أنشئ متجرك الأول', setupBody: 'ابدأ تجربة الخطة التي تختارها. يُنشأ المتجر داخل Supabase بحسابك الحالي.',
  shopName: 'اسم المتجر', plan: 'خطة التجربة', createShop: 'إنشاء المتجر', creating: 'جاري الإنشاء...',
  businessMode: 'طريقة تشغيل النشاط', businessModeHelp: 'تتحكم في ظهور مسارات المنتجات أو الخدمات ولا تغيّر خطة اشتراكك.',
  productMode: 'منتجات ومخزون', productModeBody: 'للبيع والمشتريات والموردين وإدارة المخزون.',
  serviceMode: 'خدمات فقط', serviceModeBody: 'لتقديم الخدمات دون الحاجة إلى سجلات مخزون.',
  mixedMode: 'منتجات وخدمات', mixedModeBody: 'لإظهار مسارات المنتجات والخدمات معًا.',
  loadingPlans: 'جاري تحميل الخطط...', noPlans: 'لا توجد خطط متاحة للتجربة الآن.',
  reviewTitle: 'حالة النظام للمراجعة', ready: 'متاح الآن', next: 'قيد العمل',
  readyBody: 'الحساب، تسجيل الدخول، عرض الخطط، إنشاء المتجر، المنتجات والخدمات، مشتريات الموردين، المخزون اليدوي، المصروفات، وقراءة الاشتراك والفواتير.',
  nextBody: 'البيع، مدفوعات ومرتجعات الموردين، الدخل الإضافي، الموظفون والتقارير قيد العمل.',
  planStatus: 'حالة الخطة', trialEnds: 'تنتهي التجربة', periodEnds: 'نهاية الفترة', owner: 'مالك', employee: 'موظف',
  recentInvoices: 'أحدث الفواتير', noInvoices: 'لا توجد فواتير مرئية لحسابك بعد.',
  invoiceNumber: 'رقم الفاتورة', client: 'العميل', amount: 'الإجمالي', date: 'التاريخ',
  loadFailed: 'تعذّر تحميل البيانات.', retry: 'إعادة المحاولة',
  noShopAfterCreate: 'تم إنشاء المتجر لكن تعذّر تحميله. حدّث الصفحة.',
  setupFailed: 'تعذّر إنشاء المتجر.', invalidName: 'اكتب اسمًا للمتجر من حرفين إلى 120 حرفًا.',
  planUnavailable: 'هذه الخطة غير متاحة للتجربة الآن.', profileInactive: 'هذا الحساب غير نشط.',
  subscriptionReview: 'الاشتراك الحالي يحتاج مراجعة قبل إنشاء متجر.',
  modeDisabled: 'هذا المسار مخفي حسب طريقة تشغيل النشاط الحالية. يمكنك تغييره من إعدادات النشاط؛ وتظل البيانات السابقة محفوظة.',
} : {
  title: 'Dashboard', subtitle: 'Review your shop and the features available today.',
  setupTitle: 'Create your first shop', setupBody: 'Start a trial of your chosen plan. Your shop is created in Supabase under your signed-in account.',
  shopName: 'Shop name', plan: 'Trial plan', createShop: 'Create shop', creating: 'Creating...',
  businessMode: 'Business operation mode', businessModeHelp: 'Controls product and service workflow visibility without changing your subscription plan.',
  productMode: 'Products and stock', productModeBody: 'For sales, purchasing, suppliers, and inventory operations.',
  serviceMode: 'Services only', serviceModeBody: 'For delivering services without requiring stock records.',
  mixedMode: 'Products and services', mixedModeBody: 'Shows both product and service workflows.',
  loadingPlans: 'Loading plans...', noPlans: 'No plans are currently available for a trial.',
  reviewTitle: 'System review status', ready: 'Available now', next: 'In progress',
  readyBody: 'Account, sign-in, plans, shop creation, products, services, supplier purchases, manual inventory, expenses, and subscription and invoice reads.',
  nextBody: 'Sales, supplier payments and returns, other income, employees, and reports are in progress.',
  planStatus: 'Plan status', trialEnds: 'Trial ends', periodEnds: 'Period ends', owner: 'Owner', employee: 'Employee',
  recentInvoices: 'Recent invoices', noInvoices: 'No invoices are visible to your account yet.',
  invoiceNumber: 'Invoice number', client: 'Client', amount: 'Total', date: 'Date',
  loadFailed: 'Could not load this data.', retry: 'Retry',
  noShopAfterCreate: 'The shop was created but could not be loaded. Refresh this page.',
  setupFailed: 'Could not create the shop.', invalidName: 'Enter a shop name between 2 and 120 characters.',
  planUnavailable: 'This plan is not available for a trial right now.', profileInactive: 'This account is inactive.',
  subscriptionReview: 'The current subscription needs review before creating a shop.',
  modeDisabled: 'This workflow is hidden by the current business mode. You can change it in Business settings; existing history remains preserved.',
})

const modeOptions = computed(() => BUSINESS_MODES.map(value => ({
  value,
  label: value === 'product' ? copy.value.productMode : value === 'service' ? copy.value.serviceMode : copy.value.mixedMode,
  body: value === 'product' ? copy.value.productModeBody : value === 'service' ? copy.value.serviceModeBody : copy.value.mixedModeBody,
})))
const modeDisabledNotice = computed(() => route.query.modeDisabled === 'product' || route.query.modeDisabled === 'service')

const { data: subscription, error: subscriptionError, refresh: refreshSubscription } = useAsyncData(
  'shop-data:subscription', async () => {
    if (!currentId.value || !isOwner.value || !currentMembership.value) return null
    const { data, error } = await supabase.from('subscriptions')
      .select('status,trial_end_at,current_period_end,plan_id')
      .eq('profile_id', currentMembership.value.profile_id).maybeSingle()
    if (error) throw error
    return data as Subscription | null
  }, { watch: [currentId], default: () => null },
)

const { data: invoices, pending: invoicesPending, error: invoicesError, refresh: refreshInvoices } = useAsyncData(
  'shop-data:recent-invoices', async () => {
    if (!currentId.value) return []
    const { data, error } = await supabase.from('invoices')
      .select('id,invoice_number,client_name_snapshot,total_amount,created_at')
      .eq('shop_id', currentId.value).in('status', ['issued', 'paid'])
      .order('created_at', { ascending: false }).limit(8)
    if (error) throw error
    return (data ?? []) as Invoice[]
  }, { watch: [currentId], default: () => [] },
)

const currentPlan = computed(() => plans.value?.find(plan => plan.id === subscription.value?.plan_id))

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(value))
}

function money(value: number, currency = 'EGP') {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(value)
}

function setupErrorText(message?: string) {
  if (message === 'INVALID_SHOP_NAME') return copy.value.invalidName
  if (message === 'PLAN_UNAVAILABLE') return copy.value.planUnavailable
  if (message === 'PROFILE_INACTIVE') return copy.value.profileInactive
  if (message === 'SUBSCRIPTION_REQUIRES_REVIEW') return copy.value.subscriptionReview
  return message || copy.value.setupFailed
}

async function createShop() {
  if (setupPending.value || current.value) return
  setupError.value = ''
  const name = setupName.value.trim()
  if (name.length < 2 || name.length > 120) { setupError.value = copy.value.invalidName; return }
  if (!selectablePlans.value.some(plan => plan.slug === selectedPlan.value)) {
    setupError.value = copy.value.planUnavailable
    return
  }
  setupPending.value = true
  try {
    const { error } = await shopRpc.rpc('create_owner_shop', {
      p_shop_name: name,
      p_plan_slug: selectedPlan.value,
      p_business_mode: setupMode.value,
    })
    if (error) throw error
    await reload()
    if (!currentId.value) throw new Error(copy.value.noShopAfterCreate)
    await Promise.all([refreshSubscription(), refreshInvoices()])
  } catch (error) {
    setupError.value = setupErrorText(error instanceof Error ? error.message : undefined)
  } finally {
    setupPending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <p v-if="modeDisabledNotice" role="status" class="rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm text-[var(--bs-status-warning)]">{{ copy.modeDisabled }}</p>
    <section v-if="!current" class="mx-auto max-w-3xl pt-6 lg:pt-12">
      <div class="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div class="border-b border-border bg-[var(--bs-deep-structure-navy)] p-6 text-white sm:p-8">
          <div class="mb-5 grid size-12 place-items-center rounded-2xl border border-[var(--bs-accent)]/30 bg-[var(--bs-primary)]"><AppIcon name="store" class="size-6 text-[var(--bs-highlight-gold)]" /></div>
          <h1 class="text-2xl font-extrabold sm:text-3xl">{{ copy.setupTitle }}</h1>
          <p class="mt-2 max-w-xl text-sm leading-6 text-white/60">{{ copy.setupBody }}</p>
        </div>
        <form class="space-y-6 p-6 sm:p-8" @submit.prevent="createShop">
          <p v-if="setupError" role="alert" class="rounded-xl border border-[var(--bs-status-error)]/30 bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ setupError }}</p>
          <div class="space-y-2"><label for="shop-name" class="text-sm font-bold">{{ copy.shopName }}</label><input id="shop-name" v-model="setupName" type="text" minlength="2" maxlength="120" required class="ls-input"></div>
          <fieldset class="space-y-3">
            <legend class="text-sm font-bold">{{ copy.businessMode }}</legend>
            <p class="text-sm text-muted-foreground">{{ copy.businessModeHelp }}</p>
            <div class="grid gap-3 sm:grid-cols-3">
              <label v-for="mode in modeOptions" :key="mode.value" class="cursor-pointer rounded-2xl border p-4" :class="setupMode === mode.value ? 'border-[var(--bs-accent)] ring-2 ring-[var(--bs-accent)]/15' : 'border-border'">
                <input v-model="setupMode" type="radio" name="business-mode" :value="mode.value" class="me-2">
                <span class="font-extrabold">{{ mode.label }}</span>
                <span class="mt-2 block text-xs leading-5 text-muted-foreground">{{ mode.body }}</span>
              </label>
            </div>
          </fieldset>
          <fieldset class="space-y-3">
            <legend class="text-sm font-bold">{{ copy.plan }}</legend>
            <p v-if="plansPending" class="text-sm text-muted-foreground">{{ copy.loadingPlans }}</p>
            <p v-else-if="plansError" role="alert" class="text-sm text-[var(--bs-status-error)]">{{ copy.loadFailed }} <button type="button" class="underline" @click="refreshPlans()">{{ copy.retry }}</button></p>
            <p v-else-if="!selectablePlans.length" class="text-sm text-muted-foreground">{{ copy.noPlans }}</p>
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <label v-for="plan in selectablePlans" :key="plan.id" class="cursor-pointer rounded-2xl border p-4 transition" :class="selectedPlan === plan.slug ? 'border-[var(--bs-accent)] bg-[var(--bs-accent)]/5 ring-2 ring-[var(--bs-accent)]/15' : 'border-border bg-background hover:border-muted-foreground/50'">
                <input v-model="selectedPlan" type="radio" name="plan" :value="plan.slug" class="sr-only">
                <div class="flex items-start justify-between gap-3"><div><p class="font-extrabold">{{ plan.name }}</p><p class="mt-1 text-xs text-muted-foreground">{{ plan.trial_days }} {{ isArabic ? 'يوم تجربة' : 'day trial' }}</p></div><p class="text-sm font-extrabold text-[var(--bs-link)]">{{ money(plan.price_amount, plan.currency) }}</p></div>
              </label>
            </div>
          </fieldset>
          <button type="submit" class="ls-btn ls-btn-primary w-full" :disabled="setupPending || !selectablePlans.length">{{ setupPending ? copy.creating : copy.createShop }}</button>
        </form>
      </div>
    </section>

    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4"><div><p class="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--bs-link)]">{{ current.name }}</p><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div><span class="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold">{{ isOwner ? copy.owner : copy.employee }}</span></header>
      <section v-if="isOwner" class="rounded-2xl border border-border bg-card p-5">
        <h2 class="font-extrabold">{{ copy.planStatus }}</h2>
        <p v-if="subscriptionError" role="alert" class="mt-3 text-sm text-[var(--bs-status-error)]">{{ copy.loadFailed }} <button type="button" class="underline" @click="refreshSubscription()">{{ copy.retry }}</button></p>
        <div v-else-if="subscription" class="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm"><p><span class="text-muted-foreground">{{ currentPlan?.name || copy.plan }}:</span> <strong>{{ subscription.status }}</strong></p><p v-if="subscription.trial_end_at"><span class="text-muted-foreground">{{ copy.trialEnds }}:</span> {{ formatDate(subscription.trial_end_at) }}</p><p v-else-if="subscription.current_period_end"><span class="text-muted-foreground">{{ copy.periodEnds }}:</span> {{ formatDate(subscription.current_period_end) }}</p></div>
        <p v-else class="mt-3 text-sm text-muted-foreground">{{ copy.loadFailed }}</p>
      </section>
      <section class="overflow-hidden rounded-2xl border border-border bg-card">
        <div class="border-b border-border px-5 py-4"><h2 class="font-extrabold">{{ copy.recentInvoices }}</h2></div>
        <div v-if="invoicesPending" class="space-y-3 p-5"><div v-for="index in 3" :key="index" class="h-11 animate-pulse rounded-lg bg-muted" /></div>
        <p v-else-if="invoicesError" role="alert" class="p-5 text-sm text-[var(--bs-status-error)]">{{ copy.loadFailed }} <button type="button" class="underline" @click="refreshInvoices()">{{ copy.retry }}</button></p>
        <div v-else-if="invoices?.length" class="overflow-x-auto"><BsDataTable :value="invoices" data-key="id" :row-class="() => 'border-t border-border'">
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
    <template #header>{{ copy.date }}</template>
    <template #body="{ data: invoice }">{{ formatDate(invoice.created_at) }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4 font-semibold">
    <template #header>{{ copy.invoiceNumber }}</template>
    <template #body="{ data: invoice }">{{ invoice.invoice_number }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-start" body-class="px-5 py-4">
    <template #header>{{ copy.client }}</template>
    <template #body="{ data: invoice }">{{ invoice.client_name_snapshot || '—' }}</template>
  </Column>
  <Column header-class="px-5 py-3 text-end" body-class="px-5 py-4 text-end font-bold">
    <template #header>{{ copy.amount }}</template>
    <template #body="{ data: invoice }">{{ money(Number(invoice.total_amount)) }}</template>
  </Column>
</BsDataTable></div>
        <p v-else class="p-8 text-center text-sm text-muted-foreground">{{ copy.noInvoices }}</p>
      </section>
    </template>

    <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 class="text-lg font-extrabold">{{ copy.reviewTitle }}</h2><div class="mt-4 grid gap-4 sm:grid-cols-2"><div class="rounded-xl border border-[var(--bs-status-success)]/25 bg-[var(--bs-status-success-bg)] p-4 dark:bg-[var(--bs-status-success-bg)]"><p class="text-sm font-bold text-[var(--bs-status-success)] dark:text-[var(--bs-status-success)]">{{ copy.ready }}</p><p class="mt-2 text-sm leading-6">{{ copy.readyBody }}</p></div><div class="rounded-xl border border-[var(--bs-status-warning)]/25 bg-[var(--bs-status-warning-bg)] p-4 dark:bg-[var(--bs-status-warning-bg)]"><p class="text-sm font-bold text-[var(--bs-status-warning)] dark:text-[var(--bs-status-warning)]">{{ copy.next }}</p><p class="mt-2 text-sm leading-6">{{ copy.nextBody }}</p></div></div></section>
  </div>
</template>
