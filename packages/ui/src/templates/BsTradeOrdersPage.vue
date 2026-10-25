<script setup lang="ts">
import type { BsTradeOrderCopy, BsTradeOrderView, BsTradeOrderRow, BsTradeOrderForm, BsOrderQuotationPicker, BsOrderReservationForm } from '../types/tradeOrderPresentation'
const props = defineProps<{ copy: BsTradeOrderCopy; view: BsTradeOrderView; rows: BsTradeOrderRow[]; quotationPicker: BsOrderQuotationPicker }>()
const search = defineModel<string>('search', { required: true })
const page = defineModel<number>('page', { required: true })
const historyPage = defineModel<number>('historyPage', { required: true })
const editorOpen = defineModel<boolean>('editorOpen', { required: true })
const detailOpen = defineModel<boolean>('detailOpen', { required: true })
const form = defineModel<BsTradeOrderForm>('form', { required: true })
const reservationOpen = defineModel<boolean>('reservationOpen', { required: true })
const reservationForm = defineModel<BsOrderReservationForm>('reservationForm', { required: true })
const reservationPage = defineModel<number>('reservationPage', { required: true })
const reservationHistoryPage = defineModel<number>('reservationHistoryPage', { required: true })
function reservationLine(id: string, key: 'quantity' | 'loss', value: string) { reservationForm.value = { ...reservationForm.value, lines: reservationForm.value.lines.map(line => line.id === id ? { ...line, [key]: value } : line) } }
const emit = defineEmits<{ reservationAction: [action: 'reserve' | 'release' | 'expire' | 'cancel']; reservationSubmit: []; reservationRetry: []; retry: []; retryDetail: []; retryPreview: []; add: []; open: [id: string]; submit: []; quotationSearch: [query: string]; quotationMore: []; quotationRetry: [] }>()
function change<K extends keyof BsTradeOrderForm>(key: K, value: BsTradeOrderForm[K]) { form.value = { ...form.value, [key]: value } }
const columns = computed(() => [{ key: 'number', field: 'number', header: props.copy.number }, { key: 'customer', field: 'customer', header: props.copy.customer }, { key: 'project', field: 'project', header: props.copy.project }, { key: 'status', field: 'status', header: props.copy.status }, { key: 'total', field: 'total', header: props.copy.total }, { key: 'date', field: 'date', header: props.copy.date }, { key: 'actions', header: props.copy.actions }])
const lineColumns = computed(() => [{ key: 'name', field: 'name', header: props.copy.lines }, { key: 'quantity', field: 'quantity', header: props.copy.quantity }, { key: 'price', field: 'price', header: props.copy.price }, { key: 'total', field: 'total', header: props.copy.total }])
const stockColumns = computed(() => [{ key: 'name', field: 'name', header: props.copy.lines }, ...(['onHand','reserved','own','available'] as const).map(key => ({ key, field: key, header: props.view.reservation[key] }))])
const reservationColumns = computed(() => [{ key: 'source', field: 'source', header: props.copy.source }, { key: 'quantity', field: 'quantity', header: props.copy.quantity }, { key: 'status', field: 'status', header: props.copy.status }, { key: 'expires', field: 'expires', header: props.view.reservation.expires }])
const eventColumns = computed(() => [{ key: 'action', field: 'action', header: props.copy.event }, { key: 'reason', field: 'reason', header: props.copy.reason }, { key: 'actor', field: 'actor', header: props.copy.actor }, { key: 'date', field: 'date', header: props.copy.date }])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.subtitle"><template #actions><BsButton v-if="view.available && view.canCreate" :disabled="view.locked" @click="emit('add')">{{ copy.add }}</BsButton></template></BsPageHeader>
  <BsPanel v-if="!view.available" padding="md"><BsText as="p">{{ copy.noShop }}</BsText></BsPanel>
  <BsPanel v-else padding="md"><BsDataTable :value="rows" :label="copy.title" :columns="columns" data-key="id" :loading="view.loading" :error="view.error || null" searchable :search-label="copy.search" lazy paginator :rows="view.pageSize" :first="(page - 1) * view.pageSize" :total-records="view.total" @search="search = $event" @page="page = $event.page + 1" @retry="emit('retry')"><template #cell-actions="{ row }"><BsButton variant="secondary" :disabled="view.locked" @click="emit('open', row.id)">{{ copy.open }}</BsButton></template><template #empty><BsText as="p">{{ copy.empty }}</BsText></template></BsDataTable></BsPanel>
  <BsRecordActionDialog v-model:visible="editorOpen" :title="copy.add" :dirty="view.editor.dirty" :pending="view.editor.pending" :close-blocked="view.editor.locked" :error="view.editor.error" :submit-label="copy.convert" :cancel-label="copy.cancel" :submit-disabled="Boolean(view.editor.existingOrderTo)" @submit="emit('submit')">
   <BsEntityPicker :model-value="form.quotationId" :label="copy.quotation" :options="quotationPicker.options" :disabled="view.editor.pending || view.editor.locked" option-label="name" option-value="id" :loading="quotationPicker.loading" :error="quotationPicker.error" :has-more="quotationPicker.hasMore" :load-more-label="quotationPicker.more" :retry-label="quotationPicker.retry" @search="emit('quotationSearch', $event)" @retry="emit('quotationRetry')" @load-more="emit('quotationMore')" @update:model-value="change('quotationId', String($event ?? ''))" />
   <BsText as="p">{{ view.editor.summary }}</BsText><BsButton v-if="view.editor.previewFailed" @click="emit('retryPreview')">{{ copy.retry }}</BsButton>
   <BsLink v-if="view.editor.existingOrderTo" :to="view.editor.existingOrderTo">{{ copy.existing }}</BsLink>
   <BsText as="p" tone="muted">{{ copy.agreement }}</BsText>
   <BsField v-slot="field" for="order-conversion-reason" :label="copy.reason"><BsTextarea :id="field.id" :model-value="form.reason" :disabled="view.editor.pending || view.editor.locked" :minlength="3" :maxlength="1000" required @update:model-value="change('reason', String($event))" /></BsField>
  </BsRecordActionDialog>
  <BsDialog v-model:visible="detailOpen" :title="view.detail.title || copy.title" size="lg" :pending="reservationOpen || view.reservation.locked">
   <BsText v-if="view.detail.loading" role="status">{{ copy.retry }}</BsText>
   <BsStack v-else-if="view.detail.error"><BsText role="alert">{{ view.detail.error }}</BsText><BsButton @click="emit('retryDetail')">{{ copy.retry }}</BsButton></BsStack>
   <BsStack v-else><BsText as="p">{{ view.detail.subtitle }}</BsText><BsText as="p">{{ view.detail.status }}</BsText><BsText as="p" tone="muted">{{ copy.agreement }}</BsText><BsDataTable :value="view.detail.lines" :label="copy.lines" :columns="lineColumns" data-key="id" /><BsDescriptionList><BsDescriptionItem v-for="total in view.detail.totals" :key="total.label" :term="total.label">{{ total.value }}</BsDescriptionItem></BsDescriptionList><BsDataTable :value="view.detail.events" :label="copy.history" :columns="eventColumns" data-key="id" lazy paginator :rows="20" :first="(historyPage - 1) * 20" :total-records="view.detail.eventCount" @page="historyPage = $event.page + 1" /></BsStack>
   <BsStack v-if="!view.detail.loading && !view.detail.error" gap="md">
    <BsHeading :level="2">{{ view.reservation.title }}</BsHeading><BsText as="p" tone="muted">{{ view.reservation.explanation }}</BsText>
    <BsText v-if="view.reservation.loading" role="status">{{ copy.retry }}</BsText>
    <BsStack v-else-if="view.reservation.error"><BsText role="alert">{{ view.reservation.error }}</BsText><BsButton @click="emit('reservationRetry')">{{ copy.retry }}</BsButton></BsStack>
    <BsStack v-else gap="md">
     <BsDataTable :value="view.reservation.stock" :label="view.reservation.title" :columns="stockColumns" data-key="id" />
     <BsInline v-if="view.reservation.canManage" wrap gap="sm"><BsButton :disabled="view.reservation.locked" @click="emit('reservationAction', 'reserve')">{{ view.reservation.reserve }}</BsButton><BsButton variant="secondary" :disabled="view.reservation.locked" @click="emit('reservationAction', 'release')">{{ view.reservation.release }}</BsButton><BsButton variant="secondary" :disabled="view.reservation.locked" @click="emit('reservationAction', 'expire')">{{ view.reservation.expire }}</BsButton><BsButton variant="danger" :disabled="view.reservation.locked" @click="emit('reservationAction', 'cancel')">{{ view.reservation.cancelOrder }}</BsButton></BsInline>
     <BsDataTable :value="view.reservation.items" :label="view.reservation.title" :columns="reservationColumns" data-key="id" lazy paginator :rows="20" :first="(reservationPage - 1) * 20" :total-records="view.reservation.total" @page="reservationPage = $event.page + 1" />
     <BsDataTable :value="view.reservation.events" :label="view.reservation.history" :columns="eventColumns" data-key="id" lazy paginator :rows="20" :first="(reservationHistoryPage - 1) * 20" :total-records="view.reservation.eventCount" @page="reservationHistoryPage = $event.page + 1" />
    </BsStack>
   </BsStack>
   <template #footer><BsButton :disabled="reservationOpen || view.reservation.locked" @click="detailOpen = false">{{ copy.close }}</BsButton></template>
  </BsDialog>
  <BsRecordActionDialog v-model:visible="reservationOpen" :title="view.reservation.commandTitle" :dirty="view.reservation.dirty" :pending="view.reservation.pending" :close-blocked="view.reservation.locked" :error="view.reservation.commandError" :submit-label="view.reservation.commandTitle" :cancel-label="copy.cancel" @submit="emit('reservationSubmit')">
   <BsText as="p">{{ view.reservation.explanation }}</BsText>
   <BsStack v-if="view.reservation.reserveAction" gap="md">
    <BsField v-slot="field" for="order-reservation-expiry" :label="view.reservation.expires"><BsInput :id="field.id" v-model="reservationForm.expiresAt" type="datetime-local" :disabled="view.reservation.locked" required /></BsField>
    <BsStack v-for="line in reservationForm.lines" :key="line.id" gap="sm">
     <BsField v-slot="field" :for="`reservation-quantity-${line.id}`" :label="line.name"><BsInput :id="field.id" :model-value="line.quantity" inputmode="decimal" :disabled="view.reservation.locked" @update:model-value="reservationLine(line.id, 'quantity', String($event))" /></BsField>
     <BsField v-if="line.reelTracked" v-slot="field" :for="`reservation-loss-${line.id}`" :label="view.reservation.loss"><BsInput :id="field.id" :model-value="line.loss" inputmode="decimal" :disabled="view.reservation.locked" @update:model-value="reservationLine(line.id, 'loss', String($event))" /></BsField>
    </BsStack>
   </BsStack>
   <BsField v-slot="field" for="order-reservation-reason" :label="view.reservation.reason"><BsTextarea :id="field.id" v-model="reservationForm.reason" :disabled="view.reservation.locked" :minlength="3" :maxlength="1000" required /></BsField>
  </BsRecordActionDialog>
 </BsStack>
</template>
