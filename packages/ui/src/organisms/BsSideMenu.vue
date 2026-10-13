<script setup lang="ts">
import { useSideNavigation } from '@building-suit/ux'
import type { NavigationGroup } from '@building-suit/contracts'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'shop'
  collapsed?: boolean
  open?: boolean
  homePath?: string
  productName: string
  groups: NavigationGroup[]
  labels: { close: string; navigation: string; dashboard: string }
}>(), {
  variant: 'default',
  collapsed: false,
  open: false,
  homePath: '/dashboard',
})

const emit = defineEmits<{ close: [restoreFocus?: boolean] }>()
const route = useRoute()
const { panel, isActive, onKeydown } = useSideNavigation(() => props.open, () => route.path, () => emit('close', true))
</script>

<template>
  <aside
    id="bs-primary-navigation"
    ref="panel"
    class="fixed inset-y-0 start-0 z-40 w-64 border-e border-[var(--bs-border)] bg-surface lg:sticky lg:block lg:w-auto"
    :class="[open ? 'block' : 'hidden', variant === 'shop' ? ['bs-shop-navigation lg:top-0 lg:h-dvh', { 'bs-shop-navigation--collapsed': collapsed }] : 'lg:top-4 lg:h-[calc(100dvh-2rem)] lg:rounded-modal lg:border lg:shadow-card']"
    @keydown="onKeydown"
  >
    <div class="flex h-full min-h-0 flex-col gap-4 p-4">
      <div class="flex items-center justify-between">
        <NuxtLink :to="homePath" class="bs-side-menu__logo inline-flex min-w-0" :aria-label="productName">
          <span class="bs-navigation-wordmark"><slot name="logo" /></span>
          <span v-if="variant === 'shop'" class="bs-navigation-mark"><slot name="mark" /></span>
        </NuxtLink>
        <BsButton
          data-side-menu-close
          variant="icon"
          class="lg:hidden"
          :aria-label="labels.close"
          @click="emit('close', true)"
        >
          <BsIcon name="close" />
        </BsButton>
      </div>

      <div class="bs-navigation-context" :class="{ 'lg:hidden': variant === 'shop' }"><slot name="context" /></div>
      <hr class="my-2 border-[var(--bs-border)]" :class="{ 'bs-shop-navigation__divider': variant === 'shop' }">

      <nav :aria-label="labels.navigation" class="min-h-0 flex-1 space-y-5 overflow-y-auto pe-1">
        <NuxtLink
          :to="homePath"
          class="ls-nav-link"
          :class="{ 'ls-nav-link-active': isActive(homePath) }"
          :title="labels.dashboard" :aria-label="labels.dashboard" :aria-current="isActive(homePath) ? 'page' : undefined"
        >
          <BsIcon name="dashboard" />
          <span class="bs-navigation-label">{{ labels.dashboard }}</span>
        </NuxtLink>
        <section v-for="group in groups" :key="group.key">
          <h2 class="bs-navigation-label mb-1.5 px-3 text-md font-bold uppercase tracking-[0.16em]">{{ group.label }}</h2>
          <div class="flex flex-col gap-0.5" :class="variant === 'shop' ? 'bs-navigation-group' : 'ms-6'">
            <NuxtLink
              v-for="item in group.links"
              :key="item.to"
              :to="item.to"
              class="ls-nav-link py-2"
              :class="{ 'ls-nav-link-active': isActive(item.to) }"
              :title="item.label" :aria-label="item.label" :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <BsIcon v-if="item.icon" :name="item.icon" />
              <span class="bs-navigation-label">{{ item.label }}</span>
            </NuxtLink>
          </div>
        </section>
      </nav>
      <div class="shrink-0"><slot name="footer" :collapsed="collapsed" /></div>
    </div>
  </aside>

  <div
    v-if="open"
    class="fixed inset-0 z-30 ls-scrim lg:hidden"
    aria-hidden="true"
    @click="emit('close', true)"
  />
</template>

<style scoped>
/* Product wordmarks must fit the navigation, regardless of intrinsic asset size. */
.bs-side-menu__logo :deep(.ls-logo) {
  max-inline-size: 100%;
}
.bs-navigation-mark { display: none; }
.bs-navigation-mark :deep(.ls-logo) { inline-size: 2.5rem; }
.bs-shop-navigation__divider { margin-block: 0; }
.bs-shop-navigation nav { font-size: .875rem; }
.bs-shop-navigation h2 { font-size: .625rem; color: var(--bs-text-muted); letter-spacing: .1em; }
.bs-shop-navigation .ls-nav-link { min-block-size: 2.75rem; gap: .65rem; }
@media (min-width: 1024px) {
  .bs-shop-navigation--collapsed .bs-navigation-label,
  .bs-shop-navigation--collapsed .bs-navigation-wordmark,
  .bs-shop-navigation--collapsed .bs-navigation-context { display: none; }
  .bs-shop-navigation--collapsed .bs-navigation-mark { display: inline-flex; }
  .bs-shop-navigation--collapsed .bs-side-menu__logo { justify-content: center; inline-size: 100%; }
  .bs-shop-navigation--collapsed .ls-nav-link { justify-content: center; padding-inline: 0; }
  .bs-shop-navigation--collapsed .bs-navigation-group { margin-inline-start: 0; }
  .bs-shop-navigation--collapsed > div { padding-inline: .5rem; }
}
</style>
