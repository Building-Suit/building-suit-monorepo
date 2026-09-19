<script setup lang="ts">
import type { Database } from '~~/types/database.types'

const props = defineProps<{
  account: { account_id: string, name: string, type: string, is_archived: boolean }
  scope: string
}>()
const emit = defineEmits<{ close: [], saved: [] }>()
const supabase = useSupabaseClient<Database>()
const { currentId, can } = useTenant()
const { t, locale } = useI18n()
const describeError = useErrorMessage()
const toasts = useToasts()
interface HistoryRow { id: string, revision: string, effective_from: string, statement_line: string, reason: string, created_at: string }
interface Context { today: string, min_effective_date: string, history: HistoryRow[] }
const context = ref<Context | null>(null)
const loading = ref(true)
const pending = ref(false)
const error = ref('')
const form = reactive({ statementLine: '', effectiveFrom: '', reason: '' })
const requestId = ref<string>()
const options = computed(() => statementLinesFor(props.account.type))
const canSchedule = computed(() => can('accounts.update') && !props.account.is_archived)
const { dirty } = useRecordAction(() => form, computed(() => !loading.value))
let disposed = false
let loadController: AbortController | undefined
const initialScope = props.scope
const initialOrganization = currentId.value
const isCurrent = () => !disposed && props.scope === initialScope && currentId.value === initialOrganization
watch(() => [form.statementLine, form.effectiveFrom, form.reason], () => { requestId.value = undefined })
onBeforeUnmount(() => { disposed = true; loadController?.abort() })

async function load() {
  if (!initialOrganization) return
  loadController?.abort()
  loadController = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const { data, error: failure } = await supabase.rpc('account_statement_classification_context', {
      p_organization_id: initialOrganization, p_account_id: props.account.account_id,
    }).abortSignal(loadController.signal)
    if (!isCurrent()) return
    if (failure) throw failure
    context.value = data as unknown as Context
    if (!form.effectiveFrom) form.effectiveFrom = context.value.min_effective_date
    requestId.value = undefined
  }
  catch (failure) { if (isCurrent()) error.value = describeError(failure) }
  finally { if (isCurrent()) loading.value = false }
}
onMounted(load)

async function save() {
  if (!isCurrent() || !initialOrganization || !context.value || pending.value || !canSchedule.value) return
  pending.value = true
  error.value = ''
  requestId.value ??= crypto.randomUUID()
  try {
    const { error: failure } = await supabase.rpc('schedule_account_statement_classification', {
      p_organization_id: initialOrganization, p_account_id: props.account.account_id,
      p_statement_line: form.statementLine, p_effective_from: form.effectiveFrom,
      p_reason: form.reason, p_request_id: requestId.value,
      p_expected_revision_id: context.value.history[0]?.id,
    })
    if (!isCurrent()) return
    if (failure) throw failure
    toasts.success(t('statementClassification.saved'))
    emit('saved')
    emit('close')
  }
  catch (failure) { if (isCurrent()) error.value = describeError(failure) }
  finally { if (isCurrent()) pending.value = false }
}
</script>

<template>
  <BsDialog :visible="true" :title="t('statementClassification.title')" size="lg" :dirty="dirty" :pending="pending" @update:visible="value => { if (!value) emit('close') }">
    <div class="space-y-4 p-4">
      <p class="font-semibold">{{ account.name }}</p>
      <p class="text-sm text-fg-muted">{{ t('statementClassification.hint') }}</p>
      <p v-if="error" role="alert" class="ls-error">{{ error }}</p>
      <SectionSkeleton v-if="loading" variant="table" :rows="3" />
      <template v-else>
        <button v-if="error" type="button" class="ls-btn" :disabled="pending" @click="load">{{ t('statementClassification.reload') }}</button>
        <template v-if="context">
          <p v-if="!canSchedule" class="text-sm text-fg-muted">{{ t('statementClassification.readOnly') }}</p>
          <form v-else class="space-y-4" @submit.prevent="save">
            <FloatingField :label="t('statementClassification.line')">
              <select id="statement-line" v-model="form.statementLine" class="ls-input" required :disabled="pending">
                <option value="" disabled>{{ t('statementClassification.choose') }}</option>
                <option v-for="line in options" :key="line" :value="line">{{ t(`statementClassification.lines.${line}`) }}</option>
              </select>
            </FloatingField>
            <FloatingField :label="t('statementClassification.effectiveFrom')">
              <input id="statement-effective" v-model="form.effectiveFrom" type="date" class="ls-input" required :min="context.min_effective_date" :disabled="pending">
            </FloatingField>
            <p class="text-sm text-fg-muted">{{ t('statementClassification.minimum', { date: formatDate(context.min_effective_date, locale) }) }}</p>
            <FloatingField :label="t('statementClassification.reason')">
              <textarea id="statement-reason" v-model="form.reason" class="ls-input" rows="3" required maxlength="1000" :disabled="pending" aria-describedby="statement-reason-hint" />
            </FloatingField>
            <p id="statement-reason-hint" class="text-sm text-fg-muted">{{ t('statementClassification.reasonHint') }}</p>
            <div class="flex justify-end"><button type="submit" class="ls-btn ls-btn-primary" :disabled="pending || !form.reason.trim()">{{ pending ? t('common.saving') : t('statementClassification.schedule') }}</button></div>
          </form>
          <h3 class="font-semibold">{{ t('statementClassification.history') }}</h3>
          <p v-if="!context.history.length" class="text-sm text-fg-muted">{{ t('statementClassification.noHistory') }}</p>
          <BsDataTable v-else :label="t('statementClassification.history')" :value="context.history" data-key="id" :paginator="context.history.length > 10" :rows="10" class="overflow-x-auto">
            <Column field="effective_from" :header="t('statementClassification.effectiveFrom')"><template #body="{ data: row }">{{ formatDate(row.effective_from, locale) }}</template></Column>
            <Column field="statement_line" :header="t('statementClassification.line')"><template #body="{ data: row }">{{ t(`statementClassification.lines.${row.statement_line}`) }}</template></Column>
            <Column field="reason" :header="t('statementClassification.reason')" body-class="min-w-48 whitespace-normal break-words" />
          </BsDataTable>
          <p v-if="context.history.length" class="text-sm text-fg-muted">{{ t('statementClassification.historyHint') }}</p>
        </template>
      </template>
    </div>
  </BsDialog>
</template>
