<script setup lang="ts">
import type { ShopBilling } from '~/types/billing'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth'] })

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const ui = useUiCopy()
const { current, currentId, isOwner } = useShop()
const { push: pushToast } = useToasts()
const isArabic = computed(() => locale.value === 'ar')
const copy = computed(() => isArabic.value ? ar : en)
const form = reactive({ paidAmount: 0, transferDate: '', transferReference: '' })
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

watch(() => billing.value?.subscription.priceAmount, value => {
  if (typeof value === 'number' && !form.paidAmount) form.paidAmount = value
}, { immediate: true })

watch(currentId, () => {
  submitRequestId.value = null
  submitError.value = ''
  Object.assign(form, { paidAmount: 0, transferDate: '', transferReference: '' })
}, { flush: 'sync' })

function date(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency }).format(value)
}

function statusLabel(status: string) {
  return copy.value.statuses[status as keyof typeof copy.value.statuses] ?? status
}

async function submitNotice() {
  if (!currentId.value || !isOwner.value || submitPending.value) return
  submitError.value = ''
  if (!(form.paidAmount > 0) || !form.transferDate || form.transferReference.trim().length < 2) {
    submitError.value = copy.value.invalid
    return
  }
  submitPending.value = true
  const requestId = submitRequestId.value ?? globalThis.crypto.randomUUID()
  submitRequestId.value = requestId
  try {
    const { error: commandError } = await rpc.rpc('submit_shop_billing_notice', {
      p_request_id: requestId,
      p_shop_id: currentId.value,
      p_paid_amount: form.paidAmount,
      p_transfer_date: form.transferDate,
      p_transfer_reference: form.transferReference.trim(),
    })
    if (commandError) throw commandError
    submitRequestId.value = null
    Object.assign(form, { paidAmount: billing.value?.subscription.priceAmount ?? 0, transferDate: '', transferReference: '' })
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
  title: 'Subscription and billing', subtitle: 'Review access, usage, and manual InstaPay transfer notices.',
  ownerOnly: 'Ask the Shop owner to review billing or submit a transfer notice. Only the owner can access these details.',
  noBilling: 'No subscription information is available. Contact Building Suit support to review this shop’s billing.', loadFailed: 'Could not load billing information.', retry: 'Retry', plan: 'Current plan', access: 'Access state',
  trialRemaining: 'Trial remaining', days: 'days', renewal: 'Trial or renewal date', trialPeriod: 'Trial period', usage: 'Current usage', locations: 'Locations', products: 'Products', services: 'Services', members: 'Members',
  readOnly: 'Your business history remains available, but subscription-gated writes are disabled until an operator approves payment or adjusts access.',
  instructions: 'Pay with InstaPay / instant bank transfer', instructionsHelp: 'Transfer using the operator-configured details below, then submit the notice for manual review. This is not automatic bank verification.',
  recipient: 'Recipient alias', paymentLink: 'Payment link', qr: 'Payment QR', unavailable: 'Payment instructions have not been configured yet. Contact Building Suit support before transferring.',
  notice: 'Submit payment notice', expected: 'Expected amount', paid: 'Paid amount', transferDate: 'Transfer date', reference: 'Transfer reference',
  submit: 'Submit for review', submitting: 'Submitting…', invalid: 'Enter a positive amount, transfer date, and reference.', submitted: 'Payment notice submitted for manual review.', failed: 'Could not submit the payment notice. You can retry safely.',
  history: 'Payment notice history', empty: 'No payment notices have been submitted.', reviewReason: 'Review note', manual: 'Manual verification',
  statuses: { trialing: 'Trialing', active: 'Active', read_only: 'Read-only', suspended: 'Suspended', submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected' },
}

const ar = {
  title: 'الاشتراك والفوترة', subtitle: 'راجع حالة الوصول والاستخدام وإشعارات التحويل اليدوي عبر InstaPay.',
  ownerOnly: 'اطلب من مالك المتجر مراجعة الفوترة أو إرسال إشعار التحويل. هذه التفاصيل متاحة للمالك فقط.',
  noBilling: 'لا توجد معلومات اشتراك متاحة. تواصل مع دعم Building Suit لمراجعة فوترة هذا المتجر.', loadFailed: 'تعذّر تحميل معلومات الفوترة.', retry: 'إعادة المحاولة', plan: 'الخطة الحالية', access: 'حالة الوصول',
  trialRemaining: 'المتبقي من التجربة', days: 'يوم', renewal: 'موعد انتهاء التجربة أو التجديد', trialPeriod: 'فترة التجربة', usage: 'الاستخدام الحالي', locations: 'الفروع', products: 'المنتجات', services: 'الخدمات', members: 'الأعضاء',
  readOnly: 'يظل سجل النشاط متاحًا، لكن عمليات الكتابة المرتبطة بالاشتراك تتوقف حتى يعتمد مسؤول المنصة الدفعة أو يعدّل الوصول.',
  instructions: 'الدفع عبر InstaPay / تحويل بنكي فوري', instructionsHelp: 'حوّل باستخدام البيانات التي ضبطها مسؤول المنصة ثم أرسل الإشعار للمراجعة اليدوية. لا توجد مطابقة بنكية تلقائية.',
  recipient: 'عنوان المستلم', paymentLink: 'رابط الدفع', qr: 'رمز QR للدفع', unavailable: 'لم يضبط مسؤول المنصة تعليمات الدفع بعد. تواصل مع دعم Building Suit قبل التحويل.',
  notice: 'إرسال إشعار الدفع', expected: 'المبلغ المتوقع', paid: 'المبلغ المدفوع', transferDate: 'تاريخ التحويل', reference: 'مرجع التحويل',
  submit: 'إرسال للمراجعة', submitting: 'جارٍ الإرسال…', invalid: 'أدخل مبلغًا موجبًا وتاريخ التحويل والمرجع.', submitted: 'تم إرسال إشعار الدفع للمراجعة اليدوية.', failed: 'تعذّر إرسال إشعار الدفع. يمكنك إعادة المحاولة بأمان.',
  history: 'سجل إشعارات الدفع', empty: 'لم تُرسل إشعارات دفع بعد.', reviewReason: 'ملاحظة المراجعة', manual: 'تحقق يدوي',
  statuses: { trialing: 'فترة تجريبية', active: 'نشط', read_only: 'قراءة فقط', suspended: 'موقوف', submitted: 'مُرسل', under_review: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' },
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <header><p class="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bs-link)]">{{ current?.name }}</p><h1 class="mt-1 text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></header>
    <p v-if="!isOwner" role="alert" class="rounded-2xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-5">{{ copy.ownerOnly }}</p>
    <div v-else-if="pending" role="status" :aria-label="ui('loading')" class="grid gap-4 sm:grid-cols-3"><div v-for="item in 3" :key="item" class="h-28 animate-pulse rounded-2xl bg-muted" /></div>
    <p v-else-if="error" role="alert" class="ls-error">{{ copy.loadFailed }} <BsButton @click="refresh()">{{ copy.retry }}</BsButton></p>
    <template v-else-if="billing">
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BsKpiCard :title="copy.plan">{{ billing.subscription.planName }}</BsKpiCard>
        <BsKpiCard :title="copy.access"><StatusBadge :status="billing.subscription.accessState" /> <span class="ms-2 text-sm">{{ statusLabel(billing.subscription.accessState) }}</span></BsKpiCard>
        <BsKpiCard :title="copy.trialPeriod"><span class="text-sm">{{ date(billing.subscription.trialStartAt) }} → {{ date(billing.subscription.trialEndAt) }}</span></BsKpiCard>
        <BsKpiCard :title="billing.subscription.accessState === 'trialing' ? copy.trialRemaining : copy.renewal">{{ billing.subscription.accessState === 'trialing' ? `${billing.subscription.trialDaysRemaining} ${copy.days}` : date(billing.subscription.periodEnd || billing.subscription.trialEndAt) }}</BsKpiCard>
      </section>
      <p v-if="['read_only', 'suspended'].includes(billing.subscription.accessState)" role="status" class="rounded-2xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm">{{ copy.readOnly }}</p>
      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 class="text-lg font-extrabold">{{ copy.usage }}</h2><p class="mt-3 text-sm text-muted-foreground">{{ copy.locations }}: {{ billing.usage.locations }} / {{ billing.usage.limits.active_locations ?? '—' }} · {{ copy.products }}: {{ billing.usage.products }} / {{ billing.usage.limits.active_products ?? '—' }} · {{ copy.services }}: {{ billing.usage.services }} / {{ billing.usage.limits.active_services ?? '—' }} · {{ copy.members }}: {{ billing.usage.members }} / {{ billing.usage.limits.active_members ?? '—' }}</p></section>
      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-lg font-extrabold">{{ copy.instructions }}</h2><p class="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{{ copy.instructionsHelp }}</p></div><span class="rounded-full bg-muted px-3 py-1 text-xs font-bold">{{ copy.manual }}</span></div>
        <div v-if="billing.instructions.recipientAlias || billing.instructions.paymentLink || billing.instructions.qrImageUrl || (isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn)" class="mt-5 grid gap-4 md:grid-cols-2">
          <p v-if="billing.instructions.recipientAlias" class="rounded-xl border border-border p-4"><span class="block text-xs text-muted-foreground">{{ copy.recipient }}</span><strong dir="ltr" class="break-all">{{ billing.instructions.recipientAlias }}</strong></p>
          <p v-if="billing.instructions.paymentLink" class="rounded-xl border border-border p-4"><span class="block text-xs text-muted-foreground">{{ copy.paymentLink }}</span><a class="break-all font-bold text-[var(--bs-link)] underline" :href="billing.instructions.paymentLink" target="_blank" rel="noopener noreferrer">{{ billing.instructions.paymentLink }}</a></p>
          <div v-if="billing.instructions.qrImageUrl" class="rounded-xl border border-border p-4"><span class="mb-3 block text-xs text-muted-foreground">{{ copy.qr }}</span><img :src="billing.instructions.qrImageUrl" :alt="copy.qr" class="h-40 w-40 rounded-lg object-contain"></div>
          <p class="whitespace-pre-line rounded-xl border border-border p-4 text-sm leading-6">{{ isArabic ? billing.instructions.instructionsAr : billing.instructions.instructionsEn }}</p>
        </div><p v-else class="mt-5 text-sm text-muted-foreground">{{ copy.unavailable }}</p>
      </section>
      <section class="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 class="text-lg font-extrabold">{{ copy.notice }}</h2><p class="mt-2 text-sm text-muted-foreground">{{ copy.expected }}: <strong>{{ money(billing.subscription.priceAmount, billing.subscription.currency) }}</strong></p>
        <BsForm class="mt-5 grid gap-4 sm:grid-cols-2" :pending="submitPending" :error="submitError" @submit="submitNotice">
          <label class="grid gap-2 text-sm font-bold">{{ copy.paid }}<input v-model.number="form.paidAmount" class="ls-input min-h-11 min-w-0" type="number" min="0.01" step="0.01" required></label>
          <label class="grid gap-2 text-sm font-bold">{{ copy.transferDate }}<input v-model="form.transferDate" class="ls-input min-h-11 min-w-0" type="date" :max="new Date().toISOString().slice(0, 10)" required></label>
          <label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.reference }}<input v-model="form.transferReference" class="ls-input min-h-11 min-w-0" dir="ltr" minlength="2" maxlength="200" required></label>
          <div class="sm:col-span-2"><BsButton type="submit" class="ls-btn ls-btn-primary" :pending="submitPending">{{ submitPending ? copy.submitting : copy.submit }}</BsButton></div>
        </BsForm>
      </section>
      <section class="overflow-hidden rounded-2xl border border-border bg-card"><div class="p-5"><h2 class="text-lg font-extrabold">{{ copy.history }}</h2></div><div class="overflow-x-auto"><BsDataTable :value="billing.submissions" data-key="id" :label="copy.history"><Column field="status"><template #header>{{ copy.access }}</template><template #body="{ data: item }"><StatusBadge :status="item.status" /> <span class="ms-2 text-sm">{{ statusLabel(item.status) }}</span></template></Column><Column><template #header>{{ copy.paid }}</template><template #body="{ data: item }">{{ money(item.paidAmount, item.currency) }}</template></Column><Column field="transferReference"><template #header>{{ copy.reference }}</template></Column><Column><template #header>{{ copy.transferDate }}</template><template #body="{ data: item }">{{ date(item.transferDate) }}</template></Column><Column field="reviewReason"><template #header>{{ copy.reviewReason }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template></BsDataTable></div></section>
    </template>
    <p v-else role="status" class="rounded-xl border border-border p-5 text-sm">{{ copy.noBilling }}</p>
  </div>
</template>
