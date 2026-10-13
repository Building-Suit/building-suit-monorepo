<script setup lang="ts">
defineProps<{ title: string; description?: string; pending?: boolean; error?: string | null; approveLabel: string; rejectLabel: string; canApprove?: boolean; canReject?: boolean }>()
const emit = defineEmits<{ approve: []; reject: [] }>()
</script>

<template>
  <BsStack gap="md">
    <BsSectionHeader :title="title" :description="description" />
    <BsAlert v-if="error" tone="error">{{ error }}</BsAlert>
    <fieldset class="bs-workflow-fields" :disabled="pending">
      <slot />
    </fieldset>
    <BsFormActions>
      <BsButton v-if="canReject" variant="danger" :disabled="pending" @click="emit('reject')">{{ rejectLabel }}</BsButton>
      <BsButton v-if="canApprove" variant="primary" :pending="pending" @click="emit('approve')">{{ approveLabel }}</BsButton>
    </BsFormActions>
  </BsStack>
</template>
