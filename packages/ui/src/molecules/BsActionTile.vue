<script setup lang="ts">
withDefaults(defineProps<{
  to?: string | Record<string, unknown>
  title?: string
  description?: string
  tone?: 'default' | 'accent' | 'danger'
  selected?: boolean
  disabled?: boolean
  external?: boolean
  ariaLabel?: string
}>(), {
  to: undefined, title: undefined, description: undefined, tone: 'default', selected: false,
  disabled: false, external: undefined, ariaLabel: undefined,
})

defineEmits<{ click: [event: MouseEvent] }>()
</script>

<template>
  <BsLink
    v-if="to"
    :to="to"
    :external="external"
    :disabled="disabled"
    variant="unstyled"
    class="bs-action-tile"
    :class="[`bs-action-tile--${tone}`, { 'bs-action-tile--selected': selected, 'bs-action-tile--disabled': disabled }]"
    :aria-label="ariaLabel"
    @click="$emit('click', $event)"
  >
    <slot name="leading" />
    <span class="bs-action-tile__content"><strong v-if="title">{{ title }}</strong><span v-if="description">{{ description }}</span><slot /></span>
    <slot name="trailing"><BsIcon name="arrowRight" directional /></slot>
  </BsLink>
  <button
    v-else
    type="button"
    class="bs-action-tile"
    :class="[`bs-action-tile--${tone}`, { 'bs-action-tile--selected': selected }]"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @click="$emit('click', $event)"
  >
    <slot name="leading" />
    <span class="bs-action-tile__content"><strong v-if="title">{{ title }}</strong><span v-if="description">{{ description }}</span><slot /></span>
    <slot name="trailing"><BsIcon name="arrowRight" directional /></slot>
  </button>
</template>
