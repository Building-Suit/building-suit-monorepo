<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  pending?: boolean
  disabled?: boolean
  error?: string | null
  pendingLabel?: string
  layout?: 'stack' | 'grid'
  columns?: 1 | 2 | 3 | 4
}>(), {
  pending: false,
  disabled: false,
  error: null,
  pendingLabel: undefined,
  layout: 'stack',
  columns: 1,
})
const emit = defineEmits<{ submit: [event: Event] }>()
const ui = useUiCopy()
const attrs = useAttrs()
const formAttrs = () => Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== 'class'))
const errorId = useId()
const summary = ref<HTMLElement | null>(null)
watch(() => props.error, async (error) => {
  if (error) { await nextTick(); summary.value?.focus() }
})
async function submit(event: Event) {
  if (props.pending) return
  emit('submit', event)
  await nextTick()
  if (props.error) summary.value?.focus()
}
</script>

<template>
  <form v-bind="formAttrs()" :aria-busy="pending" :aria-describedby="error ? errorId : undefined" @submit.prevent="submit">
    <p v-if="error" :id="errorId" ref="summary" role="alert" tabindex="-1" class="ls-error bs-form-error mb-4">{{ error }}</p>
    <p v-if="pending" role="status" class="bs-form-pending">{{ pendingLabel || ui('saving') }}</p>
    <fieldset
      :disabled="pending || disabled"
      :inert="pending || undefined"
      :class="$attrs.class"
      class="bs-form-fields"
      :data-layout="layout"
      :data-columns="columns"
    ><slot :disabled="pending || disabled" /></fieldset>
  </form>
</template>

<style>
.bs-form-error { color: var(--bs-text); }
.bs-form-fields { min-width: 0; border: 0; padding: 0; margin: 0; }
.bs-form-pending { margin: 0 0 var(--bs-space-3); color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); }
.bs-form-fields[data-layout='stack'], .bs-form-fields[data-layout='grid'] { display: grid; gap: var(--bs-space-5); }
.bs-form-fields[data-layout='grid'][data-columns='2'] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bs-form-fields[data-layout='grid'][data-columns='3'] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.bs-form-fields[data-layout='grid'][data-columns='4'] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 639px) { .bs-form-fields[data-layout='grid'] { grid-template-columns: minmax(0, 1fr) !important; } }
</style>
