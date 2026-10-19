<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'shop'
  collapsed?: boolean
  collapseNavigationLabel?: string
  navigationOpen: boolean
  openNavigationLabel: string
}>()

const emit = defineEmits<{ openNavigation: []; toggleSidebar: [] }>()
const header = ref<HTMLElement | null>(null)

function focusNavigationTrigger() {
  header.value?.querySelector<HTMLButtonElement>('[data-navigation-trigger]')?.focus()
}

defineExpose({ focusNavigationTrigger })
</script>

<template>
  <header ref="header" class="sticky top-0 z-20 flex min-h-16 min-w-0 items-center gap-2 border-b border-[var(--bs-border)] bg-surface/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4 lg:px-6" :class="variant === 'shop' ? 'bs-shop-header' : 'lg:top-4 lg:rounded-card lg:border lg:shadow-card'">
    <BsButton
      data-navigation-trigger
      variant="icon"
      class="lg:hidden"
      :aria-label="openNavigationLabel"
      aria-controls="bs-primary-navigation"
      :aria-expanded="navigationOpen"
      @click="emit('openNavigation')"
    >
      <BsIcon name="menu" />
    </BsButton>

    <div class="min-w-0 flex-1"><slot name="leading" /></div>
    <div class="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2"><slot /></div>
  </header>
</template>

<style scoped>
/* Match Shop Suit's floating side navigation; other Suits are unchanged. */
.bs-shop-header {
  top: 14px;
  min-block-size: 64px;
  margin: 14px 14px 0;
  padding-block: 9px;
  padding-inline: 13px;
  border: 1px solid var(--bs-border);
  border-radius: var(--bs-radius-large);
  background: var(--bs-surface);
  color: var(--bs-text);
  box-shadow: var(--bs-elevation-2);
  backdrop-filter: none;
}
.bs-shop-header :deep([aria-controls='bs-primary-navigation']) {
  inline-size: 44px; block-size: 44px; border-radius: 12px;
  background: var(--bs-surface-muted); color: var(--bs-text);
  transition: background var(--bs-motion-default), color var(--bs-motion-default);
}
.bs-shop-header :deep([aria-controls='bs-primary-navigation']:hover) {
  background: color-mix(in oklab, var(--bs-primary) 9%, var(--bs-surface));
  color: var(--bs-primary);
}
@media (min-width: 1024px) {
  .bs-shop-header { margin-inline: 0; }
  .bs-shop-header :deep(.bs-scope-switcher[data-compact]) { inline-size: 11.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .bs-shop-header :deep([aria-controls='bs-primary-navigation']) { transition-duration: 0.01ms; }
}
</style>
