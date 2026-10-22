<script setup lang="ts">
import { useNavigationChamber, useSideNavigation } from '@building-suit/ux'
import type { NavigationGroup, NavigationLink } from '@building-suit/contracts'

type ShopTab = 'all' | 'products' | 'services'

const props = withDefaults(defineProps<{
  navigationId?: string
  chamberId?: string
  variant?: 'default' | 'shop'
  collapsed?: boolean
  open?: boolean
  homePath?: string
  productName: string
  groups: NavigationGroup[]
  settingsLinks?: NavigationLink[]
  labels: { open?: string; collapse?: string; close: string; navigation: string; dashboard: string }
}>(), {
  navigationId: 'bs-primary-navigation',
  chamberId: 'bs-navigation-chamber',
  variant: 'default',
  collapsed: false,
  open: false,
  homePath: '/dashboard',
  settingsLinks: () => [],
})

const emit = defineEmits<{ close: [restoreFocus?: boolean]; toggleSidebar: [] }>()
const route = useRoute()
const { locale } = useI18n()
const isArabic = computed(() => locale.value === 'ar')
const { panel, isActive: isRouteActive, onKeydown } = useSideNavigation(() => props.open, () => route.path, () => emit('close', true))

function isActive(to: string) { return isRouteActive(to.split(/[?#]/u)[0] ?? to) }

const settingsLabel = computed(() => isArabic.value ? 'الإعدادات' : 'Settings')
const appLabel = computed(() => isArabic.value ? `قائمة ${props.productName}` : `${props.productName} menu`)
const conventionalSettingsLink = (to: string) => /^\/(settings|billing)([/?#]|$)/u.test(to)
const settingsGroups = computed<NavigationGroup[]>(() => {
  const links = [...props.settingsLinks, ...props.groups.flatMap(group => group.links).filter(link => conventionalSettingsLink(link.to))]
  const seen = new Set<string>()
  return [{ key: 'settings', label: settingsLabel.value, links: links.filter(link => {
    const path = link.to.split('#')[0] ?? link.to
    if (seen.has(path)) return false
    seen.add(path)
    return true
  }) }]
})
const settingsDestinations = computed(() => settingsGroups.value.flatMap(group => group.links.map(link => link.to)))
const { chamber, isSettingsPath: isSettingsLink } = useNavigationChamber(() => route.path, () => settingsDestinations.value)
const hasSettings = computed(() => settingsDestinations.value.length > 0)

// These are navigation *views*, not a second business-mode setting. The
// server-owned business mode is already projected into the links by Shop Suit.
// Use the available primary routes (not the generic catalog-import shortcut)
// to infer the saved mode without introducing a dependency on the Shop app.
const supportsProducts = computed(() => props.groups.some(group => group.links.some(link => link.to === '/products')))
const supportsServices = computed(() => props.groups.some(group => group.links.some(link => link.to === '/services')))
const defaultTab = computed<ShopTab>(() => {
  if (supportsProducts.value && !supportsServices.value) return 'products'
  if (supportsServices.value && !supportsProducts.value) return 'services'
  return 'all'
})
const activeTab = ref<ShopTab>(defaultTab.value)
watch(defaultTab, value => { activeTab.value = value })

const tabs = computed(() => [
  { value: 'all', label: isArabic.value ? 'الكل' : 'All' },
  ...[{ value: 'products', label: isArabic.value ? 'المنتجات' : 'Products', disabled: !supportsProducts.value },
  { value: 'services', label: isArabic.value ? 'الخدمات' : 'Services', disabled: !supportsServices.value }].filter(tab => !tab.disabled)
])
function selectTab(value: string) {
  if (value === 'all' || (value === 'products' && supportsProducts.value) || (value === 'services' && supportsServices.value)) {
    activeTab.value = value
  }
}

function categoryForLink(to: string): 'products' | 'services' | null {
  const path = to.split(/[?#]/u)[0]
  if (/^\/(products|inventory|purchases|catalog-import)(\/|$)/u.test(path ?? '')) return 'products'
  if (/^\/(services|appointments)(\/|$)/u.test(path ?? '')) return 'services'
  return null
}
const visibleGroups = computed(() => {
  if (chamber.value === 'settings') return settingsGroups.value
  return props.groups.map(group => ({
    ...group,
    links: group.links.filter(link => {
      if (isSettingsLink(link.to)) return false
      const category = categoryForLink(link.to)
      return props.variant !== 'shop' || activeTab.value === 'all' || category === null || category === activeTab.value
    }),
  })).filter(group => group.links.length > 0)
})
</script>

<template>
  <aside
    :id="navigationId"
    ref="panel"
    class="fixed inset-y-0 start-0 z-40 w-64 border-e border-[var(--bs-border)] bg-surface lg:sticky lg:block lg:w-auto"
    :class="['bs-side-navigation', { 'bs-side-navigation--open': open, 'bs-side-navigation--collapsed': collapsed }]"
    @keydown="onKeydown"
  >
    <button
      type="button"
      class="bs-side-navigation__collapse"
      :aria-label="collapsed ? (labels.open || appLabel) : (labels.collapse || (isArabic ? 'طي القائمة' : 'Collapse sidebar'))"
      :title="collapsed ? (labels.open || appLabel) : (labels.collapse || (isArabic ? 'طي القائمة' : 'Collapse sidebar'))"
      :aria-expanded="!collapsed"
      :aria-controls="chamberId"
      @click="emit('toggleSidebar')"
    >
      <span class="bs-side-navigation__collapse-arrow" :class="{ 'bs-side-navigation__collapse-arrow--inward': !collapsed }"><BsIcon name="arrowRight" :size="12" directional /></span>
    </button>
    <div class="bs-side-navigation__rail">
      <NuxtLink :to="homePath" class="bs-side-navigation__brand" :aria-label="productName"><slot name="mark" /></NuxtLink>
      <hr class="bs-side-navigation__rail-divider">
      <slot name="rail-navigation">
        <BsButton variant="icon" class="bs-side-navigation__rail-button" :class="{ 'bs-side-navigation__rail-button--active': chamber === 'app' }" :aria-label="appLabel" :title="appLabel" :aria-pressed="chamber === 'app'" :aria-controls="chamberId" @click="chamber = 'app'">
          <BsIcon :name="variant === 'shop' ? 'store' : 'dashboard'" />
        </BsButton>
      </slot>
      <div class="bs-side-navigation__rail-bottom">
        <BsButton v-if="hasSettings" variant="icon" class="bs-side-navigation__rail-button" :class="{ 'bs-side-navigation__rail-button--active': chamber === 'settings' }" :aria-label="settingsLabel" :title="settingsLabel" :aria-pressed="chamber === 'settings'" :aria-controls="chamberId" @click="chamber = 'settings'"><BsIcon name="settings" /></BsButton>
        <BsSettingsMenu cycle="theme" />
        <BsSettingsMenu cycle="language" />
        <slot name="footer" :collapsed="true" />
      </div>
    </div>
    <div :id="chamberId" class="bs-side-menu__body flex h-full min-h-0 flex-col gap-4 p-4">
      <div class="bs-side-menu__top flex items-center justify-between">
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

      <p class="bs-navigation-label bs-side-navigation__chamber-title"><slot name="navigation-title">{{ chamber === 'settings' ? settingsLabel : productName }}</slot></p>
      <div v-if="variant === 'shop' && chamber === 'app'" class="bs-side-navigation__tabs">
        <BsTabs
          :model-value="activeTab"
          :tabs="tabs"
          :label="isArabic ? 'تصفية أقسام القائمة' : 'Filter navigation sections'"
          @update:model-value="selectTab"
        />
      </div>

      <div class="bs-navigation-context"><slot name="context" /></div>
      <hr class="my-2 border-[var(--bs-border)] bs-side-navigation__divider">

      <nav :aria-label="labels.navigation" class="bs-side-menu__nav min-h-0 flex-1 overflow-y-auto pe-1">
        <slot v-if="$slots.navigation && chamber === 'app'" name="navigation" :collapsed="collapsed" :close="() => emit('close', true)" />
        <template v-else>
        <NuxtLink
          v-if="chamber === 'app'"
          :to="homePath"
          class="ls-nav-link"
          :class="{ 'ls-nav-link-active': isActive(homePath) }"
          :title="labels.dashboard" :aria-label="labels.dashboard" :aria-current="isActive(homePath) ? 'page' : undefined"
        >
          <BsIcon name="dashboard" />
          <span class="bs-navigation-label">{{ labels.dashboard }}</span>
        </NuxtLink>
        <section v-for="group in visibleGroups" :key="group.key" class="bs-side-menu__section">
          <h2 class="bs-navigation-label mb-1.5 px-3 text-md font-bold uppercase tracking-[0.16em]">{{ group.label }}</h2>
          <div class="bs-navigation-group flex flex-col gap-0.5">
            <NuxtLink
              v-for="item in group.links"
              :key="item.to"
              :to="item.to"
              class="ls-nav-link py-2"
              :class="{ 'ls-nav-link-active': isActive(item.to) }"
              :title="item.label" :aria-label="item.label" :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <BsIcon :name="item.icon || 'arrowRight'" :directional="!item.icon" />
              <span class="bs-navigation-label">{{ item.label }}</span>
            </NuxtLink>
          </div>
        </section>
        </template>
      </nav>
      <div class="bs-side-navigation__plan"><slot name="settings-footer" :collapsed="collapsed" /></div>
    </div>
  </aside>

  <Transition name="bs-navigation-scrim">
    <div
      v-if="open"
      class="fixed inset-0 z-30 ls-scrim bs-side-navigation__scrim lg:hidden"
      aria-hidden="true"
      @click="emit('close', true)"
    />
  </Transition>
</template>

<style scoped>
/* Canonical navigation chrome for every Suit; only catalogue filtering is Shop-specific. */
.bs-side-navigation { background: var(--bs-surface); color: var(--bs-text); }
.bs-side-navigation .bs-side-menu__body { gap: 0; }
.bs-side-navigation__tabs {
  flex: none; margin: 0 2px 16px; min-block-size: 0; max-block-size: 56px;
  opacity: 1; visibility: visible; overflow: hidden;
  transition: max-block-size 500ms cubic-bezier(.22, 1, .36, 1),
              opacity 500ms ease, visibility 500ms, margin 500ms ease;
}
.bs-side-navigation__tabs :deep([role='tablist']) {
  display: inline-flex;
  width: stretch;
  gap: 2px; padding: 3px; border-radius: var(--bs-radius-full);
  background: var(--bs-surface-muted);
}
.bs-side-navigation__tabs :deep([role='tab']) {
  width: stretch;
  min-inline-size: 0; min-block-size: 35px; padding: 3px 1px;
  border: 0; border-radius: var(--bs-radius-full); box-shadow: none;
  color: var(--bs-text-muted); font-size: 10px; line-height: 1.2;
  font-weight: var(--bs-weight-bold); white-space: nowrap;
  transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
}
.bs-side-navigation__tabs :deep([role='tab'][aria-selected='true']) {
  background: var(--bs-primary); color: var(--bs-text-on-primary);
  box-shadow: var(--bs-elevation-1);
}
.bs-side-navigation__tabs :deep([role='tab']:disabled) { opacity: .42; cursor: not-allowed; }
.bs-side-navigation__tabs :deep([role='tab']:focus-visible) { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
.bs-side-navigation .bs-navigation-context { margin-block-end: 12px; }
.bs-side-navigation__divider { display: none; }
/* The list stays mounted in both modes; only its labels change width. */
.bs-side-navigation .bs-side-menu__nav {
  margin: 0; padding: 0 3px 8px 1px; min-inline-size: 0;
  font-size: .875rem; overflow-x: hidden; overflow-y: auto;
  scrollbar-width: none;
}
.bs-side-navigation .bs-side-menu__nav::-webkit-scrollbar { inline-size: 0; block-size: 0; }
.bs-side-navigation .bs-side-menu__nav > .ls-nav-link { margin-block-end: 14px; }
.bs-side-navigation .bs-side-menu__section { padding-block-start: 12px; border-top: 1px solid var(--bs-border); }
.bs-side-navigation .bs-side-menu__section + .bs-side-menu__section { margin-block-start: 16px; }
.bs-side-navigation h2 {
  margin-block: 0 8px; padding-inline: 12px; color: var(--bs-text-muted);
  font-size: 10px; line-height: 16px; font-weight: 700; letter-spacing: .13em;
}
:dir(rtl) .bs-side-navigation h2 { letter-spacing: normal; text-transform: none; }
.bs-side-navigation .bs-side-menu__section > h2 {
  max-block-size: 28px; min-block-size: 0; white-space: nowrap;
  overflow: hidden; opacity: 1; visibility: visible;
  transition: max-block-size 500ms ease, opacity 500ms ease,
              visibility 500ms, margin 500ms ease, padding 500ms ease;
}
.bs-side-navigation .ls-nav-link {
  min-block-size: 43px; min-inline-size: 0;
  gap: 12px; padding: 9px 10px; overflow: hidden;
  border-inline-start: 0; border-radius: var(--bs-radius-button);
  font-size: 12px; font-weight: 600; line-height: 20px;
  /* Keep icon placement stable as the text occupies less space. */
  justify-content: flex-start;
  transition: background 180ms ease, color 180ms ease, gap 500ms ease,
              padding 500ms ease;
}
.bs-side-navigation .ls-nav-link :deep(svg) {
  flex: none; inline-size: 18px; block-size: 18px;
  margin-inline-start: 0;
  transition: margin-inline-start 500ms cubic-bezier(.22, 1, .36, 1);
}
.bs-side-navigation .ls-nav-link > .bs-navigation-label {
  display: block; flex: 0 1 auto; min-inline-size: 0; max-inline-size: 220px;
  overflow: hidden; text-overflow: clip; white-space: nowrap;
  opacity: 1; visibility: visible;
  transition: max-inline-size 500ms cubic-bezier(.22, 1, .36, 1),
              opacity 500ms ease, visibility 500ms;
}
.bs-side-navigation .ls-nav-link-active,
.bs-side-navigation .ls-nav-link-active:hover {
  background: color-mix(in oklab, var(--bs-primary) 9%, var(--bs-surface));
  color: var(--bs-primary);
}
.bs-side-navigation__scrim { background: var(--bs-scrim); }
.bs-navigation-scrim-enter-active, .bs-navigation-scrim-leave-active { transition: opacity 260ms ease; }
.bs-navigation-scrim-enter-from, .bs-navigation-scrim-leave-to { opacity: 0; }

@media (max-width: 1023px) {
  .bs-side-navigation {
    inline-size: min(370px, calc(100vw - 24px));
    visibility: hidden;
    pointer-events: none;
    transform: translateX(-105%);
    border-start-end-radius: var(--bs-radius-large);
    border-end-end-radius: var(--bs-radius-large);
    box-shadow: var(--bs-elevation-3);
    transition: transform 320ms cubic-bezier(.22, 1, .36, 1), visibility 320ms;
  }
  :dir(rtl) .bs-side-navigation { transform: translateX(105%); }
  .bs-side-navigation--open, :dir(rtl) .bs-side-navigation--open {
    visibility: visible; pointer-events: auto; transform: translateX(0);
  }
}
@media (min-width: 1024px) {
  .bs-side-navigation {
    top: 14px; block-size: calc(100dvh - 28px);
    border: 1px solid var(--bs-border);
    border-radius: var(--bs-radius-large);
    box-shadow: var(--bs-elevation-2);
  }
  /* Collapse without unmounting or duplicating any navigation links. */
  .bs-side-navigation--collapsed .bs-side-menu__body { padding-inline: 9px; }
  .bs-side-navigation--collapsed .bs-side-navigation__tabs {
    max-block-size: 0; margin-block: 0; opacity: 0; visibility: hidden;
    pointer-events: none;
  }
  .bs-side-navigation--collapsed .bs-navigation-context {
    display: none;
  }
  .bs-side-navigation--collapsed .bs-side-menu__nav {
    padding-inline: 0;
  }
  .bs-side-navigation--collapsed .bs-side-menu__section {
    padding-block-start: 9px;
  }
  .bs-side-navigation--collapsed .bs-side-menu__section > h2 {
    max-block-size: 0; margin: 0; padding-block: 0;
    opacity: 0; visibility: hidden; pointer-events: none;
  }
  .bs-side-navigation--collapsed .bs-navigation-group { margin-inline-start: 0; }
  .bs-side-navigation--collapsed .ls-nav-link {
    gap: 0; padding-inline: 0;
  }
  /* With the label shrinking to 0, the icon animates to the center. */
  .bs-side-navigation--collapsed .ls-nav-link :deep(svg) {
    margin-inline-start: calc(50% - 9px);
  }
  .bs-side-navigation--collapsed .ls-nav-link > .bs-navigation-label {
    max-inline-size: 0; opacity: 0; visibility: hidden;
    pointer-events: none;
  }

}
.bs-side-navigation__collapse {
  display: none; position: absolute; inset-block-start: 64px; inset-inline-end: 0;
  z-index: 1; inline-size: 30px; block-size: 30px; padding: 0;
  align-items: center; justify-content: center; transform: translateX(50%);
  border: 1px solid var(--bs-border); border-radius: var(--bs-radius-full);
  background: var(--bs-surface); color: var(--bs-text-muted);
  box-shadow: var(--bs-elevation-1); cursor: pointer;
}
.bs-side-navigation__collapse::after { content: ''; position: absolute; inset: -10px; }
.bs-side-navigation__collapse:hover { background: var(--bs-surface-muted); color: var(--bs-text); }
.bs-side-navigation__collapse:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
:dir(rtl) .bs-side-navigation__collapse { transform: translateX(-50%); }
.bs-side-navigation__collapse-arrow { display: flex; transition: transform 500ms cubic-bezier(.22, 1, .36, 1); }
.bs-side-navigation__collapse-arrow--inward { transform: rotate(180deg); }
@media (min-width: 1024px) { .bs-side-navigation__collapse { display: inline-flex; } }
/* The rail stays fixed while the existing chamber and label motion collapse. */
.bs-side-navigation { display: flex; min-inline-size: 0; }
.bs-side-navigation__rail {
  display: flex; flex: 0 0 64px; min-inline-size: 0; flex-direction: column;
  align-items: center; gap: 8px; padding: 20px 8px 16px;
}
.bs-side-navigation__brand:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; border-radius: var(--bs-radius-button); }
.bs-side-navigation__brand { display: grid; place-items: center; inline-size: 44px; min-block-size: 44px; }
.bs-side-navigation__brand :deep(.ls-logo) { inline-size: 40px; max-inline-size: 40px; }
.bs-side-navigation__rail-divider { inline-size: 100%; margin-block: 8px; border-color: var(--bs-border); }
.bs-side-navigation__rail-button { inline-size: 44px; block-size: 44px; flex: none; border-radius: var(--bs-radius-button); color: var(--bs-text-muted); }
.bs-side-navigation__rail-button--active { background: var(--bs-surface-muted); color: var(--bs-text); }
.bs-side-navigation__rail-bottom { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-block-start: auto; padding-block-start: 16px; }
.bs-side-navigation__rail-bottom :deep(.bs-sidebar-account__frame) { border: 0; padding: 0; }
.bs-side-navigation__rail-bottom :deep([data-user-menu-trigger]) { inline-size: 44px; block-size: 44px; padding: 0; justify-content: center; }
.bs-side-navigation .bs-side-menu__body {
  flex: 1; min-inline-size: 0; block-size: calc(100% - 16px);
  margin-block: 8px; margin-inline: 0 8px; padding: 14px 12px;
  border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card);
  background: var(--bs-surface-muted);
}
.bs-side-navigation .bs-side-menu__top { min-block-size: 0; margin: 0; padding: 0; justify-content: flex-end; }
.bs-side-navigation__chamber-title {
  flex: none; min-block-size: 24px; max-block-size: 24px; margin-block-end: 16px; padding-inline: 10px;
  display: flex; align-items: center; overflow: hidden; white-space: nowrap;
  font-weight: var(--bs-weight-semibold);
  transition: opacity 500ms ease, max-block-size 500ms ease, min-block-size 500ms ease, margin 500ms ease;
}
.bs-side-navigation__plan { flex: none; padding-block-start: 12px; border-top: 1px solid var(--bs-border); }
.bs-side-navigation__plan:empty { display: none; }
.bs-side-navigation--collapsed .bs-side-navigation__plan :deep(.bs-plan-summary) { border-radius: var(--bs-radius-button); }
@media (min-width: 1024px) {
  .bs-side-navigation--collapsed .bs-side-navigation__chamber-title { opacity: 0; visibility: hidden; min-block-size: 0; max-block-size: 0; margin: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .bs-side-navigation, .bs-side-navigation *, .bs-side-navigation__scrim { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  .bs-navigation-scrim-enter-active, .bs-navigation-scrim-leave-active { transition-duration: 0.01ms; }
}
</style>
