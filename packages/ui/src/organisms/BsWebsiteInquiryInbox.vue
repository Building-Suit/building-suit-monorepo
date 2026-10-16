<script setup lang="ts">
import type {BsWebsiteInquiryInboxView} from '../types/websiteInquiriesPresentation'
defineProps<{view:BsWebsiteInquiryInboxView}>()
const filter=defineModel<string>('filter',{default:'all'}),status=defineModel<string>('status',{default:'new'}),open=defineModel<boolean>('open',{default:false})
const emit=defineEmits<{edit:[id:string];save:[];retry:[];page:[page:number]}>()
</script>
<template>
 <BsPanel id="website-inquiries" padding="md">
  <BsHeading :level="2">{{view.title}}</BsHeading><BsText as="p" tone="muted">{{view.help}}</BsText>
  <BsText v-if="view.denied" role="status">{{view.copy.denied}}</BsText><BsText v-else-if="view.loading" role="status">{{view.copy.loading}}</BsText>
  <BsAlert v-else-if="view.failed" tone="error">{{view.copy.failed}}<BsButton @click="emit('retry')">{{view.copy.retry}}</BsButton></BsAlert>
  <BsStack v-else gap="md">
   <BsField v-slot="field" :label="view.copy.status"><BsSelect v-model="filter" :input-id="field.id" :label="view.copy.status" :options="[{value:'all',label:view.copy.all},...view.statusOptions]" option-label="label" option-value="value"/></BsField>
   <BsDataTable :value="view.rows" row-key="id" :label="view.title" :columns="[{key:'name',field:'name',header:view.copy.name},{key:'contact',field:'contact',header:view.copy.contact},{key:'createdLabel',field:'createdLabel',header:view.copy.created},{key:'statusLabel',field:'statusLabel',header:view.copy.status}]" :capabilities="{edit:true}" :action-labels="{edit:view.copy.open}" :row-action-pending="view.pending" @edit="emit('edit',$event.id)"/>
   <BsPagination :page="view.page" :page-size="20" :total="view.total" :label="view.title" :previous-label="view.copy.previous" :next-label="view.copy.next" @update:page="emit('page',$event)"/>
  </BsStack>
  <BsRecordActionDialog v-model:visible="open" :title="view.title" :pending="view.pending" :dirty="view.dirty" :error="view.error" :submit-label="view.copy.save" :cancel-label="view.copy.cancel" @submit="emit('save')">
   <BsDescriptionList v-if="view.selected"><BsDescriptionItem :term="view.copy.name">{{view.selected.name}}</BsDescriptionItem><BsDescriptionItem :term="view.copy.contact">{{view.selected.contact}}</BsDescriptionItem><BsDescriptionItem :term="view.copy.created">{{view.selected.createdLabel}}</BsDescriptionItem></BsDescriptionList>
   <BsText v-if="view.selected" as="p" class="bs-website-inquiry-message">{{view.selected.message}}</BsText>
   <BsField v-slot="field" :label="view.copy.status"><BsSelect v-model="status" :input-id="field.id" :label="view.copy.status" :options="view.statusOptions" option-label="label" option-value="value"/></BsField>
  </BsRecordActionDialog>
 </BsPanel>
</template>
<style scoped>.bs-website-inquiry-message{white-space:pre-wrap;overflow-wrap:anywhere;}</style>
