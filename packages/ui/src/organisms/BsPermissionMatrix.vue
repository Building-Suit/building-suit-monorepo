<script setup lang="ts">
import type { BsPermissionItem, BsPermissionRole } from '@building-suit/ux'
const props = defineProps<{ items: BsPermissionItem[]; roles?: BsPermissionRole[]; label: string; editable?: boolean; selected?: string[]; disabled?: boolean; granted?: (role: string, permission: string) => boolean }>()
const emit = defineEmits<{ toggle: [key: string, checked: boolean] }>()
const columns = computed(() => [{ key: 'permission', header: props.label }, ...(props.editable ? [] : (props.roles ?? []).map(role => ({ key: role.key, header: role.label, align: 'center' as const })))])
</script>
<template>
  <BsDataTable :value="items" row-key="key" :label="label" row-group-mode="subheader" group-rows-by="section" :columns="columns">
    <template #cell-permission="{ row }">
      <BsFieldLabel v-if="editable">
        <BsCheckbox :checked="selected?.includes(row.key) ?? false" :disabled="disabled" bare @native-change="emit('toggle', row.key, ($event.target as HTMLInputElement).checked)" />
        <BsText as="span" emphasis="semibold">{{ row.label }}</BsText>
      </BsFieldLabel>
      <BsText v-else emphasis="semibold">{{ row.label }}</BsText>
    </template>
    <template v-for="role in editable ? [] : roles" :key="role.key" #[`cell-${role.key}`]="{ row }">
      <BsIcon v-if="granted?.(role.key, row.key)" name="check" :size="18" />
      <BsText v-else as="span" tone="muted">—</BsText>
    </template>
    <template #groupheader="{ data: row }"><BsBox surface="muted">{{ row.sectionLabel }}</BsBox></template>
    <template #empty><slot name="empty" /></template>
  </BsDataTable>
</template>
