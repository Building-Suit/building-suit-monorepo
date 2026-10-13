<script setup lang="ts">
import type { BsAdminAuditTable, BsAdminCommerceCopy } from '../types/platformAdministrationPresentation'
withDefaults(defineProps<{ title: string; copy: BsAdminCommerceCopy; view: BsAdminAuditTable; paginated?: boolean; showActor?: boolean }>(), { paginated: true, showActor: true })
const emit = defineEmits<{ page: [event: { page: number }]; retry: [] }>()
</script>
<template>
  <BsDataTable :value="view.rows" :loading="view.loading" :error="view.error" :label="title" data-key="id" lazy :paginator="paginated" :rows="25" :first="view.first" :total-records="view.total" :always-show-paginator="false" :columns="[{ key: 'tenant', field: 'tenant', header: copy.tenant }, { key: 'action', field: 'action', header: copy.action }, { key: 'reason', field: 'reason', header: copy.reason }, { key: 'actor', field: 'actor', header: copy.actor, hidden: !showActor }, { key: 'occurred', field: 'occurred', header: copy.occurred }]" @page="emit('page', $event)" @retry="emit('retry')"><template #empty>{{ copy.noEvents }}</template></BsDataTable>
</template>
