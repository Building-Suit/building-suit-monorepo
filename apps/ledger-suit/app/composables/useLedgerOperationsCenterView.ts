import type { Database } from '~~/types/database.types'
import type { QuotaKey } from '~/composables/usePlanUsage'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerOperationsCenterView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const supabase = useSupabaseClient<Database>()
const { currentId, baseCurrency, can } = useTenant()
const { open, tab, close, markChanged } = useOperationsCenter()
const { data: accounts } = useOrgAccounts()
const { data: categories } = useOrgCategories()
const { data: counterparties } = useOrgCounterparties()
const toasts = useToasts()
const describeError = useErrorMessage()
const { t } = useI18n()
const { refresh: refreshPlanUsage } = usePlanUsage()

const paymentAccounts = usePaymentAccounts(accounts)
const liabilityAccounts = computed(() => accounts.value.filter(account => account.type === 'liability' && !account.is_archived))
const incomeCategories = computed(() => categories.value.filter(c => c.kind === 'income'))
const expenseCategories = computed(() => categories.value.filter(c => c.kind === 'expense'))
const busy = ref(false)
const errorMessage = ref<string | null>(null)
const today = () => new Date().toISOString().slice(0, 10)

const commitmentForm = reactive({ type: 'payable', title: '', description: '', amount: '', dueDate: today(), categoryId: '', counterpartyId: '', autoConvert: false, paymentAccountId: '', reminderDays: 3 })
const recurringForm = reactive({ name: '', transactionType: 'expense', amount: '', principal: '', interest: '', fees: '', liabilityAccountId: '', categoryId: '', paymentAccountId: '', frequency: 'monthly', intervalCount: 1, startDate: today(), endDate: '', maxOccurrences: '', mode: 'requires_confirmation' })
const counterpartyForm = reactive({ name: '', type: 'other', email: '', phone: '', taxIdentifier: '', notes: '' })
const tagForm = reactive({ name: '', color: '#2F77C9' })

const title = computed(() => t(tab.value === 'commitments' ? 'operations.addCommitment' : tab.value === 'recurring' ? 'operations.addRule' : tab.value === 'counterparties' ? 'recordPages.addCounterparty' : 'recordPages.addTag'))
const quotaKey = computed<QuotaKey | null>(() => tab.value === 'recurring' ? 'max_recurring_rules' : tab.value === 'counterparties' ? 'max_counterparties' : null)

watch(open, (isOpen) => {
  if (isOpen) errorMessage.value = null
})

async function run(kind: OperationsTab, action: () => Promise<void>) {
  busy.value = true
  errorMessage.value = null
  try {
    await action()
    if (quotaKey.value) await refreshPlanUsage()
    markChanged(kind)
    if (kind === 'counterparties') clearNuxtData('org:counterparties')
    if (kind === 'tags') clearNuxtData('org:tags')
    toasts.success(t('operations.saved'))
    close()
  }
  catch (error) { errorMessage.value = describeError(error) }
  finally { busy.value = false }
}

async function createCommitment() {
  const organizationId = currentId.value
  if (!organizationId) return
  await run('commitments', async () => {
    const amount = Number(parseMoneyToMinor(commitmentForm.amount, baseCurrency.value))
    const { data: id, error } = await supabase.rpc('create_commitment', {
      p_organization_id: organizationId,
      p_type: commitmentForm.type as Database['public']['Enums']['commitment_type'],
      p_title: commitmentForm.title,
      p_amount_minor: amount,
      p_due_date: commitmentForm.dueDate,
      p_linked_category_id: commitmentForm.categoryId || undefined,
      p_counterparty_id: commitmentForm.counterpartyId || undefined,
      p_description: commitmentForm.description || undefined,
      p_auto_convert: false,
      p_reminder_days_before: commitmentForm.reminderDays,
    })
    if (error) throw error
    if (commitmentForm.autoConvert) {
      const { error: updateError } = await supabase.rpc('update_commitment' as never, {
        p_commitment_id: id!, p_title: commitmentForm.title, p_amount_minor: amount,
        p_linked_category_id: commitmentForm.categoryId || undefined,
        p_auto_convert: true, p_auto_payment_account_id: commitmentForm.paymentAccountId,
      } as never)
      if (updateError) throw updateError
    }
    Object.assign(commitmentForm, { title: '', description: '', amount: '', dueDate: today(), categoryId: '', counterpartyId: '', autoConvert: false, paymentAccountId: '', reminderDays: 3 })
  })
}

async function createRecurring() {
  const organizationId = currentId.value
  if (!organizationId) return
  await run('recurring', async () => {
    const template: Record<string, unknown> = recurringForm.transactionType === 'liability_payment'
      ? { liability_account_id: recurringForm.liabilityAccountId, payment_account_id: recurringForm.paymentAccountId, principal_minor: Number(parseMoneyToMinor(recurringForm.principal || '0', baseCurrency.value)), interest_minor: Number(parseMoneyToMinor(recurringForm.interest || '0', baseCurrency.value)), fees_minor: Number(parseMoneyToMinor(recurringForm.fees || '0', baseCurrency.value)), description: recurringForm.name }
      : { amount_minor: Number(parseMoneyToMinor(recurringForm.amount, baseCurrency.value)), category_id: recurringForm.categoryId || undefined, description: recurringForm.name, [recurringForm.transactionType === 'expense' ? 'source_account_id' : 'destination_account_id']: recurringForm.paymentAccountId }
    const { error } = await supabase.rpc('create_recurring_rule', {
      p_organization_id: organizationId,
      p_name: recurringForm.name,
      p_transaction_type: recurringForm.transactionType as Database['public']['Enums']['transaction_type'],
      p_template: template as Database['public']['Functions']['create_recurring_rule']['Args']['p_template'],
      p_frequency: recurringForm.frequency as Database['public']['Enums']['recurrence_frequency'],
      p_start_date: recurringForm.startDate,
      p_interval_count: recurringForm.intervalCount,
      p_end_date: recurringForm.endDate || undefined,
      p_max_occurrences: recurringForm.maxOccurrences ? Number(recurringForm.maxOccurrences) : undefined,
      p_mode: recurringForm.mode as Database['public']['Enums']['recurring_mode'],
    })
    if (error) throw error
    Object.assign(recurringForm, { name: '', amount: '', principal: '', interest: '', fees: '', liabilityAccountId: '', categoryId: '', paymentAccountId: '', intervalCount: 1, startDate: today(), endDate: '', maxOccurrences: '' })
  })
}

async function createCounterparty() {
  const organizationId = currentId.value
  if (!organizationId) return
  await run('counterparties', async () => {
    const { error } = await supabase.rpc('create_counterparty', {
      p_organization_id: organizationId,
      p_name: counterpartyForm.name,
      p_type: counterpartyForm.type as Database['public']['Enums']['counterparty_type'],
      p_email: counterpartyForm.email || undefined,
      p_phone: counterpartyForm.phone || undefined,
      p_tax_identifier: counterpartyForm.taxIdentifier || undefined,
      p_notes: counterpartyForm.notes || undefined,
    })
    if (error) throw error
    Object.assign(counterpartyForm, { name: '', email: '', phone: '', taxIdentifier: '', notes: '' })
  })
}

async function createTag() {
  const organizationId = currentId.value
  if (!organizationId) return
  await run('tags', async () => {
    const { error } = await supabase.from('tags').insert({ organization_id: organizationId, name: tagForm.name, color: tagForm.color, created_by: (await supabase.auth.getUser()).data.user?.id ?? null })
    if (error) throw error
    tagForm.name = ''
  })
}
function submitCurrent() {
  if (tab.value === 'commitments') return createCommitment()
  if (tab.value === 'recurring') return createRecurring()
  if (tab.value === 'counterparties') return createCounterparty()
  return createTag()
}
const submitLabel = computed(() => tab.value === 'commitments'
  ? t('operations.addCommitment')
  : tab.value === 'recurring' ? t('operations.addRule') : t('common.save'))
const { dirty: overlayDirty0 } = useRecordAction(() => ({ commitmentForm, recurringForm, counterpartyForm, tagForm }), computed(() => Boolean(open.value)))
const ledgerUsage = useLedgerUsagePresentation()
return { supabase, currentId, baseCurrency, can, open, tab, close, markChanged, accounts, categories, counterparties, toasts, describeError, t, refreshPlanUsage, paymentAccounts, liabilityAccounts, incomeCategories, expenseCategories, busy, errorMessage, today, commitmentForm, recurringForm, counterpartyForm, tagForm, title, quotaKey, run, createCommitment, createRecurring, createCounterparty, createTag, submitCurrent, submitLabel, overlayDirty0, ledgerUsage }
}
