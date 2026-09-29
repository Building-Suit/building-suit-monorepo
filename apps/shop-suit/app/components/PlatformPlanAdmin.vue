<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { PlatformPlan, PlatformPlanShop } from '~/types/platformAdmin'

const props = withDefaults(defineProps<{ mode?: 'catalog' | 'shop'; shopId?: string | null; canMutate: boolean }>(), {
  mode: 'catalog', shopId: null,
})
const emit = defineEmits<{ changed: [] }>()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const dialog = ref<'terms' | 'availability' | 'change' | 'override' | null>(null)
const pending = ref(false)
const commandError = ref('')
const requestId = ref<string | null>(null)
const selectedPlan = ref<PlatformPlan | null>(null)
const terms = reactive({ displayName: '', billingInterval: 'monthly', currency: 'EGP', priceAmount: 0, effectiveFrom: '', active_locations: null as number | null, active_members: null as number | null, active_products: null as number | null, active_services: null as number | null, reason: '' })
const availability = reactive({ isActive: false, isPublic: false, isPurchasable: false, isComingSoon: false, reason: '' })
const subscriptionAction = reactive({ planId: '', timing: 'automatic', reason: '' })
const price = reactive({ amount: 0, currency: 'EGP', effectiveFrom: '', expiresAt: '', reason: '' })

async function read<T>(resource: 'catalog' | 'shop') {
  const { data, error } = await rpc.rpc('platform_plan_read', {
    p_resource: resource, p_shop_id: resource === 'shop' ? props.shopId : null,
  })
  if (error) throw error
  return data as T
}

const { data: catalog, pending: catalogPending, error: catalogError, refresh: refreshCatalog } = await useAsyncData(
  'platform-plan-admin:catalog',
  () => props.mode === 'catalog' ? read<{ items: PlatformPlan[] }>('catalog') : Promise.resolve(null),
  { watch: [() => props.mode] },
)
const { data: shopPlan, pending: shopPending, error: shopError, refresh: refreshShop } = await useAsyncData(
  () => `platform-plan-admin:shop:${props.shopId || 'none'}`,
  () => props.mode === 'shop' && props.shopId ? read<PlatformPlanShop>('shop') : Promise.resolve(null),
  { watch: [() => props.mode, () => props.shopId] },
)

function isoLocal(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function openTerms(plan: PlatformPlan) {
  selectedPlan.value = plan
  Object.assign(terms, {
    displayName: plan.name, billingInterval: plan.billingInterval, currency: plan.currency,
    priceAmount: plan.priceAmount, effectiveFrom: isoLocal(),
    active_locations: plan.resourceLimits.active_locations ?? null,
    active_members: plan.resourceLimits.active_members ?? null,
    active_products: plan.resourceLimits.active_products ?? null,
    active_services: plan.resourceLimits.active_services ?? null, reason: '',
  })
  commandError.value = ''; requestId.value = null; dialog.value = 'terms'
}

function openAvailability(plan: PlatformPlan) {
  selectedPlan.value = plan
  Object.assign(availability, { isActive: plan.isActive, isPublic: plan.isPublic, isPurchasable: plan.isPurchasable, isComingSoon: plan.isComingSoon, reason: '' })
  commandError.value = ''; requestId.value = null; dialog.value = 'availability'
}

function openChange() {
  const current = shopPlan.value?.subscription
  subscriptionAction.planId = current?.planId || shopPlan.value?.availablePlans[0]?.planId || ''
  subscriptionAction.timing = 'automatic'; subscriptionAction.reason = ''
  commandError.value = ''; requestId.value = null; dialog.value = 'change'
}

function openOverride() {
  const current = shopPlan.value?.subscription
  Object.assign(price, { amount: current?.effectivePriceAmount || current?.listPriceAmount || 0, currency: current?.currency || 'EGP', effectiveFrom: isoLocal(), expiresAt: '', reason: '' })
  commandError.value = ''; requestId.value = null; dialog.value = 'override'
}

async function command(action: ShopRpcDatabase['public']['Functions']['platform_plan_command']['Args']['p_action'], options: { planId?: string | null; payload?: Record<string, unknown>; reason: string }) {
  if (!props.canMutate || pending.value) return
  if (options.reason.trim().length < 2) { commandError.value = copy.value.reasonRequired; return }
  pending.value = true; commandError.value = ''
  const id = requestId.value ?? globalThis.crypto.randomUUID()
  requestId.value = id
  try {
    const { error } = await rpc.rpc('platform_plan_command', {
      p_request_id: id, p_action: action, p_reason: options.reason.trim(),
      p_plan_id: options.planId ?? null, p_shop_id: props.mode === 'shop' ? props.shopId : null,
      p_payload: options.payload ?? {},
    })
    if (error) throw error
    requestId.value = null; dialog.value = null
    await Promise.all([refreshCatalog(), refreshShop()])
    emit('changed')
    pushToast({ tone: 'success', title: copy.value.saved })
  }
  catch (error) { commandError.value = error instanceof Error ? error.message : copy.value.failed }
  finally { pending.value = false }
}

async function publishTerms() {
  const limits = { active_locations: terms.active_locations, active_members: terms.active_members, active_products: terms.active_products, active_services: terms.active_services }
  if (!selectedPlan.value || !terms.displayName.trim() || !terms.effectiveFrom || terms.priceAmount < 0
    || Object.values(limits).some(value => value !== null && (!Number.isInteger(value) || value < 1))) {
    commandError.value = copy.value.invalidTerms; return
  }
  await command('publish_terms', { planId: selectedPlan.value.id, reason: terms.reason, payload: {
    displayName: terms.displayName.trim(), billingInterval: terms.billingInterval,
    currency: terms.currency.trim().toUpperCase(), priceAmount: terms.priceAmount,
    resourceLimits: limits, effectiveFrom: new Date(terms.effectiveFrom).toISOString(),
  } })
}

async function saveAvailability() {
  if (!selectedPlan.value) return
  if (availability.isPurchasable && !availability.isPublic) { commandError.value = copy.value.publicRequired; return }
  await command('set_availability', { planId: selectedPlan.value.id, reason: availability.reason, payload: {
    isActive: availability.isActive, isPublic: availability.isPublic,
    isPurchasable: availability.isPurchasable, isComingSoon: availability.isComingSoon,
  } })
}

const targetPlan = computed(() => shopPlan.value?.availablePlans.find(plan => plan.planId === subscriptionAction.planId) ?? null)

async function changePlan() {
  if (!targetPlan.value) return
  if (targetPlan.value.blockers.length) { commandError.value = copy.value.blocked; return }
  await command('change_subscription', { planId: targetPlan.value.planId, reason: subscriptionAction.reason, payload: { timing: subscriptionAction.timing } })
}

async function simpleAction(action: 'renew_subscription' | 'suspend_subscription' | 'remove_price_override') {
  if (action === 'suspend_subscription' && !await confirmation.ask(copy.value.suspendConfirm)) return
  await command(action, { reason: subscriptionAction.reason || price.reason, payload: {} })
}

async function saveOverride() {
  if (!(price.amount > 0) || !price.effectiveFrom) { commandError.value = copy.value.invalidPrice; return }
  await command('set_price_override', { reason: price.reason, payload: {
    amount: price.amount, currency: price.currency, effectiveFrom: new Date(price.effectiveFrom).toISOString(),
    expiresAt: price.expiresAt ? new Date(price.expiresAt).toISOString() : null,
  } })
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
}
function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
}
function limit(value: number | null | undefined) { return value == null ? copy.value.unlimited : String(value) }

const en = {
  catalog: 'Plans', catalogHelp: 'Current and future-effective commercial catalog versions. Historical versions cannot be edited or deleted.',
  plan: 'Plan', state: 'State', price: 'List price', limits: 'Resource limits', version: 'Version', subscriptions: 'Subscriptions', actions: 'Actions',
  active: 'Active', inactive: 'Inactive', public: 'Public', private: 'Private', purchasable: 'Purchasable', unavailable: 'Unavailable', comingSoon: 'Coming soon',
  nextVersion: 'Scheduled version', effective: 'Effective', editTerms: 'Publish new version', availability: 'Availability', noPlans: 'No catalog plans.', loadFailed: 'Could not load plan controls.', retry: 'Retry',
  displayName: 'Display name', interval: 'Billing interval', currency: 'Currency', effectiveFrom: 'Effective from', reason: 'Reason', reasonRequired: 'Enter an explicit reason of at least two characters.', save: 'Apply and audit', cancel: 'Cancel', saved: 'The plan control was applied and audited.', failed: 'The plan control could not be applied.', invalidTerms: 'Enter valid terms, limits, price, and effective date.', publicRequired: 'A purchasable plan must be public.',
  active_locations: 'Locations', active_members: 'Members', active_products: 'Products', active_services: 'Services', unlimited: 'Unlimited',
  subscription: 'Customer subscription', currentPlan: 'Current plan', access: 'State', effectivePrice: 'Effective customer price', usage: 'Usage against enforced limits', pendingBilling: 'Pending billing requests', pendingChange: 'Scheduled plan change', noPendingChange: 'No scheduled plan change.',
  changePlan: 'Activate or switch plan', targetPlan: 'Target plan', timing: 'Timing', automatic: 'Automatic (upgrades now, downgrades at renewal)', immediate: 'Immediate operator override', periodEnd: 'Next renewal boundary', blockers: 'Downgrade blockers', blocked: 'The plan cannot be applied while the listed resources exceed its limits.', excess: 'over',
  renew: 'Renew one catalog term', suspend: 'Suspend subscription', suspendConfirm: 'Suspend this subscription? History remains readable while writes stop.', negotiatedPrice: 'Negotiated/founder price', setPrice: 'Set or change price', removePrice: 'Remove active override', amount: 'Amount', expiresAt: 'Optional expiry', invalidPrice: 'Enter a positive amount and effective date.', observer: 'Observer access is read-only.',
}
const ar = {
  catalog: 'الخطط', catalogHelp: 'إصدارات الكتالوج التجارية الحالية والمجدولة. لا يمكن تعديل أو حذف الإصدارات التاريخية.',
  plan: 'الخطة', state: 'الحالة', price: 'السعر المعلن', limits: 'حدود الموارد', version: 'الإصدار', subscriptions: 'الاشتراكات', actions: 'الإجراءات',
  active: 'نشطة', inactive: 'غير نشطة', public: 'عامة', private: 'خاصة', purchasable: 'متاحة للشراء', unavailable: 'غير متاحة', comingSoon: 'قريبًا',
  nextVersion: 'إصدار مجدول', effective: 'السريان', editTerms: 'نشر إصدار جديد', availability: 'الإتاحة', noPlans: 'لا توجد خطط.', loadFailed: 'تعذّر تحميل ضوابط الخطط.', retry: 'إعادة المحاولة',
  displayName: 'الاسم المعروض', interval: 'دورة الفوترة', currency: 'العملة', effectiveFrom: 'يسري من', reason: 'السبب', reasonRequired: 'اكتب سببًا صريحًا من حرفين على الأقل.', save: 'تطبيق وتسجيل', cancel: 'إلغاء', saved: 'تم تطبيق إجراء الخطة وتسجيله.', failed: 'تعذّر تطبيق إجراء الخطة.', invalidTerms: 'أدخل شروطًا وحدودًا وسعرًا وتاريخ سريان صالحًا.', publicRequired: 'يجب أن تكون الخطة المتاحة للشراء عامة.',
  active_locations: 'الفروع', active_members: 'الأعضاء', active_products: 'المنتجات', active_services: 'الخدمات', unlimited: 'غير محدود',
  subscription: 'اشتراك العميل', currentPlan: 'الخطة الحالية', access: 'الحالة', effectivePrice: 'السعر الفعلي للعميل', usage: 'الاستخدام مقابل الحدود المطبقة', pendingBilling: 'طلبات الفوترة المعلقة', pendingChange: 'تغيير خطة مجدول', noPendingChange: 'لا يوجد تغيير مجدول.',
  changePlan: 'تفعيل أو تغيير الخطة', targetPlan: 'الخطة المستهدفة', timing: 'التوقيت', automatic: 'تلقائي (الترقية الآن والتخفيض عند التجديد)', immediate: 'فوري بتجاوز صريح من المسؤول', periodEnd: 'عند التجديد القادم', blockers: 'عوائق التخفيض', blocked: 'لا يمكن تطبيق الخطة ما دامت الموارد المذكورة تتجاوز حدودها.', excess: 'زائد',
  renew: 'تجديد لمدة كتالوج واحدة', suspend: 'إيقاف الاشتراك', suspendConfirm: 'إيقاف الاشتراك؟ سيبقى السجل مقروءًا وتتوقف الكتابة.', negotiatedPrice: 'سعر تفاوضي/تأسيسي', setPrice: 'تعيين أو تغيير السعر', removePrice: 'إزالة التجاوز النشط', amount: 'المبلغ', expiresAt: 'انتهاء اختياري', invalidPrice: 'أدخل مبلغًا موجبًا وتاريخ سريان.', observer: 'صلاحية المراقب للقراءة فقط.',
}
</script>

<template>
  <section v-if="mode === 'catalog'" class="overflow-hidden rounded-2xl border border-border bg-card">
    <div class="border-b border-border p-5"><h2 class="text-lg font-extrabold">{{ copy.catalog }}</h2><p class="mt-2 text-sm text-muted-foreground">{{ copy.catalogHelp }}</p><p v-if="!canMutate" class="mt-2 text-sm font-bold">{{ copy.observer }}</p></div>
    <BsDataTable :value="catalog?.items ?? []" :loading="catalogPending" :error="catalogError ? copy.loadFailed : null" :label="copy.catalog" data-key="id" @retry="refreshCatalog()">
      <Column><template #header>{{ copy.plan }}</template><template #body="{ data: plan }"><p class="font-bold">{{ plan.name }}</p><p class="text-xs text-muted-foreground">{{ plan.slug }}</p></template></Column>
      <Column><template #header>{{ copy.state }}</template><template #body="{ data: plan }"><p>{{ plan.isActive ? copy.active : copy.inactive }} · {{ plan.isPublic ? copy.public : copy.private }}</p><p class="text-xs text-muted-foreground">{{ plan.isPurchasable ? copy.purchasable : copy.unavailable }}<span v-if="plan.isComingSoon"> · {{ copy.comingSoon }}</span></p></template></Column>
      <Column><template #header>{{ copy.price }}</template><template #body="{ data: plan }">{{ money(plan.priceAmount, plan.currency) }} / {{ plan.billingInterval }}</template></Column>
      <Column><template #header>{{ copy.limits }}</template><template #body="{ data: plan }"><ul class="text-xs"><li v-for="key in ['active_locations','active_members','active_products','active_services']" :key="key">{{ copy[key as keyof typeof copy] }}: {{ limit(plan.resourceLimits[key]) }}</li></ul></template></Column>
      <Column><template #header>{{ copy.version }}</template><template #body="{ data: plan }"><p>v{{ plan.catalogVersion }} · {{ date(plan.effectiveFrom) }}</p><p v-if="plan.nextTerms" class="text-xs font-bold text-[var(--bs-status-warning)]">{{ copy.nextVersion }} v{{ plan.nextTerms.version }} · {{ date(plan.nextTerms.effectiveFrom) }}</p></template></Column>
      <Column field="subscriptionCount"><template #header>{{ copy.subscriptions }}</template></Column>
      <Column v-if="canMutate"><template #header>{{ copy.actions }}</template><template #body="{ data: plan }"><div class="flex flex-wrap gap-2"><BsButton class="ls-btn" @click="openTerms(plan)">{{ copy.editTerms }}</BsButton><BsButton class="ls-btn" @click="openAvailability(plan)">{{ copy.availability }}</BsButton></div></template></Column>
      <template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.noPlans }}</p></template>
    </BsDataTable>
  </section>

  <section v-else class="space-y-4">
    <p v-if="shopError" role="alert" class="ls-error">{{ copy.loadFailed }} <BsButton @click="refreshShop()">{{ copy.retry }}</BsButton></p>
    <div v-else-if="shopPending" class="h-40 animate-pulse rounded-2xl bg-muted" />
    <template v-else-if="shopPlan?.subscription">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BsKpiCard :title="copy.currentPlan">{{ shopPlan.subscription.planName }}</BsKpiCard>
        <BsKpiCard :title="copy.access"><StatusBadge :status="shopPlan.subscription.accessState" /></BsKpiCard>
        <BsKpiCard :title="copy.effectivePrice">{{ money(shopPlan.subscription.effectivePriceAmount, shopPlan.subscription.currency) }}<span v-if="shopPlan.subscription.priceSource === 'override'" class="ms-1 text-xs">({{ copy.negotiatedPrice }})</span></BsKpiCard>
        <BsKpiCard :title="copy.pendingBilling">{{ shopPlan.subscription.pendingBillingRequests }}</BsKpiCard>
      </div>
      <div><h4 class="font-extrabold">{{ copy.usage }}</h4><div class="mt-2 grid gap-2 sm:grid-cols-2"><div v-for="resource in shopPlan.subscription.usage.resources" :key="resource.resource" class="rounded-xl border border-border p-3 text-sm"><p class="font-bold">{{ copy[resource.resource as keyof typeof copy] }}</p><p :class="resource.overLimit ? 'text-[var(--bs-status-error)]' : 'text-muted-foreground'">{{ resource.used }} / {{ limit(resource.limit) }}<span v-if="resource.overLimit"> · +{{ resource.used - (resource.limit || 0) }} {{ copy.excess }}</span></p></div></div></div>
      <div class="rounded-xl border border-border p-4"><h4 class="font-extrabold">{{ copy.pendingChange }}</h4><p v-if="shopPlan.subscription.pendingPlanChange" class="mt-2 text-sm">{{ shopPlan.subscription.pendingPlanChange.targetPlanName }} · {{ date(shopPlan.subscription.pendingPlanChange.effectiveAt) }} · {{ shopPlan.subscription.pendingPlanChange.reason }}</p><p v-else class="mt-2 text-sm text-muted-foreground">{{ copy.noPendingChange }}</p></div>
      <div v-if="canMutate" class="flex flex-wrap gap-2"><BsButton class="ls-btn ls-btn-primary" @click="openChange">{{ copy.changePlan }}</BsButton><BsButton class="ls-btn" @click="subscriptionAction.reason = ''; commandError = ''; requestId = null; dialog = 'change'">{{ copy.renew }}</BsButton><BsButton class="ls-btn" @click="openOverride">{{ copy.setPrice }}</BsButton><BsButton v-if="shopPlan.subscription.priceOverrideId" class="ls-btn" @click="price.reason = ''; commandError = ''; requestId = null; dialog = 'override'">{{ copy.removePrice }}</BsButton><BsButton class="ls-btn" @click="subscriptionAction.reason = ''; commandError = ''; requestId = null; dialog = 'change'">{{ copy.suspend }}</BsButton></div>
    </template>
  </section>

  <BsDialog :visible="dialog === 'terms'" :title="`${copy.editTerms} · ${selectedPlan?.name || ''}`" :pending="pending" @update:visible="value => { if (!value) dialog = null }"><BsForm class="space-y-4" :pending="pending" :error="commandError" @submit="publishTerms"><label class="grid gap-2 text-sm font-bold">{{ copy.displayName }}<input v-model="terms.displayName" class="ls-input" maxlength="120" required></label><div class="grid gap-4 sm:grid-cols-2"><label class="grid gap-2 text-sm font-bold">{{ copy.price }}<input v-model.number="terms.priceAmount" class="ls-input" type="number" min="0" step="1" required></label><label class="grid gap-2 text-sm font-bold">{{ copy.currency }}<input v-model="terms.currency" class="ls-input" maxlength="3" required></label><label class="grid gap-2 text-sm font-bold">{{ copy.interval }}<select v-model="terms.billingInterval" class="ls-select"><option value="monthly">monthly</option><option value="quarterly">quarterly</option><option value="annual">annual</option></select></label><label class="grid gap-2 text-sm font-bold">{{ copy.effectiveFrom }}<input v-model="terms.effectiveFrom" class="ls-input" type="datetime-local" required></label><label v-for="key in ['active_locations','active_members','active_products','active_services']" :key="key" class="grid gap-2 text-sm font-bold">{{ copy[key as keyof typeof copy] }}<input v-model.number="terms[key as keyof typeof terms]" class="ls-input" type="number" min="1" step="1" :placeholder="copy.unlimited"></label></div><label class="grid gap-2 text-sm font-bold">{{ copy.reason }}<textarea v-model="terms.reason" class="ls-input" minlength="2" maxlength="1000" required /></label><div class="flex gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary">{{ copy.save }}</BsButton><BsButton type="button" class="ls-btn" @click="dialog = null">{{ copy.cancel }}</BsButton></div></BsForm></BsDialog>
  <BsDialog :visible="dialog === 'availability'" :title="`${copy.availability} · ${selectedPlan?.name || ''}`" :pending="pending" @update:visible="value => { if (!value) dialog = null }"><BsForm class="space-y-4" :pending="pending" :error="commandError" @submit="saveAvailability"><label class="flex gap-2"><input v-model="availability.isActive" type="checkbox">{{ copy.active }}</label><label class="flex gap-2"><input v-model="availability.isPublic" type="checkbox">{{ copy.public }}</label><label class="flex gap-2"><input v-model="availability.isPurchasable" type="checkbox">{{ copy.purchasable }}</label><label class="flex gap-2"><input v-model="availability.isComingSoon" type="checkbox">{{ copy.comingSoon }}</label><label class="grid gap-2 text-sm font-bold">{{ copy.reason }}<textarea v-model="availability.reason" class="ls-input" minlength="2" maxlength="1000" required /></label><div class="flex gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary">{{ copy.save }}</BsButton><BsButton type="button" class="ls-btn" @click="dialog = null">{{ copy.cancel }}</BsButton></div></BsForm></BsDialog>
  <BsDialog :visible="dialog === 'change'" :title="copy.changePlan" :pending="pending" @update:visible="value => { if (!value) dialog = null }"><BsForm class="space-y-4" :pending="pending" :error="commandError" @submit="changePlan"><label class="grid gap-2 text-sm font-bold">{{ copy.targetPlan }}<select v-model="subscriptionAction.planId" class="ls-select"><option v-for="plan in shopPlan?.availablePlans || []" :key="plan.planId" :value="plan.planId">{{ plan.planName }} · {{ money(plan.listPriceAmount, plan.currency) }}</option></select></label><label class="grid gap-2 text-sm font-bold">{{ copy.timing }}<select v-model="subscriptionAction.timing" class="ls-select"><option value="automatic">{{ copy.automatic }}</option><option value="period_end">{{ copy.periodEnd }}</option><option value="immediate">{{ copy.immediate }}</option></select></label><div v-if="targetPlan?.blockers.length" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3"><p class="font-bold">{{ copy.blockers }}</p><ul class="mt-2 text-sm"><li v-for="blocker in targetPlan.blockers" :key="blocker.resource">{{ copy[blocker.resource as keyof typeof copy] }}: {{ blocker.used }} / {{ blocker.limit }} (+{{ blocker.excess }})</li></ul></div><label class="grid gap-2 text-sm font-bold">{{ copy.reason }}<textarea v-model="subscriptionAction.reason" class="ls-input" minlength="2" maxlength="1000" required /></label><div class="flex flex-wrap gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="Boolean(targetPlan?.blockers.length)">{{ copy.changePlan }}</BsButton><BsButton type="button" class="ls-btn" @click="simpleAction('renew_subscription')">{{ copy.renew }}</BsButton><BsButton type="button" class="ls-btn" @click="simpleAction('suspend_subscription')">{{ copy.suspend }}</BsButton><BsButton type="button" class="ls-btn" @click="dialog = null">{{ copy.cancel }}</BsButton></div></BsForm></BsDialog>
  <BsDialog :visible="dialog === 'override'" :title="copy.negotiatedPrice" :pending="pending" @update:visible="value => { if (!value) dialog = null }"><BsForm class="space-y-4" :pending="pending" :error="commandError" @submit="saveOverride"><label class="grid gap-2 text-sm font-bold">{{ copy.amount }}<input v-model.number="price.amount" class="ls-input" type="number" min="0.01" step="0.01" required></label><label class="grid gap-2 text-sm font-bold">{{ copy.currency }}<input v-model="price.currency" class="ls-input" maxlength="3" required></label><label class="grid gap-2 text-sm font-bold">{{ copy.effectiveFrom }}<input v-model="price.effectiveFrom" class="ls-input" type="datetime-local" required></label><label class="grid gap-2 text-sm font-bold">{{ copy.expiresAt }}<input v-model="price.expiresAt" class="ls-input" type="datetime-local"></label><label class="grid gap-2 text-sm font-bold">{{ copy.reason }}<textarea v-model="price.reason" class="ls-input" minlength="2" maxlength="1000" required /></label><div class="flex flex-wrap gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary">{{ copy.setPrice }}</BsButton><BsButton v-if="shopPlan?.subscription?.priceOverrideId" type="button" class="ls-btn" @click="simpleAction('remove_price_override')">{{ copy.removePrice }}</BsButton><BsButton type="button" class="ls-btn" @click="dialog = null">{{ copy.cancel }}</BsButton></div></BsForm></BsDialog>
</template>
