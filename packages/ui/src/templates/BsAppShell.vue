<script setup lang="ts">
import type { NavigationGroup, NavigationLink } from '@building-suit/contracts'
withDefaults(defineProps<{ homePath?: string; productName: string; groups: NavigationGroup[]; mobileLinks?: NavigationLink[]; labels: { close: string; open: string; navigation: string; dashboard: string } }>(), { homePath: '/dashboard', mobileLinks: () => [] })
const route = useRoute()
const mobileNavOpen = ref(false)
useTheme()
watch(() => route.fullPath, () => { mobileNavOpen.value = false })
function isActive(to: string) { return route.path === to || route.path.startsWith(`${to}/`) }
</script>
<template>  <div class="min-h-dvh bg-background lg:grid lg:grid-cols-[17rem_1fr] lg:gap-4 lg:p-4">
    <!-- Shown/hidden rather than slid off-screen with a transform: a translate
         utility that silently fails to apply leaves the drawer sitting on top
         of the page on every phone, which is exactly what happened here. -->
    <aside
      class="fixed inset-y-0 start-0 z-40 w-64 border-e border-[var(--bs-border)] bg-surface lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)] lg:w-auto lg:rounded-modal lg:border lg:shadow-card"
      :class="mobileNavOpen ? 'block' : 'hidden'"
    >
      <div class="flex h-full min-h-0 flex-col gap-4 p-4">
        <div class="flex items-center justify-between">
          <NuxtLink :to="homePath" class="inline-flex" :aria-label="productName">
            <slot name="logo" />
          </NuxtLink>
          <button
            type="button"
            class="ls-btn ls-btn-sm lg:hidden"
            :aria-label="labels.close"
            @click="mobileNavOpen = false"
          >
            <AppIcon name="close" />
          </button>
        </div>

        <slot name="context" />
        <hr class="my-2 border-[var(--bs-border)]">

        <nav :aria-label="labels.navigation" class="min-h-0 flex-1 space-y-5 overflow-y-auto pe-1">
          <NuxtLink
            :to="homePath"
            class="ls-nav-link"
            :class="{ 'ls-nav-link-active': isActive(homePath) }"
            :aria-current="isActive(homePath) ? 'page' : undefined"
          >
            <AppIcon name="dashboard" />
            <span>{{ labels.dashboard }}</span>
          </NuxtLink>
          <section v-for="group in groups" :key="group.key">
            <h2 class="mb-1.5 px-3 text-md font-bold uppercase tracking-[0.16em]">
              {{ group.label }}
            </h2>
            <div class="flex flex-col gap-0.5 ms-6">
              <NuxtLink
                v-for="item in group.links"
                :key="item.to"
                :to="item.to"
                class="ls-nav-link py-2"
                :class="{ 'ls-nav-link-active': isActive(item.to) }"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                <span>{{ item.label }}</span>
              </NuxtLink>
            </div>
          </section>
        </nav>

      </div>
    </aside>

    <div
      v-if="mobileNavOpen"
      class="fixed inset-0 z-30 ls-scrim lg:hidden"
      aria-hidden="true"
      @click="mobileNavOpen = false"
    />

    <div class="flex min-w-0 flex-col">
      <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--bs-border)] bg-surface/90 px-4 py-3 backdrop-blur lg:top-4 lg:rounded-card lg:border lg:px-6 lg:shadow-card">
        <button
          type="button"
          class="ls-btn ls-btn-sm lg:hidden"
          :aria-label="labels.open"
          @click="mobileNavOpen = true"
        >
          <AppIcon name="menu" />
        </button>

        <div class="min-w-0 flex-1" />

        <slot name="header" />
      </header>

      <main class="mx-auto w-full max-w-[1280px] min-w-0 flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-6">
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
        <AppIcon v-if="item.icon" :name="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <slot name="overlays" />
  </div>
</template>
