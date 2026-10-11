<script setup lang="ts">
import type { BsSuitRailItem, BsContextNavigationGroup, BsContextNavigationItem, BsAdministrationShellLabels } from '@building-suit/ux'

const props = withDefaults(defineProps<{
  suits: BsSuitRailItem[]
  groups: BsContextNavigationGroup[]
  selectedSuit?: string
  selectedContext?: string
  contextTitle: string
  labels: BsAdministrationShellLabels
  loading?: boolean
}>(), { selectedSuit: undefined, selectedContext: undefined, loading: false })
const emit = defineEmits<{
  'update:selectedSuit': [id: string]
  'update:selectedContext': [id: string]
  'selectSuit': [item: BsSuitRailItem]
  'selectContext': [item: BsContextNavigationItem]
}>()
const navigationId = useId()
const { open, trigger, close, onKeydown } = useNavigationDisclosure()
const hasItems = computed(() => props.groups.some(group => group.items.length))
function selectSuit(item: BsSuitRailItem) {
  if (props.loading || item.disabled) return
  emit('update:selectedSuit', item.id)
  emit('selectSuit', item)
}
function selectContext(item: BsContextNavigationItem) {
  if (props.loading || item.disabled) return
  emit('update:selectedContext', item.id)
  emit('selectContext', item)
  void close(true)
}
watch(() => props.selectedSuit, () => { void close() })
</script>

<template>
  <div class="bs-administration-shell">
    <nav class="bs-administration-shell__rail" :aria-label="labels.suits" :aria-busy="loading">
      <p v-if="loading" role="status">{{ labels.loading }}</p>
      <p v-else-if="!suits.length" role="status">{{ labels.emptySuits }}</p>
      <template v-else>
        <button
          v-for="item in suits" :key="item.id" type="button"
          class="bs-administration-shell__suit"
          :aria-label="item.label" :title="item.label"
          :aria-pressed="item.id === selectedSuit"
          :disabled="item.disabled" @click="selectSuit(item)"
        >
          <img v-if="item.logo" :src="item.logo" alt="">
          <BsIcon v-else-if="item.icon" :name="item.icon" />
          <span v-else aria-hidden="true">{{ item.label.slice(0, 2) }}</span>
        </button>
      </template>
    </nav>
    <aside class="bs-administration-shell__chamber" @keydown="onKeydown">
      <div class="bs-administration-shell__context-heading">
        <h2>{{ contextTitle }}</h2>
        <button ref="trigger" type="button" class="bs-administration-shell__toggle" :aria-expanded="open" :aria-controls="navigationId" @click="open = !open">
          {{ open ? labels.close : labels.open }}
        </button>
      </div>
      <nav :id="navigationId" class="bs-administration-shell__context" :class="{ 'bs-administration-shell__context--open': open }" :aria-label="labels.navigation" :aria-busy="loading">
        <p v-if="loading" role="status">{{ labels.loading }}</p>
        <p v-else-if="!hasItems" role="status">{{ labels.emptyNavigation }}</p>
        <template v-else>
          <section v-for="group in groups" :key="group.id">
            <h3>{{ group.label }}</h3>
            <template v-for="item in group.items" :key="item.id">
              <BsLink v-if="item.to" :to="item.to" variant="unstyled" class="bs-administration-shell__item" :disabled="item.disabled" :aria-current="item.id === selectedContext ? 'page' : undefined" @click="selectContext(item)">
                <BsIcon v-if="item.icon" :name="item.icon" />
                <span>{{ item.label }}</span>
              </BsLink>
              <button v-else type="button" class="bs-administration-shell__item" :disabled="item.disabled" :aria-pressed="item.id === selectedContext" @click="selectContext(item)">
                <BsIcon v-if="item.icon" :name="item.icon" />
                <span>{{ item.label }}</span>
              </button>
            </template>
          </section>
        </template>
      </nav>
    </aside>
    <div class="bs-administration-shell__workspace">
      <header v-if="$slots.header"><slot name="header" /></header>
      <main><slot /></main>
    </div>
    <slot name="overlays" />
  </div>
</template>

<style scoped>
.bs-administration-shell { display: grid; grid-template-columns: 4rem 16rem minmax(0, 1fr); min-block-size: 100dvh; color: var(--bs-text); background: var(--bs-bg); }
.bs-administration-shell__rail, .bs-administration-shell__chamber { background: var(--bs-surface); border-inline-end: 1px solid var(--bs-border); position: sticky; inset-block-start: 0; block-size: 100dvh; min-block-size: 0; }
.bs-administration-shell__rail { display: flex; flex-direction: column; align-items: center; gap: var(--bs-spacing-2); padding: var(--bs-spacing-3) var(--bs-spacing-2); overflow-y: auto; }
.bs-administration-shell__suit { flex-shrink: 0; display: grid; place-items: center; inline-size: 2.75rem; block-size: 2.75rem; border: 1px solid transparent; border-radius: var(--bs-radius-button); background: transparent; color: var(--bs-text-muted); cursor: pointer; position: relative; }
.bs-administration-shell__suit img { max-inline-size: 1.75rem; max-block-size: 1.75rem; object-fit: contain; }
.bs-administration-shell__suit[aria-pressed=true] { border-color: var(--bs-border-strong); background: var(--bs-surface-muted); color: var(--bs-text); }
.bs-administration-shell__suit[aria-pressed=true]::before { content: ''; position: absolute; inset-inline-start: -5px; inline-size: 3px; block-size: 50%; border-radius: var(--bs-radius-chip); background: var(--bs-primary); }
.bs-administration-shell__chamber { display: flex; flex-direction: column; min-inline-size: 0; }
.bs-administration-shell__context-heading { padding: var(--bs-spacing-4); border-block-end: 1px solid var(--bs-border); }
h2, h3, p { margin: 0; overflow-wrap: anywhere; }
h2 { font-size: 1rem; font-weight: 600; }
h3 { font-size: .75rem; font-weight: 500; color: var(--bs-text-muted); margin: var(--bs-spacing-4) var(--bs-spacing-3) var(--bs-spacing-2); }
p { padding: var(--bs-spacing-2); font-size: .75rem; }
.bs-administration-shell__context { flex: 1; min-block-size: 0; overflow-y: auto; padding: var(--bs-spacing-2); }
.bs-administration-shell__item { display: flex; align-items: center; gap: var(--bs-spacing-2); inline-size: 100%; min-block-size: 2.75rem; padding: var(--bs-spacing-2) var(--bs-spacing-3); border: 1px solid transparent; border-radius: var(--bs-radius-button); background: transparent; color: var(--bs-text); font: inherit; font-size: .875rem; text-align: start; text-decoration: none; cursor: pointer; }
.bs-administration-shell__item span { overflow-wrap: anywhere; min-inline-size: 0; }
.bs-administration-shell__item[aria-current=page], .bs-administration-shell__item[aria-pressed=true] { font-weight: 600; border-color: var(--bs-border-strong); background: var(--bs-surface-muted); }
button:disabled, .bs-administration-shell__item[aria-disabled=true] { opacity: .5; cursor: default; }
button:focus-visible, .bs-administration-shell__item:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
button:not(:disabled):hover, .bs-administration-shell__item:not([aria-disabled=true]):hover { background: var(--bs-surface-muted); }
.bs-administration-shell__toggle { display: none; }
.bs-administration-shell__workspace { min-inline-size: 0; }
.bs-administration-shell__workspace > header { padding: var(--bs-spacing-4); border-block-end: 1px solid var(--bs-border); background: var(--bs-surface); }
main { padding: var(--bs-spacing-5); }
@media (max-width: 63.99rem) {
  .bs-administration-shell { display: flex; flex-direction: column; }
  .bs-administration-shell__workspace { flex: 1; }
  .bs-administration-shell__rail, .bs-administration-shell__chamber { position: static; block-size: auto; border-inline-end: 0; border-block-end: 1px solid var(--bs-border); }
  .bs-administration-shell__rail { flex-direction: row; overflow-x: auto; }
  .bs-administration-shell__suit[aria-pressed=true]::before { inset-inline-start: 25%; inset-block-end: -5px; inline-size: 50%; block-size: 3px; }
  .bs-administration-shell__context-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--bs-spacing-3); }
  .bs-administration-shell__toggle { display: block; flex-shrink: 0; min-block-size: 2.75rem; padding: var(--bs-spacing-2); background: var(--bs-surface); color: var(--bs-text); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); font: inherit; }
  .bs-administration-shell__context { display: none; max-block-size: 50dvh; }
  .bs-administration-shell__context--open { display: block; }
  main { padding: var(--bs-spacing-4); }
}
</style>
