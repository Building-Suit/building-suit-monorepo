<script setup lang="ts">
import type { BsWebsiteAddressView } from '../types/websiteAddressPresentation'
defineProps<{ view: BsWebsiteAddressView }>()
const value = defineModel<string>({ default: '' })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ edit: []; save: []; retry: [] }>()
</script>
<template>
  <BsPanel id="website-address" class="bs-website-address" padding="md">
    <BsHeading :level="2">{{ view.title }}</BsHeading>
    <BsText as="p" size="sm" tone="muted">{{ view.help }}</BsText>
    <BsText v-if="view.loading" role="status">{{ view.loadingLabel }}</BsText>
    <BsText v-else-if="view.denied" role="status">{{ view.deniedLabel }}</BsText>
    <BsAlert v-else-if="view.failed" tone="error">{{ view.failedLabel }} <BsButton @click="emit('retry')">{{ view.retry }}</BsButton></BsAlert>
    <BsStack v-else gap="sm">
      <BsText v-if="view.currentUrl" class="bs-website-address__url" as="p" dir="ltr">{{ view.currentUrl }}</BsText>
      <BsText v-for="alias in view.aliases" :key="alias" class="bs-website-address__url" as="p" size="sm" dir="ltr">{{ alias }}</BsText>
      <BsText v-if="view.success" role="status">{{ view.success }}</BsText>
      <BsButton @click="emit('edit')">{{ view.edit }}</BsButton>
    </BsStack>
    <BsRecordActionDialog v-model:visible="open" :title="view.title" :pending="view.pending" :dirty="view.dirty" :error="view.error" :submit-disabled="view.submitDisabled" :submit-label="view.save" :cancel-label="view.cancel" @submit="emit('save')">
      <BsField :label="view.label" for="website-address-slug" :help="view.rules" required>
        <BsInput id="website-address-slug" v-model="value" dir="ltr" autocomplete="off" :maxlength="50" required />
      </BsField>
    </BsRecordActionDialog>
  </BsPanel>
</template>

<style scoped>
.bs-website-address { min-width: 0; }
.bs-website-address__url { overflow-wrap: anywhere; }
</style>
