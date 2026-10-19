<script setup lang="ts">
const props=defineProps<{copy:{title:string;description:string;notice:string;kind:string;submit:string;success:string;empty:string;loading:string;retry:string;account:string;id:string;date:string;status:string};options:{value:string;label:string}[];rows:{id:string;kind:string;recorded:string;status:string}[];loading:boolean;pending:boolean;canSubmit:boolean;submitted:boolean;error:string|null}>()
const kind=defineModel<string>('kind',{default:'access_review'})
const emit=defineEmits<{submit:[];retry:[]}>()
const columns=computed(()=>[{key:'id',field:'id' as const,header:props.copy.id},{key:'kind',field:'kind' as const,header:props.copy.kind},{key:'recorded',field:'recorded' as const,header:props.copy.date},{key:'status',field:'status' as const,header:props.copy.status}])
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.description" />
  <BsAlert tone="info" :description="copy.notice" />
  <BsAlert v-if="error" tone="error" :description="error" />
  <BsAlert v-if="submitted" tone="success" :description="copy.success" />
  <BsStateSurface v-if="loading" state="loading" :title="copy.loading" />
  <template v-else>
   <BsForm :pending="pending" @submit="emit('submit')"><BsField v-slot="field" :label="copy.kind"><BsSelect :id="field.id" v-model="kind" :options="options" option-label="label" option-value="value" :disabled="pending" /></BsField><BsButton type="submit" :disabled="!canSubmit" :pending="pending">{{ copy.submit }}</BsButton></BsForm>
   <BsDataTable v-if="rows.length" :value="rows" :columns="columns" row-key="id" />
   <BsEmptyState v-else-if="!error" :title="copy.empty" />
  </template>
  <BsInline><BsButton :disabled="loading || pending" @click="emit('retry')">{{ copy.retry }}</BsButton><BsLink to="/account">{{ copy.account }}</BsLink></BsInline>
 </BsStack>
</template>
