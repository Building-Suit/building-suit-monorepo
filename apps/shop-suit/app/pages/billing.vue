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
const form = reactive({ catalogTermsId: '', paidAmount: 0, transferDate: '', transferReference: '' })
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

const publicCatalogTerms = computed(() => new Set((publicPlans.value ?? [])
  .filter(plan => plan.is_purchasable && !plan.is_coming_soon)
  .map(plan => plan.catalog_terms_id)))
const purchasablePlans = computed(() => (billing.value?.availablePlans ?? [])
  .filter(plan => publicCatalogTerms.value.has(plan.catalogTermsId)))
const selectedPlan = computed(() => purchasablePlans.value.find(plan => plan.catalogTermsId === form.catalogTermsId) ?? null)
const latestSubmission = computed(() => billing.value?.submissions?.[0] ?? null)
const hasOpenRequest = computed(() => billing.value?.submissions?.some(item => ['submitted', 'under_review'].includes(item.status)) ?? false)
const usageResources = computed<PlanUsageResource[]>(() => {
  if (!billing.value) return []
  if (billing.value.usage.resources?.length) return billing.value.usage.resources
  const usage = billing.value.usage
  const pairs: Array<[PlanResourceKey, number]> = [
    ['active_locations', usage.locations], ['active_members', usage.members],
    ['active_products', usage.products], ['active_services', usage.services],
    ['active_customers', usage.customers], ['active_suppliers', usage.suppliers],
  ]
  return pairs.map(([resource, used]) => {
    const limit = usage.limits?.[resource] ?? null
    return { resource, used, limit, remaining: limit == null ? null : Math.max(0, limit - used), unlimited: limit == null, atLimit: limit != null && used >= limit, overLimit: limit != null && used > limit }
  })
})

watch([billing, purchasablePlans], () => {
  const plans = purchasablePlans.value
  if (!plans.length) { form.catalogTermsId = ''; return }
  if (!plans.some(plan => plan.catalogTermsId === form.catalogTermsId)) {
    form.catalogTermsId = plans.find(plan => plan.planSlug === billing.value?.subscription.planSlug
      && plan.planVariant === billing.value?.subscription.planVariant
      && plan.billingInterval === billing.value?.subscription.billingInterval)?.catalogTermsId
      ?? plans[0]?.catalogTermsId ?? ''
  }
}, { immediate: true })

watch(selectedPlan, value => {
  if (value) form.paidAmount = value.effectivePriceAmount
}, { immediate: true })

watch(currentId, () => {
  submitRequestId.value = null
  submitError.value = ''
  Object.assign(form, { catalogTermsId: '', paidAmount: 0, transferDate: '', transferReference: '' })
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

function variantLabel(plan: BillingPlanOption) {
  if (plan.planVariant === 'multi_2') return isArabic.value ? 'مالتي · فرعان' : 'Multi · 2 branches'
  if (plan.planVariant === 'multi_3') return isArabic.value ? 'مالتي · 3 فروع' : 'Multi · 3 branches'
  return plan.planName
}

function resourceLabel(resource: PlanResourceKey) {
  return copy.value.resources[resource]
}

function submissionMessage(submission: BillingSubmission) {
  return copy.value.submissionMessages[submission.status]
}

function choosePlan(plan: BillingPlanOption) {
  form.catalogTermsId = plan.catalogTermsId
}

async function submitNotice() {
  if (!currentId.value || !isOwner.value || submitPending.value) return
  submitError.value = ''
  const plan = selectedPlan.value
  if (!plan || !(form.paidAmount > 0) || !form.transferDate || form.transferReference.trim().length < 2) {
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
      p_requested_catalog_terms_id: plan.catalogTermsId,
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
  blocked: 'Approval blocked by current usage', blockers: 'You can select this plan and submit its payment notice now, but it cannot be activated until every excess below is resolved.', preservation: 'All resources and data stay saved. Nothing is automatically deleted or archived. Resources above the chosen plan limits are unavailable for new or active use until you reduce usage or upgrade the plan.', used: 'used', limitLabel: 'limit', over: 'over',
  instructions: 'Pay with InstaPay / instant bank transfer', instructionsHelp: 'Transfer using the operator-configured details below, then submit the notice for manual review. This is not automatic bank verification.',
  recipient: 'Recipient alias', paymentLink: 'Payment link', qr: 'Payment QR', unavailable: 'Payment instructions have not been configured yet. Contact Building Suit support before transferring.',
  notice: 'Submit payment notice', noticeHelp: 'A notice starts manual review. It does not change your plan or access until a platform operator approves it.', requestedPlan: 'Requested plan', interval: 'Commercial term', expected: 'Quoted plan price', paid: 'Amount transferred', transferDate: 'Transfer date', reference: 'Transfer reference',
  submit: 'Submit for review', submitting: 'Submitting…', invalid: 'Choose an available plan and enter a positive amount, transfer date, and reference.', submitted: 'Payment notice submitted for manual review.', failed: 'Could not submit the payment notice. You can retry safely.', confirmNotice: (plan: string, quote: string, paid: string) => `Submit a manual payment notice for ${plan}? The quoted price is ${quote} and you entered ${paid}. Your access will not change until an operator approves it.`,
  policyPrefix: 'By submitting, you acknowledge the', terms: 'Terms & Conditions', privacy: 'Privacy Policy', refund: 'Refund & Cancellation Policy',
  latest: 'Latest request', history: 'Payment notice history', empty: 'No payment notices have been submitted.', reviewReason: 'Review note', manual: 'Manual verification', catalogFailed: 'Could not load the purchasable plan catalog.', noPurchasable: 'No plans are currently available to request. Your current subscription remains unchanged.',
  statuses: { trialing: 'Trialing', active: 'Active', read_only: 'Read-only', suspended: 'Suspended', submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected' },
  submissionMessages: { submitted: 'Submitted for manual review. Your current plan and access have not changed.', under_review: 'An operator is reviewing this transfer. Your current plan and access have not changed.', approved: 'This request was approved. The current-plan summary above is the authoritative active access.', rejected: 'This request was rejected. Review the note, correct the transfer details, and submit a new notice if needed.' },
  resources: { active_locations: 'Active locations', active_members: 'Team members', active_products: 'Active products', active_services: 'Active services', active_customers: 'Active customers', active_suppliers: 'Active suppliers' },
  intervals: { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' },
}

const ar = {
  title: 'الاشتراك والدفع', subtitle: 'شوف خطتك واستخدامك، وتابع طلبات InstaPay اللي بنراجعها يدويًا.',
  ownerOnly: 'اطلب من مالك المتجر مراجعة الفوترة أو إرسال إشعار التحويل. هذه التفاصيل متاحة للمالك فقط.',
  noBilling: 'مفيش معلومات اشتراك متاحة. كلّم دعم Building Suit عشان يراجع اشتراك المتجر.', loadFailed: 'مقدرناش نحمّل معلومات الاشتراك.', retry: 'حاول تاني', plan: 'الخطة الحالية', access: 'حالة الاستخدام',
  days: 'يوم', periodEnd: 'ينتهي الوصول الحالي', trialEnd: 'تنتهي التجربة', currentPrice: 'السعر الفعلي', listPrice: 'السعر المعلن', negotiated: 'يُطبق سعر تفاوضي', usage: 'استخدام الخطة', usageHelp: 'نوضح الموارد القريبة من الحد أو المكتملة قبل رفض عملية جديدة.',
  readOnly: 'سجل شغلك هيفضل متاح للقراية، بس مش هتقدر تعمل عمليات جديدة لحد ما مسؤول المنصة يعتمد الدفعة أو يعدّل الاستخدام.',
  compare: 'مقارنة الخطط', compareHelp: 'تظهر فقط الخطط المعتمدة والمتاحة للشراء الآن. تُطبّق الحدود حسب المورد وليس نوع النشاط.', current: 'الحالية', choose: 'اختيار الخطة', chosen: 'تم الاختيار',
  blocked: 'التفعيل متوقف بسبب الاستخدام الحالي', blockers: 'يمكنك اختيار هذه الخطة وإرسال إشعار الدفع الآن، لكن لا يمكن تفعيلها حتى تعالج كل تجاوز موضح أدناه.', preservation: 'تظل كل الموارد والبيانات محفوظة. لن يُحذف أو يُؤرشف أي شيء تلقائيًا. الموارد التي تتجاوز حدود الخطة المختارة لن تكون متاحة للاستخدام الجديد أو النشط حتى تخفّض الاستخدام أو ترقي الخطة.', used: 'مستخدم', limitLabel: 'الحد', over: 'فوق الحد',
  instructions: 'الدفع بـ InstaPay أو تحويل بنكي فوري', instructionsHelp: 'حوّل على البيانات الظاهرة، وبعدها ابعت إشعار الدفع للمراجعة. التحويل بيتراجع يدويًا، مش بيتطابق تلقائيًا.',
  recipient: 'عنوان المستلم', paymentLink: 'رابط الدفع', qr: 'رمز QR للدفع', unavailable: 'لم يضبط مسؤول المنصة تعليمات الدفع بعد. تواصل مع دعم Building Suit قبل التحويل.',
  notice: 'ابعت إشعار الدفع', noticeHelp: 'إشعار الدفع بيبدأ المراجعة اليدوية، بس خطتك واستخدامك مش هيتغيّروا غير بعد الاعتماد.', requestedPlan: 'الخطة المطلوبة', interval: 'مدة الاشتراك', expected: 'سعر الخطة المثبت', paid: 'المبلغ المحوّل', transferDate: 'تاريخ التحويل', reference: 'مرجع التحويل',
  submit: 'ابعت للمراجعة', submitting: 'بنبعت…', invalid: 'اختار خطة متاحة، واكتب المبلغ وتاريخ ومرجع التحويل.', submitted: 'اتبعت إشعار الدفع للمراجعة اليدوية.', failed: 'مقدرناش نبعت إشعار الدفع. تقدر تحاول تاني من غير ما التحويل يتكرر.', confirmNotice: (plan: string, quote: string, paid: string) => `تبعت إشعار دفع لخطة ${plan}؟ سعر الخطة ${quote} والمبلغ اللي كتبته ${paid}. الاستخدام مش هيتغيّر غير بعد اعتماد مسؤول المنصة.`,
  policyPrefix: 'بإرسال الطلب، أنت تقر بالاطلاع على', terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية', refund: 'سياسة الاسترداد والإلغاء',
  latest: 'أحدث طلب', history: 'سجل إشعارات الدفع', empty: 'لم تُرسل إشعارات دفع بعد.', reviewReason: 'ملاحظة المراجعة', manual: 'تحقق يدوي', catalogFailed: 'تعذّر تحميل كتالوج الخطط المتاحة للشراء.', noPurchasable: 'لا توجد خطط متاحة للطلب حاليًا. سيظل اشتراكك الحالي دون تغيير.',
  statuses: { trialing: 'فترة تجريبية', active: 'نشط', read_only: 'قراءة فقط', suspended: 'موقوف', submitted: 'مُرسل', under_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' },
  submissionMessages: { submitted: 'تم الإرسال للمراجعة اليدوية. لم تتغير خطتك الحالية أو صلاحية الوصول.', under_review: 'يراجع مسؤول المنصة التحويل الآن. لم تتغير خطتك الحالية أو صلاحية الوصول.', approved: 'تم اعتماد هذا الطلب. ملخص الخطة الحالية بالأعلى هو المرجع الفعلي لصلاحية الوصول.', rejected: 'تم رفض الطلب. راجع الملاحظة وصحح بيانات التحويل ثم أرسل إشعارًا جديدًا عند الحاجة.' },
  resources: { active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق', active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة', active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون' },
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

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 class="text-lg font-extrabold">{{ copy.usage }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ copy.usageHelp }}</p><div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><PlanUsageMeter v-for="resource in usageResources" :key="resource.resource" :usage="resource" /></div></section>

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 class="text-lg font-extrabold">{{ copy.compare }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ copy.compareHelp }}</p>
        <div v-if="catalogPending" role="status" class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div v-for="item in 3" :key="item" class="h-72 animate-pulse rounded-2xl bg-muted" /></div>
        <div v-else-if="catalogError" role="alert" class="ls-error mt-5"><p>{{ copy.catalogFailed }}</p><BsButton class="mt-3" severity="secondary" @click="refreshCatalog()">{{ copy.retry }}</BsButton></div>
        <p v-else-if="!purchasablePlans.length" role="status" class="mt-5 rounded-xl border border-border p-4 text-sm">{{ copy.noPurchasable }}</p>
        <div v-else class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article v-for="plan in purchasablePlans" :key="plan.catalogTermsId" class="flex flex-col rounded-2xl border p-5" :class="form.catalogTermsId === plan.catalogTermsId ? 'border-[var(--bs-link)] ring-2 ring-[var(--bs-link)]/20' : 'border-border'">
            <div class="flex items-start justify-between gap-3"><div><h3 class="text-xl font-extrabold">{{ variantLabel(plan) }}</h3><p class="mt-1 text-sm text-muted-foreground">{{ intervalLabel(plan.billingInterval) }}</p></div><span v-if="plan.planSlug === billing.subscription.planSlug && plan.planVariant === billing.subscription.planVariant && plan.billingInterval === billing.subscription.billingInterval" class="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{{ copy.current }}</span></div>
            <p class="mt-4 text-2xl font-black">{{ money(plan.effectivePriceAmount, plan.currency) }}</p><p v-if="plan.priceSource === 'override'" class="mt-1 text-xs font-bold text-[var(--bs-link)]">{{ copy.negotiated }} · {{ copy.listPrice }} {{ money(plan.listPriceAmount, plan.currency) }}</p>
            <PlanResourceLimits class="mt-5" :limits="plan.resourceLimits" />
            <div v-if="plan.blockers.length" role="alert" class="mt-5 rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-3 text-sm"><strong>{{ copy.blocked }}</strong><p class="mt-1 leading-5">{{ copy.blockers }}</p><ul class="mt-2 list-disc space-y-1 ps-5"><li v-for="blocker in plan.blockers" :key="blocker.resource">{{ resourceLabel(blocker.resource) }}: {{ blocker.used }} {{ copy.used }} / {{ blocker.limit }} {{ copy.limitLabel }} · {{ blocker.excess }} {{ copy.over }}</li></ul><p class="mt-3 font-semibold leading-5">{{ copy.preservation }}</p></div>
            <BsButton type="button" class="mt-5 w-full" :variant="form.catalogTermsId === plan.catalogTermsId ? 'default' : 'primary'" :aria-pressed="form.catalogTermsId === plan.catalogTermsId" @click="choosePlan(plan)">{{ form.catalogTermsId === plan.catalogTermsId ? copy.chosen : copy.choose }}</BsButton>
          </article>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-extrabold">{{ copy.instructions }}</h2><p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{{ copy.instructionsHelp }}</p></div><span class="rounded-full bg-muted px-3 py-1 text-xs font-bold">{{ copy.manual }}</span></div>
        <div v-if="billing.instructions.recipientAlias || billing.instructions.paymentLink || billing.instructions.qrImageUrl || (isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn)" class="mt-5 grid gap-4 md:grid-cols-2"><p v-if="billing.instructions.recipientAlias" class="rounded-xl border border-border p-4"><span class="block text-xs text-muted-foreground">{{ copy.recipient }}</span><strong dir="ltr" class="break-all">{{ billing.instructions.recipientAlias }}</strong></p><p v-if="billing.instructions.paymentLink" class="rounded-xl border border-border p-4"><span class="block text-xs text-muted-foreground">{{ copy.paymentLink }}</span><a class="break-all font-bold text-[var(--bs-link)] underline" :href="billing.instructions.paymentLink" target="_blank" rel="noopener noreferrer">{{ billing.instructions.paymentLink }}</a></p><div v-if="billing.instructions.qrImageUrl" class="rounded-xl border border-border p-4"><span class="mb-3 block text-xs text-muted-foreground">{{ copy.qr }}</span><img :src="billing.instructions.qrImageUrl" :alt="copy.qr" class="h-40 w-40 rounded-lg object-contain"></div><p v-if="isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn" class="whitespace-pre-line rounded-xl border border-border p-4 text-sm leading-6">{{ isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn }}</p></div><p v-else class="mt-5 text-sm text-muted-foreground">{{ copy.unavailable }}</p>
      </section>

      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 class="text-lg font-extrabold">{{ copy.notice }}</h2><p class="mt-1 text-sm text-muted-foreground">{{ copy.noticeHelp }}</p>
        <BsForm class="mt-5 grid gap-4 sm:grid-cols-2" :pending="submitPending" :error="submitError" @submit="submitNotice"><div v-if="selectedPlan" class="rounded-xl border border-border p-4 text-sm sm:col-span-2"><p>{{ copy.requestedPlan }}: <strong>{{ selectedPlan.planName }}</strong> · {{ copy.expected }}: <strong>{{ money(selectedPlan.effectivePriceAmount, selectedPlan.currency) }}</strong> · {{ copy.interval }}: <strong>{{ intervalLabel(selectedPlan.billingInterval) }}</strong></p><p v-if="selectedPlan.priceSource === 'override'" class="mt-2 font-bold text-[var(--bs-link)]">{{ copy.negotiated }}</p><p v-if="selectedPlan.blockers.length" class="mt-3 rounded-lg bg-[var(--bs-status-warning-bg)] p-3 font-semibold leading-5">{{ copy.preservation }}</p></div><p v-else role="status" class="rounded-xl border border-border p-4 text-sm sm:col-span-2">{{ copy.noPurchasable }}</p><label class="grid gap-2 text-sm font-bold">{{ copy.paid }}<input v-model.number="form.paidAmount" class="ls-input min-h-11 min-w-0" type="number" min="0.01" step="0.01" :disabled="!selectedPlan" required></label><label class="grid gap-2 text-sm font-bold">{{ copy.transferDate }}<input v-model="form.transferDate" class="ls-input min-h-11 min-w-0" type="date" :max="new Date().toISOString().slice(0, 10)" :disabled="!selectedPlan" required></label><label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.reference }}<input v-model="form.transferReference" class="ls-input min-h-11 min-w-0" dir="ltr" minlength="2" maxlength="200" :disabled="!selectedPlan" required></label><p class="text-sm leading-6 text-muted-foreground sm:col-span-2">{{ copy.policyPrefix }} <NuxtLink class="font-bold text-[var(--bs-link)] underline" to="/terms">{{ copy.terms }}</NuxtLink> · <NuxtLink class="font-bold text-[var(--bs-link)] underline" to="/privacy">{{ copy.privacy }}</NuxtLink> · <NuxtLink class="font-bold text-[var(--bs-link)] underline" to="/refund-cancellation">{{ copy.refund }}</NuxtLink>.</p><div class="sm:col-span-2"><BsButton type="submit" variant="primary" :pending="submitPending" :disabled="!selectedPlan || hasOpenRequest">{{ submitPending ? copy.submitting : copy.submit }}</BsButton></div></BsForm>
      </section>

      <section class="overflow-hidden rounded-2xl border border-border bg-card"><div class="p-5"><h2 class="text-lg font-extrabold">{{ copy.history }}</h2></div><div class="overflow-x-auto"><BsDataTable :value="billing.submissions" data-key="id" :label="copy.history"><Column field="status"><template #header>{{ copy.access }}</template><template #body="{ data: item }"><StatusBadge :status="item.status" /> <span class="ms-2 text-sm">{{ statusLabel(item.status) }}</span></template></Column><Column field="requestedPlanName"><template #header>{{ copy.requestedPlan }}</template></Column><Column><template #header>{{ copy.expected }}</template><template #body="{ data: item }">{{ money(item.effectivePriceAmount, item.currency) }}</template></Column><Column><template #header>{{ copy.paid }}</template><template #body="{ data: item }">{{ money(item.paidAmount, item.currency) }}</template></Column><Column field="transferReference"><template #header>{{ copy.reference }}</template></Column><Column><template #header>{{ copy.transferDate }}</template><template #body="{ data: item }">{{ date(item.transferDate) }}</template></Column><Column field="reviewReason"><template #header>{{ copy.reviewReason }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template></BsDataTable></div></section>
    </template>
    <p v-else role="status" class="rounded-xl border border-border p-5 text-sm">{{ copy.noBilling }}</p>
  </div>
</template>
