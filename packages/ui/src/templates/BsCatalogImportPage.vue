<script setup lang="ts">
import type { BsCatalogImportCopy, BsCatalogImportView, BsCatalogImportChoice } from '../types/catalogImportPresentation'
defineProps<{ copy: BsCatalogImportCopy; view: BsCatalogImportView; kindChoices: BsCatalogImportChoice[]; categoryChoices: BsCatalogImportChoice[] }>()
const kind = defineModel<string>('kind', { required: true })
const categoryOpen = defineModel<boolean>('categoryOpen', { required: true })
const categoryName = defineModel<string>('categoryName', { required: true })
const categoryFilter = defineModel<string>('categoryFilter', { required: true })
const reportFrom = defineModel<string>('reportFrom', { required: true })
const reportTo = defineModel<string>('reportTo', { required: true })
const emit = defineEmits<{ openCategory: []; saveCategory: []; downloadTemplate: []; file: [file: File | null]; validate: []; apply: []; exportLabels: []; reloadReport: [] }>()
function selectFile(value: File | File[] | null) { emit('file', Array.isArray(value) ? value[0] ?? null : value) }
</script>
<template>
  <BsStack>
    <BsBox as="header">
      <BsHeading :level="1">{{ copy.title }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ copy.subtitle }}</BsText>
    </BsBox>
    <BsSectionSkeleton v-if="view.contextLoading" variant="table" :rows="3" />
    <BsText v-else-if="!view.available" as="p" size="sm">{{ copy.noShop }}</BsText>
    <template v-else-if="view.available">
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.categories }}</BsHeading>
          <BsButton variant="primary" @click="emit('openCategory')">{{ copy.addCategory }}</BsButton>
        </BsInline>
        <BsInline>
          <BsText v-for="category in view.categories" :key="category.id" as="span">{{ category.name }}</BsText>
        </BsInline>
      </BsPanel>
      <BsRecordActionDialog v-model:visible="categoryOpen" :title="copy.addCategory" :dirty="view.categoryDirty" :pending="view.categoryPending" :error="view.categoryError" :submit-label="copy.addCategory" @submit="emit('saveCategory')">
        <BsField v-slot="field" :label="copy.categoryName">
          <BsInput :id="field.id" v-model="categoryName" :aria-describedby="field.describedby" :minlength="2" :maxlength="80" required/>
        </BsField>
      </BsRecordActionDialog>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.importTitle }}</BsHeading>
          <BsButton severity="secondary" @click="emit('downloadTemplate')">{{ copy.template }}</BsButton>
        </BsInline>
        <BsGrid :columns="2">
          <BsField v-slot="field" :label="copy.importTitle">
            <BsSelect v-model="kind" :input-id="field.id" :aria-describedby="field.describedby" :disabled="view.pending" :label="copy.importTitle" :options="kindChoices" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="copy.choose">
            <BsFileInput :input-id="field.id" :label="copy.choose" :describedby="field.describedby" :disabled="view.pending" accept=".csv,text/csv" @select="selectFile"/>
          </BsField>
        </BsGrid>
        <BsText v-if="view.filename" as="p" size="sm">{{ view.filename }} · {{ view.rowCount }}</BsText>
        <BsText v-if="view.error" role="alert" as="p" size="sm" tone="danger">{{ view.error }}</BsText>
        <BsInline>
          <BsButton severity="secondary" :disabled="!view.canValidate" @click="emit('validate')">{{ view.pending ? copy.validating : copy.validate }}</BsButton>
          <BsButton :pending="view.pending" :disabled="!view.canApply" @click="emit('apply')">{{ copy.apply }}</BsButton>
        </BsInline>
        <BsText v-if="view.resultLabel" role="status" as="p" size="sm">{{ view.resultLabel }}</BsText>
        <BsBox v-if="view.issues.length" scroll="x">
          <BsDataTable :value="view.issues" :columns="[{ key: 'row', header: copy.row, field: 'row' }, { key: 'field', header: copy.field, field: 'field' }, { key: 'code', header: copy.issue, field: 'code' }]"/>
        </BsBox>
      </BsPanel>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.report }}</BsHeading>
          <BsButton severity="secondary" :pending="view.exporting" @click="emit('exportLabels')">{{ copy.labels }}</BsButton>
        </BsInline>
        <BsGrid :columns="3">
          <BsField v-slot="field" :label="copy.category">
            <BsSelect v-model="categoryFilter" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.category" :options="categoryChoices" option-label="label" option-value="value" option-disabled="disabled"/>
          </BsField>
          <BsField v-slot="field" :label="copy.from">
            <BsInput :id="field.id" v-model="reportFrom" :aria-describedby="field.describedby" type="date"/>
          </BsField>
          <BsField v-slot="field" :label="copy.to">
            <BsInput :id="field.id" v-model="reportTo" :aria-describedby="field.describedby" type="date"/>
          </BsField>
        </BsGrid>
        <BsSectionSkeleton v-if="view.reportPending" variant="table" :rows="3" />
        <BsBox v-else-if="view.reportError" role="alert">{{ copy.reportError }} <BsButton @click="emit('reloadReport')">{{ copy.retry }}</BsButton>
        </BsBox>
        <BsBox v-else scroll="x">
          <BsDataTable :value="view.reportRows" :columns="[{ key: 'name', header: copy.item, field: 'name' }, { key: 'category', header: copy.category, field: 'category' }, { key: 'quantity', header: copy.quantity, field: 'quantity' }, { key: 'column3', header: copy.amount }]">
            <template #cell-column3="{ row: data }">{{ data.amount }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.noData }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
    </template>
  </BsStack>
</template>
