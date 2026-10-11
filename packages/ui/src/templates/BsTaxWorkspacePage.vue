<script setup lang="ts">
import type { BsTaxWorkspaceCopy, BsTaxWorkspaceSetupForm, BsTaxWorkspaceDocumentForm, BsTaxWorkspaceView, BsTaxWorkspaceChoices } from '../types/taxWorkspacePresentation'
defineProps<{ copy: BsTaxWorkspaceCopy; view: BsTaxWorkspaceView; choices: BsTaxWorkspaceChoices }>()
const setup = defineModel<BsTaxWorkspaceSetupForm>('setup', { required: true })
const form = defineModel<BsTaxWorkspaceDocumentForm>('form', { required: true })
const from = defineModel<string>('from', { required: true })
const to = defineModel<string>('to', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ reload: []; saveSetup: []; saveDocument: []; validateAmount: []; beginOutput: []; beginInput: []; beginOutputCredit: []; beginInputCredit: []; reverse: [id: string] }>()
function updateSetup(key: keyof BsTaxWorkspaceSetupForm, value: string | number | boolean | null | undefined) { setup.value = { ...setup.value, [key]: String(value ?? '') } }
function updateForm(key: keyof BsTaxWorkspaceDocumentForm, value: string | number | boolean | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="copy.vat_title"
      :subtitle="copy.vat_policy"
      :context="view.context"
      :context-label="view.contextLabel"
    />
    <BsBox role="note" as="aside" padding="lg" border radius="control">{{ copy.vat_scopeWarning }}</BsBox>
    <BsText v-if="!view.canRead" role="status">{{ copy.vat_denied }}</BsText>
    <template v-else>
      <BsText v-if="view.loadError" role="alert" tone="danger">{{ copy.vat_errors_load }} <BsButton type="submit" @click="emit('reload')">{{ copy.common_retry }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="view.pending" variant="table" :rows="5" />
      <template v-else-if="view.available">
        <BsCard v-if="!view.profile" as="section" padding="md">
          <BsStack gap="md">
            <BsHeading :level="2" size="h2">{{ copy.vat_setupTitle }}</BsHeading>
            <BsText>{{ copy.vat_setupPolicy }}</BsText>
            <BsText v-if="view.setupError" role="alert" tone="danger">{{ view.setupError }}</BsText>
            <BsForm v-if="view.canConfigure" layout="grid" :columns="2" @submit.prevent="emit('saveSetup')">
              <BsFloatingField :label="copy.vat_registration">
                <BsInput :model-value="setup.registration" required maxlength="64" @update:model-value="updateSetup('registration', $event)" />
              </BsFloatingField>
              <BsFloatingField :label="copy.vat_effectiveFrom">
                <BsInput :model-value="setup.effective" type="date" required @update:model-value="updateSetup('effective', $event)" />
              </BsFloatingField>
              <BsFloatingField :label="copy.vat_outputAccount">
                <BsSelect :model-value="setup.output" required native @update:model-value="updateSetup('output', $event)">
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="a in choices.output" :key="a.value" :value="a.value">{{ a.label }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsFloatingField :label="copy.vat_inputAccount">
                <BsSelect :model-value="setup.input" required native @update:model-value="updateSetup('input', $event)">
                  <BsSelectOption value="" />
                  <BsSelectOption v-for="a in choices.input" :key="a.value" :value="a.value">{{ a.label }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsButton type="submit" :disabled="view.setupDisabled" variant="primary">{{ copy.vat_confirmRegistration }}</BsButton>
            </BsForm>
          </BsStack>
        </BsCard>
        <template v-else>
          <BsCard as="section" padding="md">
            <BsDescriptionList :columns="3">
              <BsBox>
                <BsDescriptionTerm>{{ copy.vat_registration }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ view.profile.registration }}</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ copy.vat_jurisdiction }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ copy.vat_egypt }}</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ copy.vat_rate }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ view.profile.rate }}</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ copy.vat_evidenceDate }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ view.profile.evidenceDate }}</BsDescriptionValue>
              </BsBox>
            </BsDescriptionList>
            <BsText size="sm" tone="muted">{{ view.profile.ruleName }}</BsText>
          </BsCard>
          <BsCard as="div" padding="md">
            <BsStack gap="md">
              <BsFloatingField :label="copy.vat_from">
                <BsInput v-model="from" type="date" :max="to" />
              </BsFloatingField>
              <BsFloatingField :label="copy.vat_to">
                <BsInput v-model="to" type="date" :min="from" />
              </BsFloatingField>
              <BsButton type="submit" @click="emit('reload')">{{ copy.vat_run }}</BsButton>
            </BsStack>
          </BsCard>
          <BsInline gap="sm" :wrap="true">
            <BsButton v-if="view.canPost" type="submit" :disabled="view.readOnly" variant="primary" @click="emit('beginOutput')">{{ copy.vat_addOutput }}</BsButton>
            <BsButton v-if="view.canPost" type="submit" :disabled="view.readOnly" variant="primary" @click="emit('beginInput')">{{ copy.vat_addInput }}</BsButton>
            <BsButton v-if="view.canAdjust" type="submit" :disabled="view.readOnly" @click="emit('beginOutputCredit')">{{ copy.vat_addOutputCredit }}</BsButton>
            <BsButton v-if="view.canAdjust" type="submit" :disabled="view.readOnly" @click="emit('beginInputCredit')">{{ copy.vat_addInputCredit }}</BsButton>
          </BsInline>
          <template v-if="view.report">
            <BsCard as="section" padding="md">
              <BsText :data-vat-reconciled="view.report.reconciled" :tone="view.report.reconciled ? 'success' : 'danger'">{{ view.report.reconciled ? copy.vat_reconciled : copy.vat_notReconciled }}</BsText>
              <BsDescriptionList :columns="3">
                <BsBox>
                  <BsDescriptionTerm>{{ copy.vat_outputVat }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsText as="span" dir="ltr">{{ view.report.output }}</BsText>
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ copy.vat_inputVat }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsText as="span" dir="ltr">{{ view.report.input }}</BsText>
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ copy.vat_netVat }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsText as="span" dir="ltr">{{ view.report.net }}</BsText>
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ copy.vat_outputDifference }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsText as="span" dir="ltr">{{ view.report.outputDifference }}</BsText>
                  </BsDescriptionValue>
                </BsBox>
                <BsBox>
                  <BsDescriptionTerm>{{ copy.vat_inputDifference }}</BsDescriptionTerm>
                  <BsDescriptionValue>
                    <BsText as="span" dir="ltr">{{ view.report.inputDifference }}</BsText>
                  </BsDescriptionValue>
                </BsBox>
              </BsDescriptionList>
            </BsCard>
            <BsCard as="section" padding="none" overflow="hidden">
              <BsHeading :level="2" size="h2">{{ copy.vat_documents }}</BsHeading>
              <BsDataTable
                :value="view.report.documents"
                row-key="id"
                :label="copy.vat_documents"
                :columns="[{ key: 'taxPointDate', field: 'taxPointDate', header: copy.vat_taxPointDate }, { key: 'documentDate', field: 'documentDate', header: copy.vat_documentDate }, { key: 'reference', field: 'reference', header: copy.vat_reference }, { key: 'column4', header: copy.vat_direction }, { key: 'column5', header: copy.vat_base }, { key: 'column6', header: copy.vat_tax }, { key: 'column7', header: copy.vat_history }]"
              >
                <template #empty>{{ copy.vat_empty }}</template>
                <template #cell-column4="{ row }">{{ row.kindLabel }}</template>
                <template #cell-column5="{ row }">
                  <BsText as="span" dir="ltr">{{ row.base }}</BsText>
                </template>
                <template #cell-column6="{ row }">
                  <BsText as="span" dir="ltr">{{ row.tax }}</BsText>
                </template>
                <template #cell-column7="{ row }">
                  <BsLink :to="row.journalTo">{{ copy.vat_journal }}</BsLink>
                  <BsButton
                    v-if="row.canReverse"
                    type="submit"
                    :disabled="view.readOnly"
                    @click="emit('reverse', row.id)"
                  >{{ copy.vat_reverse }}</BsButton>
                </template>
              </BsDataTable>
            </BsCard>
          </template>
        </template>
      </template>
    </template>
    <BsRecordActionDialog
      v-model:visible="visible"
      :title="view.dialogTitle"
      :pending="view.dialogPending"
      :dirty="view.dialogDirty"
      :error="view.dialogError"
      size="lg"
      :submit-label="copy.common_save"
      :cancel-label="copy.common_cancel"
      :submit-disabled="view.readOnly"
      @submit="emit('saveDocument')"
    >
      <BsFloatingField v-if="view.isCredit" :label="copy.vat_original">
        <BsSelect :model-value="form.original" required native @update:model-value="updateForm('original', $event)">
          <BsSelectOption value="" />
          <BsSelectOption v-for="d in choices.originals" :key="d.value" :value="d.value">{{ d.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="copy.vat_reference">
        <BsInput :model-value="form.reference" :disabled="view.isReversal" required @update:model-value="updateForm('reference', $event)" />
      </BsFloatingField>
      <BsGrid :columns="2" gap="md">
        <BsFloatingField :label="copy.vat_documentDate">
          <BsInput :model-value="form.documentDate" type="date" required @update:model-value="updateForm('documentDate', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.vat_taxPointDate">
          <BsInput :model-value="form.taxPointDate" type="date" required @update:model-value="updateForm('taxPointDate', $event)" />
        </BsFloatingField>
      </BsGrid>
      <BsFloatingField :label="copy.vat_counterparty">
        <BsSelect :model-value="form.counterparty" :disabled="view.isReversal" native @update:model-value="updateForm('counterparty', $event)">
          <BsSelectOption value="" />
          <BsSelectOption v-for="c in choices.counterparties" :key="c.value" :value="c.value">{{ c.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="copy.vat_baseAccount">
        <BsSelect :model-value="form.baseAccount" :disabled="view.isReversal" required native @update:model-value="updateForm('baseAccount', $event)">
          <BsSelectOption value="" />
          <BsSelectOption v-for="a in choices.base" :key="a.value" :value="a.value">{{ a.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="copy.vat_grossAccount">
        <BsSelect :model-value="form.grossAccount" :disabled="view.isReversal" required native @update:model-value="updateForm('grossAccount', $event)">
          <BsSelectOption value="" />
          <BsSelectOption v-for="a in choices.gross" :key="a.value" :value="a.value">{{ a.label }}</BsSelectOption>
        </BsSelect>
      </BsFloatingField>
      <BsFloatingField :label="copy.vat_base">
        <BsInput
          id="vat-base"
          :model-value="form.base" inputmode="decimal"
          :disabled="view.isReversal"
          required
          :aria-invalid="Boolean(view.amountError)"
          :aria-describedby="view.amountError ? 'vat-base-error' : undefined"
          @update:model-value="updateForm('base', $event)"
          @blur="emit('validateAmount')"
        />
      </BsFloatingField>
      <BsText v-if="view.amountError" id="vat-base-error" role="alert" size="sm" tone="danger">{{ view.amountError }}</BsText>
      <BsText>{{ copy.vat_calculatedTax }}: <BsText as="span" dir="ltr">{{ view.previewTax }}</BsText></BsText>
      <BsFloatingField v-if="view.needsReason" :label="view.reasonLabel">
        <BsInput :model-value="form.reason" required @update:model-value="updateForm('reason', $event)" />
      </BsFloatingField>
    </BsRecordActionDialog>
  </BsStack>
</template>
