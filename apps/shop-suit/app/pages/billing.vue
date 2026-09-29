<script setup lang="ts">
import type { BillingPlanOption, BillingSubmission, ShopBilling } from '~/types/billing'
import type { PlanResourceKey, PlanUsageResource } from '~/types/plans'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const ui = useUiCopy()
const { current, currentId, isOwner } = useShop()
const { push: pushToast } = useToasts()
const confirmation = useConfirmation()
const { data: publicPlans, isLoading: catalogPending, error: catalogError, refresh: refreshCatalog } = usePlans()
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const form = reactive({ planSlug: '', paidAmount: 0, transferDate: '', transferReference: '' })
const submitPending = ref(false)
const submitError = ref('')
const submitRequestId = ref<string | null>(null)

const { data: billing, pending, error, refresh } = await useAsyncData(
  'shop-data:billing',
  async (): Promise<ShopBilling | null> => {
    if (!currentId.value || !isOwner.value) return null
    const requestedShopId = currentId.value
    const { data, error: readError } = await rpc.rpc('shop_billing_read', { p_shop_id: requestedShopId })
    if (readError) throw readError
    if (requestedShopId !== currentId.value) return null
    return data as ShopBilling
  },
  { watch: [currentId, isOwner] },
)

const publicPlanSlugs = computed(() => new Set((publicPlans.value ?? [])
  .filter(plan => plan.is_purchasable && !plan.is_coming_soon)
  .map(plan => plan.slug)))
const purchasablePlans = computed(() => (billing.value?.availablePlans ?? [])
  .filter(plan => publicPlanSlugs.value.has(plan.planSlug)))
const selectedPlan = computed(() => purchasablePlans.value.find(plan => plan.planSlug === form.planSlug) ?? null)
const latestSubmission = computed(() => billing.value?.submissions?.[0] ?? null)
const hasOpenRequest = computed(() => billing.value?.submissions?.some(item => ['submitted', 'under_review'].includes(item.status)) ?? false)
const usageResources = computed<PlanUsageResource[]>(() => {
  if (!billing.value) return []
  if (billing.value.usage.resources?.length) return billing.value.usage.resources
  const usage = billing.value.usage
  const pairs: Array<[PlanResourceKey, number]> = [
    ['active_locations', usage.locations], ['active_members', usage.members],
    ['active_products', usage.products], ['active_services', usage.services],
  ]
  return pairs.map(([resource, used]) => {
    const limit = usage.limits?.[resource] ?? null
    return { resource, used, limit, remaining: limit == null ? null : Math.max(0, limit - used), unlimited: limit == null, atLimit: limit != null && used >= limit, overLimit: limit != null && used > limit }
  })
})

watch([billing, purchasablePlans], () => {
  const plans = purchasablePlans.value
  if (!plans.length) { form.planSlug = ''; return }
  if (!plans.some(plan => plan.planSlug === form.planSlug && !plan.blockers.length)) {
    form.planSlug = plans.find(plan => plan.planSlug === billing.value?.subscription.planSlug && !plan.blockers.length)?.planSlug
      ?? plans.find(plan => !plan.blockers.length)?.planSlug ?? ''
  }
}, { immediate: true })

watch(selectedPlan, value => {
  if (value) form.paidAmount = value.effectivePriceAmount
}, { immediate: true })

watch(currentId, () => {
  submitRequestId.value = null
  submitError.value = ''
  Object.assign(form, { planSlug: '', paidAmount: 0, transferDate: '', transferReference: '' })
}, { flush: 'sync' })

function date(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

function statusLabel(status: string) {
  return copy.value.statuses[status as keyof typeof copy.value.statuses] ?? status
}

function intervalLabel(interval: string) {
  return copy.value.intervals[interval as keyof typeof copy.value.intervals] ?? interval
}

function resourceLabel(resource: PlanResourceKey) {
  return copy.value.resources[resource]
}

function submissionMessage(submission: BillingSubmission) {
  return copy.value.submissionMessages[submission.status]
}

function choosePlan(plan: BillingPlanOption) {
  if (!plan.blockers.length) form.planSlug = plan.planSlug
}

async function submitNotice() {
  if (!currentId.value || !isOwner.value || submitPending.value) return
  submitError.value = ''
  const plan = selectedPlan.value
  if (!plan || plan.blockers.length || !(form.paidAmount > 0) || !form.transferDate || form.transferReference.trim().length < 2) {
    submitError.value = copy.value.invalid
    return
  }
  const confirmed = await confirmation.ask(copy.value.confirmNotice(plan.planName, money(plan.effectivePriceAmount, plan.currency), money(form.paidAmount, plan.currency)))
  if (!confirmed) return
  submitPending.value = true
  const requestId = submitRequestId.value ?? globalThis.crypto.randomUUID()
  submitRequestId.value = requestId
  try {
    const { error: commandError } = await rpc.rpc('submit_shop_billing_notice', {
      p_request_id: requestId,
      p_shop_id: currentId.value,
      p_requested_plan_slug: plan.planSlug,
      p_paid_amount: form.paidAmount,
      p_transfer_date: form.transferDate,
      p_transfer_reference: form.transferReference.trim(),
    })
    if (commandError) throw commandError
    submitRequestId.value = null
    Object.assign(form, { paidAmount: plan.effectivePriceAmount, transferDate: '', transferReference: '' })
    await refresh()
    pushToast({ tone: 'success', title: copy.value.submitted })
  }
  catch {
    submitError.value = copy.value.failed
  }
  finally {
    submitPending.value = false
  }
}

const en = {
  title: 'Subscription and billing', subtitle: 'Understand your plan, usage, and manually reviewed InstaPay requests.',
  ownerOnly: 'Ask the Shop owner to review billing or submit a transfer notice. Only the owner can access these details.',
  noBilling: 'No subscription information is available. Contact Building Suit support to review this shop’s billing.', loadFailed: 'Could not load billing information.', retry: 'Retry', plan: 'Current plan', access: 'Access state',
  days: 'days', periodEnd: 'Current access ends', trialEnd: 'Trial ends', currentPrice: 'Effective price', listPrice: 'List price', negotiated: 'Negotiated price applies', usage: 'Plan usage', usageHelp: 'Near-limit and full resources are highlighted before a write is rejected.',
  readOnly: 'Your business history remains available, but subscription-gated writes are disabled until an operator approves payment or adjusts access.',
  compare: 'Compare plans', compareHelp: 'Only plans currently approved for purchase are shown. Limits are enforced by resource, not by business type.', current: 'Current', choose: 'Choose plan', chosen: 'Selected',
  blocked: 'Blocked by current usage', blockers: 'Reduce usage below every listed limit before requesting this downgrade. Existing data stays readable and nothing is automatically deleted.', used: 'used', limitLabel: 'limit',
  instructions: 'Pay with InstaPay / instant bank transfer', instructionsHelp: 'Transfer using the operator-configured details below, then submit the notice for manual review. This is not automatic bank verification.',
  recipient: 'Recipient alias', paymentLink: 'Payment link', qr: 'Payment QR', unavailable: 'Payment instructions have not been configured yet. Contact Building Suit support before transferring.',
  notice: 'Submit payment notice', noticeHelp: 'A notice starts manual review. It does not change your plan or access until a platform operator approves it.', requestedPlan: 'Requested plan', interval: 'Commercial term', expected: 'Quoted plan price', paid: 'Amount transferred', transferDate: 'Transfer date', reference: 'Transfer reference',
  submit: 'Submit for review', submitting: 'Submitting…', invalid: 'Choose an available plan and enter a positive amount, transfer date, and reference.', submitted: 'Payment notice submitted for manual review.', failed: 'Could not submit the payment notice. You can retry safely.', confirmNotice: (plan: string, quote: string, paid: string) => `Submit a manual payment notice for ${plan}? The quoted price is ${quote} and you entered ${paid}. Your access will not change until an operator approves it.`,
  latest: 'Latest request', history: 'Payment notice history', empty: 'No payment notices have been submitted.', reviewReason: 'Review note', manual: 'Manual verification', catalogFailed: 'Could not load the purchasable plan catalog.', noPurchasable: 'No plans are currently available to request. Your current subscription remains unchanged.',
  statuses: { trialing: 'Trialing', active: 'Active', read_only: 'Read-only', suspended: 'Suspended', submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected' },
  submissionMessages: { submitted: 'Submitted for manual review. Your current plan and access have not changed.', under_review: 'An operator is reviewing this transfer. Your current plan and access have not changed.', approved: 'This request was approved. The current-plan summary above is the authoritative active access.', rejected: 'This request was rejected. Review the note, correct the transfer details, and submit a new notice if needed.' },
  resources: { active_locations: 'Active locations', active_members: 'Team members', active_products: 'Active products', active_services: 'Active services' },
  intervals: { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' },
}

const ar = {
  title: 'الاشتراك والفوترة', subtitle: 'اعرف خطتك واستخدامك وحالة طلبات InstaPay التي تتم مراجعتها يدويًا.',
  ownerOnly: 'اطلب من مالك المتجر مراجعة الفوترة أو إرسال إشعار التحويل. هذه التفاصيل متاحة للمالك فقط.',
  noBilling: 'لا توجد معلومات اشتراك متاحة. تواصل مع دعم Building Suit لمراجعة فوترة هذا المتجر.', loadFailed: 'تعذّر تحميل معلومات الفوترة.', retry: 'إعادة المحاولة', plan: 'الخطة الحالية', access: 'حالة الوصول',
  days: 'يوم', periodEnd: 'ينتهي الوصول الحالي', trialEnd: 'تنتهي التجربة', currentPrice: 'السعر الفعلي', listPrice: 'السعر المعلن', negotiated: 'يُطبق سعر تفاوضي', usage: 'استخدام الخطة', usageHelp: 'نوضح الموارد القريبة من الحد أو المكتملة قبل رفض عملية جديدة.',
  readOnly: 'يظل سجل النشاط متاحًا، لكن عمليات الكتابة المرتبطة بالاشتراك تتوقف حتى يعتمد مسؤول المنصة الدفعة أو يعدّل الوصول.',
  compare: 'مقارنة الخطط', compareHelp: 'تظهر فقط الخطط المعتمدة والمتاحة للشراء الآن. تُطبّق الحدود حسب المورد وليس نوع النشاط.', current: 'الحالية', choose: 'اختيار الخطة', chosen: 'تم الاختيار',
  blocked: 'غير متاحة بسبب الاستخدام الحالي', blockers: 'خفّض الاستخدام عن كل حد موضح قبل طلب هذه الخطة الأقل. ستظل البيانات القديمة قابلة للقراءة ولن يحذف النظام أي شيء تلقائيًا.', used: 'مستخدم', limitLabel: 'الحد',
  instructions: 'الدفع عبر InstaPay / تحويل بنكي فوري', instructionsHelp: 'حوّل باستخدام البيانات التي ضبطها مسؤول المنصة ثم أرسل الإشعار للمراجعة اليدوية. لا توجد مطابقة بنكية تلقائية.',
  recipient: 'عنوان المستلم', paymentLink: 'رابط الدفع', qr: 'رمز QR للدفع', unavailable: 'لم يضبط مسؤول المنصة تعليمات الدفع بعد. تواصل مع دعم Building Suit قبل التحويل.',
  notice: 'إرسال إشعار الدفع', noticeHelp: 'الإشعار يبدأ المراجعة اليدوية ولا يغيّر خطتك أو صلاحية الوصول قبل اعتماد مسؤول المنصة.', requestedPlan: 'الخطة المطلوبة', interval: 'المدة التجارية', expected: 'سعر الخطة المثبت', paid: 'المبلغ المحوّل', transferDate: 'تاريخ التحويل', reference: 'مرجع التحويل',
  submit: 'إرسال للمراجعة', submitting: 'جارٍ الإرسال…', invalid: 'اختر خطة متاحة وأدخل مبلغًا موجبًا وتاريخ التحويل والمرجع.', submitted: 'تم إرسال إشعار الدفع للمراجعة اليدوية.', failed: 'تعذّر إرسال إشعار الدفع. يمكنك إعادة المحاولة بأمان.', confirmNotice: (plan: string, quote: string, paid: string) => `هل تريد إرسال إشعار دفع يدوي لخطة ${plan}؟ السعر المثبت ${quote} والمبلغ المدخل ${paid}. لن يتغير الوصول قبل اعتماد مسؤول المنصة.`,
  latest: 'أحدث طلب', history: 'سجل إشعارات الدفع', empty: 'لم تُرسل إشعارات دفع بعد.', reviewReason: 'ملاحظة المراجعة', manual: 'تحقق يدوي', catalogFailed: 'تعذّر تحميل كتالوج الخطط المتاحة للشراء.', noPurchasable: 'لا توجد خطط متاحة للطلب حاليًا. سيظل اشتراكك الحالي دون تغيير.',
  statuses: { trialing: 'فترة تجريبية', active: 'نشط', read_only: 'قراءة فقط', suspended: 'موقوف', submitted: 'مُرسل', under_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' },
  submissionMessages: { submitted: 'تم الإرسال للمراجعة اليدوية. لم تتغير خطتك الحالية أو صلاحية الوصول.', under_review: 'يراجع مسؤول المنصة التحويل الآن. لم تتغير خطتك الحالية أو صلاحية الوصول.', approved: 'تم اعتماد هذا الطلب. ملخص الخطة الحالية بالأعلى هو المرجع الفعلي لصلاحية الوصول.', rejected: 'تم رفض الطلب. راجع الملاحظة وصحح بيانات التحويل ثم أرسل إشعارًا جديدًا عند الحاجة.' },
  resources: { active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق', active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة' },
  intervals: { monthly: 'شهريًا', quarterly: 'كل ثلاثة أشهر', annual: 'سنويًا' },
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <header><p class="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bs-link)]">{{ current?.name }}</p><h1 class="mt-1 text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></header>
    <p v-if="!isOwner" role="alert" class="rounded-2xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-5">{{ copy.ownerOnly }}</p>
    <div v-else-if="pending" role="status" :aria-label="ui('loading')" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div v-for="item in 4" :key="item" class="h-28 animate-pulse rounded-2xl bg-muted" /></div>
    <div v-else-if="error" role="alert" class="ls-error"><p>{{ copy.loadFailed }}</p><BsButton class="mt-3" @click="refresh()">{{ copy.retry }}</BsButton></div>
    <template v-else-if="billing">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Current subscription">
        <BsKpiCard :title="copy.plan"><span class="text-xl font-extrabold">{{ billing.subscription.planName }}</span></BsKpiCard>
        <BsKpiCard :title="copy.access"><StatusBadge :status="billing.subscription.accessState" /> <span class="ms-2 text-sm font-bold">{{ statusLabel(billing.subscription.accessState) }}</span></BsKpiCard>
        <BsKpiCard :title="billing.subscription.accessState === 'trialing' ? copy.trialEnd : copy.periodEnd"><span class="text-sm font-bold">{{ date(billing.subscription.accessState === 'trialing' ? billing.subscription.trialEndAt : billing.subscription.periodEnd) }}</span><p v-if="billing.subscription.accessState === 'trialing'" class="mt-1 text-xs text-muted-foreground">{{ billing.subscription.trialDaysRemaining }} {{ copy.days }}</p></BsKpiCard>
        <BsKpiCard :title="copy.currentPrice"><span class="text-lg font-extrabold">{{ money(billing.subscription.effectivePriceAmount ?? billing.subscription.priceAmount, billing.subscription.currency) }}</span><p v-if="billing.subscription.priceSource === 'override'" class="mt-1 text-xs font-bold text-[var(--bs-link)]">{{ copy.negotiated }}</p><p v-if="billing.subscription.listPriceAmount !== billing.subscription.effectivePriceAmount" class="mt-1 text-xs text-muted-foreground">{{ copy.listPrice }}: {{ money(billing.subscription.listPriceAmount, billing.subscription.currency) }}</p></BsKpiCard>
      </section>

      <p v-if="['read_only', 'suspended'].includes(billing.subscription.accessState)" role="status" class="rounded-2xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm">{{ copy.readOnly }}</p>

      <section v-if="latestSubmission" class="rounded-2xl border border-border bg-card p-5" aria-live="polite">
        <div class="flex flex-wrap items-center gap-3"><h2 class="font-extrabold">{{ copy.latest }}</h2><StatusBadge :status="latestSubmission.status" /><strong class="text-sm">{{ statusLabel(latestSubmission.status) }}</strong><span class="text-sm text-muted-foreground">{{ latestSubmission.requestedPlanName }} · {{ money(latestSubmission.effectivePriceAmount, latestSubmission.currency) }}</span></div>
        <p class="mt-2 text-sm leading-6">{{ submissionMessage(latestSubmission) }}</p><p v-if="latestSubmission.reviewReason" class="mt-2 text-sm text-muted-foreground">{{ copy.reviewReason }}: {{ latestSubmission.reviewReason }}</p>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 class="text-lg font-extrabold">{{ copy.usage }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ copy.usageHelp }}</p><div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><PlanUsageMeter v-for="resource in usageResources" :key="resource.resource" :usage="resource" /></div></section>

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 class="text-lg font-extrabold">{{ copy.compare }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ copy.compareHelp }}</p>
        <div v-if="catalogPending" role="status" class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div v-for="item in 3" :key="item" class="h-72 animate-pulse rounded-2xl bg-muted" /></div>
        <div v-else-if="catalogError" role="alert" class="ls-error mt-5"><p>{{ copy.catalogFailed }}</p><BsButton class="mt-3" severity="secondary" @click="refreshCatalog()">{{ copy.retry }}</BsButton></div>
        <p v-else-if="!purchasablePlans.length" role="status" class="mt-5 rounded-xl border border-border p-4 text-sm">{{ copy.noPurchasable }}</p>
        <div v-else class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="plan in purchasablePlans" :key="plan.catalogTermsId" class="flex flex-col rounded-2xl border p-5" :class="form.planSlug === plan.planSlug ? 'border-[var(--bs-link)] ring-2 ring-[var(--bs-link)]/20' : 'border-border'">
            <div class="flex items-start justify-between gap-3"><div><h3 class="text-xl font-extrabold">{{ plan.planName }}</h3><p class="mt-1 text-sm text-muted-foreground">{{ intervalLabel(plan.billingInterval) }}</p></div><span v-if="plan.planSlug === billing.subscription.planSlug" class="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{{ copy.current }}</span></div>
            <p class="mt-4 text-2xl font-black">{{ money(plan.effectivePriceAmount, plan.currency) }}</p><p v-if="plan.priceSource === 'override'" class="mt-1 text-xs font-bold text-[var(--bs-link)]">{{ copy.negotiated }} · {{ copy.listPrice }} {{ money(plan.listPriceAmount, plan.currency) }}</p>
            <PlanResourceLimits class="mt-5" :limits="plan.resourceLimits" />
            <div v-if="plan.blockers.length" role="alert" class="mt-5 rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-3 text-sm"><strong>{{ copy.blocked }}</strong><p class="mt-1 leading-5">{{ copy.blockers }}</p><ul class="mt-2 list-disc space-y-1 ps-5"><li v-for="blocker in plan.blockers" :key="blocker.resource">{{ resourceLabel(blocker.resource) }}: {{ blocker.used }} {{ copy.used }} / {{ blocker.limit }} {{ copy.limitLabel }}</li></ul></div>
            <BsButton type="button" class="mt-5 w-full" :variant="form.planSlug === plan.planSlug ? 'default' : 'primary'" :disabled="plan.blockers.length > 0" :aria-pressed="form.planSlug === plan.planSlug" @click="choosePlan(plan)">{{ form.planSlug === plan.planSlug ? copy.chosen : copy.choose }}</BsButton>
          </article>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-extrabold">{{ copy.instructions }}</h2><p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{{ copy.instructionsHelp }}</p></div><span class="rounded-full bg-muted px-3 py-1 text-xs font-bold">{{ copy.manual }}</span></div>
        <div v-if="billing.instructions.recipientAlias || billing.instructions.paymentLink || billing.instructions.qrImageUrl || (isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn)" class="mt-5 grid gap-4 md:grid-cols-2"><p v-if="billing.instructions.recipientAlias" class="rounded-xl border border-border p-4"><span class="block text-xs text-muted-foreground">{{ copy.recipient }}</span><strong dir="ltr" class="break-all">{{ billing.instructions.recipientAlias }}</strong></p><p v-if="billing.instructions.paymentLink" class="rounded-xl border border-border p-4"><span class="block text-xs text-muted-foreground">{{ copy.paymentLink }}</span><a class="break-all font-bold text-[var(--bs-link)] underline" :href="billing.instructions.paymentLink" target="_blank" rel="noopener noreferrer">{{ billing.instructions.paymentLink }}</a></p><div v-if="billing.instructions.qrImageUrl" class="rounded-xl border border-border p-4"><span class="mb-3 block text-xs text-muted-foreground">{{ copy.qr }}</span><img :src="billing.instructions.qrImageUrl" :alt="copy.qr" class="h-40 w-40 rounded-lg object-contain"></div><p v-if="isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn" class="whitespace-pre-line rounded-xl border border-border p-4 text-sm leading-6">{{ isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn }}</p></div><p v-else class="mt-5 text-sm text-muted-foreground">{{ copy.unavailable }}</p>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 class="text-lg font-extrabold">{{ copy.notice }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ copy.noticeHelp }}</p>
        <BsForm class="mt-5 grid gap-4 sm:grid-cols-2" :pending="submitPending" :error="submitError" @submit="submitNotice"><div v-if="selectedPlan" class="rounded-xl border border-border p-4 text-sm sm:col-span-2"><p>{{ copy.requestedPlan }}: <strong>{{ selectedPlan.planName }}</strong> · {{ copy.expected }}: <strong>{{ money(selectedPlan.effectivePriceAmount, selectedPlan.currency) }}</strong> · {{ copy.interval }}: <strong>{{ intervalLabel(selectedPlan.billingInterval) }}</strong></p><p v-if="selectedPlan.priceSource === 'override'" class="mt-2 font-bold text-[var(--bs-link)]">{{ copy.negotiated }}</p></div><p v-else role="status" class="rounded-xl border border-border p-4 text-sm sm:col-span-2">{{ copy.noPurchasable }}</p><label class="grid gap-2 text-sm font-bold">{{ copy.paid }}<input v-model.number="form.paidAmount" class="ls-input min-h-11 min-w-0" type="number" min="0.01" step="0.01" :disabled="!selectedPlan" required></label><label class="grid gap-2 text-sm font-bold">{{ copy.transferDate }}<input v-model="form.transferDate" class="ls-input min-h-11 min-w-0" type="date" :max="new Date().toISOString().slice(0, 10)" :disabled="!selectedPlan" required></label><label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.reference }}<input v-model="form.transferReference" class="ls-input min-h-11 min-w-0" dir="ltr" minlength="2" maxlength="200" :disabled="!selectedPlan" required></label><div class="sm:col-span-2"><BsButton type="submit" variant="primary" :pending="submitPending" :disabled="!selectedPlan || hasOpenRequest">{{ submitPending ? copy.submitting : copy.submit }}</BsButton></div></BsForm>
      </section>

      <section class="overflow-hidden rounded-2xl border border-border bg-card"><div class="p-5"><h2 class="text-lg font-extrabold">{{ copy.history }}</h2></div><div class="overflow-x-auto"><BsDataTable :value="billing.submissions" data-key="id" :label="copy.history"><Column field="status"><template #header>{{ copy.access }}</template><template #body="{ data: item }"><StatusBadge :status="item.status" /> <span class="ms-2 text-sm">{{ statusLabel(item.status) }}</span></template></Column><Column field="requestedPlanName"><template #header>{{ copy.requestedPlan }}</template></Column><Column><template #header>{{ copy.expected }}</template><template #body="{ data: item }">{{ money(item.effectivePriceAmount, item.currency) }}</template></Column><Column><template #header>{{ copy.paid }}</template><template #body="{ data: item }">{{ money(item.paidAmount, item.currency) }}</template></Column><Column field="transferReference"><template #header>{{ copy.reference }}</template></Column><Column><template #header>{{ copy.transferDate }}</template><template #body="{ data: item }">{{ date(item.transferDate) }}</template></Column><Column field="reviewReason"><template #header>{{ copy.reviewReason }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template></BsDataTable></div></section>
    </template>
    <p v-else role="status" class="rounded-xl border border-border p-5 text-sm">{{ copy.noBilling }}</p>
  </div>
</template>
