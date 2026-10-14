<script setup lang="ts">
import type { BsBankReconciliationCopy, BsBankReconciliationView, BsBankReconciliationForm, BsBankReconciliationChoices } from '../types/bankReconciliationPresentation'
defineProps<{ copy: BsBankReconciliationCopy; view: BsBankReconciliationView; choices: BsBankReconciliationChoices }>()
const selectedId = defineModel<string>('selectedId', { required: true })
const selectedLines = defineModel<string[]>('selectedLines', { required: true })
const selectedTransactions = defineModel<string[]>('selectedTransactions', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<BsBankReconciliationForm>('form', { required: true })
const emit = defineEmits<{ download: []; reload: []; begin: [mode: string, id: string]; match: []; complete: []; save: []; file: [file: File | null] }>()
function updateForm(key: keyof BsBankReconciliationForm, value: string | number | boolean | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
function normalizeSelection(value: (string | number)[] | string | number | boolean | null | undefined) { return Array.isArray(value) ? value.map(String) : [] }
function selectFile(value: File | File[] | null) { emit('file', Array.isArray(value) ? value[0] ?? null : value) }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="copy.bank_title"
      :subtitle="copy.bank_policy"
      :context="view.context"
      :context-label="view.contextLabel"
    >
      <template #actions>
        <BsButton v-if="view.canImport" type="submit" :disabled="view.readOnly" @click="emit('begin', 'import', '')">{{ copy.bank_import }}</BsButton>
        <BsButton type="submit" @click="emit('download')">{{ copy.bank_template }}</BsButton>
      </template>
    </BsPageHeader>
    <BsText v-if="!view.canRead" role="status">{{ copy.bank_denied }}</BsText>
    <template v-else>
      <BsCard v-if="choices.reconciliations.length" as="div" padding="md">
        <BsFloatingField :label="copy.bank_reconciliation">
          <BsSelect id="bank-reconciliation" v-model="selectedId" :label="copy.bank_reconciliation" native>
            <BsSelectOption v-for="item in choices.reconciliations" :key="item.value" :value="item.value">{{ item.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </BsCard>
      <BsText v-if="view.failed" role="alert" tone="danger">{{ copy.bank_errors_load }} <BsButton type="submit" @click="emit('reload')">{{ copy.bank_retry }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="view.pending" variant="table" :rows="5" />
      <BsEmptyState v-else-if="!view.current" :title="copy.bank_empty" :description="copy.bank_emptyHint" />
      <template v-else-if="view.current">
        <BsCard as="section" padding="md">
          <BsInline gap="md" :wrap="true" justify="between">
            <BsBox>
              <BsHeading :level="2" size="h2">{{ view.current.title }}</BsHeading>
              <BsText>{{ view.current.detail }}</BsText>
            </BsBox>
            <BsInline gap="sm" :wrap="false">
              <BsButton
                v-if="view.current.canComplete"
                type="submit"
                :disabled="view.readOnly || view.saving"
                variant="primary"
                @click="emit('complete')"
              >{{ copy.bank_complete }}</BsButton>
              <BsButton v-if="view.current.canReopen" type="submit" :disabled="view.readOnly" @click="emit('begin', 'reopen', '')">{{ copy.bank_reopen }}</BsButton>
            </BsInline>
          </BsInline>
          <BsText v-if="view.current.mismatch" tone="danger">{{ copy.bank_statementMismatch }}</BsText>
        </BsCard>
        <BsCard aria-labelledby="bank-equation" as="section" padding="md">
          <BsHeading id="bank-equation" :level="2" size="h2">{{ copy.bank_equation }}</BsHeading>
          <BsText size="sm" tone="muted">{{ copy.bank_equationPolicy }}</BsText>
          <BsDescriptionList v-if="view.equation" :columns="3">
            <BsBox>
              <BsDescriptionTerm>{{ copy.bank_statementBalance }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsText as="span" dir="ltr">{{ view.equation.statement }}</BsText>
              </BsDescriptionValue>
            </BsBox>
            <BsBox>
              <BsDescriptionTerm>{{ copy.bank_outstandingTotal }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsText as="span" dir="ltr">{{ view.equation.outstanding }}</BsText>
              </BsDescriptionValue>
            </BsBox>
            <BsBox>
              <BsDescriptionTerm>{{ copy.bank_ledgerBalance }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsText as="span" dir="ltr">{{ view.equation.ledger }}</BsText>
              </BsDescriptionValue>
            </BsBox>
            <BsBox>
              <BsDescriptionTerm>{{ copy.bank_difference }}</BsDescriptionTerm>
              <BsDescriptionValue data-bank-difference>
                <BsText as="span" dir="ltr">{{ view.equation.difference }}</BsText>
              </BsDescriptionValue>
            </BsBox>
          </BsDescriptionList>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.bank_statementLines }}</BsHeading>
          <BsDescriptionList :columns="3">
            <BsBox v-for="summary in view.states" :key="summary.status" :data-bank-state-total="summary.status">
              <BsDescriptionTerm>{{ summary.label }} · {{ summary.count }}</BsDescriptionTerm>
              <BsDescriptionValue>
                <BsText as="span" dir="ltr">{{ summary.amount }}</BsText>
              </BsDescriptionValue>
            </BsBox>
          </BsDescriptionList>
          <BsDataTable
            :value="view.lines"
            row-key="id"
            :label="copy.bank_statementLines"
            :columns="[{ key: 'column1', header: copy.bank_select }, { key: 'date', field: 'date', header: copy.bank_date }, { key: 'description', field: 'description', header: copy.bank_description }, { key: 'reference', field: 'reference', header: copy.bank_reference }, { key: 'column5', header: copy.bank_amount }, { key: 'column6', header: copy.bank_state }, { key: 'column7', header: copy.bank_actions }]"
          >
            <template #empty>{{ copy.bank_noLines }}</template>
            <template #cell-column1="{ row }">
              <BsCheckbox
                v-if="row.selectable"
                :aria-label="row.selectionLabel"
                :model-value="selectedLines" :value="row.id"
                bare
                @update:model-value="value => selectedLines = normalizeSelection(value)"
              />
            </template>
            <template #cell-column5="{ row }">
              <BsText as="span" dir="ltr">{{ row.amount }}</BsText>
            </template>
            <template #cell-column6="{ row }">
              <BsText :data-bank-state="row.status" as="span">{{ row.statusLabel }}</BsText>
              <BsText v-if="row.error" size="xs" tone="danger">{{ row.error }}</BsText>
            </template>
            <template #cell-column7="{ row }">
              <BsInline v-if="view.current.editable" gap="xs" :wrap="false">
                <BsButton v-if="row.canCorrect" type="submit" @click="emit('begin', 'correct', row.id)">{{ copy.bank_correct }}</BsButton>
                <BsButton v-if="row.canAdjust" type="submit" @click="emit('begin', 'adjust', row.id)">{{ copy.bank_adjust }}</BsButton>
              </BsInline>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.bank_ledgerCandidates }}</BsHeading>
          <BsDataTable
            :value="view.candidates"
            row-key="id"
            :label="copy.bank_ledgerCandidates"
            :columns="[{ key: 'column1', header: copy.bank_select }, { key: 'date', field: 'date', header: copy.bank_date }, { key: 'description', field: 'description', header: copy.bank_description }, { key: 'reference', field: 'reference', header: copy.bank_reference }, { key: 'column5', header: copy.bank_amount }, { key: 'column6', header: copy.bank_actions }]"
          >
            <template #empty>{{ copy.bank_noCandidates }}</template>
            <template #cell-column1="{ row }">
              <BsCheckbox
                v-if="view.current.editable"
                :aria-label="row.selectionLabel"
                :model-value="selectedTransactions" :value="row.id"
                bare
                @update:model-value="value => selectedTransactions = normalizeSelection(value)"
              />
            </template>
            <template #cell-column5="{ row }">
              <BsText as="span" dir="ltr">{{ row.amount }}</BsText>
            </template>
            <template #cell-column6="{ row }">
              <BsButton v-if="row.canOutstanding" type="submit" @click="emit('begin', 'outstanding', row.id)">{{ copy.bank_markOutstanding }}</BsButton>
            </template>
          </BsDataTable>
          <BsInline v-if="view.current.editable" gap="md" :wrap="true" justify="between" padding="lg">
            <BsText>{{ copy.bank_selectedTotals }}: <BsText as="span" dir="ltr">{{ view.lineTotal }}</BsText> = <BsText as="span" dir="ltr">{{ view.transactionTotal }}</BsText></BsText>
            <BsButton v-if="view.canMatch" type="submit" :disabled="view.matchDisabled" variant="primary" @click="emit('match')">{{ copy.bank_matchExact }}</BsButton>
          </BsInline>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.bank_outstanding }}</BsHeading>
          <BsDataTable
            :value="view.outstanding"
            row-key="id"
            :table-props="{ 'aria-label': copy.bank_outstanding }"
            :columns="[{ key: 'journal', field: 'journal', header: copy.bank_journal }, { key: 'reason', field: 'reason', header: copy.bank_reason }, { key: 'column3', header: copy.bank_amount }, { key: 'column4', header: copy.bank_actions }]"
          >
            <template #empty>{{ copy.bank_noOutstanding }}</template>
            <template #cell-column3="{ row }">
              <BsText as="span" dir="ltr">{{ row.amount }}</BsText>
            </template>
            <template #cell-column4="{ row }">
              <BsButton v-if="row.canRemove" type="submit" @click="emit('begin', 'removeOutstanding', row.id)">{{ copy.bank_remove }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.bank_matchHistory }}</BsHeading>
          <BsDataTable
            :value="view.matches"
            row-key="id"
            :label="copy.bank_matchHistory"
            :columns="[{ key: 'date', field: 'date', header: copy.bank_date }, { key: 'column2', header: copy.bank_amount }, { key: 'column3', header: copy.bank_state }, { key: 'column4', header: copy.bank_actions }]"
          >
            <template #empty>{{ copy.bank_noMatches }}</template>
            <template #cell-column2="{ row }">
              <BsText as="span" dir="ltr">{{ row.amount }}</BsText>
            </template>
            <template #cell-column3="{ row }">{{ row.statusLabel }}<BsText>{{ row.reason }}</BsText></template>
            <template #cell-column4="{ row }">
              <BsButton v-if="row.canUnmatch" type="submit" @click="emit('begin', 'unmatch', row.id)">{{ copy.bank_unmatch }}</BsButton>
            </template>
          </BsDataTable>
        </BsCard>
        <BsDisclosure>
          <template #summary>{{ copy.bank_auditHistory }}</template>
          <BsList :ordered="true" marker="none">
            <BsListItem v-for="event in view.events" :key="event.id"><BsText as="time">{{ event.time }}</BsText> · {{ event.label }}<BsText v-if="event.reason" as="span"> · {{ event.reason }}</BsText></BsListItem>
          </BsList>
        </BsDisclosure>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="view.formTitle"
      :pending="view.saving"
      :dirty="view.dirty"
      :error="view.formError"
      size="lg"
      :submit-label="copy.common_save"
      :cancel-label="copy.common_cancel"
      :submit-disabled="view.readOnly"
      @submit="emit('save')"
    >
      <template v-if="view.importForm">
        <BsFloatingField :label="copy.bank_bankAccount">
          <BsSelect id="bank-account" :label="copy.bank_bankAccount" :model-value="form.account" required native @update:model-value="updateForm('account', $event)">
            <BsSelectOption v-for="account in choices.banks" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="copy.bank_file">
          <BsFileInput id="bank-file" accept=".csv,text/csv" required bare @select="selectFile" />
        </BsFloatingField>
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="copy.bank_start">
            <BsInput id="bank-start" :model-value="form.start" type="date" required @update:model-value="updateForm('start', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.bank_end">
            <BsInput id="bank-end" :model-value="form.end" type="date" :min="form.start" required @update:model-value="updateForm('end', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.bank_opening">
            <BsInput id="bank-opening" :model-value="form.opening" inputmode="decimal" required @update:model-value="updateForm('opening', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.bank_closing">
            <BsInput id="bank-closing" :model-value="form.closing" inputmode="decimal" required @update:model-value="updateForm('closing', $event)" />
          </BsFloatingField>
        </BsGrid>
      </template>
      <template v-if="view.correctionForm">
        <BsFloatingField :label="copy.bank_date">
          <BsInput id="bank-correct-date" :model-value="form.date" type="date" required @update:model-value="updateForm('date', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.bank_amount">
          <BsInput id="bank-correct-amount" :model-value="form.amount" required @update:model-value="updateForm('amount', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.bank_description">
          <BsInput id="bank-correct-description" :model-value="form.description" required @update:model-value="updateForm('description', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.bank_reference">
          <BsInput id="bank-correct-reference" :model-value="form.reference" @update:model-value="updateForm('reference', $event)" />
        </BsFloatingField>
      </template>
      <BsFloatingField v-if="view.adjustmentForm" :label="copy.bank_offsetAccount">
        <BsSelect id="bank-offset" :label="copy.bank_offsetAccount" :model-value="form.offset" required native @update:model-value="updateForm('offset', $event)">
          <BsSelectOption value="" />
          <BsSelectOption v-for="account in choices.offsets" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField v-if="view.reasonField" :label="copy.bank_reason">
        <BsInput id="bank-reason" :model-value="form.reason" required @update:model-value="updateForm('reason', $event)" />
      </BsFloatingField>
    </BsRecordActionDialog>
  </BsStack>
</template>
