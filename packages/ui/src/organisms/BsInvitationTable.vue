<script setup lang="ts" generic="Row extends object">
import type { BsDataTableColumn, BsInvitationAction } from '@building-suit/ux'
defineProps<{ invitations: Row[]; columns: BsDataTableColumn<Row>[]; label: string; rowKey: keyof Row & string; actionsKey?: string; actions?: (row: Row) => BsInvitationAction[]; pending?: boolean; loading?: boolean; error?: string | null }>()
const emit = defineEmits<{ action: [key: string, row: Row]; retry: [] }>()
</script>
<template>
  <BsDataTable :value="invitations" :columns="columns" :label="label" :row-key="rowKey" :loading="loading" :error="error" @retry="emit('retry')">
    <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps" /></template>
    <template v-if="actionsKey" #[`cell-${actionsKey}`]="{ row }">
      <BsButton v-for="action in actions?.(row) ?? []" :key="action.key" type="button" size="sm" :variant="action.tone ?? 'default'" :disabled="pending || action.disabled" @click="emit('action', action.key, row)">{{ action.label }}</BsButton>
    </template>
  </BsDataTable>
</template>
