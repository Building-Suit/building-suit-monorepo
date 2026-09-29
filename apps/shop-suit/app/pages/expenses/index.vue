<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth'] })

type ExpenseStatus = 'paid' | 'void'
type HistoryKind = 'original' | 'correction' | 'corrected' | 'voided'
type Expense = {
  id: string
  title: string
  amount: number
  status: ExpenseStatus
  category_id: string | null
  category_name: string | null
  expense_date: string
  notes: string | null
  created_at: string
  created_by_name: string | null
  corrects_expense_id: string | null
  replaced_by_expense_id: string | null
  voided_at: string | null
  voided_by_name: string | null
  change_reason: string | null
  history_kind: HistoryKind
}
type ExpensePage = { items: Expense[]; total: number; page: number; pageSize: number; canManage: boolean }
type Category = { id: string; name: string }

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const supabase = useSupabaseClient()
const { locale } = useI18n()
const { success } = useToasts()
const { current, currentId, currentLocation, currentLocationId, loading: shopLoading } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const page = ref(1)
const pageSize = 20
const search = ref('')
const debouncedSearch = ref('')
const statusFilter = ref<'all' | ExpenseStatus>('all')
const categoryFilter = ref('')
const fromDate = ref('')
const toDate = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

const editingId = ref<string | null>(null)
const saveRequestId = ref<string | null>(null)
const actionError = ref('')
const form = reactive({ title: '', amount: 0, category: '', date: '', notes: '', correctionReason: '' })
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)

const voidTarget = ref<Expense | null>(null)
const voidReason = ref('')
const voidRequestId = ref<string | null>(null)
const voidPending = ref(false)
const voidOpen = computed({ get: () => Boolean(voidTarget.value), set: value => { if (!value) closeVoid() } })
const { dirty: voidDirty } = useRecordAction(() => voidReason.value, voidOpen)

function localToday() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}
form.date = localToday()

const copy = computed(() => isArabic.value ? {
  title: 'المصروفات', subtitle: 'سجل كامل لمصروفات التشغيل المدفوعة وتصحيحاتها وإلغائها.',
  incomeBoundary: 'الدخل التشغيلي الآخر غير مشمول في الإصدار الأول. هذه الصفحة لا تسجل إيراد المبيعات.',
  add: 'تسجيل مصروف', correct: 'تصحيح', void: 'إلغاء', cancel: 'تراجع', save: 'حفظ المصروف',
  saveCorrection: 'حفظ التصحيح', saving: 'جاري الحفظ...', name: 'عنوان المصروف', amount: 'المبلغ',
  category: 'التصنيف', allCategories: 'كل التصنيفات', date: 'تاريخ المصروف', notes: 'ملاحظات', status: 'الحالة',
  paid: 'مدفوع', voided: 'ملغى', allStatuses: 'كل الحالات', search: 'ابحث بالعنوان أو التصنيف أو الملاحظات أو السبب',
  from: 'من', to: 'إلى', empty: 'لا توجد مصروفات مطابقة.', noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.',
  noLocation: 'اختر فرعًا متاحًا لعرض المصروفات.', dashboard: 'لوحة التحكم', readError: 'تعذّر تحميل المصروفات.', retry: 'إعادة المحاولة',
  writeError: 'تعذّر حفظ المصروف.', invalid: 'راجع العنوان والتصنيف والمبلغ والتاريخ والسبب.',
  access: 'ليست لديك صلاحية إدارة المصروفات أو انتهى الاشتراك.', closed: 'فترة هذا المصروف مغلقة.',
  requestConflict: 'استُخدم رقم المحاولة ببيانات مختلفة. عدّل البيانات وحاول مجددًا.',
  correctionReason: 'سبب التصحيح', correctionHelp: 'سيبقى السجل الأصلي ملغيًا ويرتبط بهذا السجل البديل.',
  voidReason: 'سبب الإلغاء', voidTitle: 'إلغاء المصروف', voidHelp: 'سيبقى المصروف في السجل ويُستبعد من المجاميع.',
  categoryHint: 'مثل: إيجار، مرافق، مستلزمات', history: 'نوع السجل', actor: 'سجله',
  original: 'أصلي', correction: 'تصحيح بديل', corrected: 'الأصل المصحح', voidedHistory: 'ملغى',
  readOnly: 'لديك صلاحية العرض فقط.', saved: 'تم حفظ المصروف وسجل التتبع.', branch: 'الفرع',
} : {
  title: 'Expenses', subtitle: 'Complete paid operating-expense history, including corrections and voids.',
  incomeBoundary: 'Other operational income is excluded from V1. This page does not record sales revenue.',
  add: 'Record expense', correct: 'Correct', void: 'Void', cancel: 'Cancel', save: 'Save expense',
  saveCorrection: 'Save correction', saving: 'Saving...', name: 'Expense title', amount: 'Amount',
  category: 'Category', allCategories: 'All categories', date: 'Expense date', notes: 'Notes', status: 'Status',
  paid: 'Paid', voided: 'Voided', allStatuses: 'All statuses', search: 'Search title, category, notes, or reason',
  from: 'From', to: 'To', empty: 'No matching expenses.', noShop: 'Create a shop from the dashboard first.',
  noLocation: 'Select an available location to view expenses.', dashboard: 'Dashboard', readError: 'Could not load expenses.', retry: 'Retry',
  writeError: 'Could not save the expense.', invalid: 'Check the title, category, amount, date, and reason.',
  access: 'You do not have expense-management permission, or the subscription is inactive.', closed: 'This expense period is closed.',
  requestConflict: 'This retry key was already used with different data. Change the form and retry.',
  correctionReason: 'Correction reason', correctionHelp: 'The original remains as a voided record linked to this replacement.',
  voidReason: 'Void reason', voidTitle: 'Void expense', voidHelp: 'The expense remains in history and is excluded from totals.',
  categoryHint: 'For example: Rent, Utilities, Supplies', history: 'History', actor: 'Recorded by',
  original: 'Original', correction: 'Replacement correction', corrected: 'Corrected original', voidedHistory: 'Voided',
  readOnly: 'You have view-only expense access.', saved: 'Expense and trace history saved.', branch: 'Location',
})

watch(search, value => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value.trim(); page.value = 1 }, 300)
})
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })
watch([statusFilter, categoryFilter, fromDate, toDate], () => { page.value = 1 })

const { data: permissionAccess } = useAsyncData('shop-data:expense-permissions', async () => {
  if (!currentId.value) return { 'expenses.manage': false }
  const { data, error } = await rpc.rpc('shop_permission_access', {
    p_shop_id: currentId.value, p_permission_keys: ['expenses.manage'],
  })
  if (error) throw error
  return data
}, { watch: [currentId], default: () => ({ 'expenses.manage': false }) })

const { data: categories } = useAsyncData(() => `shop-data:expense-categories:${currentId.value ?? 'none'}`, async () => {
  if (!currentId.value) return []
  const { data, error } = await supabase.from('expense_categories').select('id,name')
    .eq('shop_id', currentId.value).eq('is_active', true).order('name').limit(500)
  if (error) throw error
  return (data ?? []) as Category[]
}, { watch: [currentId], default: () => [] })

const emptyPage = (): ExpensePage => ({ items: [], total: 0, page: 1, pageSize, canManage: false })
const { data: expensePage, pending, error, refresh } = useAsyncData(
  () => `shop-data:expenses:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${debouncedSearch.value}:${statusFilter.value}:${categoryFilter.value}:${fromDate.value}:${toDate.value}:${page.value}`,
  async (): Promise<ExpensePage> => {
    if (!currentId.value || !currentLocationId.value) return emptyPage()
    const { data, error: queryError } = await rpc.rpc('list_expenses', {
      p_shop_id: currentId.value, p_location_id: currentLocationId.value,
      p_search: debouncedSearch.value || null, p_status: statusFilter.value === 'all' ? null : statusFilter.value,
      p_category_id: categoryFilter.value || null, p_from: fromDate.value || null,
      p_to: toDate.value || null, p_page: page.value, p_page_size: pageSize,
    })
    if (queryError) throw queryError
    return data as ExpensePage
  }, { watch: [currentId, currentLocationId, debouncedSearch, statusFilter, categoryFilter, fromDate, toDate, page], default: emptyPage },
)
const canManage = computed(() => permissionAccess.value?.['expenses.manage'] === true && expensePage.value.canManage)

function money(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value))
}
function displayDate(value: string) {
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(value))
}
function historyLabel(kind: HistoryKind) {
  return kind === 'correction' ? copy.value.correction : kind === 'corrected' ? copy.value.corrected : kind === 'voided' ? copy.value.voidedHistory : copy.value.original
}
function readableError(message?: string) {
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED' || message === 'LOCATION_ACCESS_DENIED') return copy.value.access
  if (message === 'ACCOUNTING_PERIOD_CLOSED') return copy.value.closed
  if (message === 'EXPENSE_REQUEST_CONFLICT') return copy.value.requestConflict
  if (message === 'INVALID_EXPENSE' || message === 'INVALID_EXPENSE_VOID') return copy.value.invalid
  return copy.value.writeError
}
function resetForm() {
  editingId.value = null; saveRequestId.value = null; showForm.value = false; actionError.value = ''
  Object.assign(form, { title: '', amount: 0, category: '', date: localToday(), notes: '', correctionReason: '' })
}
function openCreate() { resetForm(); showForm.value = true }
function openCorrection(expense: Expense) {
  if (expense.status !== 'paid') return
  editingId.value = expense.id; saveRequestId.value = null; actionError.value = ''
  Object.assign(form, { title: expense.title, amount: Number(expense.amount), category: expense.category_name ?? '',
    date: expense.expense_date.slice(0, 10), notes: expense.notes ?? '', correctionReason: '' })
  showForm.value = true
}
function validForm() {
  const amount = Number(form.amount)
  return form.title.trim().length >= 2 && form.title.trim().length <= 160
    && form.category.trim().length >= 2 && form.category.trim().length <= 80
    && form.notes.trim().length <= 1000 && Number.isFinite(amount) && amount > 0 && amount <= 999999999.99
    && Math.round(amount * 100) / 100 === amount && /^\d{4}-\d{2}-\d{2}$/.test(form.date)
    && (!editingId.value || (form.correctionReason.trim().length >= 2 && form.correctionReason.trim().length <= 500))
}
watch(() => [form.title, form.amount, form.category, form.date, form.notes, form.correctionReason], () => { saveRequestId.value = null })
watch([currentId, currentLocationId], () => { page.value = 1; resetForm(); closeVoid() })

async function save() {
  if (!currentId.value || !currentLocationId.value || !canManage.value || saving.value) return
  actionError.value = ''
  if (!validForm()) { actionError.value = copy.value.invalid; return }
  saveRequestId.value ||= crypto.randomUUID()
  saving.value = true
  try {
    const { error: saveError } = await rpc.rpc('save_expense', {
      p_request_id: saveRequestId.value, p_shop_id: currentId.value, p_location_id: currentLocationId.value,
      p_expense_id: editingId.value, p_title: form.title.trim(), p_amount: Number(form.amount),
      p_category_name: form.category.trim(), p_expense_date: form.date, p_notes: form.notes.trim() || null,
      p_correction_reason: editingId.value ? form.correctionReason.trim() : null,
    })
    if (saveError) throw saveError
    resetForm(); await refresh(); success(copy.value.saved)
  } catch (saveError) {
    actionError.value = readableError(saveError instanceof Error ? saveError.message : undefined)
  } finally { saving.value = false }
}

function openVoid(expense: Expense) { voidTarget.value = expense; voidReason.value = ''; voidRequestId.value = null; actionError.value = '' }
function closeVoid(force = false) { if (voidPending.value && !force) return; voidTarget.value = null; voidReason.value = ''; voidRequestId.value = null }
watch(voidReason, () => { voidRequestId.value = null })
async function submitVoid() {
  if (!currentId.value || !currentLocationId.value || !voidTarget.value || !canManage.value || voidPending.value) return
  const reason = voidReason.value.trim()
  if (reason.length < 2 || reason.length > 500) { actionError.value = copy.value.invalid; return }
  voidRequestId.value ||= crypto.randomUUID(); voidPending.value = true; actionError.value = ''
  try {
    const { error: voidError } = await rpc.rpc('void_expense', {
      p_request_id: voidRequestId.value, p_shop_id: currentId.value, p_location_id: currentLocationId.value,
      p_expense_id: voidTarget.value.id, p_reason: reason,
    })
    if (voidError) throw voidError
    await refresh(); closeVoid(true); success(copy.value.saved)
  } catch (voidError) {
    actionError.value = readableError(voidError instanceof Error ? voidError.message : undefined)
  } finally { voidPending.value = false }
}
function handlePage(event: { page: number }) { page.value = event.page + 1 }
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <BsButton v-if="current && currentLocationId && canManage" type="button" class="ls-btn ls-btn-primary" @click="openCreate">{{ copy.add }}</BsButton>
    </header>
    <div v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm"><p>{{ copy.noShop }}</p><NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.dashboard }}</NuxtLink></div>
    <template v-else-if="current">
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ copy.incomeBoundary }}</p>
      <p v-if="!currentLocationId" role="alert" class="rounded-xl border border-[var(--bs-status-warning)]/30 bg-[var(--bs-status-warning-bg)] p-4 text-sm">{{ copy.noLocation }}</p>
      <p v-else-if="expensePage && !canManage" class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm">{{ copy.readOnly }}</p>
      <p v-if="actionError && !showForm && !voidOpen" role="alert" class="ls-error">{{ actionError }}</p>

      <BsDialog v-model:visible="showForm" :title="editingId ? copy.correct : copy.add" :dirty="formDirty" :pending="saving">
        <template #default="{ close }"><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
          <p v-if="actionError" role="alert" class="ls-error sm:col-span-2">{{ actionError }}</p>
          <p v-if="editingId" class="rounded-xl bg-muted p-3 text-sm sm:col-span-2">{{ copy.correctionHelp }}</p>
          <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.name }}<input v-model="form.title" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
          <label class="space-y-2 text-sm font-bold">{{ copy.amount }}<input v-model.number="form.amount" type="number" min="0.01" max="999999999.99" step="0.01" required class="ls-input"></label>
          <label class="space-y-2 text-sm font-bold">{{ copy.date }}<input v-model="form.date" type="date" required class="ls-input"></label>
          <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.category }}<input v-model="form.category" type="text" list="shop-expense-categories" minlength="2" maxlength="80" required :placeholder="copy.categoryHint" class="ls-input"><datalist id="shop-expense-categories"><option v-for="category in categories" :key="category.id" :value="category.name" /></datalist></label>
          <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.notes }}<textarea v-model="form.notes" rows="2" maxlength="1000" class="ls-input" /></label>
          <label v-if="editingId" class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.correctionReason }}<textarea v-model="form.correctionReason" rows="2" minlength="2" maxlength="500" required class="ls-input" /></label>
          <div class="flex items-center gap-2 sm:col-span-2"><BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="saving">{{ saving ? copy.saving : editingId ? copy.saveCorrection : copy.save }}</BsButton><BsButton type="button" class="ls-btn" :disabled="saving" @click="close">{{ copy.cancel }}</BsButton></div>
        </form></template>
      </BsDialog>

      <BsDialog v-model:visible="voidOpen" :title="copy.voidTitle" :dirty="voidDirty" :pending="voidPending" size="sm">
        <p class="mb-4 text-sm text-muted-foreground">{{ copy.voidHelp }}</p>
        <form class="space-y-4" @submit.prevent="submitVoid">
          <p v-if="actionError" role="alert" class="ls-error">{{ actionError }}</p>
          <label class="space-y-2 text-sm font-bold">{{ copy.voidReason }}<textarea v-model="voidReason" rows="3" minlength="2" maxlength="500" required class="ls-input" /></label>
          <div class="flex items-center gap-2"><BsButton type="submit" class="ls-btn ls-btn-primary" :disabled="voidPending">{{ copy.void }}</BsButton><BsButton type="button" class="ls-btn" :disabled="voidPending" @click="closeVoid">{{ copy.cancel }}</BsButton></div>
        </form>
      </BsDialog>

      <section v-if="currentLocationId" class="overflow-hidden rounded-2xl border border-border bg-card">
        <div class="grid gap-3 border-b border-border p-4 sm:grid-cols-2 xl:grid-cols-6">
          <input v-model="search" type="search" :placeholder="copy.search" :aria-label="copy.search" class="ls-input xl:col-span-2">
          <select v-model="statusFilter" :aria-label="copy.status" class="ls-select"><option value="all">{{ copy.allStatuses }}</option><option value="paid">{{ copy.paid }}</option><option value="void">{{ copy.voided }}</option></select>
          <select v-model="categoryFilter" :aria-label="copy.category" class="ls-select"><option value="">{{ copy.allCategories }}</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select>
          <label class="text-xs font-bold text-muted-foreground">{{ copy.from }}<input v-model="fromDate" type="date" class="ls-input mt-1"></label>
          <label class="text-xs font-bold text-muted-foreground">{{ copy.to }}<input v-model="toDate" type="date" class="ls-input mt-1"></label>
        </div>
        <div class="border-b border-border px-4 py-3 text-sm text-muted-foreground"><strong>{{ copy.branch }}:</strong> {{ currentLocation?.name }}</div>
        <BsDataTable :value="expensePage?.items ?? []" :loading="pending" :error="error ? copy.readError : null" :label="copy.title" data-key="id" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="expensePage?.total ?? 0" :always-show-paginator="false" :row-class="() => 'border-t border-border'" @page="handlePage" @retry="refresh()">
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ copy.name }}</template><template #body="{ data: expense }"><p class="font-semibold">{{ expense.title }}</p><p v-if="expense.notes" class="text-xs text-muted-foreground">{{ expense.notes }}</p><p v-if="expense.change_reason" class="mt-1 text-xs text-muted-foreground">{{ expense.change_reason }}</p></template></Column>
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ copy.category }}</template><template #body="{ data: expense }">{{ expense.category_name || '—' }}</template></Column>
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ copy.date }}</template><template #body="{ data: expense }">{{ displayDate(expense.expense_date) }}</template></Column>
          <Column header-class="px-4 py-3 text-start" body-class="px-4 py-3"><template #header>{{ copy.history }}</template><template #body="{ data: expense }"><span class="ls-badge bg-muted text-fg">{{ historyLabel(expense.history_kind) }}</span><p class="mt-1 text-xs text-muted-foreground">{{ expense.created_by_name || '—' }}</p></template></Column>
          <Column header-class="px-4 py-3 text-end" body-class="px-4 py-3 text-end"><template #header>{{ copy.amount }}</template><template #body="{ data: expense }">{{ money(expense.amount) }}</template></Column>
          <Column header-class="px-4 py-3 text-end" body-class="px-4 py-3 text-end"><template #header>{{ copy.status }}</template><template #body="{ data: expense }"><span class="ls-badge" :class="expense.status === 'paid' ? 'bg-[var(--bs-status-success-bg)] text-fg' : 'bg-muted text-muted-foreground'">{{ expense.status === 'paid' ? copy.paid : copy.voided }}</span><div v-if="canManage && expense.status === 'paid'" class="mt-2 flex justify-end gap-2"><BsButton type="button" class="text-sm font-bold text-[var(--bs-link)]" @click="openCorrection(expense)">{{ copy.correct }}</BsButton><BsButton type="button" class="text-sm font-bold text-[var(--bs-status-error)]" @click="openVoid(expense)">{{ copy.void }}</BsButton></div></template></Column>
          <template #empty><p class="p-8 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template>
        </BsDataTable>
      </section>
    </template>
  </div>
</template>
