<script setup lang="ts">
import type { BillingPlanOption, BillingSubmission, ShopBilling } from '~/types/billing'
import type { PlanResourceKey, PlanUsageResource, ShopPlanInterval, ShopPlanOffer } from '~/types/plans'
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
  .filter((plan): plan is BillingPlanOption & { billingInterval: ShopPlanInterval } => publicCatalogTerms.value.has(plan.catalogTermsId)
    && (plan.billingInterval === 'monthly' || plan.billingInterval === 'annual')))
const selectedPlan = computed(() => purchasablePlans.value.find(plan => plan.catalogTermsId === form.catalogTermsId) ?? null)
const currentCatalogTermsId = computed(() => purchasablePlans.value.find(plan => plan.planSlug === billing.value?.subscription.planSlug
  && plan.planVariant === billing.value?.subscription.planVariant
  && plan.billingInterval === billing.value?.subscription.billingInterval)?.catalogTermsId ?? '')
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

function submissionMessage(submission: BillingSubmission) {
  return copy.value.submissionMessages[submission.status]
}

function choosePlan(plan: ShopPlanOffer) {
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
    noticeAction.complete()
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
  submit: 'ابعت للمراجعة', submitting: 'بنبعت…', invalid: 'اختار خطة متاحة، واكتب المبلغ وتاريخ ومرجع التحويل.', submitted: 'اتبعت إشعار الدفع للمراجعة اليدوية.', failed: 'مقدرناش نبعت إشعار الدفع. تقدر تحاول تاني من غير ما التحويل يتكرر.', confirmNotice: (plan: string, quote: string, paid: string) => `تبعت إشعار دفع لخطة ${plan}؟ سعر الخطة ${quote} والمبلغ اللي كتبته ${paid}. لن يتغير الوصول إلا بعد اعتماد مسؤول المنصة.`,
  policyPrefix: 'بإرسال الطلب، أنت تقر بالاطلاع على', terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية', refund: 'سياسة الاسترداد والإلغاء',
  latest: 'أحدث طلب', history: 'سجل إشعارات الدفع', empty: 'لم تُرسل إشعارات دفع بعد.', reviewReason: 'ملاحظة المراجعة', manual: 'تحقق يدوي', catalogFailed: 'تعذّر تحميل كتالوج الخطط المتاحة للشراء.', noPurchasable: 'لا توجد خطط متاحة للطلب حاليًا. سيظل اشتراكك الحالي دون تغيير.',
  statuses: { trialing: 'فترة تجريبية', active: 'نشط', read_only: 'قراءة فقط', suspended: 'موقوف', submitted: 'مُرسل', under_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' },
  submissionMessages: { submitted: 'تم الإرسال للمراجعة اليدوية. لم تتغير خطتك الحالية أو صلاحية الوصول.', under_review: 'يراجع مسؤول المنصة التحويل الآن. لم تتغير خطتك الحالية أو صلاحية الوصول.', approved: 'تم اعتماد هذا الطلب. ملخص الخطة الحالية بالأعلى هو المرجع الفعلي لصلاحية الوصول.', rejected: 'تم رفض الطلب. راجع الملاحظة وصحح بيانات التحويل ثم أرسل إشعارًا جديدًا عند الحاجة.' },
  resources: { active_locations: 'الفروع النشطة', active_members: 'أعضاء الفريق', active_products: 'المنتجات النشطة', active_services: 'الخدمات النشطة', active_customers: 'العملاء النشطون', active_suppliers: 'الموردون النشطون' },
  intervals: { monthly: 'شهريًا', quarterly: 'كل ثلاثة أشهر', annual: 'سنويًا' },
}
const planPresentation = reactive(useShopPlanPresentation({ get offers() { return purchasablePlans.value }, get selectedCatalogTermsId() { return form.catalogTermsId }, get currentCatalogTermsId() { return currentCatalogTermsId.value }, action: 'select' }, choosePlan))
const usagePresentation = useShopUsagePresentation()

const noticeAction = useRecordAction(() => form)
const { visible: noticeActionOpen, dirty: noticeActionDirty } = noticeAction
</script>

<template>
  <BsStack>
    <BsBox as="header">
      <BsText as="p" size="xs" emphasis="semibold">{{ current?.name }}</BsText>
      <BsHeading :level="1">{{ copy.title }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.subtitle }}</BsText>
    </BsBox>
    <BsText v-if="!isOwner" role="alert" as="p" tone="warning">{{ copy.ownerOnly }}</BsText>
    <BsGrid v-else-if="pending" role="status" :aria-label="ui('loading')" :columns="4">
      <BsSkeleton v-for="item in 4" :key="item"/>
    </BsGrid>
    <BsBox v-else-if="error" role="alert">
      <BsText as="p">{{ copy.loadFailed }}</BsText>
      <BsButton @click="refresh()">{{ copy.retry }}</BsButton>
    </BsBox>
    <template v-else-if="billing">
      <BsGrid aria-label="Current subscription" :columns="4">
        <BsKpiCard :title="copy.plan">
          <BsText as="span" size="lg" emphasis="semibold">{{ billing.subscription.planName }}</BsText>
        </BsKpiCard>
        <BsKpiCard :title="copy.access">
          <BsStatusBadge :status="billing.subscription.accessState"/> <BsText as="span" size="sm" emphasis="semibold">{{ statusLabel(billing.subscription.accessState) }}</BsText>
        </BsKpiCard>
        <BsKpiCard :title="billing.subscription.accessState === 'trialing' ? copy.trialEnd : copy.periodEnd">
          <BsText as="span" size="sm" emphasis="semibold">{{ date(billing.subscription.accessState === 'trialing' ? billing.subscription.trialEndAt : billing.subscription.periodEnd) }}</BsText>
          <BsText v-if="billing.subscription.accessState === 'trialing'" as="p" size="xs" tone="muted">{{ billing.subscription.trialDaysRemaining }} {{ copy.days }}</BsText>
        </BsKpiCard>
        <BsKpiCard :title="copy.currentPrice">
          <BsText as="span" size="lg" emphasis="semibold">{{ money(billing.subscription.effectivePriceAmount ?? billing.subscription.priceAmount, billing.subscription.currency) }}</BsText>
          <BsText v-if="billing.subscription.priceSource === 'override'" as="p" size="xs" emphasis="semibold">{{ copy.negotiated }}</BsText>
          <BsText v-if="billing.subscription.listPriceAmount !== billing.subscription.effectivePriceAmount" as="p" size="xs" tone="muted">{{ copy.listPrice }}: {{ money(billing.subscription.listPriceAmount, billing.subscription.currency) }}</BsText>
        </BsKpiCard>
      </BsGrid>
      <BsText v-if="['read_only', 'suspended'].includes(billing.subscription.accessState)" role="status" as="p" size="sm" tone="warning">{{ copy.readOnly }}</BsText>
      <BsPanel v-if="latestSubmission" aria-live="polite" padding="md">
        <BsInline>
          <BsHeading :level="2">{{ copy.latest }}</BsHeading>
          <BsStatusBadge :status="latestSubmission.status"/>
          <BsText as="strong" size="sm">{{ statusLabel(latestSubmission.status) }}</BsText>
          <BsText as="span" size="sm" tone="muted">{{ latestSubmission.requestedPlanName }} · {{ money(latestSubmission.effectivePriceAmount, latestSubmission.currency) }}</BsText>
        </BsInline>
        <BsText as="p" size="sm">{{ submissionMessage(latestSubmission) }}</BsText>
        <BsText v-if="latestSubmission.reviewReason" as="p" size="sm" tone="muted">{{ copy.reviewReason }}: {{ latestSubmission.reviewReason }}</BsText>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ copy.usage }}</BsHeading>
        <BsText as="p" size="sm" tone="muted">{{ copy.usageHelp }}</BsText>
        <BsGrid :columns="3">
          <BsUsageMeter v-for="resource in usageResources" :key="resource.resource" :item="usagePresentation(resource)"/>
        </BsGrid>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ copy.compare }}</BsHeading>
        <BsText as="p" size="sm" tone="muted">{{ copy.compareHelp }}</BsText>
        <BsGrid v-if="catalogPending" role="status" :columns="3">
          <BsSkeleton v-for="item in 3" :key="item"/>
        </BsGrid>
        <BsBox v-else-if="catalogError" role="alert">
          <BsText as="p">{{ copy.catalogFailed }}</BsText>
          <BsButton severity="secondary" @click="refreshCatalog()">{{ copy.retry }}</BsButton>
        </BsBox>
        <BsText v-else-if="!purchasablePlans.length" role="status" as="p" size="sm">{{ copy.noPurchasable }}</BsText>
        <BsMarketingPricing v-else :interval="planPresentation.interval" :plans="planPresentation.pricingPlans" :interval-options="[{ value: 'monthly', label: planPresentation.copy.monthly }, { value: 'annual', label: planPresentation.copy.yearly }]" :copy="{ cycleLabel: planPresentation.copy.cycle, loading: planPresentation.copy.loading, empty: planPresentation.copy.empty, retry: planPresentation.copy.retry, included: planPresentation.copy.included, notIncluded: planPresentation.copy.notIncluded }" :annual-saving="planPresentation.annualDiscount === null ? null : planPresentation.copy.annualSaving(planPresentation.annualDiscount)" :columns="3" :loading="false" :error="null" test-id="shop-plan-cards" @update:interval="value => { if (value === 'monthly' || value === 'annual') planPresentation.interval = value }" @update:variant="planPresentation.chooseVariant" @action="planPresentation.choose" @retry="refresh()"/>
      </BsPanel>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsBox>
            <BsHeading :level="2">{{ copy.instructions }}</BsHeading>
            <BsText as="p" size="sm" tone="muted">{{ copy.instructionsHelp }}</BsText>
          </BsBox>
          <BsText as="span" size="xs" emphasis="semibold">{{ copy.manual }}</BsText>
        </BsInline>
        <BsGrid v-if="billing.instructions.recipientAlias || billing.instructions.paymentLink || billing.instructions.qrImageUrl || (isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn)" :columns="2">
          <BsText v-if="billing.instructions.recipientAlias" as="p">
            <BsText as="span" size="xs" tone="muted">{{ copy.recipient }}</BsText>
            <BsText dir="ltr" as="strong">{{ billing.instructions.recipientAlias }}</BsText>
          </BsText>
          <BsText v-if="billing.instructions.paymentLink" as="p">
            <BsText as="span" size="xs" tone="muted">{{ copy.paymentLink }}</BsText>
            <BsLink :to="billing.instructions.paymentLink" target="_blank" rel="noopener noreferrer" external>{{ billing.instructions.paymentLink }}</BsLink>
          </BsText>
          <BsBox v-if="billing.instructions.qrImageUrl" padding="md">
            <BsText as="span" size="xs" tone="muted">{{ copy.qr }}</BsText>
            <BsImage :src="billing.instructions.qrImageUrl" :alt="copy.qr"/>
          </BsBox>
          <BsText v-if="isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn" as="p" size="sm">{{ isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn }}</BsText>
        </BsGrid>
        <BsText v-else as="p" size="sm" tone="muted">{{ copy.unavailable }}</BsText>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ copy.notice }}</BsHeading>
        <BsText as="p" size="sm" tone="muted">{{ copy.noticeHelp }}</BsText>
        <BsStack>
          <BsButton :disabled="!selectedPlan || hasOpenRequest" @click="noticeAction.edit()">{{ copy.submit }}</BsButton>
          <BsRecordActionDialog v-model:visible="noticeActionOpen" :title="copy.notice" :dirty="noticeActionDirty" :pending="submitPending" :error="submitError" :submit-label="copy.submit" :cancel-label="ui('cancel')" :submit-disabled="!selectedPlan || hasOpenRequest" @submit="submitNotice">
            <BsBox v-if="selectedPlan" padding="md">
              <BsText as="p">{{ copy.requestedPlan }}: <BsText as="strong">{{ selectedPlan.planName }}</BsText> · {{ copy.expected }}: <BsText as="strong">{{ money(selectedPlan.effectivePriceAmount, selectedPlan.currency) }}</BsText> · {{ copy.interval }}: <BsText as="strong">{{ intervalLabel(selectedPlan.billingInterval) }}</BsText>
              </BsText>
              <BsText v-if="selectedPlan.priceSource === 'override'" as="p" emphasis="semibold">{{ copy.negotiated }}</BsText>
              <BsText v-if="selectedPlan.blockers.length" as="p" tone="warning" emphasis="semibold">{{ copy.preservation }}</BsText>
            </BsBox>
            <BsText v-else role="status" as="p" size="sm">{{ copy.noPurchasable }}</BsText>
            <BsField v-slot="field" :label="copy.paid">
              <BsInput :id="field.id" v-model.number="form.paidAmount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" :disabled="!selectedPlan" required/>
            </BsField>
            <BsField v-slot="field" :label="copy.transferDate">
              <BsInput :id="field.id" v-model="form.transferDate" :aria-describedby="field.describedby" type="date" :max="new Date().toISOString().slice(0, 10)" :disabled="!selectedPlan" required/>
            </BsField>
            <BsField v-slot="field" :label="copy.reference">
              <BsInput :id="field.id" v-model="form.transferReference" :aria-describedby="field.describedby" dir="ltr" :minlength="2" :maxlength="200" :disabled="!selectedPlan" required/>
            </BsField>
            <BsText as="p" size="sm" tone="muted">{{ copy.policyPrefix }} <BsLink to="/terms">{{ copy.terms }}</BsLink> · <BsLink to="/privacy">{{ copy.privacy }}</BsLink> · <BsLink to="/refund-cancellation">{{ copy.refund }}</BsLink>.</BsText>
          </BsRecordActionDialog>
        </BsStack>
      </BsPanel>
      <BsPanel padding="md">
        <BsBox padding="md">
          <BsHeading :level="2">{{ copy.history }}</BsHeading>
        </BsBox>
        <BsBox scroll="x">
          <BsDataTable :value="billing.submissions" data-key="id" :label="copy.history" :columns="[{ key: 'status', header: (copy.access), field: 'status' }, { key: 'requestedPlanName', header: (copy.requestedPlan), field: 'requestedPlanName' }, { key: 'column2', header: (copy.expected) }, { key: 'column3', header: (copy.paid) }, { key: 'transferReference', header: (copy.reference), field: 'transferReference' }, { key: 'column5', header: (copy.transferDate) }, { key: 'reviewReason', header: (copy.reviewReason), field: 'reviewReason' }]">
            <template #cell-status="{ row: item }">
              <BsStatusBadge :status="item.status"/> <BsText as="span" size="sm">{{ statusLabel(item.status) }}</BsText>
            </template>
            <template #cell-column2="{ row: item }">{{ money(item.effectivePriceAmount, item.currency) }}</template>
            <template #cell-column3="{ row: item }">{{ money(item.paidAmount, item.currency) }}</template>
            <template #cell-column5="{ row: item }">{{ date(item.transferDate) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
    </template>
    <BsText v-else role="status" as="p" size="sm">{{ copy.noBilling }}</BsText>
  </BsStack>
</template>
