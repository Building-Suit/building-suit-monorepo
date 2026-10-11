<script setup lang="ts" generic="Row extends { id: string }">
withDefaults(defineProps<{ items: Row[]; label: string; addLabel: string; removeLabel: string; rowLabel: (row: Row, index: number) => string; minRows?: number; maxRows?: number; showAdd?: boolean; pending?: boolean; disabled?: boolean; errors?: Record<string, string> }>(), { showAdd: true, minRows: 0, maxRows: undefined, pending: false, disabled: false, errors: undefined })
const emit = defineEmits<{ add: []; remove: [row: Row] }>()
</script>
<template>
  <section :aria-label="label" :aria-busy="pending || undefined">
    <ol class="bs-line-items">
      <BsLineItemRow v-for="(item, index) in items" :key="item.id" :label="rowLabel(item, index)" :remove-label="removeLabel" :removable="items.length > (minRows ?? 0)" :disabled="disabled || pending" :error="errors?.[item.id]" @remove="emit('remove', item)">
        <slot :item="item" :index="index" :disabled="disabled || pending" />
      </BsLineItemRow>
    </ol>
    <BsButton v-if="showAdd !== false" :disabled="disabled || pending || (maxRows !== undefined && items.length >= maxRows)" @click="emit('add')">{{ addLabel }}</BsButton>
    <slot name="summary" />
  </section>
</template>
