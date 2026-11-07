<script setup lang="ts">
import type { BsSalesDirectoryCopy, BsSalesDirectoryView, BsSalesDirectoryRow, BsSalesChoice, BsSalesDraftForm, BsSalesDraftLine, BsSalesLineView } from '../types/salesDirectoryPresentation'
defineProps<{ copy: BsSalesDirectoryCopy; view: BsSalesDirectoryView; rows: BsSalesDirectoryRow[]; statusOptions: BsSalesChoice[]; customerOptions: BsSalesChoice[]; paymentOptions: BsSalesChoice[]; lineTypeOptions: BsSalesChoice[]; lineViews: BsSalesLineView[] }>()
const form = defineModel<BsSalesDraftForm>('form', { required: true })
const search = defineModel<string>('search', { required: true })
const status = defineModel<string>('status', { required: true })
const fromDate = defineModel<string>('fromDate', { required: true })
const toDate = defineModel<string>('toDate', { required: true })
const page = defineModel<number>('page', { required: true })
const editorOpen = defineModel<boolean>('editorOpen', { required: true })
const emit = defineEmits<{ create: []; retry: []; retryCatalog: []; save: []; issue: []; fastPay: []; addLine: []; removeLine: [index: number]; lineType: [index: number, value: string]; edit: [id: string]; page: [value: number] }>()
function updateForm(values: Partial<BsSalesDraftForm>) { form.value = { ...form.value, ...values } }
function updateLine(index: number, values: Partial<BsSalesDraftLine>) { updateForm({ lines: form.value.lines.map((line, i) => i === index ? { ...line, ...values } : line) }) }
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsButton v-if="view.available && view.canManage" type="button" :disabled="view.catalogLoading" @click="emit('create')">{{ copy.newSale }}</BsButton>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!view.available && !view.loadingContext" padding="md">{{ copy.noShop }}</BsPanel>
    <template v-else-if="view.available">
      <BsText v-if="view.denied" role="alert" as="p" size="sm" tone="warning">{{ copy.permissionDenied }}</BsText>
      <BsText v-else-if="!view.canManage" as="p" size="sm">{{ copy.manageDenied }}</BsText>
      <BsText as="p" size="sm">{{ copy.paymentBoundary }}</BsText>
      <BsPanel v-if="!view.denied" padding="md">
        <BsGrid :columns="4">
          <BsField v-slot="field" :label="copy.search"><BsInput :id="field.id" v-model="search" type="search" :placeholder="copy.search" :aria-describedby="field.describedby" /></BsField>
          <BsField v-slot="field" :label="copy.status"><BsSelect v-model="status" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.status" :options="statusOptions" option-label="label" option-value="value" option-disabled="disabled" /></BsField>
          <BsField v-slot="field" :label="(copy.from)">
            <BsInput :id="field.id" v-model="fromDate" :aria-describedby="field.describedby" type="date"/>
          </BsField>
          <BsField v-slot="field" :label="(copy.to)">
            <BsInput :id="field.id" v-model="toDate" :aria-describedby="field.describedby" type="date"/>
          </BsField>
        </BsGrid>
        <BsDataTable :value="rows" :loading="view.loading" :error="view.error || null" :label="copy.title" data-key="id" lazy paginator :rows="view.pageSize" :first="(page - 1) * view.pageSize" :total-records="view.total" :always-show-paginator="false" :columns="[{ key: 'column0', header: (copy.invoiceNumber) }, { key: 'column1', header: (copy.customer) }, { key: 'column2', header: (copy.status) }, { key: 'column3', header: (copy.total), align: 'end' }, { key: 'column4', header: (copy.date), align: 'end' }]" @page="emit('page', $event.page + 1)" @retry="emit('retry')">
          <template #cell-column0="{ row: sale }">
            <BsLink :to="sale.href">{{ sale.number }}</BsLink>
            <BsText as="p" size="xs" tone="muted">{{ sale.lineCount }}</BsText>
          </template>
          <template #cell-column1="{ row: sale }">{{ sale.customer }}</template>
          <template #cell-column2="{ row: sale }">
            <BsStatusBadge :status="sale.status" :label="sale.status" :tone="sale.statusTone ?? 'neutral'" :icon="false" />
          </template>
          <template #cell-column3="{ row: sale }">{{ sale.total }}</template>
          <template #cell-column4="{ row: sale }">
            <BsText as="p">{{ sale.date }}</BsText>
            <BsButton v-if="sale.editable" variant="link" type="button" @click="emit('edit', sale.id)">{{ copy.edit }}</BsButton>
          </template>
          <template #empty>
            <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
          </template>
        </BsDataTable>
      </BsPanel>
    </template>
    <BsText v-if="view.errorMessage && !editorOpen" role="alert" as="p">{{ view.errorMessage }}</BsText>
    <BsRecordActionDialog v-model:visible="editorOpen" :title="view.editing ? copy.editDraft : copy.newSale" :dirty="view.dirty" :pending="view.saving || view.issuing" :error="view.errorMessage" size="lg" @submit="emit('save')">
      <BsFieldGroup :disabled="Boolean(view.locked)" :legend="copy.lines">
      <BsText v-if="view.catalogError" role="alert" as="p">{{ copy.catalogError }} <BsButton @click="emit('retryCatalog')">{{ copy.retry }}</BsButton>
      </BsText>
      <BsGrid :columns="2">
        <BsField v-slot="field" :label="(copy.customer)">
          <BsSelect :model-value="form.customerId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.customer" :options="customerOptions" option-label="label" option-value="value" filter virtual :disabled="view.catalogLoading || view.saving || view.issuing" @update:model-value="value => updateForm({ customerId: String(value ?? '') })"/>
        </BsField>
        <BsField v-slot="field" :label="(copy.dueDate)">
          <BsInput :id="field.id" :model-value="form.dueDate" :aria-describedby="field.describedby" type="date" :disabled="!form.customerId" @update:model-value="value => updateForm({ dueDate: String(value ?? '') })"/>
        </BsField>
        <BsField v-slot="field" :label="(copy.notes)">
          <BsInput :id="field.id" :model-value="form.notes" :aria-describedby="field.describedby" :maxlength="2000" @update:model-value="value => updateForm({ notes: String(value ?? '') })"/>
        </BsField>
      </BsGrid>
      <BsGrid v-if="!form.customerId" :columns="2">
        <BsText as="p" size="sm">{{ copy.customerlessNotice }}</BsText>
        <BsField v-slot="field" :label="copy.paymentMethod">
          <BsSelect :model-value="form.paymentMethod" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.paymentMethod" :options="paymentOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="value => updateForm({ paymentMethod: String(value ?? '') })"/>
        </BsField>
        <BsField v-slot="field" :label="(copy.paymentReference)">
          <BsInput :id="field.id" :model-value="form.paymentReference" :aria-describedby="field.describedby" :maxlength="200" @update:model-value="value => updateForm({ paymentReference: String(value ?? '') })"/>
        </BsField>
      </BsGrid>
      <BsStack>
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.lines }}</BsHeading>
          <BsButton type="button" @click="emit('addLine')">{{ copy.addLine }}</BsButton>
        </BsInline>
        <BsGrid v-for="(line, index) in form.lines" :key="line.key" :columns="2">
          <BsField v-slot="field" :label="(copy.lines)">
            <BsSelect :model-value="line.itemType" :input-id="field.id" :aria-describedby="field.describedby" :label="(copy.lines)" :options="lineTypeOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="value => emit('lineType', index, String(value))"/>
          </BsField>
          <BsField v-slot="field" :label="(copy.item)">
            <BsSelect :model-value="line.sourceId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.item" :options="lineViews[index]?.options ?? []" option-label="label" option-value="value" :placeholder="copy.selectItem" :invalid="Boolean(view.errorMessage) && !line.sourceId" :aria-required="true" :disabled="view.catalogLoading || view.saving || view.issuing" filter virtual @update:model-value="value => updateLine(index, { sourceId: String(value ?? '') })"/>
          </BsField>
          <BsField v-if="lineViews[index]?.unitChoices" v-slot="field" :label="copy.unit || copy.quantity"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="line.unitSelection" :label="copy.unit || copy.quantity" :options="lineViews[index]?.unitChoices" option-label="label" option-value="value" :disabled="view.saving || view.issuing || view.locked" @update:model-value="value => updateLine(index, { unitSelection: String(value) })" /></BsField>
          <BsPriceApprovalFields v-if="lineViews[index]?.pricing" :approval="lineViews[index]!.pricing!" :record-id="line.key" :disabled="view.saving || view.issuing || view.locked" @price="updateLine(index, { overridePrice: $event })" @reason="updateLine(index, { overrideReason: $event })" />
          <BsText v-if="lineViews[index]?.baseEquivalent" size="sm" tone="muted">{{ lineViews[index]?.baseEquivalent }}</BsText>
          <BsCheckbox v-if="lineViews[index]?.physical?.canSplit" :model-value="line.allowSplit ?? false" :label="copy.physicalSplit" :disabled="view.saving || view.issuing || view.locked" @update:model-value="updateLine(index, { allowSplit: Boolean($event) })" />
          <BsField v-if="lineViews[index]?.physical?.canSplit" v-slot="field" :label="`${copy.physicalLoss} (${lineViews[index]?.physical?.unit})`" :hint="copy.physicalLossHelp"><BsInput :id="field.id" :aria-describedby="field.describedby" :model-value="line.cuttingLoss || '0'" inputmode="decimal" :disabled="view.saving || view.issuing || view.locked" @update:model-value="updateLine(index, { cuttingLoss: String($event) })" /></BsField>
          <BsField v-slot="field" :label="(copy.quantity)">
            <BsInput :id="field.id" :model-value="line.quantity" :aria-describedby="field.describedby" type="number" :min="lineViews[index]?.quantityStep ?? 0.001" :max="1000000" :step="lineViews[index]?.quantityStep ?? 0.001" required @update:model-value="value => updateLine(index, { quantity: Number(value) })"/>
          </BsField>
          <BsBox>
            <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.lineTotal }}</BsText>
            <BsText as="p" emphasis="semibold">{{ lineViews[index]?.total }}</BsText>
            <BsText v-if="lineViews[index]?.discount" as="p" size="xs" tone="muted">{{ copy.discount }}: {{ lineViews[index]?.discount }}</BsText>
          </BsBox>
          <BsInline>
            <BsButton type="button" :disabled="form.lines.length === 1" @click="emit('removeLine', index)">{{ copy.removeLine }}</BsButton>
          </BsInline>
        </BsGrid>
      </BsStack>
      <BsBox padding="md">
        <BsText as="p" size="sm">{{ copy.previewNotice }}</BsText>
        <BsText as="p" size="sm">{{ copy.stockNotice }}</BsText>
        <BsText as="p" size="lg" emphasis="semibold">{{ copy.total }}: {{ view.previewTotal }}</BsText>
      </BsBox>
      </BsFieldGroup>
      <BsText v-if="view.locked" role="status">{{ copy.fastPayRetry }}</BsText>
      <template #actions="{ close }">
        <BsButton v-if="view.canFastPay" type="button" variant="primary" :pending="view.issuing" :disabled="view.saving || view.issuing" @click="emit('fastPay')">{{ copy.fastPay }}</BsButton>
        <BsButton type="submit" :disabled="view.saving || view.issuing || Boolean(view.locked)">{{ view.saving ? copy.saving : copy.saveDraft }}</BsButton>
        <BsButton v-if="view.canIssue" type="button" variant="primary" :disabled="view.saving || view.issuing || Boolean(view.locked)" @click="emit('issue')">{{ view.issuing ? copy.issuing : copy.issueLabel }}</BsButton>
        <BsButton type="button" :disabled="view.saving || view.issuing" @click="close">{{ copy.cancel }}</BsButton>
      </template>
    </BsRecordActionDialog>
  </BsStack>
</template>
