<script setup lang="ts">
const visible = defineModel<boolean>('visible', { default: false })
withDefaults(defineProps<{ title: string; size?: 'sm' | 'md' | 'lg'; pending?: boolean; columns?: 1 | 2 | 3 }>(), { size: 'md', pending: false, columns: 1 })
const slots = useSlots()
</script>

<template>
  <BsDialog v-model:visible="visible" :title="title" :size="size" :pending="pending">
    <template #default="scope"><BsDescriptionList :columns="columns"><slot v-bind="scope" /></BsDescriptionList></template>
    <template v-if="slots.footer" #footer="scope"><slot name="footer" v-bind="scope" /></template>
  </BsDialog>
</template>
