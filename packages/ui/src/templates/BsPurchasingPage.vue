<script setup lang="ts">
import type { BsPurchasingCopy, BsPurchasingView, BsSupplierForm, BsPurchaseForm, BsPurchaseLineForm, BsSupplierRow, BsPurchaseRow, BsPurchasingPicker, BsPurchasingChoice, BsPurchasingFilters } from '../types/purchasingPresentation'
defineProps<{ copy: BsPurchasingCopy; view: BsPurchasingView; vendors: BsSupplierRow[]; purchases: BsPurchaseRow[]; supplierPicker: BsPurchasingPicker; productPicker: BsPurchasingPicker; supplierChoices: BsPurchasingChoice[]; filterChoices: BsPurchasingChoice[]; lineChoices: { options: BsPurchasingChoice[] }[] }>()
const supplierForm = defineModel<BsSupplierForm>('supplierForm', { required: true })
const purchaseForm = defineModel<BsPurchaseForm>('purchaseForm', { required: true })
const filters = defineModel<BsPurchasingFilters>('filters', { required: true })
const supplierOpen = defineModel<boolean>('supplierOpen', { required: true })
const purchaseOpen = defineModel<boolean>('purchaseOpen', { required: true })
const search = defineModel<string>('search', { required: true })
const supplierSearch = defineModel<string>('supplierSearch', { required: true })
const showArchivedSuppliers = defineModel<boolean>('showArchivedSuppliers', { required: true })
const page = defineModel<number>('page', { required: true })
const supplierPage = defineModel<number>('supplierPage', { required: true })
const emit = defineEmits<{ createSupplier: []; createPurchase: []; saveSupplier: []; savePurchase: []; addLine: []; removeLine: [key: number]; retry: []; editSupplier: [id: string]; archiveSupplier: [id: string]; voidPurchase: [id: string]; supplierRetry: []; productRetry: []; supplierMore: []; productMore: []; supplierSearch: [value: string]; productSearch: [value: string]; selectSupplier: [id: string]; selectProduct: [index: number, id: string]; filterSupplier: [id: string] }>()
function updateSupplier(value: Partial<BsSupplierForm>) { supplierForm.value = { ...supplierForm.value, ...value } }
function updatePurchase(value: Partial<BsPurchaseForm>) { purchaseForm.value = { ...purchaseForm.value, ...value } }
function updateLine(index: number, value: Partial<BsPurchaseLineForm>) { updatePurchase({ lines: purchaseForm.value.lines.map((line, i) => i === index ? { ...line, ...value } : line) }) }
</script>
<template>
  <BsStack>
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsInline v-if="view.available">
          <BsButton v-if="view.canCreateSupplier" type="button" @click="emit('createSupplier')">{{ copy.addSupplier }}</BsButton>
          <BsButton v-if="view.canCreatePurchase" type="button" :disabled="view.createPurchaseDisabled" @click="emit('createPurchase')">{{ copy.newPurchase }}</BsButton>
        </BsInline>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!view.available && !view.loadingContext" padding="md">
      <BsText as="p">{{ copy.noShop }}</BsText>
      <BsLink to="/dashboard">{{ copy.dashboard }}</BsLink>
    </BsPanel>
    <template v-else-if="view.available">
      <BsText as="p" size="sm">{{ copy.scope }}</BsText>
      <BsText v-if="view.success" role="status" as="p" size="sm">{{ view.success }}</BsText>
      <BsText v-if="view.actionError && !supplierOpen && !purchaseOpen" role="alert" as="p" size="sm" tone="danger">{{ view.actionError }}</BsText>
      <BsPanel v-if="!view.hasProducts && !view.pending" padding="md">
        <BsText as="p">{{ copy.noProducts }}</BsText>
        <BsLink to="/products">{{ copy.products }}</BsLink>
      </BsPanel>
      <BsText v-if="!view.hasSuppliers && !view.pending" as="p" size="sm">{{ copy.noSuppliers }}</BsText>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.suppliers }}</BsHeading>
          <BsInline>
            <BsInput v-model="supplierSearch" :aria-label="copy.supplierSearch" type="search" :placeholder="copy.supplierSearch"/>
            <BsCheckbox  v-model="showArchivedSuppliers" :label="copy.showArchived" />
          </BsInline>
        </BsInline>
        <BsBox scroll="x">
          <BsDataTable :value="vendors" :label="copy.suppliers" lazy paginator :rows="view.pageSize" :first="(supplierPage - 1) * view.pageSize" :total-records="view.vendorTotal" :always-show-paginator="false" data-key="id" :loading="view.pending" :columns="[{ key: 'column0', header: (copy.supplier) }, { key: 'column1', header: (copy.contact) }, { key: 'column2', header: (copy.payable), align: 'end' }, { key: 'column3', header: (copy.actions), align: 'end' }]" @page="supplierPage = $event.page + 1">
            <template #cell-column0="{ row: vendor }">{{ vendor.name }}<BsText v-if="vendor.archived" as="span" size="xs" tone="muted">({{ copy.archived }})</BsText>
            </template>
            <template #cell-column1="{ row: vendor }">
              <BsText as="p">{{ vendor.contact }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ vendor.communication }}</BsText>
            </template>
            <template #cell-column2="{ row: vendor }">{{ vendor.payable }}</template>
            <template #cell-column3="{ row: vendor }">
              <BsText v-if="vendor.editable" as="span">
                <BsButton variant="link" @click="emit('editSupplier', vendor.id)">{{ copy.edit }}</BsButton>
                <BsButton variant="text" :disabled="vendor.archiving" @click="emit('archiveSupplier', vendor.id)">{{ copy.archive }}</BsButton>
              </BsText>
            </template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.noSuppliers }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsRecordActionDialog v-model:visible="supplierOpen" :title="view.editingSupplier ? copy.edit : copy.addSupplier" :dirty="view.supplierDirty" :pending="view.supplierSaving" :error="view.actionError" :submit-label="copy.saveSupplier" :cancel-label="copy.cancel" @submit="emit('saveSupplier')">
        <BsField v-slot="field" :label="copy.supplierName">
          <BsInput :id="field.id" :model-value="supplierForm.name" :aria-describedby="field.describedby" type="text" :minlength="2" :maxlength="160" required @update:model-value="updateSupplier({ name: String($event) })"/>
        </BsField>
        <BsField v-slot="field" :label="copy.contactName">
          <BsInput :id="field.id" :model-value="supplierForm.contactName" :aria-describedby="field.describedby" type="text" :maxlength="160" @update:model-value="updateSupplier({ contactName: String($event) })"/>
        </BsField>
        <BsField v-slot="field" :label="copy.phone">
          <BsInput :id="field.id" :model-value="supplierForm.phone" :aria-describedby="field.describedby" type="tel" :maxlength="40" @update:model-value="updateSupplier({ phone: String($event) })"/>
        </BsField>
        <BsField v-slot="field" :label="copy.email">
          <BsInput :id="field.id" :model-value="supplierForm.email" :aria-describedby="field.describedby" type="email" :maxlength="254" @update:model-value="updateSupplier({ email: String($event) })"/>
        </BsField>
        <BsField v-slot="field" :label="copy.taxNumber">
          <BsInput :id="field.id" :model-value="supplierForm.taxNumber" :aria-describedby="field.describedby" type="text" :maxlength="80" @update:model-value="updateSupplier({ taxNumber: String($event) })"/>
        </BsField>
        <BsField v-slot="field" :label="copy.address">
          <BsTextarea :id="field.id" :model-value="supplierForm.address" :aria-describedby="field.describedby" :rows="2" :maxlength="500" @update:model-value="updateSupplier({ address: String($event) })"/>
        </BsField>
        <BsField v-slot="field" :label="copy.notes">
          <BsTextarea :id="field.id" :model-value="supplierForm.notes" :aria-describedby="field.describedby" :rows="2" :maxlength="1000" @update:model-value="updateSupplier({ notes: String($event) })"/>
        </BsField>
      </BsRecordActionDialog>
      <BsRecordActionDialog v-model:visible="purchaseOpen" :title="copy.newPurchase" :dirty="view.purchaseDirty" :pending="view.purchaseSaving" :error="view.actionError" :submit-label="copy.savePurchase" :cancel-label="copy.cancel" size="lg" @submit="emit('savePurchase')">
        <BsGrid :columns="2">
          <BsEntityPicker :model-value="purchaseForm.vendorId" :label="copy.supplier" :options="supplierChoices" option-label="name" option-value="id" :loading="supplierPicker.loading" :error="supplierPicker.error" :has-more="supplierPicker.hasMore" :load-more-label="supplierPicker.moreLabel" :retry-label="supplierPicker.retryLabel" @retry="emit('supplierRetry')" @search="emit('supplierSearch', $event)" @load-more="emit('supplierMore')" @update:model-value="emit('selectSupplier', String($event ?? ''))" />
          <BsField v-slot="field" :label="copy.date">
            <BsInput :id="field.id" :model-value="purchaseForm.issuedOn" :aria-describedby="field.describedby" type="date" required @update:model-value="updatePurchase({ issuedOn: String($event) })"/>
          </BsField>
          <BsField v-slot="field" :label="(copy.invoiceNumber) + ' (' + (copy.optional) + ')'">
            <BsInput :id="field.id" :model-value="purchaseForm.invoiceNumber" :aria-describedby="field.describedby" type="text" :maxlength="120" @update:model-value="updatePurchase({ invoiceNumber: String($event) })"/>
          </BsField>
        </BsGrid>
        <BsFieldGroup :legend="(copy.product)">
          <BsGrid v-for="(line, index) in purchaseForm.lines" :key="line.key" :columns="1">
            <BsEntityPicker :model-value="line.productId" :label="`${copy.product} ${index + 1}`" :options="lineChoices[index]?.options ?? []" option-label="name" option-value="id" :loading="productPicker.loading" :error="productPicker.error" :has-more="productPicker.hasMore" :load-more-label="productPicker.moreLabel" :retry-label="productPicker.retryLabel" @retry="emit('productRetry')" @search="emit('productSearch', $event)" @load-more="emit('productMore')" @update:model-value="emit('selectProduct', index, String($event ?? ''))" />
            <BsField v-slot="field" :label="copy.quantity">
              <BsInput :id="field.id" :model-value="line.quantity" :aria-describedby="field.describedby" type="number" :min="0.001" :max="1000000" :step="0.001" required @update:model-value="updateLine(index, { quantity: Number($event) })"/>
            </BsField>
            <BsField v-slot="field" :label="copy.unitCost">
              <BsInput :id="field.id" :model-value="line.unitCost" :aria-describedby="field.describedby" type="number" :min="0" :max="999999999.99" :step="0.01" required @update:model-value="updateLine(index, { unitCost: Number($event) })"/>
            </BsField>
            <BsInline>
              <BsButton type="button" :disabled="purchaseForm.lines.length === 1" :aria-label="`${copy.removeLine} ${index + 1}`" @click="emit('removeLine', line.key)">×</BsButton>
            </BsInline>
          </BsGrid>
          <BsButton v-if="purchaseForm.lines.length < 100" type="button" @click="emit('addLine')">{{ copy.addLine }}</BsButton>
        </BsFieldGroup>
        <BsField v-slot="field" :label="copy.notes">
          <BsTextarea :id="field.id" :model-value="purchaseForm.notes" :aria-describedby="field.describedby" :rows="2" :maxlength="1000" @update:model-value="updatePurchase({ notes: String($event) })"/>
        </BsField>
        <BsText as="p" size="lg" emphasis="semibold">{{ copy.total }}: {{ view.formTotal }}</BsText>
      </BsRecordActionDialog>
      <BsPanel padding="md">
        <BsStack>
          <BsInline justify="between">
            <BsHeading :level="2">{{ copy.recent }}</BsHeading>
            <BsInput v-model="search" :aria-label="copy.search" type="search" :placeholder="copy.search"/>
          </BsInline>
          <BsGrid :columns="2">
            <BsEntityPicker :model-value="filters.vendor" :label="copy.supplier" show-clear :options="filterChoices" option-label="name" option-value="id" :loading="supplierPicker.loading" :error="supplierPicker.error" :has-more="supplierPicker.hasMore" :load-more-label="supplierPicker.moreLabel" :retry-label="supplierPicker.retryLabel" @retry="emit('supplierRetry')" @search="emit('supplierSearch', $event)" @load-more="emit('supplierMore')" @update:model-value="emit('filterSupplier', String($event ?? ''))" />
            <BsSelect :model-value="filters.status" :label="copy.status" :options="[{ value: '', label: (copy.all) + ' — ' + (copy.status), disabled: false }, { value: 'posted', label: (copy.posted), disabled: false }, { value: 'void', label: (copy.voided), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="filters = { ...filters, status: String($event ?? '') }"/>
            <BsSelect :model-value="filters.settlement" :label="copy.settlement" :options="[{ value: '', label: (copy.all) + ' — ' + (copy.settlement), disabled: false }, { value: 'unpaid', label: (copy.unpaid), disabled: false }, { value: 'partial', label: (copy.partial), disabled: false }, { value: 'paid', label: (copy.paid), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="filters = { ...filters, settlement: String($event ?? '') }"/>
            <BsField v-slot="field" :label="copy.from">
              <BsInput :id="field.id" :model-value="filters.from" :aria-describedby="field.describedby" type="date" @update:model-value="filters = { ...filters, from: String($event ?? '') }"/>
            </BsField>
            <BsField v-slot="field" :label="copy.to">
              <BsInput :id="field.id" :model-value="filters.to" :aria-describedby="field.describedby" type="date" @update:model-value="filters = { ...filters, to: String($event ?? '') }"/>
            </BsField>
          </BsGrid>
        </BsStack>
        <BsText v-if="view.pending" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
        <BsBox v-else-if="view.error" role="alert">
          <BsText as="p">{{ copy.readError }}</BsText>
          <BsButton @click="emit('retry')">{{ copy.retry }}</BsButton>
        </BsBox>
        <BsText v-else-if="!purchases.length" as="p" size="sm" tone="muted">{{ view.total ? copy.noResults : copy.empty }}</BsText>
        <BsBox v-else scroll="x">
          <BsDataTable :value="purchases" :label="copy.recent" data-key="id" :columns="[{ key: 'column0', header: (copy.date) }, { key: 'column1', header: (copy.supplier) }, { key: 'column2', header: (copy.total), align: 'end' }, { key: 'column3', header: (copy.payable), align: 'end' }, { key: 'column4', header: (copy.status), align: 'end' }, { key: 'column5', header: (copy.actions), align: 'end' }]">
            <template #cell-column0="{ row: purchase }">{{ purchase.date }}</template>
            <template #cell-column1="{ row: purchase }">
              <BsLink :to="purchase.href">{{ purchase.vendor }}</BsLink>
              <BsText v-if="purchase.invoiceNumber" as="p" size="xs" tone="muted" emphasis="semibold">{{ purchase.invoiceNumber }}</BsText>
            </template>
            <template #cell-column2="{ row: purchase }">{{ purchase.total }}</template>
            <template #cell-column3="{ row: purchase }">{{ purchase.payable }}<BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ purchase.settlement }}</BsText>
            </template>
            <template #cell-column4="{ row: purchase }">{{ purchase.status }}</template>
            <template #cell-column5="{ row: purchase }">
              <BsText as="span">
                <BsLink :to="purchase.href">{{ copy.details }}</BsLink>
                <BsButton v-if="purchase.voidable" variant="text" type="button" :disabled="purchase.voiding" @click="emit('voidPurchase', purchase.id)">{{ copy.void }}</BsButton>
              </BsText>
            </template>
          </BsDataTable>
          <BsInline v-if="view.total > view.pageSize" justify="between">
            <BsButton :disabled="page === 1" @click="page--">{{ copy.previous }}</BsButton>
            <BsText as="span">{{ page }} / {{ view.pages }}</BsText>
            <BsButton :disabled="page === view.pages" @click="page++">{{ copy.next }}</BsButton>
          </BsInline>
        </BsBox>
      </BsPanel>
    </template>
  </BsStack>
</template>
