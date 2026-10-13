<script setup lang="ts">
withDefaults(defineProps<{
  as?: 'div' | 'section' | 'article' | 'header' | 'span' | 'p'
  part: 'diagram' | 'stage-heading' | 'step' | 'branches' | 'node' | 'node-number' | 'arrow' | 'node-icon' | 'callout' | 'subbranch' | 'subbranch-label' | 'flow-branches' | 'pill' | 'merge' | 'split' | 'check-path' | 'engine-check' | 'check-number' | 'engine-result' | 'result'
  columns?: 2 | 3 | 4
  numbered?: boolean
  state?: 'default' | 'start' | 'waiting' | 'ledger'
}>(), { as: 'div', columns: undefined, numbered: false, state: 'default' })
</script>

<template><component :is="as" :class="['bs-flow-block', part === 'diagram' ? 'financial-tree' : `tree-${part}`, columns ? `tree-${part}-${{ 2: 'two', 3: 'three', 4: 'four' }[columns]}` : undefined, { 'tree-numbered': numbered }, state !== 'default' ? `tree-${part}-${state}` : undefined]"><slot /></component></template>

<style scoped>
.financial-tree { max-width: 73.75rem; margin-inline: auto; padding-block-end: var(--bs-space-8); }


.tree-node {
  position: relative;
  display: block;
  border: 1px solid var(--bs-border);
  border-radius: var(--bs-radius-card);
  background: var(--bs-surface);
  padding: 1.25rem;
  box-shadow: var(--bs-elevation-1);
}

.tree-node h3 { font-weight: 700; }
.tree-node p { margin-top: 0.3rem; color: var(--bs-text-muted); font-size: 0.875rem; }

.tree-node-start { border-color: color-mix(in srgb, var(--bs-primary) 45%, var(--bs-border)); }
.tree-node-ledger { border-width: 2px; border-color: var(--bs-primary); }
.tree-node-waiting { border-style: dashed; }

.tree-node-number {
  position: absolute;
  inset-block-start: 0.85rem;
  inset-inline-end: 0.9rem;
  color: var(--bs-primary);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.tree-numbered .tree-node { padding-block-start: 2.7rem; }

.tree-step {
  display: inline-flex;
  margin-bottom: 0.65rem;
  border-radius: 999px;
  background: var(--bs-status-info-bg);
  padding: 0.25rem 0.65rem;
  color: var(--bs-primary);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.tree-arrow {
  display: grid;
  height: 5rem;
  place-items: center;
  color: var(--bs-primary);
  font-size: 1.5rem;
  font-weight: 700;
}

.tree-stage-heading { margin: 0 auto 2rem; max-width: 44rem; text-align: center; }
.tree-stage-heading-start { margin-top: 0.5rem; }
.tree-stage-heading .tree-step { margin-bottom: 0.35rem; }
.tree-stage-heading h3 { font-size: 1.1rem; font-weight: 700; }
.tree-stage-heading p { margin-top: 0.5rem; color: var(--bs-text-muted); font-size: 0.875rem; line-height: 1.7; }

.tree-branches { position: relative; display: grid; gap: 1.5rem; }
.tree-branches-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.tree-node-icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  margin-bottom: 0.75rem;
  place-items: center;
  border-radius: var(--bs-radius-button);
  background: var(--bs-status-info-bg);
  color: var(--bs-primary);
}
.tree-pill {
  display: block;
  border: 1px solid var(--bs-border);
  border-radius: var(--bs-radius-button);
  background: var(--bs-surface-muted);
  padding: 0.45rem 0.6rem;
  color: var(--bs-text-muted);
  font-size: 0.72rem;
}

.tree-subbranch {
  position: relative;
  max-width: 58rem;
  margin: 2.5rem auto 0;
  padding-top: 1rem;
}

.tree-subbranch::before {
  position: absolute;
  inset-block-start: -2.5rem;
  inset-inline-start: 50%;
  width: 2px;
  height: 2.5rem;
  background: var(--bs-border-strong);
  content: '';
}

.tree-subbranch-label {
  position: relative;
  width: max-content;
  max-width: 100%;
  margin: 0 auto 1rem;
  border-radius: 999px;
  background: var(--bs-bg);
  padding: 0.25rem 0.65rem;
  color: var(--bs-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
}

.tree-flow-branches { display: grid; gap: 0.6rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.tree-flow-branches .tree-pill { position: relative; display: flex; align-items: center; gap: 0.5rem; }
.tree-flow-branches .tree-pill > span { color: var(--bs-primary); font-size: 0.65rem; font-weight: 800; }

.tree-callout {
  margin-top: 0.75rem;
  border-inline-start: 3px solid var(--bs-status-warning);
  padding-inline-start: 0.65rem;
  color: var(--bs-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.tree-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.85rem;
  color: var(--bs-primary);
  font-size: 0.8rem;
  font-weight: 700;
}

.tree-merge,
.tree-split {
  position: relative;
  display: grid;
  height: 5rem;
  place-items: center;
  color: var(--bs-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tree-merge::before,
.tree-split::before {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 50%;
  width: 2px;
  background: var(--bs-border-strong);
  content: '';
}

.tree-merge span,
.tree-split span { position: relative; z-index: 1; border-radius: 999px; background: var(--bs-bg); padding: 0.25rem 0.65rem; }

.tree-check-path {
  position: relative;
  display: grid;
  max-width: 48rem;
  margin-inline: auto;
  gap: 1rem;
}

.tree-check-path::before {
  position: absolute;
  inset-block: -2rem;
  inset-inline-start: 50%;
  width: 2px;
  background: var(--bs-border-strong);
  content: '';
}

.tree-engine-check {
  display: flex;
  width: calc(50% - 1.5rem);
  align-items: center;
  gap: 0.75rem;
  line-height: 1.5;
}

.tree-engine-check:nth-child(odd) { justify-self: start; }
.tree-engine-check:nth-child(even) { justify-self: end; }

.tree-engine-check::after {
  position: absolute;
  inset-block-start: 50%;
  width: 1.5rem;
  height: 2px;
  background: var(--bs-border-strong);
  content: '';
}

.tree-engine-check:nth-child(odd)::after { inset-inline-end: -1.5rem; }
.tree-engine-check:nth-child(even)::after { inset-inline-start: -1.5rem; }

.tree-check-number {
  display: flex;
  min-width: 2.3rem;
  height: 2.3rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--bs-status-info-bg);
  color: var(--bs-primary);
  font-size: 0.7rem;
  font-weight: 800;
}

.tree-engine-result {
  position: relative;
  display: flex;
  max-width: 34rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 2rem auto 0;
  border-radius: var(--bs-radius-card);
  background: var(--bs-deep-structure-navy);
  padding: 1rem;
  color: var(--bs-white);
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
}

.tree-result { min-height: 100%; transition: transform var(--bs-motion-quick), border-color var(--bs-motion-quick); }
.tree-result:hover { transform: translateY(-2px); border-color: var(--bs-primary); }

@media (min-width: 768px) {
  .tree-branches-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tree-branches-four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tree-branches > .tree-node::before {
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: -1rem;
    width: 2px;
    height: 1rem;
    background: var(--bs-border-strong);
    content: '';
  }
}

@media (min-width: 1100px) {
  .tree-branches-four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .tree-flow-branches { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .tree-subbranch { max-width: none; padding-top: 2rem; }
  .tree-subbranch::before { inset-inline-start: 16.666%; height: 3.25rem; }
  .tree-subbranch::after {
    position: absolute;
    inset-block-start: 0.75rem;
    inset-inline: 12.5%;
    height: 2px;
    background: var(--bs-border-strong);
    content: '';
  }
  .tree-subbranch-label { z-index: 1; }
  .tree-flow-branches .tree-pill::before {
    position: absolute;
    inset-block-start: -1.6rem;
    inset-inline-start: 50%;
    width: 2px;
    height: 1.6rem;
    background: var(--bs-border-strong);
    content: '';
  }
}

@media (max-width: 480px) {
  .tree-flow-branches { grid-template-columns: 1fr; }
}

@media (max-width: 767px) {
  .tree-branches-two { grid-template-columns: 1fr; }
  .tree-branches { padding-inline-start: 1rem; border-inline-start: 2px solid var(--bs-border-strong); }
  .tree-branches > .tree-node::before { position: absolute; inset-inline-start: -1rem; inset-block-start: 2rem; width: 1rem; height: 2px; background: var(--bs-border-strong); content: ''; }
  .tree-check-path { padding-inline-start: 1rem; }
  .tree-check-path::before { inset-inline-start: 0; }
  .tree-engine-check { width: 100%; }
  .tree-engine-check::after,
  .tree-engine-check:nth-child(odd)::after,
  .tree-engine-check:nth-child(even)::after { inset-inline-start: -1rem; width: 1rem; }
}

:lang(ar) .tree-step,
[dir='rtl'] .tree-step,
:lang(ar) .tree-merge,
[dir='rtl'] .tree-merge,
:lang(ar) .tree-split,
[dir='rtl'] .tree-split { text-transform: none; letter-spacing: normal; }

</style>
