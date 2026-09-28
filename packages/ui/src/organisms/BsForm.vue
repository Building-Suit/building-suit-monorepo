<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ pending?: boolean; error?: string | null }>(), { pending: false, error: null })
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
    <p v-if="pending" role="status" class="mb-3 text-sm text-fg-muted">{{ ui('saving') }}</p>
    <fieldset :disabled="pending" :inert="pending" :class="$attrs.class" class="bs-form-fields"><slot /></fieldset>
  </form>
</template>

<style>
.bs-form-error { color: var(--bs-text); }
.bs-form-fields { min-width: 0; border: 0; padding: 0; margin: 0; }
</style>
