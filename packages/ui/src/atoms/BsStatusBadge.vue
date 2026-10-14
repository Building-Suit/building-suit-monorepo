<script setup lang="ts">
/**
 * Status is always spelled out in words; colour is a secondary cue only, so the
 * table stays readable without colour vision.
 *
 * Gold is deliberately absent: per the brand guidelines gold is not a status
 * colour, it marks the single focal point of a screen.
 */
type StatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  status: string | null | undefined
  label?: string
  tone?: StatusTone
  icon?: string | false
}>(), { label: undefined, tone: undefined, icon: undefined })

const { t, te } = useI18n()

const STATUS_TONES: Record<string, StatusTone> = {
  posted: 'success', completed: 'success', valid: 'success', paid: 'success', active: 'success', passed: 'success', approved: 'success', succeeded: 'success', merged: 'success', finished: 'success',
  trialing: 'info', scheduled: 'info', reversed: 'info', running: 'info', in_progress: 'info', verification: 'info', open: 'info', planned: 'info', queued: 'info',
  grace_period: 'warning', checkout_required: 'warning', pending: 'warning', processing: 'warning', partial: 'warning', pending_approval: 'warning', due: 'warning', due_soon: 'warning', partially_paid: 'warning', blocked: 'warning', not_run: 'warning', stopped: 'warning',
  read_only: 'danger', failed: 'danger', fail: 'danger', invalid: 'danger', overdue: 'danger', critical: 'danger',
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-[var(--bs-surface-muted)] text-[var(--bs-text-muted)]',
  success: 'bg-[var(--bs-status-success-bg)] text-[var(--bs-status-success)]',
  info: 'bg-[var(--bs-status-info-bg)] text-[var(--bs-status-info)]',
  warning: 'bg-[var(--bs-status-warning-bg)] text-[var(--bs-status-warning)]',
  danger: 'bg-[var(--bs-status-error-bg)] text-[var(--bs-status-error)]',
}

const key = computed(() => props.status ?? 'unknown')
const label = computed(() => props.label ?? (
  te(`status.${key.value}`) ? t(`status.${key.value}`) : key.value.replace(/_/g, ' ')
))
const tone = computed<StatusTone>(() => props.tone ?? STATUS_TONES[key.value] ?? 'neutral')
const klass = computed(() => TONE_CLASSES[tone.value])
const icon = computed(() => {
  if (props.icon === false) return null
  if (props.icon) return props.icon
  if (tone.value === 'success') return 'checkBadge'
  if (tone.value === 'danger') return 'close'
  return 'notification'
})
</script>

<template>
  <span class="ls-badge" :class="klass"><BsIcon v-if="icon" :name="icon" :size="14" />{{ label }}</span>
</template>
