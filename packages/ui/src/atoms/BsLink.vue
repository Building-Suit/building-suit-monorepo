<script setup lang="ts">
const props = withDefaults(defineProps<{
  to: string | Record<string, unknown>
  external?: boolean
  target?: '_self' | '_blank' | '_parent' | '_top'
  rel?: string
  variant?: 'default' | 'muted' | 'standalone' | 'unstyled'
  underline?: 'hover' | 'always' | 'none'
  ariaLabel?: string
  disabled?: boolean
  tabindex?: number
}>(), { external: undefined, target: undefined, rel: undefined, variant: 'default', underline: 'hover', ariaLabel: undefined, disabled: false, tabindex: undefined })

const isExternal = computed(() => props.external ?? (typeof props.to === 'string' && /^(?:https?:|mailto:|tel:)/.test(props.to)))
const safeRel = computed(() => props.rel ?? (props.target === '_blank' ? 'noopener noreferrer' : undefined))
const emit = defineEmits<{ click: [event: MouseEvent] }>()
function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <a
    v-if="isExternal"
    :href="typeof to === 'string' ? to : undefined"
    class="bs-link"
    :class="[`bs-link--${variant}`, `bs-link--underline-${underline}`]"
    :target="target"
    :rel="safeRel"
    :aria-label="ariaLabel"
    :aria-disabled="disabled || undefined"
    :tabindex="disabled ? -1 : tabindex"
    @click="onClick"
  ><slot /></a>
  <NuxtLink v-else :to="to" class="bs-link" :class="[`bs-link--${variant}`, `bs-link--underline-${underline}`]" :aria-label="ariaLabel" :aria-disabled="disabled || undefined" :tabindex="disabled ? -1 : tabindex" @click="onClick"><slot /></NuxtLink>
</template>
