<script setup lang="ts">
import type{BsPaymentReconciliationFilters,BsPaymentReconciliationView}from'../types/paymentReconciliationPresentation'
defineProps<{view:BsPaymentReconciliationView}>()
const filters=defineModel<BsPaymentReconciliationFilters>('filters',{required:true})
const emit=defineEmits<{apply:[];retry:[];page:[direction:number]}>()
function update(key:keyof BsPaymentReconciliationFilters,value:unknown){filters.value={...filters.value,[key]:String(value??'')}}
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="view.title" :subtitle="view.subtitle"><template #actions><BsLink :to="view.back.to">{{ view.back.label }}</BsLink></template></BsPageHeader>
  <BsText as="p" tone="warning">{{ view.notice }}</BsText>
  <BsText as="p" size="sm" tone="muted">{{ view.dateNotice }}</BsText>
  <BsFilterBar :label="view.title">
   <BsGrid :columns="3">
    <BsField v-slot="field" :label="view.fromLabel"><BsInput :id="field.id" type="date" :model-value="filters.from" :aria-describedby="field.describedby" :disabled="view.loading" @update:model-value="update('from',$event)"/></BsField>
    <BsField v-slot="field" :label="view.toLabel"><BsInput :id="field.id" type="date" :model-value="filters.to" :aria-describedby="field.describedby" :disabled="view.loading" @update:model-value="update('to',$event)"/></BsField>
    <BsField v-slot="field" :label="view.statusLabel"><BsSelect :input-id="field.id" :label="view.statusLabel" :aria-describedby="field.describedby" :model-value="filters.status" :options="view.statuses" option-label="label" option-value="value" :disabled="view.loading" @update:model-value="update('status',$event)"/></BsField>
   </BsGrid>
   <BsButton :pending="view.loading" @click="emit('apply')">{{ view.applyLabel }}</BsButton>
  </BsFilterBar>
  <BsText v-if="view.loading" as="p" role="status">{{ view.loadingLabel }}</BsText>
  <BsText v-else-if="view.error" as="p" role="alert" tone="danger">{{ view.error }} <BsButton v-if="!view.denied" @click="emit('retry')">{{ view.retry }}</BsButton></BsText>
  <template v-else>
   <BsText as="p" size="sm" tone="muted">{{ view.observed }}</BsText>
   <BsPanel padding="md"><BsHeading :level="2">{{ view.totalsLabel }}</BsHeading><BsBox scroll="x"><BsDataTable :value="view.totals" data-key="id" :columns="view.totalsColumns">
    <template v-for="column in view.totalsColumns" :key="column.key" #[`cell-${column.key}`]="{row}"><BsText as="span">{{ row.cells[column.key] }}</BsText></template>
    <template #empty><BsText as="p">{{ view.empty }}</BsText></template>
   </BsDataTable></BsBox></BsPanel>
   <BsPanel padding="md"><BsHeading :level="2">{{ view.noticesLabel }}</BsHeading><BsBox scroll="x"><BsDataTable :value="view.rows" data-key="id" :columns="[...view.columns,{key:'open',header:view.openLabel}]">
    <template v-for="column in view.columns" :key="column.key" #[`cell-${column.key}`]="{row}"><BsText as="span">{{ row.cells[column.key] }}</BsText></template>
    <template #cell-open="{row}"><BsLink :to="row.to">{{ view.openLabel }}</BsLink></template>
    <template #empty><BsText as="p">{{ view.empty }}</BsText></template>
   </BsDataTable></BsBox><BsInline justify="between"><BsText as="p">{{ view.pagination }}</BsText><BsInline><BsButton :disabled="view.previousDisabled" @click="emit('page',-1)">{{ view.previousLabel }}</BsButton><BsButton :disabled="view.nextDisabled" @click="emit('page',1)">{{ view.nextLabel }}</BsButton></BsInline></BsInline></BsPanel>
  </template>
 </BsStack>
</template>
