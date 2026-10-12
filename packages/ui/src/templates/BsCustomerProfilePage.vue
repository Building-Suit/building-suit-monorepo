<script setup lang="ts">
import type { BsCustomerIdentityForm } from '../types/customerDirectoryPresentation'
import type { BsCustomerProfileView, BsCustomerReceivablesView, BsCustomerStatementView, BsCustomerProfileCopy, BsCustomerReceiptForm, BsCustomerReceiptEditor } from '../types/customerProfilePresentation'
defineProps<{
  customer: BsCustomerProfileView | null; copy: BsCustomerProfileCopy; pending: boolean; error: string | null
  outstanding: BsCustomerReceivablesView; statement: BsCustomerStatementView
  archiving: boolean; actionError: string; saving: boolean; editorDirty: boolean
  receiptEditor: BsCustomerReceiptEditor; methodOptions: { value: string; label: string; disabled: boolean }[]
}>()
const visible = defineModel<boolean>('visible', { required: true })
const receiptOpen = defineModel<boolean>('receiptOpen', { required: true })
const form = defineModel<BsCustomerIdentityForm>('form', { required: true })
const receiptForm = defineModel<BsCustomerReceiptForm>('receiptForm', { required: true })
const emit = defineEmits<{ retry: []; retryOutstanding: []; retryStatement: []; edit: []; archive: []; receive: []; save: []; saveReceipt: []; outstandingPage: [page: number]; statementPage: [page: number] }>()
function updateReceipt(key: 'date' | 'method' | 'reference' | 'notes', value: string | number | null) { receiptForm.value = { ...receiptForm.value, [key]: String(value ?? '') } }
function updateAllocation(id: string, value: string | number) { receiptForm.value = { ...receiptForm.value, allocations: { ...receiptForm.value.allocations, [id]: Number(value) } } }
</script>
<template>
  <BsStack gap="lg">
    <BsLink to="/customers">{{ copy.customers_back }}</BsLink>
    <BsStack v-if="pending">
      <BsSkeleton/>
      <BsSkeleton/>
    </BsStack>
    <BsBox v-else-if="error" role="alert" padding="md">
      <BsText as="p">{{ error }}</BsText>
      <BsButton variant="link" type="button" @click="emit('retry')">{{ copy.common_retry }}</BsButton>
    </BsBox>
    <BsPanel v-else-if="!customer" padding="md">{{ copy.customers_notFound }}</BsPanel>
    <template v-else>
      <BsPageHeader :title="customer.name" :subtitle="copy.customers_details"><template #actions><BsStatusBadge :status="customer.status" :label="customer.status" tone="neutral" /><BsInline v-if="customer.canEdit"><BsButton variant="secondary" type="button" @click="emit('edit')">{{ copy.customers_edit }}</BsButton><BsButton variant="danger" type="button" :pending="archiving" :disabled="archiving" @click="emit('archive')">{{ copy.customers_archive }}</BsButton></BsInline></template></BsPageHeader>
      <BsText v-if="actionError && !visible" role="alert" as="p" size="sm" tone="danger">{{ actionError }}</BsText>
      <BsText v-if="!customer.canManage" as="p" size="sm">{{ copy.customers_manageDenied }}</BsText>
      <BsGrid :columns="2">
        <BsPanel padding="md">
          <BsHeading :level="2">{{ copy.customers_contact }}</BsHeading>
          <BsDescriptionList>
            <BsDescriptionItem :term="(copy.customers_phone)">
              <BsText as="span">{{ customer.phone || '—' }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(copy.customers_email)">
              <BsText as="span">{{ customer.email || '—' }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(copy.customers_address)">
              <BsText as="span">{{ customer.address || '—' }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(copy.customers_notes)">
              <BsText as="span">{{ customer.notes || '—' }}</BsText>
            </BsDescriptionItem>
          </BsDescriptionList>
        </BsPanel>
        <BsPanel padding="md">
          <BsHeading :level="2">{{ copy.customers_details }}</BsHeading>
          <BsDescriptionList>
            <BsDescriptionItem :term="(copy.customers_created)">
              <BsText as="span">{{ customer.created }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(copy.customers_updated)">
              <BsText as="span">{{ customer.updated }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem v-if="customer.archived" :term="(copy.customers_archivedOn)">
              <BsText as="span">{{ customer.archived }}</BsText>
            </BsDescriptionItem>
          </BsDescriptionList>
        </BsPanel>
      </BsGrid>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsBox>
            <BsHeading :level="2">{{ copy.customers_receivables }}</BsHeading>
            <BsText as="p" size="sm" tone="muted">{{ outstanding.overdue }}</BsText>
          </BsBox>
          <BsInline>
            <BsText as="p" size="lg" emphasis="semibold">{{ outstanding.balance }}</BsText>
            <BsButton v-if="customer.canReceive" type="button" @click="emit('receive')">{{ copy.payments_recordReceipt }}</BsButton>
          </BsInline>
        </BsInline>
        <BsText v-if="outstanding.error" role="alert" as="p" size="sm">{{ copy.payments_loadError }} <BsButton variant="link" type="button" @click="emit('retryOutstanding')">{{ copy.common_retry }}</BsButton>
        </BsText>
        <BsBox v-else scroll="x">
          <BsDataTable :value="outstanding.rows" :label="copy.customers_receivables" lazy paginator :rows="outstanding.pageSize" :first="(outstanding.page - 1) * outstanding.pageSize" :total-records="outstanding.total" :loading="outstanding.loading" data-key="id" :columns="[{ key: 'column0', header: (copy.sales_invoiceNumber) }, { key: 'column1', header: (copy.payments_settlementLabel) }, { key: 'column2', header: (copy.sales_dueDate) }, { key: 'column3', header: (copy.payments_outstanding), align: 'end' }]" @page="emit('outstandingPage', $event.page + 1)">
            <template #cell-column0="{ row: invoice }">
              <BsLink :to="invoice.href">{{ invoice.number }}</BsLink>
            </template>
            <template #cell-column1="{ row: invoice }">{{ invoice.settlement }}</template>
            <template #cell-column2="{ row: invoice }">
              <BsText as="span">{{ invoice.due || '—' }}</BsText>
            </template>
            <template #cell-column3="{ row: invoice }">{{ invoice.amount }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.customers_noOutstanding }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ copy.customers_statement }}</BsHeading>
        <BsText v-if="statement.error" role="alert" as="p" size="sm">{{ copy.payments_loadError }} <BsButton variant="link" type="button" @click="emit('retryStatement')">{{ copy.common_retry }}</BsButton>
        </BsText>
        <BsBox v-else scroll="x">
          <BsDataTable :value="statement.rows" :label="copy.customers_statement" lazy paginator :rows="statement.pageSize" :first="(statement.page - 1) * statement.pageSize" :total-records="statement.total" :loading="statement.loading" data-key="id" :columns="[{ key: 'column0', header: (copy.sales_date) }, { key: 'column1', header: (copy.payments_event) }, { key: 'column2', header: (copy.payments_debit), align: 'end' }, { key: 'column3', header: (copy.payments_credit), align: 'end' }, { key: 'column4', header: (copy.payments_runningBalance), align: 'end' }]" @page="emit('statementPage', $event.page + 1)">
            <template #cell-column0="{ row: event }">{{ event.date }}</template>
            <template #cell-column1="{ row: event }">
              <BsText as="p" emphasis="semibold">{{ event.type }}</BsText>
              <BsLink :to="event.href">{{ event.document }}</BsLink>
            </template>
            <template #cell-column2="{ row: event }">{{ event.debit }}</template>
            <template #cell-column3="{ row: event }">{{ event.credit }}</template>
            <template #cell-column4="{ row: event }">{{ event.balance }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.customers_noStatement }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsRecordActionDialog v-model:visible="receiptOpen" :title="copy.payments_recordReceipt" :dirty="receiptEditor.dirty" :pending="receiptEditor.pending" :error="receiptEditor.error" :submit-label="copy.payments_save" :cancel-label="copy.customers_cancel" :submit-disabled="receiptEditor.submitDisabled" size="lg" @submit="emit('saveReceipt')">
        <BsText as="p" size="sm" tone="muted">{{ copy.payments_allocateInvoices }}</BsText>
        <BsDataTable :value="outstanding.rows" :label="copy.customers_receivables" :loading="outstanding.loading" :error="outstanding.error ? copy.payments_loadError : null" lazy paginator :rows="outstanding.pageSize" :first="(outstanding.page - 1) * outstanding.pageSize" :total-records="outstanding.total" :columns="[{ key: 'column0', header: copy.sales_invoiceNumber }, { key: 'column1', header: copy.payments_amount }]" @page="emit('outstandingPage', $event.page + 1)" @retry="emit('retryOutstanding')">
          <template #cell-column0="{ row: invoice }">{{ invoice.number }}<BsText as="p">{{ copy.payments_outstanding }}: {{ invoice.amount }}</BsText>
          </template>
          <template #cell-column1="{ row: invoice }">
            <BsInput :model-value="receiptForm.allocations[invoice.id]" type="number" :min="0" :max="invoice.amountLimit" :step="0.01" :aria-label="`${invoice.number} ${copy.payments_amount}`" @update:model-value="updateAllocation(invoice.id, $event)"/>
          </template>
        </BsDataTable>
        <BsText as="p" emphasis="semibold">{{ copy.payments_amount }}: {{ receiptEditor.amount }}</BsText>
        <BsGrid :columns="2">
          <BsField v-slot="field" :label="(copy.payments_date)">
            <BsInput :id="field.id" :model-value="receiptForm.date" :aria-describedby="field.describedby" type="date" required @update:model-value="updateReceipt('date', $event)"/>
          </BsField>
          <BsField v-slot="field" :label="(copy.payments_method)">
            <BsSelect :model-value="receiptForm.method" :input-id="field.id" :aria-describedby="field.describedby" :label="(copy.payments_method)" :options="methodOptions" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="updateReceipt('method', $event)"/>
          </BsField>
          <BsField v-slot="field" :label="(copy.payments_reference)">
            <BsInput :id="field.id" :model-value="receiptForm.reference" :aria-describedby="field.describedby" :maxlength="200" @update:model-value="updateReceipt('reference', $event)"/>
          </BsField>
          <BsField v-slot="field" :label="(copy.payments_notes)">
            <BsInput :id="field.id" :model-value="receiptForm.notes" :aria-describedby="field.describedby" :maxlength="2000" @update:model-value="updateReceipt('notes', $event)"/>
          </BsField>
        </BsGrid>
      </BsRecordActionDialog>
      <BsRecordActionDialog v-model:visible="visible" :title="copy.customers_editTitle" :dirty="editorDirty" :pending="saving" :error="actionError" :submit-label="copy.customers_save" :cancel-label="copy.customers_cancel" @submit="emit('save')">
        <BsCustomerIdentityFields v-model="form" :labels="{ name: copy.customers_name, phone: copy.customers_phone, email: copy.customers_email, address: copy.customers_address, notes: copy.customers_notes }"/>
      </BsRecordActionDialog>
    </template>
  </BsStack>
</template>
