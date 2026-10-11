<script setup lang="ts">
import type { BsInventoryAccountingCopy, BsInventoryAccountingView, BsInventoryAccountingForm, BsInventoryAccountingChoices } from '../types/inventoryAccountingPresentation'
defineProps<{ copy: BsInventoryAccountingCopy; view: BsInventoryAccountingView; choices: BsInventoryAccountingChoices }>()
const asOf = defineModel<string>('asOf', { required: true })
const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<BsInventoryAccountingForm>('form', { required: true })
const emit = defineEmits<{ run: []; reload: []; begin: [mode: string]; save: []; page: [first: number] }>()
function updateForm(key: keyof BsInventoryAccountingForm, value: string | number | boolean | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader
      :title="copy.inventory_title"
      :subtitle="copy.inventory_policy"
      :context="view.context"
      :context-label="view.contextLabel"
    />
    <BsText role="note">{{ copy.inventory_boundary }}</BsText>
    <BsText v-if="!view.canRead" role="status">{{ copy.inventory_denied }}</BsText>
    <template v-else>
      <BsForm @submit.prevent="emit('run')">
        <BsFloatingField :label="copy.inventory_asOf">
          <BsInput v-model="asOf" type="date" required />
        </BsFloatingField>
        <BsButton type="submit" :disabled="view.pending">{{ copy.inventory_run }}</BsButton>
        <BsButton v-if="view.canConfigure" type="button" :disabled="view.configurationDisabled" @click="emit('begin', 'control')">{{ copy.inventory_newControl }}</BsButton>
        <BsButton v-if="view.canConfigure" type="button" :disabled="view.configurationDisabled" variant="primary" @click="emit('begin', 'source')">{{ copy.inventory_configure }}</BsButton>
      </BsForm>
      <BsText v-if="view.failed" role="alert" tone="danger">{{ copy.inventory_loadError }} <BsButton type="submit" @click="emit('reload')">{{ copy.common_retry }}</BsButton></BsText>
      <BsSectionSkeleton v-else-if="view.pending" variant="table" :rows="5" />
      <template v-else-if="view.available">
        <BsText v-if="!view.sources.length" role="status">{{ copy.inventory_noSource }}</BsText>
        <BsCard v-for="source in view.sources" :key="source.id" as="section" padding="md">
          <BsStack gap="md">
            <BsHeading :level="2" size="h2">{{ source.key }}</BsHeading>
            <BsText :data-inventory-status="source.status" :tone="source.tone">{{ source.statusLabel }}</BsText>
            <BsDescriptionList :columns="3">
              <BsBox v-for="metric in source.amounts" :key="metric.id">
                <BsDescriptionTerm>{{ metric.label }}</BsDescriptionTerm>
                <BsDescriptionValue>
                  <BsText as="span" dir="ltr">{{ metric.value }}</BsText>
                </BsDescriptionValue>
              </BsBox>
            </BsDescriptionList>
            <BsText size="sm" tone="muted">{{ copy.inventory_snapshot }}: {{ source.sequence }} · {{ copy.inventory_closingNote }}</BsText>
            <BsDescriptionList :columns="2">
              <BsBox>
                <BsDescriptionTerm>{{ copy.inventory_sourceId }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ source.id }}</BsDescriptionValue>
              </BsBox>
              <BsBox>
                <BsDescriptionTerm>{{ copy.inventory_actor }}</BsDescriptionTerm>
                <BsDescriptionValue>{{ source.actor }}</BsDescriptionValue>
              </BsBox>
            </BsDescriptionList>
          </BsStack>
        </BsCard>
        <BsCard as="section" padding="none" overflow="hidden">
          <BsHeading :level="2" size="h2">{{ copy.inventory_facts }}</BsHeading>
          <BsDataTable
            :value="view.facts"
            row-key="id"
            lazy
            paginator
            :rows="view.pageSize"
            :first="view.first"
            :total-records="view.total"
            :label="copy.inventory_facts"
            :columns="[{ key: 'accountingDate', field: 'accountingDate', header: copy.inventory_accountingDate }, { key: 'effectiveDate', field: 'effectiveDate', header: copy.inventory_effectiveDate }, { key: 'column3', header: copy.inventory_movement }, { key: 'column4', header: copy.inventory_valuation }, { key: 'column5', header: copy.inventory_inventoryDelta }, { key: 'column6', header: copy.inventory_cogsDelta }, { key: 'column7', header: copy.inventory_trace }]"
            @page="event => emit('page', event.first)"
          >
            <template #empty>{{ copy.inventory_empty }}</template>
            <template #cell-column3="{ row: fact }">
              <BsText as="span">{{ fact.movement }}</BsText>
              <BsText as="span" size="sm">{{ fact.kind }}</BsText>
            </template>
            <template #cell-column4="{ row: fact }">{{ fact.valuation }}<BsText as="span" size="sm">{{ fact.policy }}</BsText></template>
            <template #cell-column5="{ row: fact }">
              <BsText as="span" dir="ltr">{{ fact.inventory }}</BsText>
            </template>
            <template #cell-column6="{ row: fact }">
              <BsText as="span" dir="ltr">{{ fact.cogs }}</BsText>
            </template>
            <template #cell-column7="{ row: fact }">
              <BsLink :to="fact.journalTo">{{ fact.journal }}</BsLink>
              <BsText as="span" size="xs">{{ fact.id }}</BsText>
              <BsText v-if="fact.related" as="span" size="xs">{{ copy.inventory_related }}: {{ fact.related }}</BsText>
              <BsText as="span" size="sm">{{ fact.reason }}</BsText>
            </template>
          </BsDataTable>
        </BsCard>
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
      <BsFloatingField v-if="view.controlMode" :label="copy.inventory_controlName">
        <BsInput :model-value="form.name" required @update:model-value="updateForm('name', $event)" />
      </BsFloatingField>
      <template v-else>
        <BsText>{{ copy.inventory_setupPolicy }}</BsText>
        <BsFloatingField :label="copy.inventory_sourceKey">
          <BsInput :model-value="form.source" required :maxlength="view.sourceKeyMaxLength" @update:model-value="updateForm('source', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.inventory_actor">
          <BsInput :model-value="form.actor" required @update:model-value="updateForm('actor', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.inventory_effectiveDate">
          <BsInput :model-value="form.effective" type="date" required @update:model-value="updateForm('effective', $event)" />
        </BsFloatingField>
        <BsFloatingField :label="copy.inventory_control">
          <BsSelect :label="copy.inventory_control" :model-value="form.control" required native @update:model-value="updateForm('control', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in choices.controls" :key="a.value" :value="a.value">{{ a.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="copy.inventory_cogs">
          <BsSelect :label="copy.inventory_cogs" :model-value="form.cogs" required native @update:model-value="updateForm('cogs', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in choices.cogs" :key="a.value" :value="a.value">{{ a.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
        <BsFloatingField :label="copy.inventory_offset">
          <BsSelect :label="copy.inventory_offset" :model-value="form.offset" required native @update:model-value="updateForm('offset', $event)">
            <BsSelectOption value="" />
            <BsSelectOption v-for="a in choices.offsets" :key="a.value" :value="a.value">{{ a.label }}</BsSelectOption>
          </BsSelect>
        </BsFloatingField>
      </template>
    </BsRecordActionDialog>
  </BsStack>
</template>
