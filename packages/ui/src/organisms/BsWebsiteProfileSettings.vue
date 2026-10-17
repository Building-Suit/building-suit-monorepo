<script setup lang="ts">
import type { BsWebsiteProfileForm, BsWebsiteProfileView } from '../types/websiteProfilePresentation'
defineProps<{ view: BsWebsiteProfileView }>()
const form = defineModel<BsWebsiteProfileForm>('form', { required: true })
const open = defineModel<boolean>('open', { default: false })
const optIn = defineModel<boolean>('optIn', { default: false })
const emit = defineEmits<{ edit: []; save: []; retry: []; publish: []; unpublish: []; selectLogo: [file: File | File[] | null]; removeLogo: [] }>()
function update(key: Exclude<keyof BsWebsiteProfileForm, 'locations'>, value: string | number) { form.value = { ...form.value, [key]: String(value) } }
function updateLocation(id: string, key: 'visible' | 'publicName' | 'address', value: string | number | boolean) {
  const existing = form.value.locations.find(v => v.id === id) ?? { id, visible: false, publicName: '', address: '' }
  form.value = { ...form.value, locations: [...form.value.locations.filter(v => v.id !== id), { ...existing, [key]: value }] }
}
</script>
<template>
  <BsPanel id="website-profile" padding="md">
    <BsHeading :level="2">{{ view.title }}</BsHeading>
    <BsText as="p" tone="muted">{{ view.help }}</BsText>
    <BsText v-if="view.loading" role="status">{{ view.copy.loading }}</BsText>
    <BsText v-else-if="view.denied" role="status">{{ view.copy.denied }}</BsText>
    <BsAlert v-else-if="view.failed" tone="error">{{ view.copy.failed }} <BsButton @click="emit('retry')">{{ view.copy.retry }}</BsButton></BsAlert>
    <BsStack v-else gap="md">
      <BsText emphasis="semibold">{{ view.state }}</BsText>
      <BsText v-if="view.url" class="bs-website-profile__url" dir="ltr">{{ view.url }}</BsText>
      <BsImage v-if="view.logo" :src="view.logo" :alt="view.title" :width="96" :height="96" fit="contain" />
      <BsText v-if="view.success" role="status">{{ view.success }}</BsText>
      <BsAlert v-if="view.error && !open" tone="error">{{ view.error }}</BsAlert>
      <BsText emphasis="semibold">{{ view.copy.readiness }}</BsText>
      <BsText v-for="reason in view.missing" :key="reason" as="p" size="sm">{{ reason }}</BsText>
      <BsText as="p" size="sm" tone="muted">{{ view.copy.catalogPending }}</BsText>
      <BsInline wrap>
        <BsButton :disabled="!view.canEdit || view.pending" @click="emit('edit')">{{ view.copy.edit }}</BsButton>
        <BsButton :disabled="!view.canUnpublish || view.pending" @click="emit('unpublish')">{{ view.copy.unpublish }}</BsButton>
      </BsInline>
      <BsCheckbox v-model="optIn" :label="view.copy.optIn" :disabled="!view.canConsent || view.pending" />
      <BsButton :disabled="!view.canPublish || !optIn || view.pending" @click="emit('publish')">{{ view.copy.publish }}</BsButton>
    </BsStack>
    <BsRecordActionDialog v-model:visible="open" :title="view.title" :pending="view.pending" :dirty="view.dirty" :error="view.error" :submit-label="view.copy.save" :cancel-label="view.copy.cancel" :submit-disabled="!view.canEdit" pinned-actions @submit="emit('save')">
      <BsField v-slot="field" :label="view.copy.logo" :help="view.copy.logoHelp">
        <BsFileInput :input-id="field.id" accept="image/png,image/jpeg,image/webp" :label="view.copy.logo" :reset-after-select="true" @select="emit('selectLogo', $event)" />
        <BsButton v-if="view.logo" @click="emit('removeLogo')">{{ view.copy.removeLogo }}</BsButton>
      </BsField>
      <BsField v-for="key in (['publicName','description','phone','whatsapp','email','openingHours','seoTitle','seoDescription'] as const)" :key="key" v-slot="field" :label="view.copy[key]">
        <BsTextarea v-if="key === 'openingHours' || key === 'description' || key === 'seoDescription'" :id="field.id" :model-value="form[key]" :maxlength="key === 'openingHours' ? 1000 : key === 'description' ? 320 : 170" :aria-describedby="field.describedby" @update:model-value="update(key,$event)" />
        <BsInput v-else :id="field.id" :model-value="form[key]" :type="key === 'email' ? 'email' : 'text'" :maxlength="key === 'publicName' ? 120 : key === 'seoTitle' ? 70 : 254" :aria-describedby="field.describedby" @update:model-value="update(key,$event)" />
      </BsField>
      <BsFieldGroup :legend="view.copy.locations">
        <BsStack v-for="location in view.locationOptions" :key="location.id" gap="sm">
          <BsCheckbox :model-value="form.locations.find(v => v.id === location.id)?.visible ?? false" :label="`${view.copy.visible}: ${location.label}`" :disabled="!location.canShow && !(form.locations.find(v => v.id === location.id)?.visible ?? false)" @update:model-value="updateLocation(location.id,'visible',$event === true)" />
          <BsField v-slot="field" :label="view.copy.publicName"><BsInput :id="field.id" :model-value="form.locations.find(v => v.id === location.id)?.publicName ?? ''" :maxlength="120" @update:model-value="updateLocation(location.id,'publicName',$event)" /></BsField>
          <BsField v-slot="field" :label="view.copy.address"><BsInput :id="field.id" :model-value="form.locations.find(v => v.id === location.id)?.address ?? ''" :maxlength="500" @update:model-value="updateLocation(location.id,'address',$event)" /></BsField>
        </BsStack>
      </BsFieldGroup>
    </BsRecordActionDialog>
  </BsPanel>
</template>
<style scoped>
.bs-website-profile__url { overflow-wrap: anywhere; }
</style>
