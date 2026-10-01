<script setup lang="ts">
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
const page = ref(1)
const notificationChoices = ref<string[]>(['email'])
const planChoice = ref<string | string[]>('standard')
const tableState = ref<'data' | 'loading' | 'empty' | 'error'>('data')
const density = ref<'compact' | 'comfortable'>('comfortable')
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
useHead({ title: 'Shared component catalogue · Building Suit' })
</script>

<template>
  <div class="space-y-8">
    <BsPageHeader
      :title="isArabic ? 'مكتبة المكونات المشتركة' : 'Shared component catalogue'"
      :subtitle="isArabic ? 'أمثلة حية للعقود الأساسية المستخدمة في جميع تطبيقات سوت.' : 'Live examples of the canonical contracts used by every Suit.'"
      :context-label="isArabic ? 'سياق المعاينة' : 'Preview context'"
      :context="[{ label: isArabic ? 'الاتجاه' : 'Direction', value: isArabic ? 'RTL' : 'LTR' }, { label: isArabic ? 'المصدر' : 'Owner', value: 'packages/ui' }]"
    />

    <BsContentSection :title="isArabic ? 'الهوية والإجراءات' : 'Brand and actions'" :description="isArabic ? 'تستخدم الإجراءات الحالات والأحجام المشتركة.' : 'Actions use shared variants, sizes and pending guards.'">
      <div class="flex flex-wrap items-center gap-3"><BsBuildingLogo /><AppIcon v-for="icon in ['dashboard', 'ledger', 'invoice', 'team', 'wallet', 'reports']" :key="icon" :name="icon" :size="28" /></div>
      <div class="ls-card-flat mt-5 flex flex-wrap items-center gap-3 p-5">
        <BsButton variant="primary">{{ ui('save') }}</BsButton><BsButton variant="secondary">{{ isArabic ? 'مراجعة' : 'Review' }}</BsButton><BsButton>{{ ui('cancel') }}</BsButton><BsButton variant="danger">{{ isArabic ? 'حذف' : 'Delete' }}</BsButton>
      </div>
      <div class="mt-5 flex flex-wrap items-center gap-3" role="group" :aria-label="isArabic ? 'إجراءات دلالية' : 'Semantic actions'">
        <BsButton variant="link">{{ isArabic ? 'إجراء رابط' : 'Link action' }}</BsButton>
        <BsButton variant="icon" :aria-label="ui('close')"><AppIcon name="close" /></BsButton>
        <BsButton variant="tab" role="tab" aria-selected="true">{{ isArabic ? 'تبويب' : 'Tab' }}</BsButton>
        <BsButton variant="chip" aria-pressed="true">{{ isArabic ? 'خيار' : 'Chip' }}</BsButton>
        <BsButton variant="tile" class="max-w-48">{{ isArabic ? 'بطاقة تفاعلية' : 'Interactive tile' }}</BsButton>
      </div>
    </BsContentSection>

    <BsContentSection :title="isArabic ? 'التنقل والأدوات' : 'Navigation and tools'" :description="isArabic ? 'تبويبات وشريط أدوات وقائمة مشتركة.' : 'Shared tabs, toolbar and menu geometry.'">
      <BsTabs v-model="tab" :label="isArabic ? 'أقسام المثال' : 'Example sections'" :tabs="[{ value: 'overview', label: isArabic ? 'نظرة عامة' : 'Overview' }, { value: 'activity', label: isArabic ? 'النشاط' : 'Activity' }]" />
      <BsToolbar class="mt-4" :label="isArabic ? 'أدوات الصفحة' : 'Page tools'">
        <BsInput :model-value="''" type="search" :placeholder="isArabic ? 'بحث' : 'Search'" :aria-label="isArabic ? 'بحث' : 'Search'" />
        <template #actions><BsButton variant="primary">{{ isArabic ? 'إضافة' : 'Add' }}</BsButton><BsMenu :label="isArabic ? 'المزيد' : 'More'"><BsButton variant="text" role="menuitem">{{ isArabic ? 'تصدير' : 'Export' }}</BsButton></BsMenu></template>
      </BsToolbar>
    </BsContentSection>

    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Status and KPI examples">
      <BsKpiCard :title="isArabic ? 'السجلات' : 'Records'" change-label="+12%" tone="success">{{ rows.length }}</BsKpiCard>
      <BsKpiCard :title="isArabic ? 'قيد المراجعة' : 'In review'" :hint="isArabic ? 'بيانات تجريبية' : 'Example data'">1</BsKpiCard>
      <BsCard :title="isArabic ? 'الحالات' : 'Statuses'" padding="lg"><div class="flex flex-wrap gap-2"><StatusBadge status="active" /><StatusBadge status="pending" /><StatusBadge status="failed" /></div></BsCard>
      <BsCard :title="isArabic ? 'سطح متداخل' : 'Nested surface'" variant="flat" padding="lg"><p class="text-sm text-fg-muted">{{ isArabic ? 'بدون ظل إضافي.' : 'No competing elevation.' }}</p></BsCard>
    </section>

    <section class="ls-card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 class="text-xl font-bold">{{ isArabic ? 'جدول البيانات' : 'Data table' }}</h2>
        <div class="flex flex-wrap gap-2">
          <BsButton v-for="state in (['data', 'loading', 'empty', 'error'] as const)" :key="state" size="sm" :variant="tableState === state ? 'primary' : 'default'" @click="tableState = state">{{ state }}</BsButton>
          <BsButton variant="primary" data-testid="catalogue-add" @click="add">{{ isArabic ? 'إضافة سجل' : 'Add record' }}</BsButton>
        </div>
      </div>
      <div class="px-5 pb-3"><BsTableDensity v-model="density" :label="isArabic ? 'كثافة الجدول' : 'Table density'" :compact-label="isArabic ? 'مضغوط' : 'Compact'" :comfortable-label="isArabic ? 'مريح' : 'Comfortable'" /></div>
      <BsDataTable
        v-model:selection="selected" v-model:filters="filters" :value="tableState === 'empty' ? [] : rows" data-key="id"
        :search-fields="['name', 'category']" searchable exportable paginator :rows="2" :rows-per-page-options="[2, 5, 10]"
        sort-mode="multiple" removable-sort resizable-columns reorderable-columns striped-rows selection-mode="multiple"
        :meta-key-selection="false" :density="density" :loading="tableState === 'loading'"
        :error="tableState === 'error' ? (isArabic ? 'تعذر تحميل المثال.' : 'The example could not be loaded.') : null"
        :label="isArabic ? 'أمثلة المكونات' : 'Component examples'" @retry="tableState = 'data'"
      >
        <Column selection-mode="multiple" header-style="width: 3rem" />
        <Column field="name" :header="isArabic ? 'الاسم' : 'Name'" sortable />
        <Column field="category" :header="isArabic ? 'التصنيف' : 'Category'" sortable />
        <Column field="status" :header="isArabic ? 'الحالة' : 'Status'"><template #body="{ data: row }"><StatusBadge :status="row.status" /></template></Column>
        <Column field="amount" :header="isArabic ? 'القيمة' : 'Value'" sortable body-class="ls-num" />
        <Column :header="isArabic ? 'الإجراءات' : 'Actions'"><template #body="{ data: row }"><BsButton size="sm" @click="edit(row)">{{ isArabic ? 'تعديل' : 'Edit' }}</BsButton></template></Column>
      </BsDataTable>
    </section>

    <BsCard :title="isArabic ? 'النماذج والاختيار' : 'Forms and selection'" data-testid="foundation-patterns">
      <div class="space-y-4">
        <BsSelect v-model="choice" :label="isArabic ? 'الصنف' : 'Item'" :options="choices" option-label="name" option-value="id" filter virtual />
        <BsForm :pending="formPending" :error="formError" class="space-y-4" @submit="verifyForm">
          <BsField v-slot="field" :label="isArabic ? 'القيمة' : 'Value'" for="catalogue-value" :hint="isArabic ? 'حقل نصي مشترك' : 'Shared text field'" required><BsInput id="catalogue-value" v-model="formValue" required :aria-describedby="field.describedby" :invalid="field.invalid" /></BsField>
          <BsField v-slot="field" :label="isArabic ? 'ملاحظات' : 'Notes'" for="catalogue-notes"><BsTextarea id="catalogue-notes" v-model="notes" :aria-describedby="field.describedby" /></BsField>
          <BsChoiceGroup v-model="notificationChoices" :legend="isArabic ? 'الإشعارات' : 'Notifications'" :options="[{ value: 'email', label: isArabic ? 'البريد' : 'Email' }, { value: 'app', label: isArabic ? 'داخل التطبيق' : 'In app' }]" inline />
          <BsChoiceGroup v-model="planChoice" type="radio" :legend="isArabic ? 'الخطة' : 'Plan'" :options="[{ value: 'standard', label: isArabic ? 'قياسية' : 'Standard' }, { value: 'advanced', label: isArabic ? 'متقدمة' : 'Advanced' }]" inline />
          <BsButton type="submit" variant="primary">{{ ui('save') }}</BsButton>
        </BsForm>
        <div class="flex flex-wrap gap-2"><BsButton variant="chip" :aria-pressed="formPending" @click="formPending = !formPending">{{ ui('loading') }}</BsButton><BsButton @click="toastSuccess(isArabic ? 'تم الحفظ' : 'Saved')">{{ isArabic ? 'إظهار إشعار' : 'Show notification' }}</BsButton></div>
      </div>
    </BsCard>

    <BsContentSection :title="isArabic ? 'حالات المحتوى' : 'Content states'" variant="flat">
      <div class="grid gap-3 md:grid-cols-2"><BsStateSurface state="loading" :title="ui('loading')" /><BsStateSurface state="error" :title="isArabic ? 'تعذر التحميل' : 'Could not load'" :description="isArabic ? 'حاول مرة أخرى.' : 'Try again.'" :action-label="isArabic ? 'إعادة المحاولة' : 'Retry'" /></div>
      <BsPagination v-model:page="page" class="mt-4" :page-size="10" :total="42" :label="isArabic ? 'الصفحات' : 'Pages'" :previous-label="isArabic ? 'السابق' : 'Previous'" :next-label="isArabic ? 'التالي' : 'Next'" />
    </BsContentSection>

    <BsCard :title="isArabic ? 'التأكيد والخطوات' : 'Confirmation and steps'">
      <BsSignupWizard :step="step" :steps="[{ title: 'Account' }, { title: 'Workspace' }]" @back="back"><p>Step {{ step }}</p><BsButton :disabled="step === 2" @click="advance()">{{ ui('next') }}</BsButton></BsSignupWizard>
      <div class="mt-5"><BsButton variant="danger" @click="confirmExample">{{ isArabic ? 'إزالة سجل' : 'Remove record' }}</BsButton><p class="mt-3" role="status">{{ confirmationResult }}</p></div>
    </BsCard>

    <ToastHost />
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="mode === 'edit' ? (isArabic ? 'تعديل السجل' : 'Edit record') : (isArabic ? 'إضافة سجل' : 'Add record')"
      :dirty="dirty" :pending="pending" :error="actionError" @submit="save"
    >
      <FloatingField :label="isArabic ? 'الاسم' : 'Name'"><InputText id="catalogue-record-name" v-model="name" class="ls-input" required /></FloatingField>
    </BsRecordActionDialog>
  </div>
</template>
