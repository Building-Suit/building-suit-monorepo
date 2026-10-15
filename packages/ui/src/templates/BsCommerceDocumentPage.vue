<script setup lang="ts">
import type { BsCommerceDocumentCopy, BsCommerceDocumentForm, BsCommerceCorrectionForm, BsCommerceDocumentView } from '../types/commerceDocumentPresentation'
defineProps<{ copy: BsCommerceDocumentCopy; view: BsCommerceDocumentView; backTo: string; inventoryTo: string; methods: { value: string; label: string }[]; constraints: { referenceLength: number; notesLength: number; reasonMinimum: number; reasonMaximum: number; amountMinimum: number; amountStep: number; quantityStep: number } }>()
const form = defineModel<BsCommerceDocumentForm>('form', { required: true })
const correctionForm = defineModel<BsCommerceCorrectionForm>('correctionForm', { required: true })
const dialogOpen = defineModel<boolean>('dialogOpen', { required: true })
const correctionOpen = defineModel<boolean>('correctionOpen', { required: true })
const discountOpen = defineModel<boolean>('discountOpen', { default: false })
const orderDiscount = defineModel<number>('orderDiscount', { default: 0 })
const emit = defineEmits<{ editOrderDiscount: []; saveOrderDiscount: []; retry: []; issue: []; share: []; payment: []; credit: []; return: []; reverse: [id: string]; refund: [id: string]; correct: []; retryCorrection: []; submit: []; submitCorrection: [] }>()
function updateForm<K extends keyof BsCommerceDocumentForm>(key: K, value: BsCommerceDocumentForm[K]) { form.value = { ...form.value, [key]: value } }
function updateCorrection<K extends keyof BsCommerceCorrectionForm>(key: K, value: BsCommerceCorrectionForm[K]) { correctionForm.value = { ...correctionForm.value, [key]: value } }
</script>
<template>
  <BsStack gap="lg">
    <BsLink :to="backTo">{{ copy.back }}</BsLink>
    <BsText v-if="view.loading" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
    <BsBox v-else-if="view.error" role="alert" padding="md"><BsText as="p">{{ copy.loadError }}</BsText><BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsBox>
    <BsText v-else-if="!view.found" as="p" size="sm" tone="muted">{{ copy.notFound }}</BsText>
    <template v-else>
      <BsPageHeader :title="view.title" :subtitle="view.subtitle">
        <template #actions><BsInline>
          <BsLink v-if="view.serviceAction" :to="view.serviceAction.to">{{ view.serviceAction.label }}</BsLink>
          <BsLink v-if="view.relatedAction" :to="view.relatedAction.to">{{ view.relatedAction.label }}</BsLink>
          <BsButton v-if="view.orderDiscount?.canEdit" @click="emit('editOrderDiscount')">{{ view.orderDiscount.label }}</BsButton>
          <BsLink v-if="view.editTo" :to="view.editTo">{{ copy.edit }}</BsLink>
          <BsButton v-if="view.canIssue" :disabled="view.issuing" @click="emit('issue')">{{ view.issuing ? copy.issuing : copy.issue }}</BsButton>
          <BsButton v-if="view.correction.canCorrect" severity="danger" :disabled="view.correctionDialog.pending" @click="emit('correct')">{{ copy.correct }}</BsButton>
          <BsLink v-if="view.receiptTo" :to="view.receiptTo">{{ copy.reprint }}</BsLink>
          <BsButton v-if="view.canShare" severity="secondary" :pending="view.sharing" @click="emit('share')">{{ copy.share }}</BsButton>
          <BsButton v-if="view.canPayment" @click="emit('payment')">{{ copy.recordPayment }}</BsButton>
          <BsButton v-if="view.canCredit" @click="emit('credit')">{{ copy.recordCredit }}</BsButton>
          <BsButton v-if="view.canReturn" @click="emit('return')">{{ copy.recordReturn }}</BsButton>
        </BsInline></template>
      </BsPageHeader>
      <BsText v-if="view.status" as="p" size="sm">{{ view.status }}</BsText>
      <BsText v-if="view.success" role="status" as="p" size="sm">{{ view.success }}</BsText>
      <BsText v-if="view.actionError && !dialogOpen && !correctionOpen" role="alert" as="p" size="sm" tone="danger">{{ view.actionError }}</BsText>
      <BsText v-if="view.notice" as="p" size="sm">{{ view.notice }}</BsText>
      <BsPanel v-if="view.correction.visible" padding="md">
        <BsHeading :level="2">{{ copy.correction }}</BsHeading>
        <BsText v-if="view.correction.loading" as="p" size="sm" tone="muted">{{ copy.correctionLoading }}</BsText>
        <BsBox v-else-if="view.correction.error" role="alert"><BsText as="p">{{ copy.correctionError }}</BsText><BsButton severity="secondary" @click="emit('retryCorrection')">{{ copy.retry }}</BsButton></BsBox>
        <BsBox v-else-if="view.correction.title" padding="md">
          <BsText as="p" emphasis="semibold">{{ view.correction.title }}</BsText><BsText as="p" tone="muted">{{ view.correction.description }}</BsText><BsText as="p">{{ view.correction.reason }}</BsText>
          <BsDescriptionList><BsDescriptionItem :term="copy.refunded">{{ view.correction.refunded }}</BsDescriptionItem><BsDescriptionItem :term="copy.restored">{{ view.correction.restored }}</BsDescriptionItem></BsDescriptionList>
        </BsBox>
        <BsText v-else as="p" size="sm" tone="muted">{{ view.correction.notice }}</BsText><BsText as="p" size="sm" tone="muted">{{ view.correction.fullOnly }}</BsText>
      </BsPanel>
      <BsGrid :columns="2">
        <BsPanel padding="md"><BsHeading :level="2">{{ copy.party }}</BsHeading><BsStack v-if="view.party.name" gap="xs">
          <BsText as="p" emphasis="semibold"><BsLink v-if="view.party.to" :to="view.party.to">{{ view.party.name }}</BsLink><template v-else>{{ view.party.name }}</template></BsText>
          <BsText v-if="view.party.phone" as="p">{{ view.party.phone }}</BsText><BsText v-if="view.party.email" as="p">{{ view.party.email }}</BsText><BsText v-if="view.party.address" as="p">{{ view.party.address }}</BsText>
        </BsStack><BsText v-else as="p" size="sm" tone="muted">{{ copy.noParty }}</BsText></BsPanel>
        <BsPanel padding="md"><BsHeading :level="2">{{ copy.details }}</BsHeading><BsDescriptionList>
          <BsDescriptionItem v-if="view.showCreated" :term="copy.created">{{ view.detail.created }}</BsDescriptionItem>
          <BsDescriptionItem :term="copy.date">{{ view.detail.date }}</BsDescriptionItem>
          <BsDescriptionItem v-if="view.showNotes" :term="copy.notes">{{ view.detail.notes }}</BsDescriptionItem>
          <BsDescriptionItem v-for="item in view.amountBreakdown ?? []" :key="item.label" :term="item.label">{{ item.value }}</BsDescriptionItem>
          <BsDescriptionItem v-if="view.showDiscount" :term="copy.discount">{{ view.detail.discount }}</BsDescriptionItem>
          <BsDescriptionItem :term="copy.total"><BsText as="span" size="lg" emphasis="semibold">{{ view.detail.total }}</BsText></BsDescriptionItem>
          <BsDescriptionItem :term="copy.balance">{{ view.detail.balance }}</BsDescriptionItem>
          <BsDescriptionItem v-if="view.showPaid" :term="copy.paid">{{ view.detail.paid }}</BsDescriptionItem>
          <BsDescriptionItem v-if="view.showDue" :term="copy.due">{{ view.detail.due }}</BsDescriptionItem>
          <BsDescriptionItem v-if="view.detail.settlement" :term="copy.settlement">{{ view.detail.settlement }}</BsDescriptionItem>
        </BsDescriptionList></BsPanel>
      </BsGrid>
      <BsPanel padding="md"><BsHeading :level="2">{{ copy.lines }}</BsHeading>
        <BsDataTable density="compact" :value="view.lines" data-key="id" :columns="[{ key: 'name', field: 'name', header: copy.item }, { key: 'quantity', field: 'quantity', header: copy.quantity, align: 'end' }, ...(view.showAvailable ? [{ key: 'available', field: 'available', header: copy.available, align: 'end' as const }] : []), { key: 'price', field: 'price', header: copy.price, align: 'end' }, ...(view.showDiscount ? [{ key: 'discount', field: 'discount', header: copy.discount, align: 'end' as const }] : []), { key: 'total', field: 'total', header: copy.total, align: 'end' }]">
          <template #cell-name="{ row }"><BsText as="p" emphasis="semibold">{{ row.name }}</BsText><BsText v-if="row.description" as="p" size="xs" tone="muted">{{ row.description }}</BsText></template>
        </BsDataTable>
      </BsPanel>
      <BsGrid :columns="view.showCredits ? 2 : 1">
        <BsPanel v-if="view.showPayments" padding="md"><BsHeading :level="2">{{ copy.payments }}</BsHeading><BsStack>
          <BsText v-if="!view.events.length" as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
          <BsInline v-for="event in view.events" :key="event.id" justify="between"><BsBox><BsText as="p" emphasis="semibold">{{ event.title }}</BsText><BsText as="p" size="xs" tone="muted">{{ event.description }}</BsText><BsText v-if="event.reason" as="p" size="sm">{{ event.reason }}</BsText></BsBox>
            <BsInline><BsButton v-if="event.canReverse" @click="emit('reverse', event.id)">{{ copy.reverse }}</BsButton><BsButton v-if="event.canRefund" @click="emit('refund', event.id)">{{ copy.refund }}</BsButton></BsInline>
          </BsInline>
        </BsStack></BsPanel>
        <BsPanel v-if="view.showCredits" padding="md"><BsHeading :level="2">{{ copy.credits }}</BsHeading><BsStack><BsText v-if="!view.credits.length" as="p" size="sm" tone="muted">{{ copy.empty }}</BsText><BsBox v-for="credit in view.credits" :key="credit.id" as="article"><BsText as="p" emphasis="semibold">{{ credit.title }}</BsText><BsText as="p" size="xs" tone="muted">{{ credit.description }}</BsText><BsText as="p" size="sm">{{ credit.reason }}</BsText></BsBox></BsStack></BsPanel>
      </BsGrid>
      <BsPanel padding="md"><BsInline justify="between"><BsHeading :level="2">{{ copy.inventory }}</BsHeading><BsLink v-if="inventoryTo" :to="inventoryTo">{{ copy.inventory }}</BsLink></BsInline>
        <BsDataTable v-if="view.inventoryTable" :value="view.movements" data-key="id" :columns="[{ key: 'date', field: 'date', header: copy.date }, { key: 'name', field: 'name', header: copy.item }, { key: 'quantity', field: 'quantity', header: copy.quantity, align: 'end' }, { key: 'cost', field: 'cost', header: copy.price, align: 'end' }]"><template #empty><BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText></template></BsDataTable>
        <BsText v-else-if="!view.movements.length" as="p" size="sm" tone="muted">{{ copy.noInventory }}</BsText>
        <BsGrid v-for="movement in view.inventoryTable ? [] : view.movements" :key="movement.id" :columns="4"><BsText as="p" emphasis="semibold">{{ movement.name }}</BsText><BsText as="p">{{ copy.quantity }}: {{ movement.quantity }}</BsText><BsText as="p">{{ copy.batch }}: {{ movement.batch }}</BsText><BsLink :to="movement.to">{{ copy.open }}</BsLink></BsGrid>
      </BsPanel>
    </template>
    <BsRecordActionDialog v-if="view.orderDiscount" v-model:visible="discountOpen" :title="view.orderDiscount.label" :dirty="view.orderDiscount.dirty" :pending="view.orderDiscount.pending" :error="view.actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('saveOrderDiscount')">
      <BsField :label="view.orderDiscount.label"><BsInput v-model="orderDiscount" type="number" min="0" step="0.01" required :aria-label="view.orderDiscount.label" /></BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="dialogOpen" :title="view.dialog.title" :dirty="view.dialog.dirty" :pending="view.dialog.pending" :error="view.actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('submit')">
      <BsField v-if="view.dialog.showAmount" v-slot="field" :label="copy.amount"><BsInput :id="field.id" :model-value="form.amount" :aria-describedby="field.describedby" type="number" :min="constraints.amountMinimum" :max="view.dialog.maximum" :step="constraints.amountStep" required @update:model-value="updateForm('amount', Number($event))"/></BsField>
      <BsGrid v-for="line in view.dialog.showQuantities ? view.lines : []" :key="line.id" :columns="1"><BsBox><BsText as="p" emphasis="semibold">{{ line.name }}</BsText><BsText as="p" size="xs" tone="muted">{{ copy.available }}: {{ line.available }} · {{ copy.price }}: {{ line.price }}</BsText></BsBox><BsField v-slot="field" :label="copy.quantity"><BsInput :id="field.id" :model-value="form.quantities[line.id]" :aria-describedby="field.describedby" type="number" :min="0" :max="line.returnMaximum" :step="constraints.quantityStep" @update:model-value="updateForm('quantities', { ...form.quantities, [line.id]: Number($event) })"/></BsField></BsGrid>
      <BsField v-slot="field" :label="copy.date"><BsInput :id="field.id" :model-value="form.date" :aria-describedby="field.describedby" type="date" required @update:model-value="updateForm('date', String($event ?? ''))"/></BsField>
      <BsField v-if="view.dialog.showMethod" v-slot="field" :label="copy.method"><BsSelect :model-value="form.method" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.method" :options="methods" option-label="label" option-value="value" @update:model-value="updateForm('method', String($event))"/></BsField>
      <BsField v-if="view.dialog.showReference" v-slot="field" :label="copy.reference"><BsInput :id="field.id" :model-value="form.reference" :aria-describedby="field.describedby" :maxlength="constraints.referenceLength" @update:model-value="updateForm('reference', String($event ?? ''))"/></BsField>
      <BsField v-if="view.dialog.showNotes" v-slot="field" :label="copy.notes"><BsTextarea :id="field.id" :model-value="form.notes" :aria-describedby="field.describedby" :maxlength="constraints.notesLength" :rows="2" @update:model-value="updateForm('notes', String($event ?? ''))"/></BsField>
      <BsField v-if="view.dialog.showReason" v-slot="field" :label="copy.reason"><BsTextarea :id="field.id" :model-value="form.reason" :aria-describedby="field.describedby" :minlength="constraints.reasonMinimum" :maxlength="constraints.reasonMaximum" required :rows="3" @update:model-value="updateForm('reason', String($event ?? ''))"/></BsField>
      <BsText v-if="view.dialog.showQuantities" as="p" size="lg" emphasis="semibold">{{ copy.total }}: {{ view.dialog.total }}</BsText>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="correctionOpen" :title="copy.correctionDialog" :dirty="view.correctionDialog.dirty" :pending="view.correctionDialog.pending" :error="view.actionError" :submit-label="copy.correctionSubmit" :cancel-label="copy.cancel" submit-tone="danger" @submit="emit('submitCorrection')">
      <BsText as="p" size="sm" tone="warning">{{ view.correctionDialog.warning }}</BsText>
      <BsField v-slot="field" :label="copy.date"><BsInput :id="field.id" :model-value="correctionForm.date" :aria-describedby="field.describedby" type="date" required @update:model-value="updateCorrection('date', String($event ?? ''))"/></BsField>
      <BsField v-slot="field" :label="copy.reference"><BsInput :id="field.id" :model-value="correctionForm.reference" :aria-describedby="field.describedby" :maxlength="constraints.referenceLength" @update:model-value="updateCorrection('reference', String($event ?? ''))"/></BsField>
      <BsField v-slot="field" :label="copy.reason"><BsTextarea :id="field.id" :model-value="correctionForm.reason" :aria-describedby="field.describedby" :minlength="constraints.reasonMinimum" :maxlength="constraints.reasonMaximum" required :rows="4" @update:model-value="updateCorrection('reason', String($event ?? ''))"/></BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>
