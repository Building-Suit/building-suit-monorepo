<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description?: string
  pending?: boolean
  error?: string | null
  submitLabel?: string
  pendingLabel?: string
  submitDisabled?: boolean
  align?: 'start' | 'center'
}>(), {
  eyebrow: undefined,
  description: undefined,
  pending: false,
  error: null,
  submitLabel: undefined,
  pendingLabel: undefined,
  submitDisabled: false,
  align: 'center',
})

const emit = defineEmits<{ submit: [event: Event] }>()
defineSlots<{
  default(): unknown
  actions(): unknown
  footer(): unknown
}>()
</script>

<template>
  <div class="bs-auth-form">
    <BsForm v-bind="$attrs" :pending="pending" :error="error" @submit="emit('submit', $event)">
      <header class="bs-auth-form__header" :class="`bs-auth-form__header--${align}`">
        <p v-if="eyebrow" class="bs-auth-form__eyebrow">{{ eyebrow }}</p>
        <h1 class="bs-auth-form__title">{{ title }}</h1>
        <p v-if="description" class="bs-auth-form__description">{{ description }}</p>
      </header>

      <div class="bs-auth-form__body"><slot /></div>

      <div v-if="$slots.actions || submitLabel" class="bs-auth-form__actions">
        <slot name="actions">
          <BsButton type="submit" variant="primary" class="w-full" :pending="pending" :disabled="submitDisabled">
            {{ pending && pendingLabel ? pendingLabel : submitLabel }}
          </BsButton>
        </slot>
      </div>

      <footer v-if="$slots.footer" class="bs-auth-form__footer"><slot name="footer" /></footer>
    </BsForm>
  </div>
</template>

<style>
.bs-auth-form {
  width: 100%;
  padding: var(--bs-space-6);
  border: 1px solid color-mix(in oklab, var(--bs-border) 88%, transparent);
  border-radius: 20px;
  background: color-mix(in oklab, var(--bs-surface) 94%, transparent);
  box-shadow: 0 24px 64px rgb(0 0 0 / .18), 0 1px 0 rgb(255 255 255 / .04) inset;
}
.bs-auth-form__header { margin-bottom: var(--bs-space-6); }
.bs-auth-form__header--center { text-align: center; }
.bs-auth-form__header--start { text-align: start; }
.bs-auth-form__eyebrow { color: var(--bs-accent); font-size: 11px; font-weight: var(--bs-weight-bold); letter-spacing: .12em; }
.bs-auth-form__title { margin-top: var(--bs-space-2); font-size: 1.25rem; font-weight: var(--bs-weight-extrabold); letter-spacing: -.03em; }
.bs-auth-form__description { margin-top: var(--bs-space-2); color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); line-height: var(--bs-type-body-m-lh); }
.bs-auth-form__body { display: grid; gap: var(--bs-space-5); }
.bs-auth-form__actions { margin-top: var(--bs-space-6); }
.bs-auth-form__footer { margin-top: var(--bs-space-5); color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); text-align: center; }
@media (min-width: 640px) { .bs-auth-form { padding: var(--bs-space-8); } }
@media (max-width: 1023px) { .bs-auth-form { box-shadow: var(--bs-elevation-2); } }
:lang(ar) .bs-auth-form__eyebrow, [dir='rtl'] .bs-auth-form__eyebrow { letter-spacing: normal; }
</style>
