<script setup lang="ts">
import type { NavigationGroup, NavigationLink } from '@building-suit/contracts'
withDefaults(defineProps<{ variant?: 'default' | 'shop'; floatingActions?: boolean; homePath?: string; productName: string; groups: NavigationGroup[]; settingsLinks?: NavigationLink[]; mobileLinks?: NavigationLink[]; labels: { collapse?: string; close: string; open: string; navigation: string; dashboard: string } }>(), { variant: 'default', floatingActions: false, homePath: '/dashboard', mobileLinks: () => [] })
const navigationId = useId()
const chamberId = `${navigationId}-chamber`
const { collapsed, toggle: toggleSidebar } = useCollapsibleNavigation()
const { mobileNavOpen, navigationTrigger, closeMobileNav, isActive } = useWorkspaceNavigation()
</script>
<template>
  <div class="min-h-dvh bg-background lg:grid" :class="['bs-app-shell', { 'bs-app-shell--collapsed': collapsed }]">
    <BsSideMenu :navigation-id="navigationId" :chamber-id="chamberId" :open="mobileNavOpen" :variant="variant" :collapsed="collapsed" :home-path="homePath" :product-name="productName" :groups="groups" :settings-links="settingsLinks" :labels="labels" @close="closeMobileNav" @toggle-sidebar="toggleSidebar">
      <template v-if="$slots['rail-navigation']" #rail-navigation><slot name="rail-navigation" /></template>
      <template v-if="$slots.navigation" #navigation="scope"><slot name="navigation" v-bind="scope" /></template>
      <template v-if="$slots['navigation-title']" #navigation-title><slot name="navigation-title" /></template>
      <template #logo><slot name="logo" /></template>
      <template #mark><slot name="mark"><BsProductLogo :name="productName" kind="mark" /></slot></template>
      <template #settings-footer="scope"><slot name="settings-footer" v-bind="scope" /></template>
      <template #context><slot name="context" /></template>
      <template #footer="scope"><slot name="sidebar-footer" v-bind="scope" /></template>
    </BsSideMenu>

    <div class="flex min-w-0 flex-col">
      <main class="mx-auto w-full min-w-0 flex-1" :class="['bs-app-shell__workspace px-4 py-5 lg:px-6 2xl:px-8', floatingActions ? 'pb-40 lg:pb-24' : 'pb-24 lg:pb-6']">
        <div class="bs-app-shell__page-context">
          <button ref="navigationTrigger" type="button" class="bs-app-shell__mobile-trigger lg:hidden" :aria-label="labels.open" :aria-expanded="mobileNavOpen" :aria-controls="navigationId" @click="mobileNavOpen = true"><BsIcon name="menu" /></button>
          <div class="bs-app-shell__scope-actions"><slot name="header" /></div>
        </div>
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
.bs-app-shell__workspace { max-inline-size: var(--bs-component-app-shell-content-maximum-width); }
.bs-app-shell__page-context { display: flex; align-items: center; gap: var(--bs-space-3); min-inline-size: 0; margin-block-end: var(--bs-space-5); }
.bs-app-shell__scope-actions { display: flex; flex: 1; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: var(--bs-space-3); min-inline-size: 0; }
.bs-app-shell__scope-actions :deep(.bs-context-switcher) { min-inline-size: 0; inline-size: min(100%, 18rem); }
.bs-app-shell__scope-actions :deep(.bs-scope-switcher[data-compact]) { inline-size: clamp(9rem, 14vw, 12rem); }
.bs-app-shell__mobile-trigger { flex: none; align-items: center; justify-content: center; inline-size: var(--bs-tap-target-min); block-size: var(--bs-tap-target-min); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); background: var(--bs-surface); color: var(--bs-text); }
.bs-app-shell__mobile-trigger:focus-visible { outline: var(--bs-focus-ring-style); outline-offset: var(--bs-focus-ring-offset); }
@media (max-width: 1023px) { .bs-app-shell__mobile-trigger { display: inline-flex; } }
@media (min-width: 1024px) {
  .bs-app-shell {
    grid-template-columns: 21rem minmax(0, 1fr);
    gap: 14px;
    padding-inline: 14px;
    transition: grid-template-columns 500ms cubic-bezier(.22, 1, .36, 1);
  }
  .bs-app-shell__page-context:has(.bs-app-shell__scope-actions:empty) { display: none; }
  .bs-app-shell--collapsed { grid-template-columns: 8.625rem minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .bs-app-shell { transition-duration: 0.01ms; }
}
</style>
