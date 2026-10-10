<script setup lang="ts">
import type { NavigationGroup } from '@building-suit/contracts'

const props = withDefaults(defineProps<{
  open?: boolean
  homePath?: string
  productName: string
  groups: NavigationGroup[]
  labels: { close: string; navigation: string; dashboard: string }
}>(), {
  open: false,
  homePath: '/dashboard',
})

const emit = defineEmits<{ close: [restoreFocus?: boolean] }>()
const route = useRoute()
const panel = ref<HTMLElement | null>(null)

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

function focusableElements() {
  if (!panel.value) return []
  return [...panel.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hasAttribute('hidden'))
}

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close', true)
    return
  }
  if (event.key !== 'Tab') return
  const focusable = focusableElements()
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  panel.value?.querySelector<HTMLButtonElement>('[data-side-menu-close]')?.focus()
})
</script>

<template>
  <aside
    id="bs-primary-navigation"
    ref="panel"
    class="fixed inset-y-0 start-0 z-40 w-64 border-e border-[var(--bs-border)] bg-surface lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)] lg:w-auto lg:rounded-modal lg:border lg:shadow-card"
    :class="open ? 'block' : 'hidden'"
    @keydown="onKeydown"
  >
    <div class="flex h-full min-h-0 flex-col gap-4 p-4">
      <div class="flex items-center justify-between">
        <NuxtLink :to="homePath" class="bs-side-menu__logo inline-flex min-w-0" :aria-label="productName">
          <slot name="logo" />
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

      <slot name="context" />
      <hr class="my-2 border-[var(--bs-border)]">

      <nav :aria-label="labels.navigation" class="min-h-0 flex-1 space-y-5 overflow-y-auto pe-1">
        <NuxtLink
          :to="homePath"
          class="ls-nav-link"
          :class="{ 'ls-nav-link-active': isActive(homePath) }"
          :aria-current="isActive(homePath) ? 'page' : undefined"
        >
          <BsIcon name="dashboard" />
          <span>{{ labels.dashboard }}</span>
        </NuxtLink>
        <section v-for="group in groups" :key="group.key">
          <h2 class="mb-1.5 px-3 text-md font-bold uppercase tracking-[0.16em]">{{ group.label }}</h2>
          <div class="flex flex-col gap-0.5 ms-6">
            <NuxtLink
              v-for="item in group.links"
              :key="item.to"
              :to="item.to"
              class="ls-nav-link py-2"
              :class="{ 'ls-nav-link-active': isActive(item.to) }"
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <BsIcon v-if="item.icon" :name="item.icon" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </div>
        </section>
      </nav>
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
</style>
