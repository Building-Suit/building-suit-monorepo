<script setup lang="ts">
import type { NavigationGroup, NavigationLink } from '@building-suit/contracts'
withDefaults(defineProps<{ homePath?: string; productName: string; groups: NavigationGroup[]; mobileLinks?: NavigationLink[]; labels: { close: string; open: string; navigation: string; dashboard: string } }>(), { homePath: '/dashboard', mobileLinks: () => [] })
const route = useRoute()
const mobileNavOpen = ref(false)
const topHeader = ref<{ focusNavigationTrigger: () => void } | null>(null)
useTheme()
watch(() => route.fullPath, () => {
  if (mobileNavOpen.value) void closeMobileNav(false)
})
function isActive(to: string) { return route.path === to || route.path.startsWith(`${to}/`) }
async function closeMobileNav(restoreFocus = true) {
  mobileNavOpen.value = false
  if (restoreFocus) {
    await nextTick()
    topHeader.value?.focusNavigationTrigger()
  }
}
</script>
<template>
  <div class="min-h-dvh bg-background lg:grid lg:grid-cols-[17rem_1fr] lg:gap-4 lg:p-4">
    <BsSideMenu :open="mobileNavOpen" :home-path="homePath" :product-name="productName" :groups="groups" :labels="labels" @close="closeMobileNav">
      <template #logo><slot name="logo" /></template>
      <template #context><slot name="context" /></template>
    </BsSideMenu>

    <div class="flex min-w-0 flex-col">
      <BsTopHeader ref="topHeader" :navigation-open="mobileNavOpen" :open-navigation-label="labels.open" @open-navigation="mobileNavOpen = true">
        <slot name="header" />
      </BsTopHeader>

      <main class="mx-auto w-full max-w-[1440px] min-w-0 flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-6">
        <slot />
      </main>
    </div>

    <nav v-if="mobileLinks.length" :style="{ gridTemplateColumns: `repeat(${mobileLinks.length}, minmax(0, 1fr))` }" class="fixed inset-x-0 bottom-0 z-30 grid border-t border-[var(--bs-border)] bg-surface px-2 pb-[env(safe-area-inset-bottom)] shadow-raised lg:hidden" :aria-label="labels.navigation">
      <NuxtLink
        v-for="item in mobileLinks"
        :key="`mobile-${item.to}`"
        :to="item.to"
        class="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-fg-muted"
        :class="{ 'text-accent': isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <BsIcon v-if="item.icon" :name="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <slot name="overlays" />
  </div>
</template>
