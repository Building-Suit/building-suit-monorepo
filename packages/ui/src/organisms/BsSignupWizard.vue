<script setup lang="ts">
export interface SignupWizardStep {
  id: string | number
  title: string
  body?: string
}

const props = withDefaults(defineProps<{
  step: number
  steps: SignupWizardStep[]
  pending?: boolean
  error?: string | null
  notice?: string | null
  backLabel?: string
  submitLabel: string
  pendingLabel?: string
  submitDisabled?: boolean
}>(), {
  pending: false,
  error: null,
  notice: null,
  backLabel: undefined,
  pendingLabel: undefined,
  submitDisabled: false,
})

const emit = defineEmits<{ back: [] }>()
const ui = useUiCopy()
const current = computed(() => props.steps[props.step - 1])
</script>
<template>
  <section class="bs-signup-wizard" :aria-labelledby="`signup-step-${current?.id}`">
    <ol class="bs-signup-wizard__steps" :aria-label="ui('step')">
      <li
        v-for="(item, index) in steps"
        :key="item.id"
        class="bs-signup-wizard__step"
        :data-state="index + 1 === step ? 'current' : index + 1 < step ? 'complete' : 'upcoming'"
        :aria-current="index + 1 === step ? 'step' : undefined"
      >
        <span class="bs-signup-wizard__number">{{ index + 1 }}</span>
        <div class="bs-signup-wizard__step-copy"><p>{{ item.title }}</p><small v-if="item.body">{{ item.body }}</small></div>
      </li>
    </ol>
    <header class="bs-signup-wizard__header">
      <div><p class="bs-signup-wizard__count">{{ ui('step') }} {{ step }} / {{ steps.length }}</p><h2 :id="`signup-step-${current?.id}`">{{ current?.title }}</h2></div>
    </header>
    <div class="bs-signup-wizard__content"><slot :step="step" :step-descriptor="current" /></div>
    <p v-if="notice" role="status" class="bs-signup-wizard__notice">{{ notice }}</p>
    <p v-if="error" role="alert" tabindex="-1" class="ls-error bs-signup-wizard__error">{{ error }}</p>
    <div class="bs-signup-wizard__actions">
      <BsButton v-if="step > 1" type="button" variant="secondary" :disabled="pending" @click="emit('back')">{{ backLabel || ui('previous') }}</BsButton>
      <BsButton type="submit" variant="primary" :pending="pending" :disabled="submitDisabled" class="bs-signup-wizard__submit">{{ pending && pendingLabel ? pendingLabel : submitLabel }}</BsButton>
    </div>
    <div v-if="$slots.footer" class="bs-signup-wizard__footer"><slot name="footer" /></div>
  </section>
</template>

<style>
.bs-signup-wizard { display: grid; gap: var(--bs-space-6); }
.bs-signup-wizard__steps { display: flex; gap: var(--bs-space-3); padding: 0; margin: 0; list-style: none; }
.bs-signup-wizard__step { display: flex; min-width: 0; flex: 1 1 0; align-items: flex-start; gap: var(--bs-space-2); }
.bs-signup-wizard__step[data-state='upcoming'] { opacity: .55; }
.bs-signup-wizard__number { display: grid; width: 2rem; height: 2rem; flex: 0 0 auto; place-items: center; border: 1px solid var(--bs-border); border-radius: 999px; font-size: var(--bs-type-caption-size); font-weight: var(--bs-weight-bold); }
.bs-signup-wizard__step[data-state='current'] .bs-signup-wizard__number { border-color: var(--bs-primary); background: var(--bs-primary); color: var(--bs-text-on-primary); }
.bs-signup-wizard__step[data-state='complete'] .bs-signup-wizard__number { border-color: var(--bs-accent); }
.bs-signup-wizard__step-copy { min-width: 0; }
.bs-signup-wizard__step-copy p { font-size: var(--bs-type-body-m-size); font-weight: var(--bs-weight-bold); }
.bs-signup-wizard__step-copy small { display: block; color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); }
.bs-signup-wizard__header { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-3); }
.bs-signup-wizard__header h2 { font-size: 1.25rem; font-weight: var(--bs-weight-extrabold); }
.bs-signup-wizard__count { margin-bottom: var(--bs-space-1); color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); }
.bs-signup-wizard__content { min-width: 0; }
.bs-signup-wizard__notice { padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); background: var(--bs-surface-muted); color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); }
.bs-signup-wizard__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--bs-space-3); }
.bs-signup-wizard__submit { min-width: min(100%, 12rem); }
.bs-signup-wizard__footer { color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); text-align: center; }
@media (max-width: 639px) {
  .bs-signup-wizard__steps { gap: var(--bs-space-2); }
  .bs-signup-wizard__step { display: block; }
  .bs-signup-wizard__step-copy { margin-top: var(--bs-space-1); }
  .bs-signup-wizard__step-copy small { display: none; }
  .bs-signup-wizard__actions { align-items: stretch; flex-direction: column-reverse; }
  .bs-signup-wizard__actions > * { width: 100%; }
}
</style>
