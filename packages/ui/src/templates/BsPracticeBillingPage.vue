<script setup lang="ts">
import { computed } from 'vue'
import type { BsPracticeBillingLabel, BsPracticeBillingView, BsBillingPriceFields, BsBillingChargeFields } from '../utils/practiceBillingPresentation'
const props = defineProps<{ copy: Record<BsPracticeBillingLabel, string>; view: BsPracticeBillingView }>()
const priceFields = defineModel<BsBillingPriceFields>('priceFields', { required: true })
const chargeFields = defineModel<BsBillingChargeFields>('chargeFields', { required: true })
const locationId = defineModel<string | null>('locationId', { required: true })
const emit = defineEmits<{ retry: []; retryOperation: []; createPrice: []; editPrice: [id: string]; createCharge: []; correctCharge: [id: string]; savePrice: []; saveCharge: []; priceVisible: [value: boolean]; chargeVisible: [value: boolean]; locationPage: [page: number]; page: [kind: 'prices' | 'charges' | 'visits', page: number]; history: [id: string]; closeHistory: []; previousHistory: []; nextHistory: [] }>()
const priceColumns = computed(() => [{ key: 'label', field: 'label', header: props.copy.label }, { key: 'amount', field: 'amount', header: props.copy.amount }, { key: 'version', field: 'version', header: props.copy.version }, { key: 'effectiveAt', field: 'effectiveAt', header: props.copy.effectiveAt }])
const chargeColumns = computed(() => [{ key: 'visit', field: 'visit', header: props.copy.visit }, { key: 'service', field: 'service', header: props.copy.service }, { key: 'amount', field: 'amount', header: props.copy.amount }, { key: 'version', field: 'version', header: props.copy.version }, { key: 'history', header: props.copy.history }, { key: 'payments', header: props.copy.payments }])
function previous(page: { page: number }) { return page.page < 2 || props.view.loading || props.view.pending }
function next(page: { page: number; total: number; size: number }) { return page.page * page.size >= page.total || props.view.loading || props.view.pending }
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="view.practiceName"><template #actions><BsButton :disabled="view.pending || view.loading" @click="emit('retry')">{{ copy.retry }}</BsButton></template></BsPageHeader>
  <BsAlert tone="info" :description="copy.notice" />
  <BsAlert v-if="view.uncertain" tone="warning" :description="copy.uncertain" />
  <BsButton v-if="view.uncertain" :disabled="view.pending || view.loading" @click="emit('retryOperation')">{{ copy.retryOperation }}</BsButton>
  <BsAlert v-if="view.error" tone="error" :description="view.error" />
  <BsStateSurface v-if="view.denied" state="permission" :title="copy.denied" />
  <template v-else>
   <BsField v-slot="field" :label="copy.location"><BsSelect :id="field.id" v-model="locationId" :label="copy.location" :options="view.locations" option-label="label" option-value="value" :disabled="view.pending || view.loading || view.uncertain" /></BsField>
   <BsInline><BsButton :disabled="previous(view.locationPage) || view.uncertain" @click="emit('locationPage', view.locationPage.page - 1)">{{ copy.previous }}</BsButton><BsText>{{ view.locationPage.page }}</BsText><BsButton :disabled="next(view.locationPage) || view.uncertain" @click="emit('locationPage', view.locationPage.page + 1)">{{ copy.next }}</BsButton></BsInline>
   <BsStateSurface v-if="view.loading" state="loading" :title="copy.loading" />
   <template v-else-if="view.ready">
    <BsAlert v-if="view.readOnly" tone="info" :description="copy.readOnly" />
    <BsHeading :level="2">{{ copy.prices }}</BsHeading>
    <BsDataTable :value="view.priceRows" :columns="priceColumns" row-key="id" :label="copy.prices" :capabilities="{ insert: view.canWrite, edit: view.canWrite }" :action-labels="{ insert: copy.createPrice, edit: copy.editPrice }" :row-action-pending="view.pending || view.uncertain || view.loading" @create="emit('createPrice')" @edit="emit('editPrice', $event.id)"><template #cell-amount="{ row }"><BsText as="bdi" dir="ltr">{{ row.amount }}</BsText></template><template #empty><BsEmptyState :title="copy.empty" /></template></BsDataTable>
    <BsInline><BsButton :disabled="previous(view.pricePage)" @click="emit('page', 'prices', view.pricePage.page - 1)">{{ copy.previous }}</BsButton><BsText>{{ view.pricePage.page }}</BsText><BsButton :disabled="next(view.pricePage)" @click="emit('page', 'prices', view.pricePage.page + 1)">{{ copy.next }}</BsButton></BsInline>
    <BsHeading :level="2">{{ copy.charges }}</BsHeading>
    <BsDataTable :value="view.chargeRows" :columns="chargeColumns" row-key="id" :label="copy.charges" :capabilities="{ insert: view.canWrite, edit: view.canWrite }" :action-labels="{ insert: copy.createCharge, edit: copy.correctCharge }" :row-action-pending="view.pending || view.uncertain || view.loading" @create="emit('createCharge')" @edit="emit('correctCharge', $event.id)"><template #cell-payments="{ row }"><BsLink :to="row.moneyHref">{{ copy.payments }}</BsLink></template><template #cell-history="{ row }"><BsButton :disabled="view.pending" @click="emit('history', row.id)">{{ copy.history }}</BsButton></template><template #cell-amount="{ row }"><BsText as="bdi" dir="ltr">{{ row.amount }}</BsText></template><template #empty><BsEmptyState :title="copy.empty" /></template></BsDataTable>
    <BsInline><BsButton :disabled="previous(view.chargePage)" @click="emit('page', 'charges', view.chargePage.page - 1)">{{ copy.previous }}</BsButton><BsText>{{ view.chargePage.page }}</BsText><BsButton :disabled="next(view.chargePage)" @click="emit('page', 'charges', view.chargePage.page + 1)">{{ copy.next }}</BsButton></BsInline>
   </template>
  </template>
  <BsRecordActionDialog :visible="view.priceEditor.visible" :title="view.priceEditor.title" :dirty="view.priceEditor.dirty" :pending="view.pending" :error="view.error" :submit-disabled="view.priceEditor.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @update:visible="emit('priceVisible', $event)" @submit="emit('savePrice')">
   <BsField v-slot="field" :label="copy.label" required><BsInput :id="field.id" v-model="priceFields.label" :disabled="view.uncertain" required maxlength="160" /></BsField>
   <BsField v-slot="field" :label="copy.amount" required><BsInput :id="field.id" v-model="priceFields.amount" :disabled="view.uncertain" required inputmode="decimal" /></BsField>
   <BsField v-slot="field" :label="copy.currency" required><BsInput :id="field.id" v-model="priceFields.currency" :disabled="view.uncertain" required maxlength="3" /></BsField>
   <BsField v-slot="field" :label="copy.exponent" required><BsSelect :id="field.id" v-model="priceFields.exponent" :disabled="view.uncertain" :label="copy.exponent" :options="['0','1','2','3','4']" required /></BsField>
   <BsText as="p">{{ copy.precisionHelp }}</BsText>
   <BsAlert v-if="view.uncertain" tone="warning" :description="copy.uncertain" /><BsButton v-if="view.uncertain" :disabled="view.pending" @click="emit('retryOperation')">{{ copy.retryOperation }}</BsButton>
  </BsRecordActionDialog>
  <BsRecordActionDialog :visible="view.chargeEditor.visible" :title="view.chargeEditor.title" :dirty="view.chargeEditor.dirty" :pending="view.pending" :error="view.chargeEditor.error || view.error" :submit-disabled="view.chargeEditor.disabled" :submit-label="copy.save" :cancel-label="copy.cancel" @update:visible="emit('chargeVisible', $event)" @submit="emit('saveCharge')">
   <BsField v-slot="field" :label="copy.service" required><BsSelect :id="field.id" v-model="chargeFields.priceId" :label="copy.service" :options="view.priceOptions" option-label="label" option-value="value" required :disabled="view.uncertain" /></BsField>
   <BsInline><BsButton :disabled="previous(view.pricePage) || view.uncertain" @click="emit('page', 'prices', view.pricePage.page - 1)">{{ copy.previous }}</BsButton><BsText>{{ view.pricePage.page }}</BsText><BsButton :disabled="next(view.pricePage) || view.uncertain" @click="emit('page', 'prices', view.pricePage.page + 1)">{{ copy.next }}</BsButton></BsInline>
   <BsField v-slot="field" :label="copy.visit" required><BsSelect :id="field.id" v-model="chargeFields.visitId" :label="copy.visit" :options="view.visitOptions" option-label="label" option-value="value" required :disabled="view.chargeEditor.correcting || view.uncertain" /></BsField>
   <BsInline v-if="!view.chargeEditor.correcting"><BsButton :disabled="previous(view.visitPage) || view.uncertain" @click="emit('page', 'visits', view.visitPage.page - 1)">{{ copy.previous }}</BsButton><BsText>{{ view.visitPage.page }}</BsText><BsButton :disabled="next(view.visitPage) || view.uncertain" @click="emit('page', 'visits', view.visitPage.page + 1)">{{ copy.next }}</BsButton></BsInline>
   <BsField v-slot="field" :label="copy.quantity" required><BsInput :id="field.id" v-model="chargeFields.quantity" :disabled="view.uncertain" required type="number" min="1" max="1000" step="1" /></BsField>
   <BsField v-slot="field" :label="copy.reason" required><BsTextarea :id="field.id" v-model="chargeFields.reason" :disabled="view.uncertain" required minlength="2" maxlength="500" /></BsField>
   <BsAlert v-if="view.uncertain" tone="warning" :description="copy.uncertain" /><BsButton v-if="view.uncertain" :disabled="view.pending" @click="emit('retryOperation')">{{ copy.retryOperation }}</BsButton>
  </BsRecordActionDialog>
  <BsDialog :visible="view.history.visible" :title="copy.history" @update:visible="value => { if (!value) emit('closeHistory') }">
   <BsStateSurface v-if="view.history.loading" state="loading" :title="copy.loading" />
   <BsDataTable v-else :value="view.history.rows" row-key="id" :label="copy.history" :columns="[{ key: 'version', field: 'version', header: copy.version }, { key: 'amount', field: 'amount', header: copy.amount }, { key: 'reason', field: 'reason', header: copy.reason }, { key: 'createdAt', field: 'createdAt', header: copy.createdAt }]" />
   <BsInline><BsButton :disabled="!view.history.previous || view.history.loading" @click="emit('previousHistory')">{{ copy.previous }}</BsButton><BsButton :disabled="!view.history.next || view.history.loading" @click="emit('nextHistory')">{{ copy.next }}</BsButton></BsInline>
  </BsDialog>
  <BsLink to="/account">{{ copy.account }}</BsLink>
 </BsStack>
</template>
