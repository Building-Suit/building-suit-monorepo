<script setup lang="ts">
import type { BsSuitRailItem, BsContextNavigationGroup, BsContextNavigationItem, BsAdministrationShellLabels } from '@building-suit/ux'

const props = withDefaults(defineProps<{
  suits: BsSuitRailItem[]
  groups: BsContextNavigationGroup[]
  selectedSuit?: string
  selectedContext?: string
  contextTitle: string
  productName?: string
  labels: BsAdministrationShellLabels
  loading?: boolean
}>(), { selectedSuit: undefined, selectedContext: undefined, productName: 'Building Suit', loading: false })
const emit = defineEmits<{
  'update:selectedSuit': [id: string]
  'update:selectedContext': [id: string]
  'selectSuit': [item: BsSuitRailItem]
  'selectContext': [item: BsContextNavigationItem]
}>()
const hasItems = computed(() => props.groups.some(group => group.items.length))
function selectSuit(item: BsSuitRailItem) {
  if (props.loading || item.disabled) return
  emit('update:selectedSuit', item.id)
  emit('selectSuit', item)
}
function selectContext(item: BsContextNavigationItem, close: () => void) {
  if (props.loading || item.disabled) return
  emit('update:selectedContext', item.id)
  emit('selectContext', item)
  close()
}
</script>

<template>
  <BsAppShell home-path="/" :product-name="productName" :groups="[]" :labels="{ open: labels.open, close: labels.close, navigation: labels.navigation, dashboard: contextTitle }">
    <template #mark><slot name="mark"><BsProductLogo :name="productName" kind="mark" /></slot></template>
    <template #navigation-title>{{ contextTitle }}</template>
    <template #rail-navigation>
      <div class="bs-administration-rail" :aria-label="labels.suits" role="group" :aria-busy="loading">
        <p v-if="loading" role="status">{{ labels.loading }}</p>
        <p v-else-if="!suits.length" role="status">{{ labels.emptySuits }}</p>
        <template v-else>
          <button v-for="item in suits" :key="item.id" type="button" class="bs-administration-rail__suit" :aria-label="item.label" :title="item.label" :aria-pressed="item.id === selectedSuit" :disabled="loading || item.disabled" @click="selectSuit(item)">
            <img v-if="item.logo" :src="item.logo" alt="">
            <BsIcon v-else-if="item.icon" :name="item.icon" />
            <span v-else aria-hidden="true">{{ item.label.slice(0, 2) }}</span>
          </button>
        </template>
      </div>
    </template>
    <template #navigation="{ collapsed, close }">
      <div class="bs-administration-navigation" :class="{ 'bs-administration-navigation--collapsed': collapsed }" :aria-busy="loading">
        <p v-if="loading" role="status">{{ labels.loading }}</p>
        <p v-else-if="!hasItems" role="status">{{ labels.emptyNavigation }}</p>
        <template v-else>
          <section v-for="group in groups" :key="group.id">
            <h3>{{ group.label }}</h3>
            <template v-for="item in group.items" :key="item.id">
              <BsLink v-if="item.to" :to="item.to" variant="unstyled" class="bs-administration-navigation__item" :disabled="loading || item.disabled" :title="item.label" :aria-label="item.label" :aria-current="item.id === selectedContext ? 'page' : undefined" @click="selectContext(item, close)">
                <BsIcon :name="item.icon || 'arrowRight'" :directional="!item.icon" />
                <span>{{ item.label }}</span>
              </BsLink>
              <button v-else type="button" class="bs-administration-navigation__item" :disabled="loading || item.disabled" :title="item.label" :aria-label="item.label" :aria-pressed="item.id === selectedContext" @click="selectContext(item, close)">
                <BsIcon :name="item.icon || 'arrowRight'" :directional="!item.icon" />
                <span>{{ item.label }}</span>
              </button>
            </template>
          </section>
        </template>
      </div>
    </template>
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <slot />
    <template #overlays><slot name="overlays" /></template>
  </BsAppShell>
</template>

<style scoped>
.bs-administration-rail { display: flex; flex-direction: column; align-items: center; gap: var(--bs-space-2); min-block-size: 0; overflow-y: auto; inline-size: 100%; }
.bs-administration-rail p { font-size: .75rem; overflow-wrap: anywhere; text-align: center; }
.bs-administration-rail__suit { flex: none; display: grid; place-items: center; inline-size: var(--bs-tap-target-min); block-size: var(--bs-tap-target-min); border: 1px solid transparent; border-radius: var(--bs-radius-button); background: transparent; color: var(--bs-text-muted); font: inherit; cursor: pointer; }
.bs-administration-rail__suit img { max-inline-size: 1.75rem; max-block-size: 1.75rem; object-fit: contain; }
.bs-administration-rail__suit[aria-pressed=true] { background: var(--bs-surface-muted); color: var(--bs-text); }
.bs-administration-navigation h3 { margin: var(--bs-space-3) var(--bs-space-3) var(--bs-space-2); color: var(--bs-text-muted); font-size: .75rem; font-weight: var(--bs-weight-semibold); }
.bs-administration-navigation p { margin: 0; overflow-wrap: anywhere; font-size: .875rem; }
.bs-administration-navigation__item { display: flex; align-items: center; gap: var(--bs-space-3); inline-size: 100%; min-block-size: 43px; padding: 9px 10px; border: 0; border-radius: var(--bs-radius-button); background: transparent; color: var(--bs-text); font: inherit; font-size: 12px; font-weight: var(--bs-weight-semibold); text-align: start; text-decoration: none; cursor: pointer; }
.bs-administration-navigation__item span { min-inline-size: 0; overflow-wrap: anywhere; }
.bs-administration-navigation__item :deep(svg) { flex: none; inline-size: 18px; block-size: 18px; }
.bs-administration-navigation__item[aria-current=page], .bs-administration-navigation__item[aria-pressed=true] { background: color-mix(in oklab, var(--bs-primary) 9%, var(--bs-surface)); color: var(--bs-primary); }
button:disabled, .bs-administration-navigation__item[aria-disabled=true] { opacity: .5; cursor: default; }
button:focus-visible, .bs-administration-navigation__item:focus-visible { outline: var(--bs-focus-ring-style); outline-offset: var(--bs-focus-ring-offset); }
button:not(:disabled):hover, .bs-administration-navigation__item:not([aria-disabled=true]):hover { background: var(--bs-surface-muted); }
@media (min-width: 1024px) {
  .bs-administration-navigation--collapsed h3, .bs-administration-navigation--collapsed .bs-administration-navigation__item span { display: none; }
  .bs-administration-navigation--collapsed .bs-administration-navigation__item { justify-content: center; padding-inline: 0; }
}
</style>
