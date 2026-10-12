<script setup lang="ts">
import type { BsOpeningBalanceCopy, BsOpeningBalanceView } from '../types/openingBalancePresentation'
defineProps<{ copy: BsOpeningBalanceCopy; view: BsOpeningBalanceView }>()
const mode = defineModel<string>('mode', { required: true })
const cutoff = defineModel<string>('cutoff', { required: true })
const correctionReason = defineModel<string>('correctionReason', { required: true })
const correctionDate = defineModel<string>('correctionDate', { required: true })
const emit = defineEmits<{ downloadTemplate: []; file: [file: File | null]; uploadRows: []; validateBatch: []; approve: []; reverse: [id: string]; mapAccount: [sourceRow: number, accountId: string | null] }>()
function selectFile(value: File | File[] | null) { emit('file', Array.isArray(value) ? value[0] ?? null : value) }
</script>
<template>
  <BsStack data-opening-workflow gap="lg">
    <BsPageHeader
      :title="copy.opening_title"
      :subtitle="copy.opening_subtitle"
      :context="view.context"
      :context-label="view.contextLabel"
    />
    <BsText v-if="!view.canRead" tone="muted">{{ copy.opening_noAccess }}</BsText>
    <BsText v-else-if="view.loadError" role="alert" tone="danger">{{ copy.opening_loadFailed }}</BsText>
    <BsSectionSkeleton v-else-if="view.pending" variant="table" :rows="5" />
    <template v-else>
      <BsCard aria-labelledby="opening-readiness-guide" data-opening-readiness-guide as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-readiness-guide" :level="2" size="h2">{{ copy.opening_guideTitle }}</BsHeading>
          <BsText size="sm" tone="muted">{{ copy.opening_guideHint }}</BsText>
          <BsList :ordered="false" marker="disc">
            <BsListItem>{{ copy.opening_guideChart }}</BsListItem>
            <BsListItem>{{ copy.opening_guidePeriod }}</BsListItem>
            <BsListItem>{{ copy.opening_guideMapping }}</BsListItem>
          </BsList>
          <BsInline gap="sm" :wrap="true">
            <BsLink :to="view.reviewChartTo">{{ copy.opening_reviewChart }}</BsLink>
            <BsLink :to="view.reviewPeriodsTo">{{ copy.opening_reviewPeriods }}</BsLink>
          </BsInline>
        </BsStack>
      </BsCard>
      <BsCard v-if="view.canManage" aria-labelledby="opening-setup" as="section" padding="md">
        <BsStack gap="md">
          <BsBox>
            <BsHeading id="opening-setup" :level="2" size="h2">1. {{ copy.opening_setup }}</BsHeading>
            <BsText size="sm" tone="muted">{{ copy.opening_cutoffHint }}</BsText>
          </BsBox>
          <BsGrid :columns="2" gap="md">
            <BsFloatingField :label="copy.opening_mode">
              <BsSelect id="opening-mode" v-model="mode" :disabled="view.posted" native>
                <BsSelectOption v-for="choice in view.modes" :key="choice.value" :value="choice.value">{{ choice.label }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsFloatingField :label="copy.opening_cutoff">
              <BsInput id="opening-cutoff" v-model="cutoff" type="date" required :disabled="view.posted" />
            </BsFloatingField>
          </BsGrid>
          <BsBox>
            <BsHeading :level="2" size="h2">2. {{ copy.opening_upload }}</BsHeading>
            <BsInline gap="sm" :wrap="true">
              <BsFieldLabel for="opening-file">{{ copy.opening_chooseCsv }}</BsFieldLabel>
              <BsButton type="button" @click="emit('downloadTemplate')">{{ copy.opening_downloadTemplate }}</BsButton>
            </BsInline>
            <BsFileInput id="opening-file" accept=".csv,text/csv" :disabled="view.fileDisabled" bare hide-control  @select="selectFile" />
            <BsText v-if="view.filename" size="sm" tone="muted">{{ view.filename }} · {{ copy.opening_rowCount }}</BsText>
            <BsButton v-if="view.uploadFailed" type="button" :disabled="view.busy" @click="emit('uploadRows')">{{ view.retryLabel }}</BsButton>
          </BsBox>
        </BsStack>
      </BsCard>
      <BsCard v-if="view.rows.length" aria-labelledby="opening-mapping" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-mapping" :level="2" size="h2">3. {{ copy.opening_mapping }}</BsHeading>
          <BsDataTable
            :value="view.rows"
            row-key="sourceRow"
            :label="copy.opening_mapping"
            :columns="[{ key: 'sourceRow', field: 'sourceRow', header: '#' }, { key: 'column2', header: copy.opening_sourceAccount }, { key: 'column3', header: copy.opening_debit }, { key: 'column4', header: copy.opening_credit }, { key: 'column5', header: copy.opening_ledgerAccount }, { key: 'column6', header: copy.opening_validationErrors }]"
          >
            <template #cell-column2="{ row }">
              <BsText as="strong">{{ row.sourceCode }}</BsText>
              <BsLineBreak />
              <BsText as="span" tone="muted">{{ row.sourceName }}</BsText>
            </template>
            <template #cell-column3="{ row }">{{ row.debit || '—' }}</template>
            <template #cell-column4="{ row }">{{ row.credit || '—' }}</template>
            <template #cell-column5="{ row }">
              <BsSelect :model-value="row.accountId" :aria-label="`${copy.opening_ledgerAccount} ${row.sourceRow}`" native @update:model-value="value => emit('mapAccount', row.sourceRow, value === null ? null : String(value))">
                <BsSelectOption :value="null">{{ copy.opening_chooseAccount }}</BsSelectOption>
                <BsSelectOption v-for="account in view.accounts" :key="account.value" :value="account.value">{{ account.label }}</BsSelectOption>
              </BsSelect>
            </template>
            <template #cell-column6="{ row }">
              <BsList v-if="row.errors.length" :ordered="false" marker="none">
                <BsListItem v-for="code in row.errors" :key="code">{{ code }}</BsListItem>
              </BsList>
              <BsText v-else-if="view.validation" as="span" tone="success">{{ copy.opening_valid }}</BsText>
            </template>
          </BsDataTable>
          <BsButton type="button" :disabled="view.busy" variant="primary" @click="emit('validateBatch')">{{ view.validateLabel }}</BsButton>
        </BsStack>
      </BsCard>
      <BsCard v-if="view.validation" aria-labelledby="opening-validation" :data-validation="view.validation.valid ? 'valid' : 'invalid'" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-validation" :level="2" size="h2">4. {{ copy.opening_validation }}</BsHeading>
          <BsGrid :columns="3" gap="md">
            <BsText>
              <BsText as="span" tone="muted">{{ copy.opening_debitTotal }}</BsText>
              <BsLineBreak />
              <BsText as="strong">{{ view.validation.debit }}</BsText>
            </BsText>
            <BsText>
              <BsText as="span" tone="muted">{{ copy.opening_creditTotal }}</BsText>
              <BsLineBreak />
              <BsText as="strong">{{ view.validation.credit }}</BsText>
            </BsText>
            <BsText>
              <BsText as="span" tone="muted">{{ copy.opening_difference }}</BsText>
              <BsLineBreak />
              <BsText as="strong">{{ view.validation.difference }}</BsText>
            </BsText>
          </BsGrid>
          <BsBox v-if="view.validation.errors.length" role="alert">
            <BsText emphasis="semibold">{{ copy.opening_blocked }}</BsText>
            <BsList :ordered="false" marker="disc">
              <BsListItem v-for="code in view.validation.errors" :key="code">{{ code }}</BsListItem>
            </BsList>
          </BsBox>
          <BsBox v-else role="status" padding="md" surface="muted" radius="control">{{ copy.opening_validationPassed }}</BsBox>
        </BsStack>
      </BsCard>
      <BsCard v-if="view.validation?.preview.length" aria-labelledby="opening-preview" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-preview" :level="2" size="h2">5. {{ copy.opening_preview }}</BsHeading>
          <BsText size="sm" tone="muted">{{ copy.opening_previewHint }}</BsText>
          <BsDataTable
            :value="view.validation.preview"
            row-key="id"
            :label="copy.opening_preview"
            :columns="[{ key: 'column1', header: copy.opening_ledgerAccount }, { key: 'column2', header: copy.opening_debit, align: 'end' as const }, { key: 'column3', header: copy.opening_credit, align: 'end' as const }]"
          >
            <template #cell-column1="{ row: line }">{{ line.account }}</template>
            <template #cell-column2="{ row: line }">{{ line.debit }}</template>
            <template #cell-column3="{ row: line }">{{ line.credit }}</template>
          </BsDataTable>
          <BsButton
            v-if="view.canApprove"
            type="button"
            :disabled="view.approveDisabled"
            variant="primary"
            @click="emit('approve')"
          >{{ view.approveLabel }}</BsButton>
          <BsBox v-if="view.posted" data-opening-posted padding="lg" surface="muted" radius="control">
            <BsText as="strong">{{ copy.opening_postedLocked }}</BsText>
            <BsLineBreak />
            <BsLink :to="view.journalTo">{{ copy.opening_openJournal }}</BsLink>
          </BsBox>
        </BsStack>
      </BsCard>
      <BsCard aria-labelledby="opening-history" as="section" padding="md">
        <BsStack gap="md">
          <BsHeading id="opening-history" :level="2" size="h2">{{ copy.opening_history }}</BsHeading>
          <BsEmptyState v-if="!view.history.length" :title="copy.opening_empty" :description="copy.opening_emptyHint" />
          <BsBox v-for="batch in view.history" :key="batch.id" :data-batch-status="batch.status" as="article" padding="lg" border radius="control">
            <BsInline gap="md" :wrap="true" justify="between">
              <BsBox>
                <BsText as="strong">{{ batch.title }}</BsText>
                <BsText size="sm" tone="muted">{{ batch.subtitle }}</BsText>
              </BsBox>
              <BsLink v-if="batch.journalTo" :to="batch.journalTo">{{ copy.opening_openJournal }}</BsLink>
            </BsInline>
            <BsGrid v-if="batch.validation" :columns="3" gap="sm">
              <BsText as="span">{{ batch.validation.rows }}</BsText>
              <BsText as="span">{{ copy.opening_debit }}: {{ batch.validation.debit }}</BsText>
              <BsText as="span">{{ copy.opening_credit }}: {{ batch.validation.credit }}</BsText>
            </BsGrid>
            <BsText size="xs" tone="muted">{{ copy.opening_creator }}: {{ batch.creator }}<template v-if="batch.approver"> · {{ copy.opening_approver }}: {{ batch.approver }}</template></BsText>
            <BsText v-if="batch.reversalId" size="sm">{{ copy.opening_reversal }}: <BsLink :to="batch.reversalTo || ''">{{ batch.reversalId }}</BsLink> · {{ batch.correctionReason }}</BsText>
            <BsForm
              v-if="batch.canCorrect"
              :aria-busy="batch.pending"
              layout="grid"
              @submit.prevent="emit('reverse', batch.id)"
            >
              <BsFloatingField :label="copy.opening_correctionReason">
                <BsInput v-model="correctionReason" required />
              </BsFloatingField>
              <BsFloatingField :label="copy.opening_reversalDate">
                <BsInput v-model="correctionDate" type="date" />
              </BsFloatingField>
              <BsButton type="submit" :disabled="view.correctionDisabled">{{ batch.reverseLabel }}</BsButton>
            </BsForm>
          </BsBox>
        </BsStack>
      </BsCard>
    </template>
  </BsStack>
</template>
