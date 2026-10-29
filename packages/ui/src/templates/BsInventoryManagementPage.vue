<script setup lang="ts">
import type { BsInventoryCopy, BsInventoryView, BsInventoryEditor, BsInventoryStockRow, BsInventoryMovementRow, BsInventoryCountRow, BsInventoryAdjustmentForm, BsInventoryCountForm } from '../types/inventoryPresentation'
defineProps<{ physicalStockTo?: string; text: BsInventoryCopy; view: BsInventoryView; rows: BsInventoryStockRow[]; movementRows: BsInventoryMovementRow[]; countRows: BsInventoryCountRow[]; productOptions: { id: string; name: string }[]; adjustmentEditor: BsInventoryEditor; countEditor: BsInventoryEditor; thresholdEditor: BsInventoryEditor }>()
const adjustmentForm = defineModel<BsInventoryAdjustmentForm>('adjustmentForm', { required: true })
const countForm = defineModel<BsInventoryCountForm>('countForm', { required: true })
const thresholdValue = defineModel<number>('thresholdValue', { required: true })
const lowOnly = defineModel<boolean>('lowOnly', { required: true })
const adjustmentOpen = defineModel<boolean>('adjustmentOpen', { required: true })
const countOpen = defineModel<boolean>('countOpen', { required: true })
const thresholdOpen = defineModel<boolean>('thresholdOpen', { required: true })
const historyProductId = defineModel<string>('historyProductId', { required: true })
const historyPage = defineModel<number>('historyPage', { required: true })
const countsPage = defineModel<number>('countsPage', { required: true })
const emit = defineEmits<{ retryAccess: []; retry: []; retryHistory: []; saveAdjustment: []; saveCount: []; saveThreshold: []; count: [id: string]; threshold: [id: string]; adjust: [mode: 'receive' | 'writeoff'] }>()
</script>
<template>
  <BsStack gap="lg">
    <BsPageHeader :title="text.title" :subtitle="text.subtitle"><template #actions><BsLink v-if="physicalStockTo && view.canView" :to="physicalStockTo">{{ text.physicalStock }}</BsLink></template></BsPageHeader>
    <BsPanel v-if="!view.available && !view.loadingContext" padding="md">
      <BsText as="p">{{ text.noShop }}</BsText>
      <BsLink to="/dashboard">{{ text.dashboard }}</BsLink>
    </BsPanel>
    <template v-else-if="view.available">
      <BsStateSurface v-if="view.accessError" state="error" :title="text.loadError" :action-label="text.retry" @action="emit('retryAccess')" />
      <BsStateSurface v-else-if="view.accessLoading" state="loading" :title="text.loading" />
      <BsStateSurface v-else-if="!view.canView" state="denied" :title="text.denied" />
      <template v-else>
        <BsText v-if="view.planNotice" as="p" size="sm" tone="warning">{{ text.plan }}</BsText>
        <BsMetricGrid v-if="!view.loading && !view.error" :columns="2">
          <BsKpiCard :title="text.totalValue" :value="view.valuation" icon="store" />
          <BsKpiCard :title="text.lowCount" :value="view.lowCount" icon="ledger" />
        </BsMetricGrid>
        <BsInline justify="between">
          <BsInline>
            <BsButton variant="chip" :aria-pressed="!lowOnly" @click="lowOnly = false">{{ text.all }}</BsButton>
            <BsButton variant="chip" :aria-pressed="lowOnly" @click="lowOnly = true">{{ text.lowOnly }}</BsButton>
          </BsInline>
          <BsInline v-if="view.canAdjust && !view.loading && !view.error">
            <BsButton @click="emit('adjust', 'receive')">{{ text.receive }}</BsButton>
            <BsButton @click="emit('adjust', 'writeoff')">{{ text.writeoff }}</BsButton>
          </BsInline>
        </BsInline>
        <BsPanel padding="md">
          <BsDataTable :value="rows" paginator :rows="20" data-key="id" :loading="view.loading" :error="view.error || null" :label="text.title" :columns="[{ key: 'column0', header: (text.product) }, { key: 'column1', header: (text.onHand), align: 'end' }, { key: 'column2', header: (text.threshold), align: 'end' }, { key: 'column3', header: (text.value), align: 'end' }, { key: 'column4', header: (text.actions), align: 'end' }]" @retry="emit('retry')">
            <template #cell-column0="{ row: row }">
              <BsText as="p" emphasis="semibold">{{ row.name }} <BsText v-if="row.archived" as="span" size="xs" tone="muted">({{ text.archived }})</BsText>
              </BsText>
              <BsText v-if="row.sku" as="p" size="xs" tone="muted">{{ row.sku }}</BsText>
            </template>
            <template #cell-column1="{ row: row }">
              <BsText as="span">{{ row.quantity }}</BsText>
              <BsText v-if="row.low" as="span" size="xs">{{ text.low }}</BsText>
            </template>
            <template #cell-column2="{ row: row }">{{ row.threshold }}</template>
            <template #cell-column3="{ row: row }">{{ row.value }}</template>
            <template #cell-column4="{ row: row }">
              <BsText as="span">
                <BsButton variant="link" @click="historyProductId = row.id">{{ text.history }}</BsButton>
                <BsButton v-if="row.canCount" variant="link" @click="emit('count', row.id)">{{ text.count }}</BsButton>
                <BsButton v-if="row.canThreshold" variant="link" @click="emit('threshold', row.id)">{{ text.setThreshold }}</BsButton>
              </BsText>
            </template>
            <template #empty>
              <BsBox padding="md">
                <BsText as="p">{{ text.noProducts }}</BsText>
                <BsLink to="/products">{{ text.products }}</BsLink>
              </BsBox>
            </template>
          </BsDataTable>
        </BsPanel>
        <BsText as="p" size="xs" tone="muted">{{ text.archivedHint }}</BsText>
        <BsPanel v-if="view.historyName" padding="md">
          <BsInline justify="between">
            <BsBox>
              <BsHeading :level="2">{{ view.historyName }}</BsHeading>
              <BsText as="p" size="sm" tone="muted">{{ text.history }}</BsText>
            </BsBox>
            <BsButton @click="historyProductId = ''">{{ text.close }}</BsButton>
          </BsInline>
          <BsText v-if="view.historyError" role="alert" as="p" size="sm">{{ text.loadError }} <BsButton variant="link" @click="emit('retryHistory')">{{ text.retry }}</BsButton>
          </BsText>
          <BsBox scroll="x">
            <BsHeading :level="3">{{ text.movements }}</BsHeading>
            <BsDataTable :value="movementRows" :label="text.movements" lazy paginator :rows="view.historyPageSize" :first="(historyPage - 1) * view.historyPageSize" :total-records="view.movementsTotal" :loading="view.movementsLoading" data-key="id" :columns="[{ key: 'column0', header: (text.date) }, { key: 'column1', header: (text.source) }, { key: 'column2', header: (text.quantity), align: 'end' }, { key: 'column3', header: (text.value), align: 'end' }, { key: 'column4', header: (text.actor) }]" @page="historyPage = $event.page + 1">
              <template #cell-column0="{ row: event }">{{ event.date }}</template>
              <template #cell-column1="{ row: event }">
                <BsText as="p" emphasis="semibold">{{ event.source }}</BsText>
                <BsText as="p" size="xs" tone="muted">{{ event.reference }}<template v-if="event.reason"> · {{ event.reason }}</template>
                </BsText>
              </template>
              <template #cell-column2="{ row: event }">{{ event.quantity }}</template>
              <template #cell-column3="{ row: event }">{{ event.value }}</template>
              <template #cell-column4="{ row: event }">{{ event.actor }}</template>
              <template #empty>
                <BsText as="p" size="sm" tone="muted">{{ text.emptyHistory }}</BsText>
              </template>
            </BsDataTable>
          </BsBox>
          <BsBox scroll="x">
            <BsHeading :level="3">{{ text.counts }}</BsHeading>
            <BsDataTable :value="countRows" :label="text.counts" :loading="view.countsLoading" lazy paginator :rows="view.historyPageSize" :first="(countsPage - 1) * view.historyPageSize" :total-records="view.countsTotal" data-key="id" :columns="[{ key: 'column0', header: (text.date) }, { key: 'column1', header: (text.reference) }, { key: 'column2', header: (text.expected), align: 'end' }, { key: 'column3', header: (text.counted), align: 'end' }, { key: 'column4', header: (text.variance), align: 'end' }]" @page="countsPage = $event.page + 1">
              <template #cell-column0="{ row: event }">{{ event.date }}</template>
              <template #cell-column1="{ row: event }">
                <BsText as="p" emphasis="semibold">{{ event.reference }}</BsText>
                <BsText as="p" size="xs" tone="muted">{{ event.reason }}</BsText>
              </template>
              <template #cell-column2="{ row: event }">{{ event.expected }}</template>
              <template #cell-column3="{ row: event }">{{ event.counted }}</template>
              <template #cell-column4="{ row: event }">{{ event.variance }}</template>
            </BsDataTable>
          </BsBox>
        </BsPanel>
      </template>
    </template>
    <BsRecordActionDialog v-model:visible="adjustmentOpen" :title="view.adjustmentTitle" :dirty="adjustmentEditor.dirty" :pending="adjustmentEditor.pending" :error="view.actionError" :submit-label="text.save" @submit="emit('saveAdjustment')">
      <BsGrid :columns="2">
        <BsField v-slot="field" :label="text.product">
          <BsSelect :model-value="adjustmentForm.productId" :input-id="field.id" :aria-describedby="field.describedby" :label="text.product" :options="productOptions" option-label="name" option-value="id" filter virtual :aria-required="true" :disabled="adjustmentEditor.pending" @update:model-value="adjustmentForm = { ...adjustmentForm, productId: String($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="adjustmentEditor.unit ? `${text.quantity} (${adjustmentEditor.unit})` : text.quantity">
          <BsInput :id="field.id" :model-value="adjustmentForm.quantity" :aria-describedby="field.describedby" type="number" :min="adjustmentEditor.quantityStep ?? 0.01" :max="1000000" :step="adjustmentEditor.quantityStep ?? 0.01" required @update:model-value="adjustmentForm = { ...adjustmentForm, quantity: Number($event) }"/>
        </BsField>
        <BsField v-if="view.receive" v-slot="field" :label="text.unitCost">
          <BsInput :id="field.id" :model-value="adjustmentForm.unitCost" :aria-describedby="field.describedby" type="number" :min="0" :step="adjustmentEditor.costStep ?? 0.01" required @update:model-value="adjustmentForm = { ...adjustmentForm, unitCost: Number($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="text.reason">
          <BsInput :id="field.id" :model-value="adjustmentForm.reason" :aria-describedby="field.describedby" :maxlength="500" :required="!view.receive" @update:model-value="adjustmentForm = { ...adjustmentForm, reason: String($event) }"/>
        </BsField>
      </BsGrid>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="countOpen" :title="text.count" :dirty="countEditor.dirty" :pending="countEditor.pending" :error="view.actionError" :submit-label="text.save" @submit="emit('saveCount')">
      <BsBox>
        <BsText as="p" emphasis="semibold">{{ view.countProduct }}</BsText>
        <BsText as="p" tone="muted">{{ text.expected }}: {{ view.countExpected }} · {{ text.variance }}: {{ view.countVariance }}</BsText>
      </BsBox>
      <BsGrid :columns="2">
        <BsField v-slot="field" :label="countEditor.unit ? `${text.counted} (${countEditor.unit})` : text.counted">
          <BsInput :id="field.id" :model-value="countForm.quantity" :aria-describedby="field.describedby" type="number" :min="0" :max="1000000" :step="countEditor.quantityStep ?? 0.01" required @update:model-value="countForm = { ...countForm, quantity: Number($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="text.countedAt">
          <BsInput :id="field.id" :model-value="countForm.date" :aria-describedby="field.describedby" type="datetime-local" required @update:model-value="countForm = { ...countForm, date: String($event) }"/>
        </BsField>
        <BsField v-if="view.positiveVariance" v-slot="field" :label="text.positiveCost">
          <BsInput :id="field.id" :model-value="countForm.unitCost" :aria-describedby="field.describedby" type="number" :min="0" :step="countEditor.costStep ?? 0.01" required @update:model-value="countForm = { ...countForm, unitCost: Number($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="text.reference">
          <BsInput :id="field.id" :model-value="countForm.reference" :aria-describedby="field.describedby" :maxlength="200" required @update:model-value="countForm = { ...countForm, reference: String($event) }"/>
        </BsField>
        <BsField v-slot="field" :label="text.reason">
          <BsTextarea :id="field.id" :model-value="countForm.reason" :aria-describedby="field.describedby" :minlength="3" :maxlength="500" :rows="2" required @update:model-value="countForm = { ...countForm, reason: String($event) }"/>
        </BsField>
      </BsGrid>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="thresholdOpen" :title="text.setThreshold" :dirty="thresholdEditor.dirty" :pending="thresholdEditor.pending" :error="view.actionError" :submit-label="text.save" @submit="emit('saveThreshold')">
      <BsField v-slot="field" :label="thresholdEditor.unit ? `${text.threshold} (${thresholdEditor.unit})` : text.threshold">
        <BsInput :id="field.id" :model-value="thresholdValue" :aria-describedby="field.describedby" type="number" :min="0" :max="1000000" :step="thresholdEditor.quantityStep ?? 0.01" required @update:model-value="thresholdValue = Number($event)"/>
      </BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>
