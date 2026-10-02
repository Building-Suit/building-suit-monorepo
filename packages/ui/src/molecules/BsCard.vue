<script setup lang="ts">
const props = withDefaults(defineProps<{
  as?: 'article' | 'section' | 'div'
  title?: string
  subtitle?: string
  headingLevel?: 2 | 3 | 4 | 5 | 6
  variant?: 'default' | 'flat'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}>(), {
  as: 'article',
  title: undefined,
  subtitle: undefined,
  headingLevel: 2,
  variant: 'default',
  padding: 'md',
})

const slots = useSlots()
const heading = computed(() => `h${props.headingLevel}` as const)
</script>

<template>
  <component
    :is="as"
    :class="[
      variant === 'flat' ? 'ls-card-flat' : 'ls-card',
      { 'p-3': padding === 'sm', 'p-5': padding === 'md', 'p-6': padding === 'lg' },
    ]"
  >
    <header v-if="title || subtitle || slots.header || slots.actions" class="flex min-w-0 items-start justify-between gap-4">
      <slot name="header">
        <div class="min-w-0">
          <component :is="heading" v-if="title" class="text-h3 font-bold">{{ title }}</component>
          <p v-if="subtitle" class="mt-1 text-sm text-fg-muted">{{ subtitle }}</p>
        </div>
      </slot>
      <div v-if="slots.actions" class="flex shrink-0 flex-wrap items-center justify-end gap-2"><slot name="actions" /></div>
    </header>
    <div :class="{ 'mt-4': title || subtitle || slots.header || slots.actions }"><slot /></div>
    <footer v-if="slots.footer" class="mt-4 border-t border-line pt-4"><slot name="footer" /></footer>
  </component>
</template>
