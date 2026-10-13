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
  <header ref="header" class="sticky top-0 z-20 flex min-h-16 min-w-0 items-center gap-2 border-b border-[var(--bs-border)] bg-surface/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4 lg:px-6" :class="variant === 'shop' ? 'bs-shop-header lg:top-0' : 'lg:top-4 lg:rounded-card lg:border lg:shadow-card'">
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

    <BsButton v-if="variant === 'shop'" variant="icon" class="hidden lg:inline-flex" :aria-label="collapsed ? openNavigationLabel : (collapseNavigationLabel || openNavigationLabel)" :aria-expanded="!collapsed" aria-controls="bs-primary-navigation" @click="emit('toggleSidebar')"><BsIcon name="menu" /></BsButton>
    <div class="min-w-0 flex-1"><slot name="leading" /></div>
    <div class="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2"><slot /></div>
  </header>
</template>

<style scoped>
.bs-shop-header { padding-block: 0; background: var(--bs-surface); backdrop-filter: none; }
@media (min-width: 1024px) {
  .bs-shop-header :deep(.bs-scope-switcher[data-compact]) { inline-size: 11.5rem; }
}
</style>
