<script setup lang="ts">
import type { ChartAccount } from '~/utils/accountTree'

const props = defineProps<{ accounts: ChartAccount[] }>()
const emit = defineEmits<{ changed: [] }>()
const supabase = useSupabaseClient()
const { currentId, can, baseCurrency } = useTenant()
const { t } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()

interface ReconciliationRow {
  control_account_id: string
  account_code: string | null
  account_name: string
  subledger_type: 'customer' | 'supplier' | 'inventory'
  as_of_date: string
  gl_balance_minor: number
  subledger_balance_minor: number | null
  variance_minor: number | null
  status: 'provider_unavailable' | 'reconciled' | 'unreconciled' | 'explained_variance'
  provider_reference: string | null
  explanation_reason: string | null
  explanation_reference: string | null
}

const asOfDate = ref(new Date().toISOString().slice(0, 10))
const rows = ref<ReconciliationRow[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

async function load() {
  if (!currentId.value || !can('controls.reconcile')) return
  loading.value = true
  loadError.value = null
  const organizationId = currentId.value
  const { data, error } = await supabase.rpc('reconcile_control_accounts' as never, {
    p_organization_id: organizationId,
    p_as_of_date: asOfDate.value,
  } as never)
  if (currentId.value !== organizationId) return
  if (error) loadError.value = describeError(error)
  else rows.value = (data ?? []) as ReconciliationRow[]
  loading.value = false
}
const controlAccountIds = computed(() => props.accounts
  .filter(account => account.account_role === 'control')
  .map(account => account.account_id)
  .sort()
  .join(','))
watch([currentId, asOfDate, controlAccountIds], () => { void load() }, { immediate: true })

const dialogOpen = ref(false)
const selected = ref<ChartAccount | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)
const form = reactive({
  date: asOfDate.value,
  counterpartAccountId: '',
  controlSide: 'debit' as 'debit' | 'credit',
  amount: '',
  description: '',
  reason: '',
  reference: '',
  idempotencyKey: '',
})
const postingAccounts = computed(() => props.accounts.filter(account =>
  account.account_role === 'posting' && !account.is_archived,
))

function openAdjustment(accountId: string) {
  const account = props.accounts.find(item => item.account_id === accountId) ?? null
  if (!account || account.control_subledger_type === 'inventory') return
  selected.value = account
  Object.assign(form, {
    date: asOfDate.value,
    counterpartAccountId: '',
    controlSide: account.normal_balance,
    amount: '', description: '', reason: '', reference: '',
    idempotencyKey: crypto.randomUUID(),
  })
  formError.value = null
  dialogOpen.value = true
}

async function submitAdjustment() {
  if (!currentId.value || !selected.value || submitting.value) return
  formError.value = null
  let amountMinor: bigint
  try { amountMinor = parseMoneyToMinor(form.amount, baseCurrency.value) }
  catch { formError.value = t('controls.amountInvalid'); return }
  if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    formError.value = t('controls.amountInvalid')
    return
  }
  if (!form.counterpartAccountId || !form.description.trim() || !form.reason.trim() || !form.reference.trim()) {
    formError.value = t('controls.adjustmentRequired')
    return
  }
  submitting.value = true
  const opposite = form.controlSide === 'debit' ? 'credit' : 'debit'
  const { error } = await supabase.rpc('create_control_adjustment' as never, {
    p_organization_id: currentId.value,
    p_control_account_id: selected.value.account_id,
    p_transaction_date: form.date,
    p_lines: [
      { account_id: selected.value.account_id, side: form.controlSide, amount_minor: Number(amountMinor) },
      { account_id: form.counterpartAccountId, side: opposite, amount_minor: Number(amountMinor) },
    ],
    p_description: form.description.trim(),
    p_reason: form.reason.trim(),
    p_reference_kind: 'reconciliation_case',
    p_reconciliation_reference: form.reference.trim(),
    p_idempotency_key: form.idempotencyKey,
  } as never)
  if (error) formError.value = describeError(error)
  else {
    dialogOpen.value = false
    toasts.success(t('controls.adjustmentSaved'))
    emit('changed')
    await load()
  }
  submitting.value = false
}
</script>

<template>
  <section class="ls-card overflow-hidden" aria-labelledby="control-reconciliation-heading">
    <div class="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4">
      <div>
        <h2 id="control-reconciliation-heading" class="text-lg font-bold">{{ t('controls.reconciliation') }}</h2>
        <p class="mt-1 text-sm text-fg-muted">{{ t('controls.reconciliationHint') }}</p>
      </div>
      <FloatingField :label="t('controls.asOfDate')">
        <input id="control-as-of-date" v-model="asOfDate" type="date" class="ls-input">
      </FloatingField>
    </div>
    <p v-if="loading" class="p-4 text-sm text-fg-muted" role="status">{{ t('accounts.loading') }}</p>
    <p v-else-if="loadError" class="ls-error m-4" role="alert">{{ loadError }}</p>
    <BsDataTable v-else :value="rows" data-key="control_account_id" :table-props="{ 'aria-label': t('controls.reconciliation') }">
      <Column :header="t('accounts.account')"><template #body="{ data }"><span class="font-medium">{{ data.account_name }}</span><span v-if="data.account_code" class="ms-2 font-mono text-xs text-fg-muted">{{ data.account_code }}</span></template></Column>
      <Column :header="t('controls.subledgerType')"><template #body="{ data }">{{ t(`controls.subledgers.${data.subledger_type}`) }}</template></Column>
      <Column :header="t('controls.glBalance')" body-class="ls-num"><template #body="{ data }"><MoneyText :amount-minor="data.gl_balance_minor" /></template></Column>
      <Column :header="t('controls.subledgerBalance')" body-class="ls-num"><template #body="{ data }"><MoneyText v-if="data.subledger_balance_minor !== null" :amount-minor="data.subledger_balance_minor" /><span v-else>{{ t('controls.subledgerUnavailable') }}</span></template></Column>
      <Column :header="t('controls.variance')" body-class="ls-num"><template #body="{ data }"><MoneyText v-if="data.variance_minor !== null" :amount-minor="data.variance_minor" /><span v-else>{{ t('common.dash') }}</span></template></Column>
      <Column :header="t('controls.status')"><template #body="{ data }"><span class="ls-badge bg-surface-muted">{{ t(`controls.statuses.${data.status}`) }}</span><p v-if="data.explanation_reason" class="mt-1 text-xs text-fg-muted">{{ data.explanation_reason }} · {{ data.explanation_reference }}</p></template></Column>
      <Column v-if="can('controls.adjust')" :header="t('accounts.actions')"><template #body="{ data }"><NuxtLink v-if="data.subledger_type === 'inventory' && can('inventory.read')" to="/inventory-accounting" class="text-link underline">{{ t('inventory.sourceLink') }}</NuxtLink><button v-else-if="data.subledger_type !== 'inventory'" type="button" class="ls-btn ls-btn-sm" @click="openAdjustment(data.control_account_id)">{{ t('controls.adjust') }}</button></template></Column>
    </BsDataTable>
  </section>

  <BsDialog v-if="dialogOpen" :visible="true" :title="t('controls.adjust')" :show-header="false" size="md" :pending="submitting" @update:visible="value => { if (!value) dialogOpen = false }">
    <template #default="{ close }">
      <form class="space-y-4 p-6" @submit.prevent="submitAdjustment">
        <div class="flex items-center justify-between"><h2 class="text-lg font-bold">{{ t('controls.adjust') }}</h2><button type="button" class="ls-btn ls-btn-sm" :aria-label="t('common.close')" @click="close"><AppIcon name="close" /></button></div>
        <p class="text-sm text-fg-muted">{{ selected?.name }} · {{ selected?.control_subledger_type ? t(`controls.subledgers.${selected.control_subledger_type}`) : '' }}</p>
        <FloatingField :label="t('controls.asOfDate')"><input v-model="form.date" type="date" class="ls-input" required></FloatingField>
        <FloatingField :label="t('controls.counterpartAccount')"><select v-model="form.counterpartAccountId" class="ls-input" required><option value="">{{ t('controls.choosePostingAccount') }}</option><option v-for="account in postingAccounts" :key="account.account_id" :value="account.account_id">{{ account.name }}</option></select></FloatingField>
        <FloatingField :label="t('controls.controlSide')"><select v-model="form.controlSide" class="ls-input"><option value="debit">{{ t('accounts.sides.debit') }}</option><option value="credit">{{ t('accounts.sides.credit') }}</option></select></FloatingField>
        <FloatingField :label="t('transactions.amount')"><input v-model="form.amount" inputmode="decimal" class="ls-input" required></FloatingField>
        <FloatingField :label="t('transactions.description')"><input v-model="form.description" class="ls-input" required></FloatingField>
        <FloatingField :label="t('controls.adjustmentReason')"><input v-model="form.reason" class="ls-input" required></FloatingField>
        <FloatingField :label="t('controls.reconciliationReference')"><input v-model="form.reference" class="ls-input" required></FloatingField>
        <p class="text-sm text-fg-muted">{{ t('controls.adjustmentWarning') }}</p>
        <p v-if="formError" class="ls-error" role="alert">{{ formError }}</p>
        <div class="flex justify-end gap-2"><button type="button" class="ls-btn" @click="close">{{ t('common.cancel') }}</button><button class="ls-btn ls-btn-primary" :disabled="submitting">{{ submitting ? t('common.saving') : t('common.save') }}</button></div>
      </form>
    </template>
  </BsDialog>
</template>
