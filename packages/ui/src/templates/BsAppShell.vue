<script setup lang="ts">
import type { NavigationGroup, NavigationLink } from '@building-suit/contracts'
withDefaults(defineProps<{ variant?: 'default' | 'shop'; floatingActions?: boolean; homePath?: string; productName: string; groups: NavigationGroup[]; mobileLinks?: NavigationLink[]; labels: { collapse?: string; close: string; open: string; navigation: string; dashboard: string } }>(), { variant: 'default', floatingActions: false, homePath: '/dashboard', mobileLinks: () => [] })
const { collapsed, toggle: toggleSidebar } = useCollapsibleNavigation()
const { mobileNavOpen, topHeader, closeMobileNav, isActive } = useWorkspaceNavigation()
</script>
<template>
  <div class="min-h-dvh bg-background lg:grid" :class="variant === 'shop' ? ['bs-shop-shell', { 'bs-shop-shell--collapsed': collapsed }] : 'lg:grid-cols-[17rem_1fr] lg:gap-4 lg:p-4'">
    <BsSideMenu :open="mobileNavOpen" :variant="variant" :collapsed="variant === 'shop' && collapsed" :home-path="homePath" :product-name="productName" :groups="groups" :labels="labels" @close="closeMobileNav">
      <template #logo><slot name="logo" /></template>
      <template #mark><slot name="mark" /></template>
      <template #context><slot name="context" /></template>
      <template #footer="scope"><slot name="sidebar-footer" v-bind="scope" /></template>
    </BsSideMenu>

    <div class="flex min-w-0 flex-col">
      <BsTopHeader ref="topHeader" :variant="variant" :navigation-open="mobileNavOpen" :collapsed="collapsed" :open-navigation-label="labels.open" :collapse-navigation-label="labels.collapse" @open-navigation="mobileNavOpen = true" @toggle-sidebar="toggleSidebar">
        <slot name="header" />
      </BsTopHeader>

      <main class="mx-auto w-full min-w-0 flex-1" :class="[variant === 'shop' ? 'px-4 py-5 lg:px-6 2xl:px-8' : 'max-w-[1440px] px-4 py-6 lg:px-8', floatingActions ? 'pb-40 lg:pb-24' : 'pb-24 lg:pb-6']">
        <slot />
      </main>
    </div>

    <nav v-if="mobileLinks.length" data-viewport-bottom :style="{ gridTemplateColumns: `repeat(${mobileLinks.length}, minmax(0, 1fr))` }" class="fixed inset-x-0 bottom-0 z-30 grid border-t border-[var(--bs-border)] bg-surface px-2 pb-[env(safe-area-inset-bottom)] shadow-raised lg:hidden" :aria-label="labels.navigation">
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

<style scoped>
@media (min-width: 1024px) {
  .bs-shop-shell { grid-template-columns: 15.5rem minmax(0, 1fr); }
  .bs-shop-shell--collapsed { grid-template-columns: 4.5rem minmax(0, 1fr); }
}
</style>
