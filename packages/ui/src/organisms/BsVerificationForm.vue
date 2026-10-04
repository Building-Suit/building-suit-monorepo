<script setup lang="ts">
const code = defineModel<string>({ required: true })

const props = withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description: string
  email: string
  codeLabel: string
  pending?: boolean
  error?: string | null
  notice?: string | null
  expired?: boolean
  verified?: boolean
  expiryLabel?: string
  expiredLabel: string
  attemptsLabel?: string
  submitLabel: string
  pendingLabel?: string
  resendPrompt?: string
  resendLabel: string
  resendDisabled?: boolean
  securityTitle?: string
  securityBody?: string
}>(), {
  eyebrow: undefined,
  pending: false,
  error: null,
  notice: null,
  expired: false,
  verified: false,
  expiryLabel: undefined,
  attemptsLabel: undefined,
  pendingLabel: undefined,
  resendPrompt: undefined,
  resendDisabled: false,
  securityTitle: undefined,
  securityBody: undefined,
})

const emit = defineEmits<{ submit: [event: Event]; resend: [] }>()
defineSlots<{ secondary(): unknown; footer(): unknown }>()
const submitDisabled = computed(() => props.pending || (!props.verified && (code.value.length !== 6 || props.expired)))
</script>

<template>
  <div class="bs-verification-form">
    <BsForm :pending="pending" :error="error" @submit="emit('submit', $event)">
      <div class="bs-verification-form__intro">
      <div class="bs-verification-form__icon"><AppIcon name="mail" :size="28" /></div>
      <p v-if="eyebrow" class="bs-verification-form__eyebrow">{{ eyebrow }}</p>
      <h1 class="bs-verification-form__title">{{ title }}</h1>
      <p class="bs-verification-form__description">{{ description }}</p>
      <p class="bs-verification-form__email" dir="ltr">{{ email }}</p>
      </div>

      <div class="bs-verification-form__body">
      <OtpInput v-if="!verified" v-model="code" :label="codeLabel" :disabled="pending || expired" />
      <div v-if="!verified && (expiryLabel || expired || attemptsLabel)" class="bs-verification-form__timer" aria-live="polite">
        <span v-if="!expired">{{ expiryLabel }}</span>
        <span v-else class="bs-verification-form__expired">{{ expiredLabel }}</span>
        <span v-if="attemptsLabel">{{ attemptsLabel }}</span>
      </div>
      <p v-if="notice" role="status" class="bs-verification-form__notice">{{ notice }}</p>
      <BsButton type="submit" variant="primary" class="w-full" :pending="pending" :disabled="submitDisabled">
        {{ pending && pendingLabel ? pendingLabel : submitLabel }}
      </BsButton>
      <div v-if="!verified" class="bs-verification-form__resend">
        <span v-if="resendPrompt">{{ resendPrompt }}</span>
        <BsButton variant="link" type="button" :disabled="pending || resendDisabled" @click="emit('resend')">{{ resendLabel }}</BsButton>
      </div>
      <div v-if="$slots.secondary" class="bs-verification-form__secondary"><slot name="secondary" /></div>
      <aside v-if="securityTitle || securityBody" class="bs-verification-form__security">
        <p v-if="securityTitle" class="font-bold text-fg">{{ securityTitle }}</p>
        <p v-if="securityBody" class="mt-1">{{ securityBody }}</p>
      </aside>
      <footer v-if="$slots.footer" class="bs-verification-form__footer"><slot name="footer" /></footer>
      </div>
    </BsForm>
  </div>
</template>

<style>
.bs-verification-form { width: 100%; padding: var(--bs-space-6); border: 1px solid color-mix(in oklab, var(--bs-border) 88%, transparent); border-radius: 20px; background: color-mix(in oklab, var(--bs-surface) 94%, transparent); box-shadow: 0 24px 64px rgb(0 0 0 / .18), 0 1px 0 rgb(255 255 255 / .04) inset; }
.bs-verification-form__intro { max-width: 32rem; margin-inline: auto; text-align: center; }
.bs-verification-form__icon { display: grid; width: 3.5rem; height: 3.5rem; margin-inline: auto; place-items: center; border-radius: 999px; background: var(--bs-surface-muted); color: var(--bs-primary); }
.bs-verification-form__eyebrow { margin-top: var(--bs-space-6); color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); font-weight: var(--bs-weight-bold); letter-spacing: .18em; text-transform: uppercase; }
.bs-verification-form__title { margin-top: var(--bs-space-2); font-size: 1.5rem; font-weight: var(--bs-weight-extrabold); }
.bs-verification-form__description { margin-top: var(--bs-space-3); color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); line-height: 1.5rem; }
.bs-verification-form__email { margin-top: var(--bs-space-1); overflow-wrap: anywhere; font-weight: var(--bs-weight-bold); }
.bs-verification-form__body { display: grid; max-width: 27rem; margin: var(--bs-space-8) auto 0; gap: var(--bs-space-5); }
.bs-verification-form__timer { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-space-4); color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); }
.bs-verification-form__expired { color: var(--bs-status-error); font-weight: var(--bs-weight-semibold); }
.bs-verification-form__notice, .bs-verification-form__security { padding: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); background: var(--bs-surface-muted); color: var(--bs-text-muted); font-size: var(--bs-type-caption-size); line-height: var(--bs-type-caption-lh); }
.bs-verification-form__resend, .bs-verification-form__secondary, .bs-verification-form__footer { text-align: center; color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); }
@media (min-width: 640px) { .bs-verification-form { padding: var(--bs-space-8); } }
@media (max-width: 1023px) { .bs-verification-form { box-shadow: var(--bs-elevation-2); } }
:lang(ar) .bs-verification-form__eyebrow, [dir='rtl'] .bs-verification-form__eyebrow { letter-spacing: normal; text-transform: none; }
</style>
