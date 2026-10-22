<script setup lang="ts">
defineProps<{
  copy: {title:string;description:string;notice:string;retry:string}
  view: {state:'loading'|'empty'|'error'|'denied'|'info'|'success';title:string;description:string;retry:boolean;context:string|null}
}>()
const emit=defineEmits<{retry:[]}>()
</script>
<template>
  <BsPage width="md">
    <BsStack gap="lg">
      <BsPageHeader :title="copy.title" :subtitle="copy.description" />
      <BsAlert tone="warning" :description="copy.notice" />
      <BsStateSurface :state="view.state" :title="view.title" :description="view.description" :action-label="view.retry ? copy.retry : undefined" @action="emit('retry')" />
      <BsText v-if="view.context" role="status">{{view.context}}</BsText>
    </BsStack>
  </BsPage>
</template>
