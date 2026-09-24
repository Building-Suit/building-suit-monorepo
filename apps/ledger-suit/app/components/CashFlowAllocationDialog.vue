<script setup lang="ts">
import type { Database } from '~~/types/database.types'
const props = defineProps<{ entryId: string, accountName: string }>()
const emit = defineEmits<{ close: [], saved: [] }>()
const supabase = useSupabaseClient<Database>()
const { currentId, baseCurrency, can } = useTenant()
const { t } = useI18n()
const describeError = useErrorMessage()
const loading = ref(true)
const pending = ref(false)
const error = ref('')
const reason = ref('')
const amounts = reactive({ operating: '', investing: '', financing: '' })
const context = ref<{ amount_minor: number, decision_id: string | null, allocations: Record<string, number> }>()
let requestId: string | undefined
const total = computed(() => {
  try { return (['operating', 'investing', 'financing'] as const)
    .reduce((sum, key) => sum + (amounts[key] ? parseMoneyToMinor(amounts[key], baseCurrency.value) : 0n), 0n) }
  catch { return -1n }
})
const valid = computed(() => context.value && total.value === BigInt(context.value.amount_minor) && reason.value.trim().length > 0)
watch([reason, () => amounts.operating, () => amounts.investing, () => amounts.financing], () => { requestId = undefined })
onMounted(async () => {
  if (!currentId.value) return
  const { data, error: failure } = await supabase.rpc('cash_flow_allocation_context', {
    p_organization_id: currentId.value, p_entry_id: props.entryId,
  })
  if (failure) error.value = describeError(failure)
  else context.value = data as unknown as typeof context.value
  loading.value = false
})
async function save() {
  if (!valid.value || !currentId.value || !can('accounts.update') || pending.value) return
  pending.value = true
  error.value = ''
  requestId ??= crypto.randomUUID()
  try {
    const allocations: Record<string, number> = {}
    for (const key of ['operating', 'investing', 'financing'] as const) {
      const value = amounts[key] ? parseMoneyToMinor(amounts[key], baseCurrency.value) : 0n
      if (value > 0n) allocations[key] = Number(value)
    }
    const result = await supabase.rpc('classify_cash_flow_entry', {
      p_organization_id: currentId.value, p_entry_id: props.entryId,
      p_allocations: allocations, p_reason: reason.value.trim(), p_request_id: requestId,
      p_expected_decision_id: context.value?.decision_id ?? undefined,
    })
    if (result.error) throw result.error
    emit('saved')
    emit('close')
  }
  catch (failure) { error.value = describeError(failure) }
  finally { pending.value = false }
}
</script>

<template>
  <BsDialog :visible="true" :title="t('financialMapping.allocate')" size="md" :pending="pending" @update:visible="value => { if (!value) emit('close') }">
    <div class="space-y-4 p-4">
      <p>{{ accountName }}</p>
      <SectionSkeleton v-if="loading" variant="table" :rows="3" />
      <template v-else-if="context">
        <p>{{ t('financialMapping.sourceAmount') }}: <MoneyText :amount-minor="context.amount_minor" /></p>
        <div v-if="context.decision_id" class="text-sm text-fg-muted"><p>{{ t('financialMapping.previousAllocation') }}</p><p v-for="(value, section) in context.allocations" :key="section">{{ t(`financialMapping.lines.${section}`) }}: <MoneyText :amount-minor="value" /></p></div>
        <form class="space-y-3" @submit.prevent="save">
          <FloatingField v-for="key in (['operating', 'investing', 'financing'] as const)" :key="key" :label="t(`financialMapping.lines.${key}`)">
            <input v-model="amounts[key]" type="text" inputmode="decimal" class="ls-input" :disabled="pending">
          </FloatingField>
          <FloatingField :label="t('statementClassification.reason')"><textarea v-model="reason" class="ls-input" required maxlength="1000" :disabled="pending" /></FloatingField>
          <p v-if="total !== BigInt(context.amount_minor)" role="alert" class="ls-error">{{ t('financialMapping.allocationMismatch') }}</p>
          <button type="submit" class="ls-btn ls-btn-primary" :disabled="!valid || pending">{{ t('common.saving') }}</button>
        </form>
      </template>
      <p v-if="error" role="alert" class="ls-error">{{ error }}</p>
    </div>
  </BsDialog>
</template>
