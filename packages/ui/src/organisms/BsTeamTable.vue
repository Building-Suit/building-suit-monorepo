<script setup lang="ts" generic="Row extends object">
import type { BsDataTableColumn, BsDataTableCapabilities, BsDataTableActionLabels } from '@building-suit/ux'
defineProps<{ members: Row[]; columns: BsDataTableColumn<Row>[]; label: string; rowKey: keyof Row & string; capabilities?: BsDataTableCapabilities; actionLabels?: BsDataTableActionLabels; loading?: boolean; error?: string | null; capacityNotice?: string; canRowAction?: (action: 'edit' | 'delete' | 'archive' | 'void', row: Row) => boolean }>()
const emit = defineEmits<{ invite: []; edit: [row: Row]; delete: [row: Row]; archive: [row: Row]; void: [row: Row]; retry: [] }>()
</script>
<template>
  <BsStack gap="md">
    <BsAlert v-if="capacityNotice" tone="warning">{{ capacityNotice }}</BsAlert>
    <BsDataTable :value="members" :columns="columns" :label="label" :row-key="rowKey" :capabilities="capabilities" :action-labels="actionLabels" :can-row-action="canRowAction" :loading="loading" :error="error" @create="emit('invite')" @edit="emit('edit', $event)" @delete="emit('delete', $event)" @archive="emit('archive', $event)" @void="emit('void', $event)" @retry="emit('retry')">
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps" />
      </template>
    </BsDataTable>
  </BsStack>
</template>
