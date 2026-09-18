<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const confirmation = useConfirmation()

definePageMeta({ layout: 'default', middleware: ['auth'] })

type Expense = {
  id: string
  title: string
  amount: number
  status: 'paid' | 'void' | 'unpaid'
  category_id: string | null
  expense_date: string
  notes: string | null
}
type Category = { id: string; name: string }

const supabase = useSupabaseClient()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, isOwner, loading: shopLoading } = useShop()
const isArabic = computed(() => locale.value === 'ar')
const search = ref('')
const voidingId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const requestId = ref<string | null>(null)
const actionError = ref('')
const form = reactive({ title: '', amount: 0, category: '', date: '', notes: '' })
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)

function localToday() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-')
}
form.date = localToday()

const copy = computed(() => isArabic.value ? {
  title: 'المصروفات', subtitle: 'سجّل مصروفات المتجر المدفوعة وصحّحها أو ألغها.',
  otherLater: 'الدخل الإضافي وتقارير الربح والتدفق النقدي قيد العمل.',
  add: 'تسجيل مصروف', edit: 'تعديل', void: 'إلغاء', cancel: 'تراجع', save: 'حفظ المصروف',
  saving: 'جاري الحفظ...', name: 'عنوان المصروف', amount: 'المبلغ',
  category: 'التصنيف', date: 'تاريخ المصروف', notes: 'ملاحظات', status: 'الحالة',
  paid: 'مدفوع', voided: 'ملغى', unpaid: 'غير مدفوع', search: 'ابحث في المصروفات',
  empty: 'لا توجد مصروفات بعد.', noResults: 'لا توجد نتائج مطابقة.',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم',
  readError: 'تعذّر تحميل المصروفات.', retry: 'إعادة المحاولة',
  writeError: 'تعذّر حفظ المصروف.', invalid: 'اكتب عنوانًا وتصنيفًا ومبلغًا صحيحًا وتاريخًا.',
  access: 'انتهت التجربة أو ليست لديك صلاحية التعديل.', closed: 'الفترة المحاسبية مغلقة.',
  requestConflict: 'تعارض طلب سابق. غيّر البيانات وحاول مرة أخرى.',
  voidConfirm: 'إلغاء هذا المصروف؟ سيبقى محفوظًا في السجل ولن يدخل في المجاميع.',
  recent: 'آخر 100 مصروف', categoryHint: 'مثل: إيجار، مرافق، مستلزمات',
} : {
  title: 'Expenses', subtitle: 'Record, correct and void paid shop expenses.',
  otherLater: 'Other income, profit reports and cash-flow reports are in progress.',
  add: 'Record expense', edit: 'Edit', void: 'Void', cancel: 'Cancel', save: 'Save expense',
  saving: 'Saving...', name: 'Expense title', amount: 'Amount',
  category: 'Category', date: 'Expense date', notes: 'Notes', status: 'Status',
  paid: 'Paid', voided: 'Voided', unpaid: 'Unpaid', search: 'Search expenses',
  empty: 'No expenses yet.', noResults: 'No matching expenses.',
  noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  readError: 'Could not load expenses.', retry: 'Retry',
  writeError: 'Could not save the expense.', invalid: 'Enter a title, category, valid amount and date.',
  access: 'Your trial has ended or you do not have permission to edit.', closed: 'The accounting period is closed.',
  requestConflict: 'This request conflicts with an earlier one. Change the form and retry.',
  voidConfirm: 'Void this expense? It stays in the record and is excluded from totals.',
  recent: 'Latest 100 expenses', categoryHint: 'For example: Rent, Utilities, Supplies',
})

const { data: expenseData, pending, error, refresh } = useAsyncData(
  'shop-data:expenses', async () => {
    if (!currentId.value) return { entries: [] as Expense[], categories: [] as Category[] }
    const [expenseResult, categoryResult] = await Promise.all([
      supabase.from('expenses')
        .select('id,title,amount,status,category_id,expense_date,notes')
        .eq('shop_id', currentId.value)
        .order('expense_date', { ascending: false }).limit(100),
      supabase.from('expense_categories')
        .select('id,name').eq('shop_id', currentId.value).eq('is_active', true)
        .order('name').limit(500),
    ])
    if (expenseResult.error) throw expenseResult.error
    if (categoryResult.error) throw categoryResult.error
    return {
      entries: (expenseResult.data ?? []) as Expense[],
      categories: (categoryResult.data ?? []) as Category[],
    }
  }, {
    watch: [currentId],
    default: () => ({ entries: [] as Expense[], categories: [] as Category[] }),
  },
)

const categories = computed(() => expenseData.value?.categories ?? [])
const entries = computed(() => expenseData.value?.entries ?? [])
const categoryMap = computed(() => new Map(categories.value.map(item => [item.id, item.name])))
const filteredEntries = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return entries.value
  return entries.value.filter(entry =>
    [entry.title, entry.notes, entry.category_id ? categoryMap.value.get(entry.category_id) : null]
      .some(value => value?.toLocaleLowerCase().includes(query)))
})

function money(value: number) {
  return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    style: 'currency', currency: 'EGP', maximumFractionDigits: 2,
  }).format(value)
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Africa/Cairo',
  }).format(new Date(value))
}

function statusLabel(status: Expense['status']) {
  if (status === 'paid') return copy.value.paid
  if (status === 'void') return copy.value.voided
  return copy.value.unpaid
}

function resetForm() {
  editingId.value = null
  requestId.value = null
  showForm.value = false
  actionError.value = ''
  form.title = ''
  form.amount = 0
  form.category = ''
  form.date = localToday()
  form.notes = ''
}

watch(currentId, resetForm)
watch(() => [form.title, form.amount, form.category, form.date, form.notes], () => {
  requestId.value = null
})

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(expense: Expense) {
  if (expense.status !== 'paid') return
  editingId.value = expense.id
  requestId.value = null
  form.title = expense.title
  form.amount = Number(expense.amount)
  form.category = expense.category_id ? categoryMap.value.get(expense.category_id) ?? '' : ''
  form.date = expense.expense_date.slice(0, 10)
  form.notes = expense.notes ?? ''
  actionError.value = ''
  showForm.value = true
}

function readableError(message?: string) {
  if (message === 'SHOP_SUBSCRIPTION_INACTIVE' || message === 'SHOP_PERMISSION_DENIED') return copy.value.access
  if (message === 'ACCOUNTING_PERIOD_CLOSED') return copy.value.closed
  if (message === 'EXPENSE_REQUEST_CONFLICT') return copy.value.requestConflict
  if (message === 'INVALID_EXPENSE') return copy.value.invalid
  return message || copy.value.writeError
}

async function save() {
  if (!currentId.value || !isOwner.value || saving.value) return
  actionError.value = ''
  const amount = Number(form.amount)
  if (form.title.trim().length < 2 || form.title.trim().length > 160
    || form.category.trim().length < 2 || form.category.trim().length > 80
    || form.notes.trim().length > 1000
    || !Number.isFinite(amount) || amount <= 0 || amount > 999999999.99
    || Math.round(amount * 100) / 100 !== amount
    || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
    actionError.value = copy.value.invalid
    return
  }
  if (!editingId.value) requestId.value ||= crypto.randomUUID()
  saving.value = true
  try {
    const { error: saveError } = await shopRpc.rpc('save_expense', {
      p_shop_id: currentId.value, p_expense_id: editingId.value,
      p_request_id: editingId.value ? null : requestId.value,
      p_title: form.title.trim(), p_amount: amount,
      p_category_name: form.category.trim(), p_expense_date: form.date,
      p_notes: form.notes.trim() || null,
    })
    if (saveError) throw saveError
    resetForm()
    await refresh()
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    saving.value = false
  }
}

async function voidExpense(expense: Expense) {
  if (!currentId.value || !isOwner.value || voidingId.value) return
  if (!await confirmation.ask(copy.value.voidConfirm)) return
  actionError.value = ''
  voidingId.value = expense.id
  try {
    const { error: voidError } = await shopRpc.rpc('void_expense', {
      p_shop_id: currentId.value, p_expense_id: expense.id,
    })
    if (voidError) throw voidError
    await refresh()
  } catch (error) {
    actionError.value = readableError(error instanceof Error ? error.message : undefined)
  } finally {
    voidingId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <button v-if="current && isOwner" type="button" class="ls-btn ls-btn-primary" @click="openCreate">{{ copy.add }}</button>
    </header>
    <div v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm"><p>{{ copy.noShop }}</p><NuxtLink to="/dashboard" class="mt-3 inline-block font-bold text-[var(--bs-link)] underline">{{ copy.dashboard }}</NuxtLink></div>
    <template v-else-if="current">
      <p class="rounded-xl border border-[var(--bs-status-info)]/25 bg-[var(--bs-status-info-bg)] p-4 text-sm dark:bg-[var(--bs-status-info-bg)]">{{ copy.otherLater }}</p>
      <p v-if="actionError && !showForm" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>
      <BsDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.add" :dirty="formDirty" :pending="saving"><template #default="{ close }"><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <p v-if="actionError" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)] sm:col-span-2">{{ actionError }}</p>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.name }}<input v-model="form.title" type="text" minlength="2" maxlength="160" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.amount }}<input v-model.number="form.amount" type="number" min="0.01" max="999999999.99" step="0.01" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold">{{ copy.date }}<input v-model="form.date" type="date" required class="ls-input"></label>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.category }}<input v-model="form.category" type="text" list="shop-expense-categories" minlength="2" maxlength="80" required :placeholder="copy.categoryHint" class="ls-input"><datalist id="shop-expense-categories"><option v-for="category in categories" :key="category.id" :value="category.name" /></datalist></label>
        <label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.notes }}<textarea v-model="form.notes" rows="2" maxlength="1000" class="ls-input" /></label>
        <div class="flex items-end gap-2 sm:col-span-2"><button type="submit" class="ls-btn ls-btn-primary" :disabled="saving">{{ saving ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" :disabled="saving" @click="close">{{ copy.cancel }}</button></div>
      </form></template></BsDialog>
      <section class="rounded-2xl border border-border bg-card p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 class="text-sm font-bold">{{ copy.recent }}</h2><input v-model="search" type="search" :placeholder="copy.search" class="ls-input"></div>
        <p v-if="pending" class="text-sm text-muted-foreground">{{ isArabic ? 'جاري التحميل...' : 'Loading...' }}</p>
        <div v-else-if="error" class="text-sm"><p>{{ copy.readError }}</p><button type="button" class="mt-2 font-bold underline" @click="refresh()">{{ copy.retry }}</button></div>
        <p v-else-if="!filteredEntries.length" class="py-8 text-center text-sm text-muted-foreground">{{ entries.length ? copy.noResults : copy.empty }}</p>
        <div v-else class="overflow-x-auto"><BsDataTable :value="filteredEntries" data-key="id" :row-class="() => 'border-b border-border last:border-0'">
  <Column header-class="py-3 text-start" body-class="py-3 font-semibold">
    <template #header>{{ copy.name }}</template>
    <template #body="{ data: entry }">{{ entry.title }}<p v-if="entry.notes" class="text-xs font-normal text-muted-foreground">{{ entry.notes }}</p></template>
  </Column>
  <Column header-class="py-3 text-start" body-class="py-3">
    <template #header>{{ copy.category }}</template>
    <template #body="{ data: entry }">{{ entry.category_id ? categoryMap.get(entry.category_id) ?? '—' : '—' }}</template>
  </Column>
  <Column header-class="py-3 text-start" body-class="py-3">
    <template #header>{{ copy.date }}</template>
    <template #body="{ data: entry }">{{ displayDate(entry.expense_date) }}</template>
  </Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end">
    <template #header>{{ copy.amount }}</template>
    <template #body="{ data: entry }">{{ money(Number(entry.amount)) }}</template>
  </Column>
  <Column header-class="py-3 text-end" body-class="py-3 text-end">
    <template #header>{{ copy.status }}</template>
    <template #body="{ data: entry }">{{ statusLabel(entry.status) }}</template>
  </Column>
  <Column header-class="py-3 text-end" body-class="space-x-2 py-3 text-end">
    <template #header>{{ copy.edit }}</template>
    <template #body="{ data: entry }"><template v-if="isOwner && entry.status === 'paid'"><button type="button" class="font-bold text-[var(--bs-link)]" @click="openEdit(entry)">{{ copy.edit }}</button><button type="button" class="font-bold text-[var(--bs-status-error)]" :disabled="voidingId === entry.id" @click="voidExpense(entry)">{{ copy.void }}</button></template></template>
  </Column>
</BsDataTable></div>
      </section>
    </template>
  </div>
</template>
