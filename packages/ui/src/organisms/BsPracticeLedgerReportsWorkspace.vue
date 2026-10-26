<script setup lang="ts">
import type { BsPracticeReportCopy,BsPracticeReportFilters,BsPracticeReportView } from '../utils/practiceLedgerReportPresentation'
defineProps<{copy:BsPracticeReportCopy;view:BsPracticeReportView}>()
const filters=defineModel<BsPracticeReportFilters>('filters',{required:true})
const emit=defineEmits<{apply:[];refresh:[];page:[direction:number];clinicPage:[direction:number];closeSource:[]}>()
function update(key:keyof BsPracticeReportFilters,value:unknown){filters.value={...filters.value,[key]:String(value??'')}}
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.notice"><template #actions><BsButton :disabled="view.loading" @click="emit('refresh')">{{copy.refresh}}</BsButton><BsLink :to="view.billingTo">{{copy.billing}}</BsLink><BsLink :to="view.saasTo">{{copy.saas}}</BsLink></template></BsPageHeader>
  <BsText as="p" tone="warning">{{copy.basis}}</BsText>
  <BsFilterBar :label="copy.title">
   <BsGrid :columns="3">
    <BsField v-slot="field" :label="copy.clinic"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :label="copy.clinic" :model-value="filters.location" :options="view.clinics" option-label="label" option-value="value" :disabled="view.clinicLoading || view.loading" @update:model-value="update('location',$event)"/></BsField>
    <BsField v-slot="field" :label="copy.from"><BsInput :id="field.id" type="date" :aria-describedby="field.describedby" :model-value="filters.from" :disabled="view.loading" @update:model-value="update('from',$event)"/></BsField>
    <BsField v-slot="field" :label="copy.until"><BsInput :id="field.id" type="date" :aria-describedby="field.describedby" :model-value="filters.until" :disabled="view.loading" @update:model-value="update('until',$event)"/></BsField>
    <BsField v-slot="field" :label="copy.status"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :label="copy.status" :model-value="filters.status" :options="view.statuses" option-label="label" option-value="value" :disabled="view.loading" @update:model-value="update('status',$event)"/></BsField>
    <BsField v-slot="field" :label="copy.metric"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :label="copy.metric" :model-value="filters.metric" :options="view.metrics" option-label="label" option-value="value" :disabled="view.loading" @update:model-value="update('metric',$event)"/></BsField>
    <BsField v-slot="field" :label="copy.group"><BsSelect :input-id="field.id" :aria-describedby="field.describedby" :label="copy.group" :model-value="filters.group" :options="view.groups" option-label="label" option-value="value" :disabled="view.loading" @update:model-value="update('group',$event)"/></BsField>
   </BsGrid>
   <BsInline><BsButton :disabled="!view.clinicPrevious || view.clinicLoading" @click="emit('clinicPage',-1)">{{copy.previous}} · {{copy.clinicPages}}</BsButton><BsButton :disabled="!view.clinicNext || view.clinicLoading" @click="emit('clinicPage',1)">{{copy.next}} · {{copy.clinicPages}}</BsButton><BsButton :disabled="view.loading" @click="emit('apply')">{{copy.apply}}</BsButton></BsInline>
   <BsText v-if="view.clinicError" role="alert" tone="danger">{{copy.error}}</BsText>
  </BsFilterBar>
  <BsText v-if="view.loading" role="status">{{copy.loading}}</BsText>
  <BsText v-else-if="view.denied" role="alert" tone="danger">{{copy.denied}}</BsText>
  <BsText v-else-if="view.error" role="alert" tone="danger">{{copy.error}}</BsText>
  <template v-else-if="view.ready">
   <BsText as="p" tone="muted">{{copy.observed}}: {{view.observed}}</BsText>
   <BsMetricGrid><BsKpiCard v-for="item in view.totals" :key="item.id" :title="item.label" :value="item.value" :to="item.to" :hint="copy.sources"/></BsMetricGrid>
   <BsPanel padding="md"><BsHeading :level="2">{{copy.sources}}</BsHeading>
    <BsDataTable :value="view.rows" row-key="id" :columns="[{key:'source',field:'source',header:copy.source},{key:'amount',field:'amount',header:copy.amount},{key:'recorded',field:'recorded',header:copy.recorded},{key:'issued',field:'issued',header:copy.issued},{key:'state',field:'state',header:copy.state}]">
     <template #cell-source="{row}"><BsLink :to="row.to">{{row.source}}</BsLink></template>
     <template #empty><BsText>{{copy.empty}}</BsText></template>
    </BsDataTable>
    <BsInline justify="between"><BsText>{{copy.total}}: {{view.page}}</BsText><BsButton :disabled="!view.previous" @click="emit('page',-1)">{{copy.previous}}</BsButton><BsButton :disabled="!view.next" @click="emit('page',1)">{{copy.next}}</BsButton></BsInline>
   </BsPanel>
  </template>
  <BsDetailDialog :visible="view.source.visible" :title="copy.sourceTitle" @update:visible="!$event && emit('closeSource')">
   <BsDescriptionItem v-if="view.source.loading" :term="copy.source">{{copy.loading}}</BsDescriptionItem>
   <BsDescriptionItem v-else-if="view.source.error" :term="copy.source">{{copy.sourceError}}</BsDescriptionItem>
   <BsDescriptionItem v-for="item in view.source.items" :key="item.term" :term="item.term">{{item.value}}</BsDescriptionItem>
   <template #footer><BsButton @click="emit('closeSource')">{{copy.close}}</BsButton></template>
  </BsDetailDialog>
 </BsStack>
</template>
