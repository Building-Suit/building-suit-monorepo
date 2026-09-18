<script setup lang="ts">
const { locale } = useI18n()
const ui = useUiCopy()
const rows = ref([{ id: '1', name: 'Ledger Suit', category: 'Finance', amount: 120 }, { id: '2', name: 'Shop Suit', category: 'Commerce', amount: 240 }, { id: '3', name: 'Building Suit', category: 'Platform', amount: 360 }])
const selected = ref([])
const filters = ref({ global: { value: null, matchMode: 'contains' } })
const name = ref('')
const action = useRecordAction(() => ({ name: name.value }))
const { visible, dirty, pending } = action
const { step, advance, back } = useSignupWizard(2)
const confirmation = useConfirmation()
const confirmationResult = ref('')
async function confirmExample() { confirmationResult.value = await confirmation.ask(locale.value === 'ar' ? 'تأكيد هذا الإجراء التجريبي؟' : 'Confirm this example action?') ? 'Confirmed' : 'Cancelled' }
function add() { name.value = ''; action.open() }
function save() { rows.value.push({ id: String(rows.value.length + 1), name: name.value, category: 'Example', amount: 0 }); action.complete() }
useHead({ title: 'Shared component catalogue · Building Suit' })
</script>
<template>
  <div class="space-y-8">
    <header><h1 class="text-3xl font-black">{{ locale === 'ar' ? 'مكتبة المكونات المشتركة' : 'Shared component catalogue' }}</h1><p class="mt-3 text-fg-muted">{{ locale === 'ar' ? 'أمثلة حية من نفس المكونات المستخدمة في التطبيقات.' : 'Live examples of the components used by both applications.' }}</p></header>
    <section class="ls-card p-6"><h2 class="text-xl font-bold">{{ locale === 'ar' ? 'الهوية والأيقونات' : 'Brand and icons' }}</h2><div class="mt-5 flex flex-wrap items-center gap-6"><BsBuildingLogo /><AppIcon v-for="icon in ['dashboard', 'ledger', 'invoice', 'team', 'wallet', 'reports']" :key="icon" :name="icon" :size="28" /></div></section>
    <section class="ls-card overflow-hidden"><div class="flex flex-wrap items-center justify-between gap-3 p-5"><h2 class="text-xl font-bold">{{ locale === 'ar' ? 'جدول البيانات' : 'Data table' }}</h2><button type="button" class="ls-btn ls-btn-primary" data-testid="catalogue-add" @click="add">{{ locale === 'ar' ? 'إضافة سجل' : 'Add record' }}</button></div>
      <BsDataTable v-model:selection="selected" v-model:filters="filters" :value="rows" data-key="id" :search-fields="['name', 'category']" searchable exportable paginator :rows="2" :rows-per-page-options="[2, 5, 10]" sort-mode="multiple" removable-sort resizable-columns reorderable-columns striped-rows selection-mode="multiple" :meta-key-selection="false" label="Component examples">
        <Column selection-mode="multiple" header-style="width: 3rem" />
        <Column field="name" :header="locale === 'ar' ? 'الاسم' : 'Name'" sortable />
        <Column field="category" :header="locale === 'ar' ? 'التصنيف' : 'Category'" sortable />
        <Column field="amount" :header="locale === 'ar' ? 'القيمة' : 'Value'" sortable body-class="ls-num" />
      </BsDataTable>
    </section>
    <section class="ls-card p-6"><h2 class="mb-5 text-xl font-bold">{{ locale === 'ar' ? 'خطوات التسجيل' : 'Signup wizard' }}</h2><BsSignupWizard :step="step" :steps="[{ title: 'Account' }, { title: 'Workspace' }]" @back="back"><p>Step {{ step }}</p><button type="button" class="ls-btn" :disabled="step === 2" @click="advance()">{{ ui('next') }}</button></BsSignupWizard></section>
    <section class="ls-card p-6"><button type="button" class="ls-btn" @click="confirmExample">{{ ui('confirm') }}</button><p class="mt-3" role="status">{{ confirmationResult }}</p></section>
    <BsDialog v-model:visible="visible" :title="locale === 'ar' ? 'إضافة سجل' : 'Add record'" :dirty="dirty" :pending="pending"><form class="space-y-5" @submit.prevent="save"><FloatingField :label="locale === 'ar' ? 'الاسم' : 'Name'"><InputText id="catalogue-record-name" v-model="name" class="ls-input" required /></FloatingField><button class="ls-btn ls-btn-primary">{{ ui('save') }}</button></form></BsDialog>
  </div>
</template>
