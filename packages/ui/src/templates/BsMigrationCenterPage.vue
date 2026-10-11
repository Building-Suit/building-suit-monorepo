<script setup lang="ts">
import type { BsMigrationCenterCopy, BsMigrationCenterView, BsMigrationCenterCreateForm, BsMigrationCenterChoices } from '../types/migrationCenterPresentation'
defineProps<{ copy: BsMigrationCenterCopy; view: BsMigrationCenterView; choices: BsMigrationCenterChoices }>()
const createOpen = defineModel<boolean>('createOpen', { required: true })
const createForm = defineModel<BsMigrationCenterCreateForm>('createForm', { required: true })
const selectedProjectId = defineModel<string>('selectedProjectId', { required: true })
const selectedOpeningId = defineModel<string>('selectedOpeningId', { required: true })
const reviewNote = defineModel<string>('reviewNote', { required: true })
const approvalAcknowledged = defineModel<boolean>('approvalAcknowledged', { required: true })
const emit = defineEmits<{ openCreate: []; createProject: []; downloadSource: []; downloadOpenItems: []; downloadOperational: []; file: [file: File | null]; mapTarget: [id: string, value: string]; reviewMappings: []; linkOpening: []; markModules: []; approve: [] }>()
function updateCreateForm(key: keyof BsMigrationCenterCreateForm, value: string | number | boolean | null | undefined) { createForm.value = { ...createForm.value, [key]: String(value ?? '') } }
function selectSource(value: File | File[] | null) { emit('file', Array.isArray(value) ? value[0] ?? null : value) }
</script>
<template>
  <BsStack data-migration-center gap="lg">
    <BsPageHeader
      :title="copy.migration_title"
      :subtitle="copy.migration_subtitle"
      :context="view.context"
      :context-label="view.contextLabel"
    />
    <BsText v-if="!view.canRead" tone="muted">{{ copy.migration_noAccess }}</BsText>
    <template v-else>
      <BsCard aria-labelledby="migration-projects" as="section" padding="md">
        <BsStack gap="md">
          <BsInline gap="md" :wrap="true" align="end" justify="between">
            <BsFloatingField :label="copy.migration_project">
              <BsSelect
                id="migration-project"
                v-model="selectedProjectId"
                :label="copy.migration_project"
                :placeholder="copy.migration_chooseProject"
                :options="choices.projects"
                option-label="label"
                option-value="value"
              />
            </BsFloatingField>
            <BsButton v-if="view.canManage" type="button" variant="primary" @click="emit('openCreate')">{{ copy.migration_newProject }}</BsButton>
          </BsInline>
        </BsStack>
      </BsCard>
      <BsRecordActionDialog
        v-if="createOpen"
        v-model:visible="createOpen"
        :title="copy.migration_newProject"
        :dirty="view.createDirty"
        :pending="view.createPending"
        :error="view.createError"
        size="lg"
        :submit-label="copy.migration_createProject"
        :cancel-label="copy.common_cancel"
        @submit="emit('createProject')"
      >
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="copy.migration_projectName">
            <BsInput :model-value="createForm.name" required :maxlength="view.projectNameMaxLength" @update:model-value="updateCreateForm('name', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.migration_sourceType">
            <BsSelect :model-value="createForm.sourceType" native @update:model-value="updateCreateForm('sourceType', $event)"><BsSelectOption v-for="option in choices.sourceTypes" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption></BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="copy.migration_cutoverDate">
            <BsInput :model-value="createForm.cutoverDate" type="date" required @update:model-value="updateCreateForm('cutoverDate', $event)" />
          </BsFloatingField>
          <BsFloatingField :label="copy.migration_depth">
            <BsSelect :model-value="createForm.depth" native @update:model-value="updateCreateForm('depth', $event)"><BsSelectOption v-for="option in choices.depths" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption></BsSelect>
          </BsFloatingField>
          <BsText size="sm" tone="muted">{{ copy.migration_fastCutoverPolicy }}</BsText>
        </BsGrid>
      </BsRecordActionDialog>
      <BsText v-if="view.error" role="alert" tone="danger">{{ copy.migration_loadFailed }}</BsText>
      <BsSectionSkeleton v-else-if="view.loading" variant="table" :rows="6" />
      <template v-else-if="view.available">
        <BsCard aria-labelledby="migration-progress" as="section" padding="md">
          <BsHeading id="migration-progress" :level="2" size="h2">{{ copy.migration_progress }}</BsHeading>
          <BsList data-migration-progress :ordered="true" marker="none">
            <BsListItem v-for="(section, index) in view.progress" :key="section.key" :data-section="section.key" :data-state="section.state">
              <BsText as="span" size="xs" tone="muted">{{ index + 1 }}</BsText>
              <BsText emphasis="semibold">{{ section.label }}</BsText>
              <BsText size="sm" :tone="section.tone">{{ section.description }}</BsText>
            </BsListItem>
          </BsList>
        </BsCard>
        <BsCard aria-labelledby="migration-source" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-source" :level="2" size="h2">{{ copy.migration_sections_source }}</BsHeading>
              <BsText size="sm" tone="muted">{{ copy.migration_sourceHint }}</BsText>
            </BsBox>
            <BsInline gap="sm" :wrap="true">
              <BsButton type="button" size="sm" @click="emit('downloadSource')">{{ copy.migration_sourceTemplate }}</BsButton>
              <BsButton type="button" size="sm" @click="emit('downloadOpenItems')">{{ copy.migration_openItemsTemplate }}</BsButton>
              <BsButton type="button" size="sm" @click="emit('downloadOperational')">{{ copy.migration_operationalTemplate }}</BsButton>
              <BsLink :to="view.openingTo">{{ copy.migration_openingTemplate }}</BsLink>
            </BsInline>
            <BsFieldLabel v-if="view.canUpload" for="migration-source-file">{{ copy.migration_uploadSource }}</BsFieldLabel>
            <BsFileInput id="migration-source-file" accept=".csv,text/csv" :disabled="view.busy" bare reset-after-select hide-control  @select="selectSource" />
            <BsBox v-if="view.source" padding="md" surface="muted" radius="control">
              <BsText emphasis="semibold">{{ view.source.name }} · {{ view.source.revision }}</BsText>
              <BsText tone="muted">{{ copy.sourceHashLabel }}: {{ view.source.hash }}</BsText>
              <BsText>{{ copy.migration_originalRows }}</BsText>
            </BsBox>
            <BsDataTable
              v-if="view.sourceRows.length"
              :value="view.sourceRows"
              row-key="sourceRow"
              :label="copy.migration_sourcePreview"
              :columns="[{ key: 'sourceRow', field: 'sourceRow', header: '#' }, { key: 'column2', header: copy.migration_sourceKind }, { key: 'column3', header: copy.migration_sourceKey }, { key: 'column4', header: copy.migration_sourceName }, { key: 'column5', header: copy.migration_rowIssues }]"
            >
              <template #cell-column2="{ row: data }">{{ data.kind }}</template>
              <template #cell-column3="{ row: data }">{{ data.key }}</template>
              <template #cell-column4="{ row: data }">{{ data.name }}</template>
              <template #cell-column5="{ row: data }">
                <BsText v-if="data.issues" as="span" tone="danger">{{ data.issues }}</BsText>
                <BsText v-else-if="view.staged" as="span" tone="success">{{ copy.migration_rowValid }}</BsText>
                <BsText v-else as="span">—</BsText>
              </template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsCard v-if="view.mappings.length" aria-labelledby="migration-mapping" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-mapping" :level="2" size="h2">{{ copy.migration_sections_accounts }}</BsHeading>
              <BsText size="sm" tone="muted">{{ copy.migration_mappingHint }}</BsText>
            </BsBox>
            <BsDataTable
              :value="view.mappings"
              row-key="id"
              :label="copy.migration_mappingReview"
              :columns="[{ key: 'column1', header: copy.migration_sourceKind }, { key: 'sourceKey', field: 'sourceKey', header: copy.migration_sourceKey }, { key: 'sourceName', field: 'sourceName', header: copy.migration_sourceName }, { key: 'column4', header: copy.migration_ledgerTarget }]"
            >
              <template #cell-column1="{ row: data }">{{ data.kind }}</template>
              <template #cell-column4="{ row: data }">
                <BsSelect :model-value="data.target" :label="`${copy.migration_ledgerTarget} ${data.sourceKey}`" native @update:model-value="value => emit('mapTarget', data.id, String(value ?? ''))">
                  <BsSelectOption value="">{{ copy.migration_chooseTarget }}</BsSelectOption>
                  <BsSelectOption v-for="option in data.choices" :key="option.value" :value="option.value">{{ option.label }}</BsSelectOption>
                  
                </BsSelect>
              </template>
            </BsDataTable>
            <BsFloatingField :label="copy.migration_reviewNote">
              <BsTextarea v-model="reviewNote" :minlength="view.reviewNoteMinLength" :maxlength="view.reviewNoteMaxLength" />
            </BsFloatingField>
            <BsButton
              type="button"
              :disabled="view.mappingDisabled"
              variant="primary"
              @click="emit('reviewMappings')"
            >{{ view.mappingLabel }}</BsButton>
          </BsStack>
        </BsCard>
        <BsCard v-else-if="view.reviewedMappings.length" aria-labelledby="migration-mapping-reviewed" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-mapping-reviewed" :level="2" size="h2">{{ copy.migration_mappingReview }}</BsHeading>
              <BsText size="sm" tone="muted">{{ view.mappingNote }}</BsText>
            </BsBox>
            <BsDataTable
              :value="view.reviewedMappings"
              row-key="id"
              :label="copy.migration_mappingReview"
              :columns="[{ key: 'kind', field: 'kind', header: copy.migration_sourceKind }, { key: 'sourceKey', field: 'sourceKey', header: copy.migration_sourceKey }, { key: 'resolution', field: 'resolution', header: copy.migration_resolution }, { key: 'column4', header: copy.migration_ledgerTarget }]"
            >
              <template #cell-column4="{ row: data }">{{ data.target }}</template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsCard aria-labelledby="migration-opening" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-opening" :level="2" size="h2">{{ copy.migration_sections_opening }}</BsHeading>
              <BsText size="sm" tone="muted">{{ copy.migration_openingHint }}</BsText>
            </BsBox>
            <BsInline v-if="!view.openingLinked" gap="md" :wrap="true" align="end">
              <BsFloatingField :label="copy.migration_openingBatch">
                <BsSelect v-model="selectedOpeningId" native>
                  <BsSelectOption value="">{{ copy.migration_chooseOpening }}</BsSelectOption>
                  <BsSelectOption v-for="batch in choices.openings" :key="batch.value" :value="batch.value">{{ batch.label }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsButton
                type="button"
                :disabled="view.openingLinkDisabled"
                variant="primary"
                @click="emit('linkOpening')"
              >{{ copy.migration_linkOpening }}</BsButton>
              <BsLink :to="view.openingTo">{{ copy.migration_prepareOpening }}</BsLink>
            </BsInline>
            <BsText v-else size="sm">{{ copy.migration_openingLinkedStatus }}</BsText>
          </BsStack>
        </BsCard>
        <BsCard aria-labelledby="migration-modules" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-modules" :level="2" size="h2">{{ copy.migration_modulesTitle }}</BsHeading>
              <BsText size="sm" tone="muted">{{ copy.migration_modulesHint }}</BsText>
            </BsBox>
            <BsGrid v-if="view.modules.length" :columns="5" gap="sm">
              <BsText v-for="module in view.modules" :key="module.id" size="sm"><BsText as="span" emphasis="semibold">{{ module.label }}</BsText><BsLineBreak />{{ module.status }}</BsText>
            </BsGrid>
            <BsButton
              v-else-if="view.canMarkModules"
              type="button"
              :disabled="view.busy"
              @click="emit('markModules')"
            >{{ copy.migration_allModulesNotApplicable }}</BsButton>
            <BsText size="sm">{{ copy.migration_historyPolicy }}</BsText>
          </BsStack>
        </BsCard>
        <BsCard v-if="view.review" aria-labelledby="migration-final-review" data-final-review as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-final-review" :level="2" size="h2">{{ copy.migration_sections_final_review }}</BsHeading>
              <BsText size="sm" tone="muted">{{ copy.migration_finalReviewHint }}</BsText>
            </BsBox>
            <BsGrid :columns="3" gap="md">
              <BsText>
                <BsText as="span" tone="muted">{{ copy.opening_debitTotal }}</BsText>
                <BsLineBreak />
                <BsText as="strong">{{ view.review.debit }}</BsText>
              </BsText>
              <BsText>
                <BsText as="span" tone="muted">{{ copy.opening_creditTotal }}</BsText>
                <BsLineBreak />
                <BsText as="strong">{{ view.review.credit }}</BsText>
              </BsText>
              <BsText>
                <BsText as="span" tone="muted">{{ copy.opening_difference }}</BsText>
                <BsLineBreak />
                <BsText as="strong">{{ view.review.difference }}</BsText>
              </BsText>
            </BsGrid>
            <BsDataTable
              v-if="view.review.variances.length"
              :value="view.review.variances"
              :label="copy.migration_reconciliations"
              :columns="[{ key: 'module', field: 'module', header: copy.migration_module }, { key: 'column2', header: copy.migration_moduleDetail }, { key: 'column3', header: copy.migration_glBalance }, { key: 'column4', header: copy.opening_difference }]"
            >
              <template #cell-column2="{ row: data }">{{ data.detail }}</template>
              <template #cell-column3="{ row: data }">{{ data.gl }}</template>
              <template #cell-column4="{ row: data }">
                <BsText as="span" :tone="data.tone">{{ data.variance }}</BsText>
              </template>
            </BsDataTable>
            <BsBox v-if="view.review.errors.length" role="alert">
              <BsText emphasis="semibold">{{ copy.migration_approvalBlocked }}</BsText>
              <BsList :ordered="false" marker="disc">
                <BsListItem v-for="code in view.review.errors" :key="code">{{ code }}</BsListItem>
              </BsList>
            </BsBox>
            <BsBox v-else role="status" padding="md" radius="control">{{ copy.migration_reconciled }}</BsBox>
            <BsBox v-if="view.review.approved" data-cutover-approved padding="lg" border radius="control">
              <BsText tone="success" emphasis="bold">{{ copy.migration_approved }}</BsText>
              <BsText size="sm">{{ copy.migration_approvedEvidence }}</BsText>
              <BsInline gap="sm" :wrap="true"><BsLink v-for="link in view.review.links" :key="link.to" :to="link.to">{{ link.label }}</BsLink></BsInline>
            </BsBox>
            <template v-else>
              <BsFieldLabel>
                <BsCheckbox v-model="approvalAcknowledged" bare />
                <BsText as="span">{{ copy.migration_approvalAcknowledgement }}</BsText>
              </BsFieldLabel>
              <BsText size="sm" tone="muted">{{ copy.migration_correctionPolicy }}</BsText>
              <BsButton
                type="button"
                :disabled="view.approveDisabled"
                variant="primary"
                @click="emit('approve')"
              >{{ view.approveLabel }}</BsButton>
            </template>
          </BsStack>
        </BsCard>
      </template>
    </template>
  </BsStack>
</template>
