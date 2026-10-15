<script setup lang="ts">
import type { BsShopTaxForm, BsShopTaxCopy, BsShopTaxVersionRow } from '../types/shopTaxPresentation'
import type { BsDataTableColumn } from '@building-suit/ux'
const props = defineProps<{ copy: BsShopTaxCopy; available: boolean; loading: boolean; error: boolean; pending: boolean; dirty: boolean; actionError: boolean; saved: boolean; records: BsShopTaxVersionRow[] }>()
const editor = defineModel<boolean>('editor', { required: true })
const form = defineModel<BsShopTaxForm>('form', { required: true })
const emit = defineEmits<{ edit: []; save: []; retry: [] }>()
const columns = computed<BsDataTableColumn<BsShopTaxVersionRow>[]>(() => [
 { key: 'effectiveAt', field: 'effectiveAt', header: props.copy.effectiveAt }, { key: 'enabled', field: 'enabled', header: props.copy.enabled }, { key: 'reason', field: 'reason', header: props.copy.reason },
])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.help"><template #actions><BsButton v-if="available && !loading && !error" @click="emit('edit')">{{ copy.edit }}</BsButton></template></BsPageHeader>
  <BsText v-if="loading" role="status">{{ copy.loading }}</BsText>
  <BsBox v-else-if="error" role="alert"><BsText>{{ copy.error }}</BsText><BsButton @click="emit('retry')">{{ copy.retry }}</BsButton></BsBox>
  <BsText v-else-if="!available">{{ copy.noContext }}</BsText>
  <template v-else>
   <BsText v-if="saved" role="status">{{ copy.saved }}</BsText>
   <BsDataTable :value="records" :columns="columns" row-key="id" :label="copy.history" ><template #empty><BsText role="status">{{ copy.empty }}</BsText></template></BsDataTable>
   <BsRecordActionDialog v-model:visible="editor" :title="copy.title" :dirty="dirty" :pending="pending" :error="actionError ? copy.error : undefined" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="emit('save')">
    <BsCheckbox v-model="form.enabled" :label="copy.enabled" />
    <BsField :label="copy.effectiveAt"><BsInput v-model="form.effectiveAt" type="datetime-local" required :aria-label="copy.effectiveAt" /></BsField>
    <BsHeading :level="2">{{ copy.defaults }}</BsHeading>
    <BsShopTaxRuleFields v-model="form.default" :copy="copy" />
    <BsHeading :level="2">{{ copy.overrides }}</BsHeading>
    <BsPanel v-for="item in form.items" :key="`${item.itemType}:${item.id}`">
     <BsHeading :level="3">{{ item.name }}</BsHeading>
     <BsCheckbox v-model="item.override" :label="copy.override" />
     <BsShopTaxRuleFields v-if="item.override" v-model="form.items[form.items.indexOf(item)]!" :copy="copy" />
    </BsPanel>
    <BsField :label="copy.reason"><BsInput v-model="form.reason" required minlength="2" maxlength="1000" :aria-label="copy.reason" /></BsField>
   </BsRecordActionDialog>
  </template>
 </BsStack>
</template>
