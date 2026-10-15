<script setup lang="ts">
import type { PrivacyPresentation } from '@building-suit/ux'
import type { ChangelogFeed, ChangelogCopy } from '@building-suit/contracts'
import type { BsBillingCopy, BsBillingForm, BsBillingView } from '@building-suit/ui/types/billingPresentation'
const privacyExampleOpen = ref(false)
const privacyExampleChoice = ref(false)
const privacyExample = computed<PrivacyPresentation>(() => ({
  ready: privacyExampleOpen.value, prompt: false, settings: privacyExampleOpen.value, analytics: privacyExampleChoice.value,
  open: () => { privacyExampleOpen.value = true }, close: () => { privacyExampleOpen.value = false },
  save: value => { privacyExampleChoice.value = value; privacyExampleOpen.value = false }, change: value => { privacyExampleChoice.value = value },
  copy: { title: 'Privacy choices / خيارات الخصوصية', body: '', accept: 'Accept optional / قبول الاختياري', reject: 'Reject optional / رفض الاختياري', settings: 'Privacy settings / إعدادات الخصوصية', necessary: 'Catalogue example only. No provider or storage is connected. مثال توضيحي دون مزود أو تخزين.', analytics: 'Optional analytics / التحليلات الاختيارية', save: 'Save / حفظ', policy: 'Policy / السياسة' },
}))
const billingExampleForm = ref<BsBillingForm>({ paidAmount: 0, transferDate: '', transferReference: '', privateLink: '', reason: '' })
const billingExampleBlocked = ref(false)
const billingExampleDialogVisible = ref(false)
const billingExampleCopy = computed<BsBillingCopy>(() => ({
  title: isArabic.value ? 'مثال الدفع المستضاف' : 'Hosted checkout example', subtitle: '', loading: ui('loading'), retry: ui('retry'), cancel: ui('cancel'), denied: '', failed: '', unavailable: '',
  usage: '', usageHelp: '', usageLoading: '', usageError: '', compare: '', compareHelp: '', instructions: '', instructionsHelp: '', manual: '', recipient: '', paymentLink: '', qr: '', instructionsUnavailable: '',
  privateTitle: '', privateHelp: '', privateLink: '', privatePreview: '', privateClear: '', notice: '', noticeHelp: '', submit: '', requestedPlan: '', expected: '', interval: '', paid: '', transferDate: '', reference: '',
  policyPrefix: isArabic.value ? 'راجع السياسات:' : 'Review policies:', terms: isArabic.value ? 'الشروط' : 'Terms', privacy: isArabic.value ? 'الخصوصية' : 'Privacy', refund: isArabic.value ? 'الاسترداد' : 'Refunds', noPurchasable: '',
  evidenceTitle: '', evidenceHelp: '', evidenceSelect: '', evidenceUpload: '', evidenceUploading: '', evidenceFirst: '', evidenceSaved: '', evidenceAttached: '', history: '', empty: '', access: '', reviewReason: '', reason: '', refresh: '', requests: '', inspect: '', openSubscription: '', cancelRequest: '',
}))
const billingExampleView = computed<BsBillingView>(() => ({
  workspace: '', loading: false, failed: false, denied: false, available: true, summary: [], notice: '', details: [], providerNotice: '', latest: null,
  usage: { items: [], loading: false, failed: false }, pricing: { plans: [], interval: 'monthly', intervalOptions: [], copy: { cycleLabel: '', loading: '', empty: '', retry: '', included: '', notIncluded: '' }, loading: false, error: null, annualSaving: null, columns: 3, testId: 'catalogue-hosted-checkout-plans' },
  pendingChange: { title: isArabic.value ? 'تغيير مجدول توضيحي' : 'Illustrative scheduled change', status: isArabic.value ? 'قيد الانتظار' : 'Pending', message: isArabic.value ? 'لا تُحصّل دفعة الآن. راجع الدفع يدويًا عند الاستحقاق.' : 'No payment now. Review payment manually when due.', details: [{label:isArabic.value?'التاريخ':'Date',value:'13 Oct 2028'}], blockers: [], links: [], pending: false, error: '', cancelLabel: ui('cancel'), payLabel: '', canCancel: true, canPay: false },
  instructions: null, privateOffer: null, transfer: null, evidence: null, showEvidence: false, history: [], showHistory: false, trial: null, policy: null,
  paymentNotice: '', paymentRequired: '', compatibilityNotice: '', pricingError: '', canRequests: false,
  checkout: { title: isArabic.value ? 'دفع مستضاف' : 'Hosted payment', description: isArabic.value ? 'المزود يستقبل بيانات الدفع في صفحته.' : 'The provider collects payment details on its page.',
    logoLight: '/brand/shop-suit-wordmark-light.svg', logoDark: '/brand/shop-suit-wordmark-dark.svg', logoAlt: 'Example provider', quote: 'Example · 199.90 EGP', notice: '', consequences: [isArabic.value ? 'لا يتغير الوصول حتى تأكيد الدفع.' : 'Access stays unchanged until payment is verified.'],
    breakdown: { title: isArabic.value ? 'عرض سعر توضيحي' : 'Illustrative quote', items: [{ label: isArabic.value ? 'المبلغ المطلوب' : 'Amount due', value: '199.90 EGP' }], policy: isArabic.value ? 'مثال بيانات فقط؛ لا ينفذ دفعًا.' : 'Example data only; no payment is performed.', expiry: '' },
    unavailable: isArabic.value ? 'مثال غير متصل بمزود دفع.' : 'Catalogue example; no payment provider is connected.', action: isArabic.value ? 'المتابعة للدفع' : 'Continue to payment', pending: false, disabled: true,
    error: billingExampleBlocked.value ? (isArabic.value ? 'مثال على تغيير غير مدعوم. لم يتم قبول سعر أو دفع.' : 'Illustrative unsupported change. No price or payment was accepted.') : '',
    actionVisible: !billingExampleBlocked.value, helpLabel: isArabic.value ? 'رابط دعم توضيحي' : 'Example support link', helpTo: '/components#hosted-checkout' },
}))
const exampleQuantity = ref(1)
const pinnedRecordActions = ref(false)
const recordSubmitVisible = ref(true)
const changelogState = ref<'ready' | 'loading' | 'error' | 'denied'>('ready')
const changelogFeed: ChangelogFeed = {
  serverNow: '2026-10-10T12:00:00Z',
  suits: ['shop', 'ledger', 'inventory', 'automation', 'future'].map(id => ({ id: `${id}-suit`, name: { en: `${id[0]!.toUpperCase()}${id.slice(1)} Suit`, ar: ({ shop: 'شوب سوت', ledger: 'ليدجر سوت', inventory: 'إنفنتوري سوت', automation: 'أوتوميشن سوت', future: 'سوت مستقبلي' } as Record<string, string>)[id]! } })),
  entries: ['shop', 'ledger', 'inventory', 'automation', 'future'].map((id, index) => ({
    id: `example-${id}`, suit: `${id}-suit`, visibility: 'public' as const, publishedAt: '2026-10-09T12:00:00Z',
    title: { en: 'Example workspace update', ar: 'مثال لتحديث مساحة العمل' },
    summary: { en: 'Catalogue demonstration only.', ar: 'عرض توضيحي للمكتبة فقط.' },
    details: { en: 'Curated release content supplied by the owning Suit. This example is not an actual release.', ar: 'محتوى تحديث من التطبيق المسؤول. هذا المثال ليس إصداراً فعلياً.' }, links: [],
    ...(index % 2 === 0 ? { status: 'released' as const, version: '1.0.0', releasedAt: '2026-10-09T10:00:00Z' } : { status: 'coming-soon' as const, targetVersion: '1.1.0-beta.1' }),
  })),
}
const changelogCopy = computed<ChangelogCopy>(() => isArabic.value ? {
  timeline: 'سجل التحديثات', suit: 'التطبيق', status: 'حالة الإصدار', allSuits: 'كل التطبيقات', allStatuses: 'كل الحالات', released: 'تم الإصدار', comingSoon: 'قريباً', targetVersion: 'الإصدار المستهدف', new: 'جديد', published: 'تاريخ النشر', releasedAt: 'تاريخ الإصدار', empty: 'لا توجد تحديثات', loading: 'جار تحميل التحديثات', error: 'تعذر تحميل التحديثات', denied: 'الوصول غير مسموح', retry: 'إعادة المحاولة',
} : {
  timeline: 'Changelog', suit: 'Suit', status: 'Release status', allSuits: 'All Suits', allStatuses: 'All statuses', released: 'Released', comingSoon: 'Coming Soon', targetVersion: 'Target version', new: 'New', published: 'Published', releasedAt: 'Released', empty: 'No updates', loading: 'Loading updates', error: 'Unable to load updates', denied: 'Access denied', retry: 'Retry',
})
const shellSuit = ref('alpha')
const shellContext = ref('overview')
const shellState = ref<'normal' | 'loading' | 'empty' | 'overflow'>('normal')
const { locale } = useI18n()
const ui = useUiCopy()
const isArabic = computed(() => locale.value === 'ar')
const rows = ref([
  { id: '1', name: 'Ledger Suit', category: 'Finance', amount: 120, status: 'active' },
  { id: '2', name: 'Shop Suit', category: 'Commerce', amount: 240, status: 'pending' },
  { id: '3', name: 'Building Suit', category: 'Platform', amount: 360, status: 'completed' },
])
const selected = ref([])
const choice = ref<string | number | null>('1')
const choices = Array.from({ length: 10000 }, (_, index) => ({ id: String(index + 1), name: `Item ${index + 1}` }))
const formError = ref('')
const formPending = ref(false)
const formValue = ref('')
const notes = ref('')
const tab = ref('overview')
const segment = ref('summary')
const page = ref(1)
const notificationChoices = ref<string[]>(['email'])
const planChoice = ref<string | string[]>('standard')
const consent = ref(false)
const notificationsEnabled = ref(true)
const searchValue = ref('')
const rangeFrom = ref('2026-10-01')
const rangeTo = ref('2026-10-31')
const selectedFile = ref<File | null>(null)
const catalogueOtp = ref('123456')
const tableState = ref<'data' | 'loading' | 'empty' | 'error'>('data')
const density = ref<'compact' | 'comfortable'>('comfortable')
const catalogueTags = ref(['shared', 'typed'])
const selectedEntity = ref<string | number | null>('ledger')
const entityOptions = ref([{ id: 'ledger', name: 'Ledger Suit' }, { id: 'shop', name: 'Shop Suit' }])
const historyEntries = [
  { id: 'created', title: 'Created', detail: 'Typed table contract' },
  { id: 'reviewed', title: 'Reviewed', detail: 'Bs-only domain cells' },
]
const tableColumns = computed(() => [
  { key: 'name', field: 'name', header: isArabic.value ? 'الاسم' : 'Name', sortable: true, footer: isArabic.value ? 'الإجمالي' : 'Total' },
  { key: 'category', field: 'category', header: isArabic.value ? 'التصنيف' : 'Category', sortable: true },
  { key: 'status', field: 'status', header: isArabic.value ? 'الحالة' : 'Status' },
  { key: 'amount', field: 'amount', header: isArabic.value ? 'القيمة' : 'Value', sortable: true, align: 'end' as const, width: 'sm' as const },
])
const pricingInterval = ref('monthly')
const { success: toastSuccess } = useToasts()
function verifyForm() { formError.value = isArabic.value ? 'راجع القيمة وحاول مرة أخرى.' : 'Review the value and try again.' }
const filters = ref({ global: { value: null, matchMode: 'contains' } })
const name = ref('')
const editingId = ref<string | null>(null)
const action = useRecordAction(() => ({ name: name.value }))
const { visible, dirty, pending, error: actionError, mode } = action
const { step, advance, back } = useSignupWizard(2)
const confirmation = useConfirmation()
const confirmationResult = ref('')
async function confirmExample() {
  const confirmed = await confirmation.ask({
    title: isArabic.value ? 'إزالة السجل' : 'Remove record',
    message: isArabic.value ? 'هل تريد إزالة هذا السجل التجريبي؟' : 'Remove this example record?',
    confirmLabel: isArabic.value ? 'إزالة' : 'Remove',
    tone: 'danger',
  })
  confirmationResult.value = confirmed ? (isArabic.value ? 'تم التأكيد' : 'Confirmed') : (isArabic.value ? 'تم الإلغاء' : 'Cancelled')
}
function add() {
  editingId.value = null
  name.value = ''
  action.create()
}
function edit(row: { id: string; name: string }) {
  editingId.value = row.id
  name.value = row.name
  action.edit()
}
async function save() {
  await action.run(async () => {
    if (!name.value.trim()) throw new Error('invalid example')
    if (editingId.value) {
      const row = rows.value.find(item => item.id === editingId.value)
      if (row) row.name = name.value.trim()
    }
    else rows.value.push({ id: String(rows.value.length + 1), name: name.value.trim(), category: 'Example', amount: 0, status: 'draft' })
  }, () => isArabic.value ? 'أدخل اسماً قبل الحفظ.' : 'Enter a name before saving.')
}
const shellSuits = computed(() => shellState.value === 'empty' ? [] : Array.from({ length: shellState.value === 'overflow' ? 24 : 3 }, (_, index) => ({
  id: index === 0 ? 'alpha' : `suit-${index}`,
  label: isArabic.value ? `مساحة العمل ${index + 1}` : `Workspace ${index + 1}`,
  icon: 'dashboard', disabled: index === 2,
})))
const shellGroups = computed(() => shellState.value === 'empty' ? [] : [{
  id: 'workspace', label: isArabic.value ? 'الإدارة' : 'Administration',
  items: Array.from({ length: shellState.value === 'overflow' ? 32 : 3 }, (_, index) => ({
    id: index === 0 ? 'overview' : `context-${index}`,
    label: index === 0 ? (isArabic.value ? 'نظرة عامة' : 'Overview') : (isArabic.value ? `إعدادات مساحة العمل وعناصر التنقل الطويلة ${index}` : `Workspace settings and long navigation item ${index}`),
    to: index === 1 ? '#administration-shell' : undefined,
    disabled: index === 2,
  })),
}])
const shellLabels = computed(() => ({
  suits: isArabic.value ? 'مساحات العمل' : 'Workspaces', navigation: isArabic.value ? 'تنقل السياق' : 'Context navigation',
  open: isArabic.value ? 'فتح التنقل' : 'Open navigation', close: isArabic.value ? 'إغلاق التنقل' : 'Close navigation',
  loading: isArabic.value ? 'جارٍ التحميل' : 'Loading navigation', emptySuits: isArabic.value ? 'لا توجد مساحات عمل' : 'No workspaces',
  emptyNavigation: isArabic.value ? 'لا توجد عناصر تنقل' : 'No navigation items',
}))
useHead({ title: 'Shared component catalogue · Building Suit' })

const invitationPreviewPassword=ref(''), invitationPreviewConfirmation=ref('')
const invitationPreviewCopy={
  "ownerInvite.title": "Owner invitation",
  "ownerInvite.description": "A complete shared claim page; ownership remains product-owned.",
  "ownerInvite.home": "Home",
  "ownerInvite.loading": "Loading",
  "ownerInvite.invalid": "Invitation unavailable",
  "ownerInvite.askAdmin": "Request an explicitly acknowledged resend.",
  "ownerInvite.login": "Sign in",
  "ownerInvite.done": "Done",
  "ownerInvite.open": "Open",
  "ownerInvite.passwordTitle": "Password title",
  "ownerInvite.verified": "Verified",
  "ownerInvite.save": "Save",
  "ownerInvite.password": "Password",
  "ownerInvite.confirm": "Confirm",
  "ownerInvite.passwordError": "Passworderror"
}
</script>

<template>
  <div class="space-y-8">
    <BsPageHeader
      :title="isArabic ? 'مكتبة المكونات المشتركة' : 'Shared component catalogue'"
      :subtitle="isArabic ? 'أمثلة حية للعقود الأساسية المستخدمة في جميع تطبيقات سوت.' : 'Live examples of the canonical contracts used by every Suit.'"
      :context-label="isArabic ? 'سياق المعاينة' : 'Preview context'"
      :context="[{ label: isArabic ? 'الاتجاه' : 'Direction', value: isArabic ? 'RTL' : 'LTR' }, { label: isArabic ? 'المصدر' : 'Owner', value: 'packages/ui' }]"
    />

    <BsContentSection :title="isArabic ? 'حالة العمليات المحلية' : 'Local transaction status'">
      <BsOfflineCounterStatus :view="{ notice: isArabic ? 'مثال توضيحي لحالات المزامنة؛ لا ينفذ عمليات.' : 'Illustrative synchronization states; no transactions are executed.', retry: isArabic ? 'إعادة المحاولة' : 'Retry', records: ['unsynced','syncing','failed','synced'].map((state, index) => ({ id: String(index), label: isArabic ? 'عملية محلية' : 'Local transaction', state: state as 'unsynced' | 'syncing' | 'failed' | 'synced', status: state, detail: '', receipt: null })) }" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'عنوان طويل وعرض ضيق' : 'Long heading at narrow widths'">
      <BsPageHeader :title="isArabic ? 'اسممتجرطويلبدونمسافاتلاختبارالتفافالعنوانداخلعرضالصفحة' : 'ExampleShopIdentifierWithoutSpacesForTestingHeadingWrappingWithinTheViewport'" :subtitle="isArabic ? 'مثال توضيحي لاختبار العرض والاستجابة.' : 'Illustrative heading for responsive layout inspection.'" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'التنقل بين أقسام الصفحة' : 'Page section navigation'">
      <BsSectionNavigation :label="isArabic ? 'أقسام المكتبة' : 'Catalogue sections'" :sections="[{ id: 'forms', label: isArabic ? 'النماذج' : 'Forms' }, { id: 'pricing', label: isArabic ? 'الخطط' : 'Plans' }]" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'تقويم المواعيد' : 'Appointment calendar'">
      <BsText size="sm" tone="muted">{{ isArabic ? 'مثال توضيحي على خلية فارغة وحالة اليوم.' : 'Illustrative empty calendar cell and today marker.' }}</BsText>
      <BsAppointmentCalendar view="day" :transitioning="false" :copy="{ title: isArabic ? 'تقويم المواعيد' : 'Appointment calendar', empty: isArabic ? 'لا توجد مواعيد' : 'No appointments', edit: isArabic ? 'تعديل' : 'Edit', reschedule: isArabic ? 'تعديل الموعد' : 'Reschedule', saving: isArabic ? 'جارٍ الحفظ' : 'Saving', history: isArabic ? 'السجل' : 'History' }" :days="[{ id: '2026-10-12', label: isArabic ? 'الاثنين ١٢ أكتوبر' : 'Monday 12 October', today: true, appointments: [] }]" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'الكمية' : 'Touch quantity controls'"><BsQuantityStepper v-model="exampleQuantity" :max="3" :label="isArabic ? 'الكمية' : 'Quantity'" :decrease-label="isArabic ? 'تقليل الكمية' : 'Decrease quantity'" :increase-label="isArabic ? 'زيادة الكمية' : 'Increase quantity'" /></BsContentSection>

    <BsContentSection :title="isArabic ? 'بطاقات كتالوج نقطة البيع' : 'POS catalog image cards'">
      <BsGrid :columns="3"><BsCatalogTile :name="isArabic ? 'مثال منتج بدون صورة' : 'Example product without image'" price="30" :detail="isArabic ? 'بيانات توضيحية' : 'Illustrative data'" :image-label="isArabic ? 'بدون صورة' : 'No image'" /><BsCatalogTile :name="isArabic ? 'مثال خدمة بدون صورة' : 'Example service without image'" price="10" :detail="isArabic ? 'بيانات توضيحية' : 'Illustrative data'" :image-label="isArabic ? 'بدون صورة' : 'No image'" /></BsGrid>
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'رفع صور الكتالوج' : 'Catalog image upload'">
      <BsCatalogImageUploader input-id="catalog-image-example" preview="" name="" status="idle" :copy="{ choose: isArabic ? 'اختيار صورة' : 'Choose image', replace: isArabic ? 'استبدال الصورة' : 'Replace image', remove: isArabic ? 'إزالة' : 'Remove', retry: isArabic ? 'إعادة المحاولة' : 'Retry', help: isArabic ? 'عرض توضيحي فقط؛ لا يتم رفع الملفات.' : 'Presentation example only; files are not uploaded.', uploading: isArabic ? 'جارٍ الرفع…' : 'Uploading…', uploaded: isArabic ? 'تم رفع الصورة' : 'Image uploaded', error: isArabic ? 'تعذّر رفع الصورة' : 'Upload failed', invalid: isArabic ? 'صورة غير صالحة' : 'Invalid image', placeholder: isArabic ? 'بدون صورة' : 'No image' }" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'مقاييس لوحة التحكم' : 'Dashboard metrics'">
      <BsDashboardMetric :metric="{ id: 'example', title: isArabic ? 'بيانات توضيحية' : 'Illustrative data', value: 'EGP 120', hint: isArabic ? 'مثال للمكتبة فقط.' : 'Catalogue example only.', changeLabel: '', tone: 'neutral', to: '', source: null }" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'مثال رسوم مزيج المبيعات' : 'Sales mix chart example'">
      <BsGrid :columns="2"><BsMetricChart :title="isArabic ? 'بيانات توضيحية' : 'Illustrative data'" :empty-label="isArabic ? 'لا توجد بيانات' : 'No data'" kind="donut" :items="[{ id: 'products', label: isArabic ? 'منتجات' : 'Products', hint: '', value: 30, formatted: '30' }, { id: 'services', label: isArabic ? 'خدمات' : 'Services', hint: '', value: 10, formatted: '10' }]" /><BsMetricChart :title="isArabic ? 'بيانات توضيحية' : 'Illustrative data'" :empty-label="isArabic ? 'لا توجد بيانات' : 'No data'" :items="[{ id: 'cash', label: isArabic ? 'نقدي' : 'Cash', hint: '', value: 30, formatted: '30' }, { id: 'card', label: isArabic ? 'بطاقة' : 'Card', hint: '', value: 10, formatted: '10' }]" /></BsGrid>
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'قوالب الصفحات' : 'Page templates'"><BsLink to="/templates/access?suit=ledger">Ledger access template</BsLink><BsLink to="/templates/access?suit=shop">Shop access template</BsLink></BsContentSection>
    <BsContentSection id="changelog" :title="isArabic ? 'سجل التحديثات' : 'Changelog'">
      <BsInline><BsButton v-for="state in (['ready', 'loading', 'error', 'denied'] as const)" :key="state" :aria-pressed="changelogState === state" @click="changelogState = state">{{ state }}</BsButton></BsInline>
      <BsChangelogTimeline :feed="changelogFeed" :locale="isArabic ? 'ar' : 'en'" :copy="changelogCopy" :state="changelogState" @retry="changelogState = 'ready'" />
    </BsContentSection>

    <BsContentSection id="administration-shell" :title="isArabic ? 'هيكل الإدارة' : 'Administration shell'" :description="isArabic ? 'أمثلة التنقل والحالات من بيانات التطبيق.' : 'App-owned descriptors, controlled selection and normal/loading/empty/overflow examples.'">
      <BsInline>
        <BsButton v-for="state in (['normal', 'loading', 'empty', 'overflow'] as const)" :key="state" :aria-pressed="shellState === state" @click="shellState = state">{{ state }}</BsButton>
      </BsInline>
      <BsAdministrationShell v-model:selected-suit="shellSuit" v-model:selected-context="shellContext" :suits="shellSuits" :groups="shellGroups" :labels="shellLabels" :loading="shellState === 'loading'" :context-title="isArabic ? 'مساحة العمل النشطة' : 'Active workspace'">
        <template #header><BsText>{{ isArabic ? 'أدوات مساحة العمل' : 'Workspace tools' }}</BsText></template>
        <BsHeading :level="2">{{ isArabic ? 'مساحة العمل' : 'Working area' }}</BsHeading>
        <BsText>{{ isArabic ? 'يملك التطبيق البيانات والإجراءات والتفويض.' : 'The app owns data, actions and authorization.' }}</BsText>
        <BsButton>{{ isArabic ? 'إجراء تجريبي' : 'Example action' }}</BsButton>
      </BsAdministrationShell>
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'حساب الشريط الجانبي' : 'Sidebar account and plan'">
      <div class="max-w-xs"><BsSidebarAccount :name="isArabic ? 'مالك المتجر' : 'Shop owner'" email="owner@example.test" :account-label="isArabic ? 'الحساب' : 'Account'" :sign-out-label="isArabic ? 'تسجيل الخروج' : 'Sign out'" :plan="{ name: 'Solo', status: isArabic ? 'مثال توضيحي' : 'Catalogue example', detail: '', actionLabel: isArabic ? 'الاشتراك' : 'Subscription', to: '#pricing' }" /></div>
    </BsContentSection>

    <BsContentSection
      :title="isArabic ? 'الدلالات والتخطيط' : 'Semantic content and layout'"
      :description="isArabic ? 'تتكيف العقود نفسها مع العرض الضيق والاتجاه من اليمين إلى اليسار والسمة النشطة.' : 'The same contracts adapt to narrow screens, RTL, and the active theme.'"
    >
      <BsStack gap="lg">
        <BsSegmentedControl
          v-model="segment"
          :label="isArabic ? 'عرض المحتوى' : 'Content view'"
          :options="[{ value: 'summary', label: isArabic ? 'ملخص' : 'Summary' }, { value: 'details', label: isArabic ? 'تفاصيل' : 'Details' }]"
        />
        <BsGrid columns="auto" min-item-width="md" gap="md">
          <BsSurface variant="muted" padding="lg">
            <BsStack gap="sm">
              <BsBadge tone="featured">{{ isArabic ? 'جديد' : 'New' }}</BsBadge>
              <BsHeading :level="3">{{ isArabic ? 'محتوى دلالي' : 'Semantic content' }}</BsHeading>
              <BsText tone="muted">{{ isArabic ? 'لا يحتاج المستهلك إلى فئات عرض.' : 'Consumers do not need presentation classes.' }}</BsText>
              <BsInline justify="between"><BsLink to="/components" variant="standalone">{{ isArabic ? 'رابط داخلي' : 'Internal link' }}</BsLink><BsText as="time" size="sm" tone="muted" datetime="2026-10-03">2026-10-03</BsText></BsInline>
            </BsStack>
          </BsSurface>
          <BsInteractiveCard
            :title="isArabic ? 'بطاقة تفاعلية' : 'Interactive card'"
            :description="isArabic ? 'تركيز واضح بدون مظهر زر عادي.' : 'Clear focus without ordinary button chrome.'"
            @click="segment = segment === 'summary' ? 'details' : 'summary'"
          />
          <BsAlert tone="permission" :title="isArabic ? 'وصول مقيّد' : 'Restricted access'" :description="isArabic ? 'تظل الصلاحيات مسؤولية الخادم.' : 'Authorization remains a server responsibility.'" />
        </BsGrid>
        <BsDescriptionList :columns="2" divided>
          <BsDescriptionItem :term="isArabic ? 'الاتجاه' : 'Direction'">{{ isArabic ? 'من اليمين إلى اليسار' : 'Left to right' }}</BsDescriptionItem>
          <BsDescriptionItem :term="isArabic ? 'السمة' : 'Theme'">{{ isArabic ? 'تتبع الإعداد النشط' : 'Uses the active setting' }}</BsDescriptionItem>
        </BsDescriptionList>
        <BsDisclosure :summary="isArabic ? 'تفاصيل العقد' : 'Contract details'" variant="surface">
          <BsList marker="check" spacing="compact"><BsListItem>{{ isArabic ? 'مسافات دلالية' : 'Semantic spacing' }}</BsListItem><BsListItem>{{ isArabic ? 'تخطيط متجاوب' : 'Responsive layout' }}</BsListItem></BsList>
        </BsDisclosure>
        <BsCodeBlock language="vue" :label="isArabic ? 'مثال' : 'Example'" code="&lt;BsStack gap=&quot;md&quot;&gt;…&lt;/BsStack&gt;" />
      </BsStack>
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'الهوية والإجراءات' : 'Brand and actions'" :description="isArabic ? 'تستخدم الإجراءات الحالات والأحجام المشتركة.' : 'Actions use shared variants, sizes and pending guards.'">
      <div class="flex flex-wrap items-center gap-3"><BsBuildingLogo /><BsIcon v-for="icon in ['dashboard', 'ledger', 'invoice', 'team', 'wallet', 'reports']" :key="icon" :name="icon" :size="28" /></div>
      <div class="mt-5 flex flex-wrap items-start gap-4"><BsUserIdentity name="Building Suit User" email="user@example.com" /><BsUserMenu name="Building Suit User" email="user@example.com" :account-label="isArabic ? 'قائمة الحساب' : 'Account menu'" :sign-out-label="isArabic ? 'تسجيل الخروج' : 'Sign out'" /></div>
      <div class="ls-card-flat mt-5 flex flex-wrap items-center gap-3 p-5">
        <BsButton variant="primary">{{ ui('save') }}</BsButton><BsButton variant="secondary">{{ isArabic ? 'مراجعة' : 'Review' }}</BsButton><BsButton>{{ ui('cancel') }}</BsButton><BsButton variant="danger">{{ isArabic ? 'حذف' : 'Delete' }}</BsButton>
      </div>
      <div class="mt-5 flex flex-wrap items-center gap-3" role="group" :aria-label="isArabic ? 'إجراءات دلالية' : 'Semantic actions'">
        <BsButton variant="link">{{ isArabic ? 'إجراء رابط' : 'Link action' }}</BsButton>
        <BsButton variant="icon" :aria-label="ui('close')"><BsIcon name="close" /></BsButton>
        <BsButton variant="tab" role="tab" aria-selected="true">{{ isArabic ? 'تبويب' : 'Tab' }}</BsButton>
        <BsButton variant="chip" aria-pressed="true">{{ isArabic ? 'خيار' : 'Chip' }}</BsButton>
        <BsButton variant="tile" class="max-w-48">{{ isArabic ? 'بطاقة تفاعلية' : 'Interactive tile' }}</BsButton>
      </div>
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'التنقل والأدوات' : 'Navigation and tools'" :description="isArabic ? 'تبويبات وشريط أدوات وقائمة مشتركة.' : 'Shared tabs, toolbar and menu geometry.'">
      <BsTabs v-model="tab" :label="isArabic ? 'أقسام المثال' : 'Example sections'" :tabs="[{ value: 'overview', label: isArabic ? 'نظرة عامة' : 'Overview', count: 3 }, { value: 'activity', label: isArabic ? 'النشاط' : 'Activity' }]" />
      <BsToolbar class="mt-4" :label="isArabic ? 'أدوات الصفحة' : 'Page tools'">
        <BsInput :model-value="''" type="search" :placeholder="isArabic ? 'بحث' : 'Search'" :aria-label="isArabic ? 'بحث' : 'Search'" />
        <template #actions><BsButton variant="primary">{{ isArabic ? 'إضافة' : 'Add' }}</BsButton><BsMenu :label="isArabic ? 'المزيد' : 'More'"><BsButton variant="text" role="menuitem">{{ isArabic ? 'تصدير' : 'Export' }}</BsButton></BsMenu></template>
      </BsToolbar>
    </BsContentSection>

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Status and KPI examples">
      <BsKpiCard :title="isArabic ? 'السجلات' : 'Records'" change-label="+12%" tone="success">{{ rows.length }}</BsKpiCard>
      <BsKpiCard :title="isArabic ? 'قيد المراجعة' : 'In review'" :hint="isArabic ? 'بيانات تجريبية' : 'Example data'">1</BsKpiCard>
      <BsCard :title="isArabic ? 'الحالات' : 'Statuses'" padding="lg"><div class="flex flex-wrap gap-2"><BsStatusBadge status="active" /><BsStatusBadge status="pending" /><BsStatusBadge status="failed" /></div></BsCard>
      <BsPanel><BsHeading :level="3">{{ isArabic ? 'لوحة مشتركة' : 'Shared panel' }}</BsHeading><BsText tone="muted">{{ isArabic ? 'نفس حدود البطاقات وانحناءاتها ومسافاتها في كل المنتجات.' : 'The same card borders, corners and spacing across products.' }}</BsText></BsPanel>
      <BsCard :title="isArabic ? 'سطح متداخل' : 'Nested surface'" variant="flat" padding="lg" :span="2"><p class="text-sm text-fg-muted">{{ isArabic ? 'بدون ظل إضافي.' : 'No competing elevation.' }}</p></BsCard>
    </section>

    <section class="ls-card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 class="text-xl font-bold">{{ isArabic ? 'جدول البيانات' : 'Data table' }}</h2>
        <div class="flex flex-wrap gap-2">
          <BsButton v-for="state in (['data', 'loading', 'empty', 'error'] as const)" :key="state" size="sm" :variant="tableState === state ? 'primary' : 'default'" @click="tableState = state">{{ state }}</BsButton>
        </div>
      </div>
      <div class="px-5 pb-3"><BsTableDensity v-model="density" :label="isArabic ? 'كثافة الجدول' : 'Table density'" :compact-label="isArabic ? 'مضغوط' : 'Compact'" :comfortable-label="isArabic ? 'مريح' : 'Comfortable'" /></div>
      <BsDataTable
        v-model:selection="selected" v-model:filters="filters" :value="tableState === 'empty' ? [] : rows" row-key="id" :columns="tableColumns"
        :search-fields="['name', 'category']" searchable exportable paginator :page-size="2" :page-sizes="[2, 5, 10]"
        sort-mode="multiple" removable-sort resizable-columns reorderable-columns striped-rows selection-mode="multiple"
        :meta-key-selection="false" :density="density" :loading="tableState === 'loading'"
        :error="tableState === 'error' ? (isArabic ? 'تعذر تحميل المثال.' : 'The example could not be loaded.') : null"
        :label="isArabic ? 'أمثلة المكونات' : 'Component examples'"
        :capabilities="{ insert: true, edit: true, select: true }"
        @create="add"
        @edit="edit"
        @retry="tableState = 'data'"
      >
        <template #cell-status="{ row }"><BsStatusBadge :status="row.status" /></template>
        <template #footer-amount><BsText numeric>{{ rows.reduce((sum, row) => sum + row.amount, 0) }}</BsText></template>
      </BsDataTable>
    </section>

    <BsCard id="forms" :title="isArabic ? 'النماذج والاختيار' : 'Forms and selection'" data-testid="foundation-patterns">
      <div class="space-y-5">
        <BsFilterBar :label="isArabic ? 'مرشحات السجلات' : 'Record filters'">
          <template #search><BsSearchField v-model="searchValue" :label="isArabic ? 'البحث' : 'Search'" :placeholder="isArabic ? 'ابحث بالاسم' : 'Search by name'" :clear-label="ui('close')" /></template>
          <template #filters><BsDateRangeFilter v-model:from="rangeFrom" v-model:to="rangeTo" :legend="isArabic ? 'نطاق التاريخ' : 'Date range'" :from-label="isArabic ? 'من' : 'From'" :to-label="isArabic ? 'إلى' : 'To'" /></template>
          <template #actions><BsButton>{{ isArabic ? 'تطبيق' : 'Apply' }}</BsButton></template>
        </BsFilterBar>
        <BsSelect v-model="choice" :label="isArabic ? 'الصنف' : 'Item'" :options="choices" option-label="name" option-value="id" filter virtual />
        <BsFieldLabel for="catalogue-native-plan">{{ isArabic ? 'الخطة' : 'Plan' }}</BsFieldLabel>
        <BsSelect id="catalogue-native-plan" v-model="searchValue" native>
          <BsSelectOption value="standard">{{ isArabic ? 'قياسية' : 'Standard' }}</BsSelectOption>
          <BsSelectOption value="advanced">{{ isArabic ? 'متقدمة' : 'Advanced' }}</BsSelectOption>
        </BsSelect>
        <BsForm :pending="formPending" :error="formError" layout="grid" :columns="2" @submit="verifyForm">
          <BsField v-slot="field" :label="isArabic ? 'القيمة' : 'Value'" for="catalogue-value" :description="isArabic ? 'وصف الحقل' : 'Field description'" :hint="isArabic ? 'حقل نصي مشترك' : 'Shared text field'" required><BsInput id="catalogue-value" v-model="formValue" required :aria-describedby="field.describedby" :invalid="field.invalid" /></BsField>
          <BsField v-slot="field" :label="isArabic ? 'ملاحظات' : 'Notes'" for="catalogue-notes"><BsTextarea id="catalogue-notes" v-model="notes" :aria-describedby="field.describedby" /></BsField>
          <BsFormSection :title="isArabic ? 'خيارات السجل' : 'Record options'" :description="isArabic ? 'عناصر تحكم دلالية مشتركة.' : 'Shared semantic controls.'" :columns="2">
            <BsCheckbox v-model="consent" :label="isArabic ? 'أوافق على الشروط' : 'I agree to the terms'" required />
            <BsSwitch v-model="notificationsEnabled" :label="isArabic ? 'تفعيل الإشعارات' : 'Enable notifications'" />
            <BsFileInput v-model="selectedFile" :label="isArabic ? 'اختر ملف CSV' : 'Choose CSV file'" accept=".csv,text/csv" :empty-label="isArabic ? 'لم يتم اختيار ملف' : 'No file selected'" />
          </BsFormSection>
          <BsChoiceGroup v-model="notificationChoices" :legend="isArabic ? 'الإشعارات' : 'Notifications'" :options="[{ value: 'email', label: isArabic ? 'البريد' : 'Email' }, { value: 'app', label: isArabic ? 'داخل التطبيق' : 'In app' }]" inline />
          <BsChoiceGroup v-model="planChoice" type="radio" :legend="isArabic ? 'الخطة' : 'Plan'" :options="[{ value: 'standard', label: isArabic ? 'قياسية' : 'Standard' }, { value: 'advanced', label: isArabic ? 'متقدمة' : 'Advanced' }]" inline />
          <BsFormActions><BsButton type="button">{{ ui('cancel') }}</BsButton><BsButton type="submit" variant="primary">{{ ui('save') }}</BsButton></BsFormActions>
        </BsForm>
        <div class="flex flex-wrap gap-2"><BsButton variant="chip" :aria-pressed="formPending" @click="formPending = !formPending">{{ ui('loading') }}</BsButton><BsButton @click="toastSuccess(isArabic ? 'تم الحفظ' : 'Saved')">{{ isArabic ? 'إظهار إشعار' : 'Show notification' }}</BsButton></div>
      </div>
    </BsCard>

    <BsContentSection :title="isArabic ? 'حالات المحتوى' : 'Content states'" variant="flat">
      <div class="grid gap-3 md:grid-cols-2"><BsStateSurface state="loading" :title="ui('loading')" /><BsStateSurface state="error" :title="isArabic ? 'تعذر التحميل' : 'Could not load'" :description="isArabic ? 'حاول مرة أخرى.' : 'Try again.'" :action-label="isArabic ? 'إعادة المحاولة' : 'Retry'" /></div>
      <BsPagination v-model:page="page" class="mt-4" :page-size="10" :total="42" :label="isArabic ? 'الصفحات' : 'Pages'" :previous-label="isArabic ? 'السابق' : 'Previous'" :next-label="isArabic ? 'التالي' : 'Next'" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'عرض البيانات' : 'Data presentation'" :description="isArabic ? 'تفاصيل وسجل ووسوم واختيار كيانات بعقود مشتركة.' : 'Shared contracts for details, history, tags, and entity selection.'">
      <BsStack gap="lg">
        <BsHierarchyBranch :depth="1"><BsHierarchyLeaf /><BsText>{{ isArabic ? 'فرع متداخل' : 'Nested branch' }}</BsText></BsHierarchyBranch>
        <BsFlowBlock part="branches" :columns="2">
          <BsFlowBlock part="node" state="start"><BsHeading size="body">{{ isArabic ? 'المدخلات' : 'Input' }}</BsHeading></BsFlowBlock>
          <BsFlowBlock part="node"><BsHeading size="body">{{ isArabic ? 'المراجعة' : 'Review' }}</BsHeading><BsColorSwatch color="#16293B" /></BsFlowBlock>
        </BsFlowBlock>
        <BsDetailSection :title="isArabic ? 'تفاصيل السجل' : 'Record details'" :columns="2" divided>
          <BsDescriptionItem :term="isArabic ? 'المالك' : 'Owner'">packages/ui</BsDescriptionItem>
          <BsDescriptionItem :term="isArabic ? 'الحالة' : 'Status'"><BsStatusBadge status="active" /></BsDescriptionItem>
        </BsDetailSection>
        <BsHistoryList :entries="historyEntries" :label="isArabic ? 'سجل العقد' : 'Contract history'" item-key="id">
          <template #default="{ entry }"><BsStack gap="none"><BsText emphasis="semibold">{{ entry.title }}</BsText><BsText size="sm" tone="muted">{{ entry.detail }}</BsText></BsStack></template>
        </BsHistoryList>
        <BsTagEditor v-model="catalogueTags" :label="isArabic ? 'الوسوم' : 'Tags'" :add-label="isArabic ? 'إضافة' : 'Add tag'" :remove-label="isArabic ? 'إزالة' : 'Remove'" />
        <BsEntityPicker v-model="selectedEntity" :label="isArabic ? 'اختر المنتج' : 'Choose product'" :options="entityOptions" option-label="name" option-value="id" :load-more-label="isArabic ? 'تحميل المزيد' : 'Load more'" show-clear :retry-label="isArabic ? 'إعادة المحاولة' : 'Retry'" />
      </BsStack>
    </BsContentSection>

    <BsContentSection id="hosted-checkout" :title="isArabic ? 'الدفع المستضاف' : 'Hosted checkout'">
      <BsCheckboxField v-model="billingExampleBlocked" :label="isArabic ? 'إظهار خطأ مع رابط دعم' : 'Show error with support link'"/>
      <BsButton variant="text" @click="billingExampleDialogVisible = true">{{ isArabic ? 'فتح مراجعة الدفع' : 'Open checkout review' }}</BsButton>
      <BsBillingPage v-model:checkout-visible="billingExampleDialogVisible" v-model:form="billingExampleForm" variant="shop" :copy="billingExampleCopy" :view="billingExampleView" :show-header="false"/>
    </BsContentSection>
    <BsContentSection id="pricing" :title="isArabic ? 'خطط التسويق' : 'Marketing plans'" :description="isArabic ? 'البطاقات ودورة الفوترة والإجراءات تأتي من مكوّن مشترك.' : 'Cards, billing-cycle controls, states, and actions come from one shared organism.'">
      <BsMarketingPricing
        variant="shop"
        :interval="pricingInterval"
        :interval-options="[{ value: 'monthly', label: isArabic ? 'شهري' : 'Monthly' }, { value: 'yearly', label: isArabic ? 'سنوي' : 'Yearly' }]"
        :copy="{ cycleLabel: isArabic ? 'دورة الفوترة' : 'Billing cycle', loading: ui('loading'), empty: ui('empty'), retry: isArabic ? 'إعادة المحاولة' : 'Retry', included: isArabic ? 'مشمول' : 'Included', notIncluded: isArabic ? 'غير مشمول' : 'Not included' }"
        :annual-saving="pricingInterval === 'yearly' ? (isArabic ? 'وفّر ٢٠٪ مع الدفع السنوي' : 'Save 20% with yearly billing') : null"
        :plans="[
          { id: 'starter', name: isArabic ? 'البداية' : 'Starter', description: isArabic ? 'للعمل الجديد.' : 'For a new operation.', badge: isArabic ? 'الأكثر شيوعًا' : 'Most popular', badgeTone: 'featured', promoted: true, price: pricingInterval === 'yearly' ? 'EGP 4,800' : 'EGP 500', priceNote: pricingInterval === 'yearly' ? (isArabic ? 'تُدفع سنويًا' : 'billed yearly') : (isArabic ? 'شهريًا' : 'per month'), features: [{ key: 'records', included: true, text: isArabic ? 'تقارير أساسية' : 'Core reports' }], action: { label: isArabic ? 'ابدأ التجربة' : 'Start trial', to: '#', variant: 'primary' } },
          { id: 'scale', name: isArabic ? 'التوسع' : 'Scale', description: isArabic ? 'للفرق الأكبر.' : 'For larger teams.', pricingUnavailable: isArabic ? 'السعر قريبًا' : 'Pricing coming soon', unavailable: true, action: { label: isArabic ? 'قريبًا' : 'Coming soon', disabled: true } },
        ]"
        :columns="3"
        @update:interval="pricingInterval = $event"
      />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'سياق التطبيق والحالة' : 'Application context and status'" :description="isArabic ? 'مبدّل السياق والإشعارات وحالات التجربة والقراءة فقط مملوكة للنظام المشترك.' : 'Context switching, notifications, trial state, and read-only presentation are shared.'">
      <div class="grid gap-4 md:grid-cols-2">
        <BsScopeSwitcher model-value="main" :label="isArabic ? 'مساحة العمل' : 'Workspace'" :options="[{ id: 'main', label: isArabic ? 'المساحة الرئيسية' : 'Main workspace' }, { id: 'second', label: isArabic ? 'المساحة الثانية' : 'Second workspace' }]" />
        <BsNotificationMenu :items="[{ id: 'notice', title: isArabic ? 'اكتمل التقرير' : 'Report complete', body: isArabic ? 'التقرير جاهز للمراجعة.' : 'The report is ready for review.', read: false }]" :label="isArabic ? 'الإشعارات' : 'Notifications'" :empty-label="ui('empty')" :mark-all-label="isArabic ? 'تحديد الكل كمقروء' : 'Mark all read'" />
        <BsTrialCountdown to="#" :label="isArabic ? 'متبقي ٤ أيام' : '4 days remaining'" :compact-label="isArabic ? '٤ أيام' : '4 days'" />
        <BsReadOnlyBanner :title="isArabic ? 'وضع القراءة فقط' : 'Read-only mode'" :description="isArabic ? 'يمكنك عرض البيانات دون تعديلها.' : 'You can view data without changing it.'" />
      </div>
    </BsContentSection>

    <BsContentSection
      :title="isArabic ? 'المصادقة والتحقق' : 'Authentication and verification'"
      :description="isArabic ? 'هندسة مشتركة للنموذج وحالة التحقق مع محتوى يقدمه المنتج. يمكن لغلاف المنتج اختيار presentation=flat للأسطح ومقاسات العناوين القياسية، مع الإبقاء على الوضع الافتراضي.' : 'Shared form geometry and verification states with product-supplied content. Product auth frames may opt into presentation=flat for canonical surfaces and heading tokens; the default remains available.'"
    >
      <div class="grid items-start gap-5 xl:grid-cols-2">
        <BsAuthForm
          :eyebrow="isArabic ? 'منتج تجريبي' : 'Example product'" :title="isArabic ? 'تسجيل الدخول' : 'Sign in'"
          :description="isArabic ? 'مثال على غلاف المصادقة المشترك.' : 'An example of the shared authentication shell.'"
          :submit-label="isArabic ? 'متابعة' : 'Continue'" submit-disabled @submit="() => {}"
        >
          <BsFloatingField :label="isArabic ? 'البريد الإلكتروني' : 'Email'"><BsInput type="email" value="demo@example.com" readonly dir="ltr" /></BsFloatingField>
        </BsAuthForm>
        <BsVerificationForm
          v-model="catalogueOtp" :title="isArabic ? 'تحقق من بريدك' : 'Verify your email'"
          :description="isArabic ? 'أدخل الرمز المكوّن من ستة أرقام.' : 'Enter the six-digit code.'" email="demo@example.com"
          :code-label="isArabic ? 'رمز التحقق' : 'Verification code'" :expired-label="isArabic ? 'انتهت صلاحية الرمز' : 'Code expired'"
          :submit-label="isArabic ? 'تحقق' : 'Verify'" :resend-label="isArabic ? 'إعادة الإرسال' : 'Resend'" resend-disabled
          @submit="() => {}"
        />
      </div>
    </BsContentSection>

    <BsCard :title="isArabic ? 'التأكيد والخطوات' : 'Confirmation and steps'">
      <BsForm @submit="advance()">
        <BsSignupWizard
          :step="step" :steps="[{ id: 'account', title: isArabic ? 'الحساب' : 'Account' }, { id: 'workspace', title: isArabic ? 'مساحة العمل' : 'Workspace' }]"
          :submit-label="step === 2 ? (isArabic ? 'إنشاء' : 'Create') : ui('next')" :submit-disabled="step === 2" @back="back"
        ><p>Step {{ step }}</p></BsSignupWizard>
      </BsForm>
      <div class="mt-5"><BsButton variant="danger" @click="confirmExample">{{ isArabic ? 'إزالة سجل' : 'Remove record' }}</BsButton><p class="mt-3" role="status">{{ confirmationResult }}</p></div>
    </BsCard>

    <BsContentSection :title="isArabic ? 'قوالب دورة الحساب' : 'Account lifecycle templates'" :description="isArabic ? 'التطبيق يملك التفويض والبيانات؛ القالب يملك العرض فقط.' : 'The app owns authorization and data; each complete template owns presentation.'">
      <BsDescriptionList>
        <BsDescriptionItem term="BsAccountActivationPage">{{ isArabic ? 'تأكيد الباقة والتواريخ ونتيجة التدقيق مع إعادة الطلب نفسه.' : 'Plan confirmation, preserved trial dates, effective grant dates, audit result and exact-request retry.' }}</BsDescriptionItem>
        <BsDescriptionItem term="BsAccountProvisioningPage">{{ isArabic ? 'إنشاء المالك والباقة؛ تحقق البريد وإعادة الدعوة منفصلان.' : 'Controlled account form, grant status, separate verification status and acknowledged invitation resend.' }}</BsDescriptionItem>
        <BsDescriptionItem term="BsOwnerInvitationPage">{{ isArabic ? 'حالة الدعوة وكلمة مرور يختارها المالك بعد التحقق.' : 'Invitation states and owner-chosen password after target verification.' }}</BsDescriptionItem>
      </BsDescriptionList>
      <BsOwnerInvitationPage v-model:password="invitationPreviewPassword" v-model:confirmation="invitationPreviewConfirmation" :copy="invitationPreviewCopy" :view="{phase:'error',pending:false,failed:false}" />
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'حساب الضريبة' : 'Tax calculation'">
      <BsDescriptionList><BsDescriptionItem term="BsEtaSettingsPage">{{ isArabic ? 'إعداد هوية التاجر وفروع وأكواد المصلحة وحالة الإرسال، مع حفظ المسودات وحالات الخطأ والإرسال المعلّق. التطبيق يملك الصلاحيات والمحول المالي.' : 'Merchant identity, branch and item-code configuration and asynchronous submission status, using shared forms, dirty-state protection and error feedback. The product owns authorization and financial adapters.' }}</BsDescriptionItem></BsDescriptionList>
      <BsDescriptionList><BsDescriptionItem term="BsShopTaxSettingsPage / BsShopTaxRuleFields">{{ isArabic ? 'إعدادات مؤرخة وتصنيف مستقل لكل بند؛ التطبيق يملك الصلاحيات والحساب المالي. تعطيل الحساب ليس إعفاء.' : 'Versioned effective settings and per-item classification; the product owns authorization and financial arithmetic. Disabled calculation is not exemption.' }}</BsDescriptionItem></BsDescriptionList>
    </BsContentSection>
    <BsContentSection :title="isArabic ? 'عمولات اختيارية'  : 'Optional commissions'">
      <BsDescriptionList><BsDescriptionItem term="BsServiceFulfillmentPage">{{ isArabic ? 'وصفات اختيارية، وتنفيذ صريح بالكميات، وسجل FIFO وتسوية الطلبات بدون اتصال وتصحيحات مدققة.' : 'Optional recipes, explicit quantity fulfillment, FIFO history, offline reconciliation and audited corrections. Product adapters own authorization and business commands.' }}</BsDescriptionItem><BsDescriptionItem term="BsCommissionPolicyPage">{{ isArabic ? 'تفعيل النشاط والموظف، ونسب أو مبالغ ثابتة، وإسناد المسودات، وفصل التقديرات والمكتسبات والتعديلات بعد التصدير.' : 'Shop and employee opt-in, percentage or fixed unit rates, draft attribution, and separate estimates, earnings and post-export adjustments. Shop owns authorized commands and financial values.' }}</BsDescriptionItem></BsDescriptionList>
    </BsContentSection>
    <BsContentSection :title="isArabic ? 'المرتجعات المرتبطة بالفاتورة' : 'Invoice-linked returns'">
      <BsDescriptionList><BsDescriptionItem term="BsDocumentReturns / BsCommerceDocumentPage">{{ isArabic ? 'كميات وحالة مخزون، ومراجعة تخفيض الدين وتوزيع الدفعات الأصلية، وسجل مستقل لإثبات رد المبلغ. الحساب والصلاحيات من التطبيق.' : 'Quantity and disposition inputs, reviewed debt reduction and original-tender allocation, and separate refund completion evidence/history. Product adapters own financial arithmetic and authorization.' }}</BsDescriptionItem></BsDescriptionList>
    </BsContentSection>
    <WorkflowPatternCatalogue />

    <BsToastHost />
    <BsSwitch v-model="pinnedRecordActions" :label="isArabic ? 'تثبيت إجراءات نافذة السجل' : 'Pin record dialog actions'" />
    <BsSwitch v-model="recordSubmitVisible" :label="isArabic ? 'إظهار إجراء التأكيد' : 'Show confirmation action'" />
    <BsRecordActionDialog
      v-model:visible="visible" :pinned-actions="pinnedRecordActions" :submit-visible="recordSubmitVisible"
      :title="mode === 'edit' ? (isArabic ? 'تعديل السجل' : 'Edit record') : (isArabic ? 'إضافة سجل' : 'Add record')"
      :dirty="dirty" :pending="pending" :error="actionError" @submit="save"
    >
      <BsField v-slot="field" :label="isArabic ? 'الاسم' : 'Name'" for="catalogue-record-name" required><BsInput id="catalogue-record-name" v-model="name" required :aria-describedby="field.describedby" /></BsField>
    </BsRecordActionDialog>
  <BsContentSection title="Privacy consent / خيارات الخصوصية">
    <BsButton @click="privacyExampleOpen = true">Privacy settings / إعدادات الخصوصية</BsButton>
    <BsPrivacyConsent :model="privacyExample" />
  </BsContentSection>
  </div>
</template>
