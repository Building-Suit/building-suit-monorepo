<script setup lang="ts">
defineProps<{
  navigationOpen: boolean
  openNavigationLabel: string
}>()

const emit = defineEmits<{ openNavigation: [] }>()
const header = ref<HTMLElement | null>(null)

function focusNavigationTrigger() {
  header.value?.querySelector<HTMLButtonElement>('[data-navigation-trigger]')?.focus()
}

defineExpose({ focusNavigationTrigger })
</script>

<template>
  <header ref="header" class="sticky top-0 z-20 flex min-h-16 min-w-0 items-center gap-2 border-b border-[var(--bs-border)] bg-surface/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4 lg:top-4 lg:rounded-card lg:border lg:px-6 lg:shadow-card">
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
