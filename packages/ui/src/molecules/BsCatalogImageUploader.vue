<script setup lang="ts">
const props = defineProps<{
  preview: string
  name: string
  status: 'idle' | 'uploading' | 'uploaded' | 'error' | 'invalid'
  disabled?: boolean
  inputId: string
  describedby?: string
  copy: { choose: string; replace: string; remove: string; retry: string; help: string; uploading: string; uploaded: string; error: string; invalid: string; placeholder: string }
}>()
const emit = defineEmits<{ select: [file: File]; remove: []; retry: [] }>()
function select(value: File | File[] | null) { const file = Array.isArray(value) ? value[0] : value; if (file) emit('select', file) }
const busy = computed(() => props.disabled || props.status === 'uploading')
</script>
<template>
  <div class="bs-catalog-uploader" :aria-busy="status === 'uploading'">
    <BsCatalogImage local-preview :src="preview" :name="name" :placeholder="copy.placeholder" />
    <div class="bs-catalog-uploader__controls">
      <div class="bs-catalog-uploader__actions">
        <BsFileInput :input-id="inputId" :describedby="describedby" :label="preview ? copy.replace : copy.choose" accept="image/jpeg,image/png,image/webp" variant="button" hide-control reset-after-select :disabled="busy" @select="select" />
        <BsButton v-if="preview" variant="secondary" :disabled="busy" @click="emit('remove')">{{ copy.remove }}</BsButton>
        <BsButton v-if="status === 'error'" :disabled="disabled" @click="emit('retry')">{{ copy.retry }}</BsButton>
      </div>
      <p v-if="status === 'error' || status === 'invalid'" role="alert" class="bs-catalog-uploader__error">{{ status === 'invalid' ? copy.invalid : copy.error }}</p>
      <p v-else role="status"><BsIcon v-if="status === 'uploaded'" name="check" :size="12" />{{ status === 'uploading' ? copy.uploading : status === 'uploaded' ? copy.uploaded : copy.help }}</p>
      <progress v-if="status === 'uploading'" :aria-label="copy.uploading" />
    </div>
  </div>
</template>
<style scoped>
.bs-catalog-uploader { display: flex; gap: var(--bs-spacing-5); align-items: flex-start; }
.bs-catalog-uploader > :first-child { inline-size: 4rem; block-size: 4rem; flex-shrink: 0; border-radius: var(--bs-radius-chip); }
.bs-catalog-uploader__controls { min-inline-size: 0; flex: 1; }
.bs-catalog-uploader__actions { display: flex; flex-wrap: wrap; gap: var(--bs-spacing-4); }
.bs-catalog-uploader__actions :deep(.bs-file-input[data-variant='button']) { min-inline-size: 11.25rem; text-align: start; }
.bs-catalog-uploader__actions :deep(.bs-file-input__label) { inline-size: 100%; justify-content: flex-start; }
.bs-catalog-uploader__actions > :deep(.ls-btn) { min-inline-size: 8.75rem; min-block-size: var(--bs-tap-target-min); padding-block: var(--bs-space-2); border-color: var(--bs-primary); background: var(--bs-surface); }
@media (max-width: 639px) {
  .bs-catalog-uploader { gap: var(--bs-space-3); }
  .bs-catalog-uploader__actions :deep(.bs-file-input[data-variant='button']) { min-inline-size: 0; flex: 1 1 100%; }
  .bs-catalog-uploader__actions > :deep(.ls-btn) { min-inline-size: 0; }
}
.bs-catalog-uploader p { margin-block: var(--bs-spacing-1) 0; font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); }
.bs-catalog-uploader p[role='status'] { display: flex; gap: var(--bs-space-1); align-items: center; }
.bs-catalog-uploader__error { color: var(--bs-text); }
.bs-catalog-uploader progress { inline-size: 100%; accent-color: var(--bs-primary); }
</style>
