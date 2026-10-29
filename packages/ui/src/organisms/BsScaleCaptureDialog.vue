<script setup lang="ts">
import type { BsScaleCaptureCopy, BsScaleCaptureForm, BsScaleCaptureView } from '../types/scaleCapturePresentation'
defineProps<{ copy: BsScaleCaptureCopy; view: BsScaleCaptureView; form: BsScaleCaptureForm }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ profile: [id: string]; product: [id: string]; search: [query: string]; more: []; retry: []; connect: []; disconnect: []; read: []; tare: []; submit: [] }>()
</script>
<template>
 <BsRecordActionDialog v-model:visible="visible" :title="copy.title" :dirty="view.dirty" :pending="view.pending" :close-blocked="view.locked" :error="view.error" :submit-label="copy.confirm" :submit-disabled="!view.canSubmit" :cancel-label="copy.close" pinned-actions size="lg" @submit="emit('submit')">
  <BsText as="p" tone="muted">{{ view.notice }}</BsText>
  <BsLink v-if="view.setupTo" :to="view.setupTo">{{ copy.setup }}</BsLink>
  <BsText v-if="view.loading" role="status">{{ copy.loading }}</BsText>
  <BsField v-slot="f" for="scale-device" :label="copy.device"><BsSelect :input-id="f.id" :label="copy.device" :model-value="form.profileId" :options="view.profiles" option-label="label" option-value="value" :disabled="view.deviceLocked || view.loading" @update:model-value="emit('profile',String($event??''))" /></BsField>
  <BsText v-if="view.deviceNotice" as="p" size="sm">{{ view.deviceNotice }}</BsText>
  <BsEntityPicker :model-value="form.productId" :label="copy.product" :options="view.products" option-label="name" option-value="id" :loading="view.productLoading" :error="view.productError" :has-more="view.productHasMore" :load-more-label="copy.more" :retry-label="copy.retry" :disabled="view.productLocked || view.loading" @update:model-value="emit('product',String($event??''))" @search="emit('search',$event)" @load-more="emit('more')" @retry="emit('retry')" />
  <BsDescriptionList v-if="view.fields.length" :columns="2" density="compact"><BsDescriptionItem v-for="field in view.fields" :key="field.label" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList>
  <BsText v-if="view.factorNotice" as="p" size="sm">{{ view.factorNotice }}</BsText>
  <BsInline wrap><BsButton :disabled="!view.canConnect" @click="emit('connect')">{{ copy.connect }}</BsButton><BsButton :disabled="!view.canDisconnect" variant="secondary" @click="emit('disconnect')">{{ copy.disconnect }}</BsButton><BsButton :disabled="!view.canRead" @click="emit('read')">{{ copy.read }}</BsButton><BsButton :disabled="!view.canTare" variant="secondary" @click="emit('tare')">{{ copy.tare }}</BsButton></BsInline>
  <BsText role="status">{{ copy.status }}: {{ view.status }}</BsText>
 </BsRecordActionDialog>
</template>
