<script setup lang="ts">
import type { BillingInterval, LaunchPlanKey } from '~/composables/useBilling'
const props = defineProps<{ plan?: LaunchPlanKey, interval: BillingInterval }>()
const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const { can } = useTenant()
const { requests, selected, evidence, history, pending, error, load, submit, cancel, download, select } = useManualPayment()
const file = ref<File | null>(null)
const reason = ref('')
const validation = ref('')
const quoteId = crypto.randomUUID()
let evidenceId = crypto.randomUUID()
const { dirty, markSaved } = useRecordAction(() => ({ filename: file.value?.name, reason: reason.value }), computed(() => true))
const uploadAllowed = computed(() => selected.value && ['draft', 'rejected'].includes(selected.value.status))
const cancelAllowed = computed(() => selected.value && !['approved', 'cancelled'].includes(selected.value.status))
onMounted(() => { markSaved(); void load(props.plan, props.interval, quoteId) })
function chooseFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  evidenceId = crypto.randomUUID()
  validation.value = ''
}
async function send() {
  validation.value = ''
  if (!file.value || !reason.value.trim() || file.value.size < 1 || file.value.size > 5242880 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.value.type)) {
    validation.value = t('billing.manual.fileHint'); return
  }
  await submit(file.value, reason.value, evidenceId)
  if (!error.value) { file.value = null; reason.value = ''; markSaved() }
}
async function cancelRequest() {
  if (!reason.value.trim()) { validation.value = t('billing.manual.reason'); return }
  await cancel(reason.value)
  if (!error.value) { file.value = null; reason.value = ''; markSaved() }
}
function date(value: string) { return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
</script>

<template>
  <BsDialog :visible="true" :title="t('billing.manual.title')" :dirty="dirty" :pending="pending" size="lg" @update:visible="value => { if (!value) emit('close') }">
    <div class="space-y-4 p-4">
      <p v-if="!can('billing.manage')" role="alert">{{ t('billing.manual.denied') }}</p>
      <template v-else>
        <p v-if="pending" role="status">{{ t('app.loading') }}</p>
        <p v-if="error || validation" class="ls-error" role="alert">{{ error || validation }}</p>
        <button type="button" class="ls-btn" :disabled="pending || dirty" @click="load(plan, interval, quoteId)">{{ t('common.refresh') }}</button>
        <p v-if="!pending && !selected && !error">{{ t('billing.manual.empty') }}</p>
        <template v-if="selected">
          <p class="text-sm text-fg-muted">{{ t('billing.manual.pendingHint') }}</p>
          <p class="font-bold">{{ t(`billing.plans.${selected.plan_key}.name`) }} · {{ t(`billing.${selected.billing_interval}`) }} · {{ new Intl.NumberFormat(locale, { style: 'currency', currency: selected.currency_code.trim() }).format(selected.amount_minor / 100) }}</p>
          <p role="status">{{ t(`billing.manual.states.${selected.status}`) }}</p>
          <button v-if="selected.status === 'approved'" type="button" class="ls-btn ls-btn-primary" @click="reloadNuxtApp({ path: '/billing' })">{{ t('billing.manual.openSubscription') }}</button>
          <p class="whitespace-pre-wrap rounded-card bg-surface-muted p-4">{{ selected.instructions }}</p>
          <p class="break-all text-sm">{{ t('billing.manual.reference') }}: {{ selected.id }}</p>
          <p v-if="selected.period_start && selected.period_end">{{ date(selected.period_start) }} — {{ date(selected.period_end) }}</p>
          <form v-if="cancelAllowed" class="space-y-4" @submit.prevent="send">
            <label v-if="uploadAllowed" class="block space-y-2">
              <span>{{ t('billing.manual.receipt') }}</span>
              <input :key="selected.evidence_id ?? selected.id" type="file" accept="image/jpeg,image/png,application/pdf" class="ls-input" :disabled="pending" @change="chooseFile">
              <span class="block text-xs text-fg-muted">{{ t('billing.manual.fileHint') }}</span>
            </label>
            <FloatingField :label="t('billing.manual.reason')"><textarea v-model="reason" class="ls-input" maxlength="1000" required :disabled="pending" /></FloatingField>
            <div class="flex flex-wrap gap-2">
              <button v-if="uploadAllowed" type="submit" class="ls-btn ls-btn-primary" :disabled="pending || !file || !reason.trim()">{{ t('billing.manual.submit') }}</button>
              <button type="button" class="ls-btn" :disabled="pending || !reason.trim()" @click="cancelRequest">{{ t('billing.manual.cancel') }}</button>
            </div>
          </form>
          <h3 class="font-bold">{{ t('billing.manual.history') }}</h3>
          <ol class="space-y-2 text-sm">
            <li v-for="event in history" :key="event.id">{{ date(event.occurred_at) }} · {{ t(`billing.manual.states.${event.after_state}`) }} · {{ event.reason }}</li>
          </ol>
          <ul class="space-y-2">
            <li v-for="receipt in evidence" :key="receipt.id"><button type="button" class="text-link" :disabled="pending" @click="download(receipt)">{{ receipt.filename }} · {{ date(receipt.submitted_at) }}</button></li>
          </ul>
        </template>
        <ul v-if="requests.length > 1" class="space-y-2">
          <li v-for="payment in requests" :key="payment.id"><button type="button" class="text-link" :disabled="pending || dirty" @click="select(payment)">{{ date(payment.created_at) }} · {{ t(`billing.plans.${payment.plan_key}.name`) }}</button></li>
        </ul>
      </template>
    </div>
  </BsDialog>
</template>
