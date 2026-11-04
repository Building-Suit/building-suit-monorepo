<script setup lang="ts">
import type { HqLayoutContent } from '../types/hqLayoutPresentation'

defineProps<{ content: HqLayoutContent }>()
</script>

<template>
  <div class="bs-hq-layout">
    <header class="bs-hq-layout__header">
      <div class="bs-hq-layout__brand">
        <img :src="content.logoSrc" alt="" width="40" height="54">
        <h1>{{ content.brandName }} <span>{{ content.brandSuffix }}</span></h1>
      </div>

      <nav class="bs-hq-layout__navigation" :aria-label="content.workspaceLabel">
        <BsButton variant="tab" class="bs-hq-layout__tab bs-hq-layout__tab--selected" aria-current="page" disabled>{{ content.workspaceLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.tasksLabel }}</BsButton>
        <BsButton variant="tab" class="bs-hq-layout__tab" disabled>{{ content.brainLabel }}</BsButton>
      </nav>

      <div class="bs-hq-layout__actions">
        <span class="bs-hq-layout__status"><span aria-hidden="true" />{{ content.statusLabel }}</span>
        <BsButton variant="accent" class="bs-hq-layout__ceo" disabled><BsIcon name="chat" :size="20" />{{ content.talkToCeoLabel }}</BsButton>
        <BsButton variant="icon" class="bs-hq-layout__profile" :aria-label="content.profileLabel" disabled><BsIcon name="user" :size="26" /></BsButton>
      </div>
    </header>

    <main class="bs-hq-layout__canvas" :aria-label="content.canvasLabel">
      <div class="bs-hq-layout__footer">
        <span class="bs-hq-layout__workspace"><BsIcon name="cube" :size="22" />{{ content.workspaceLabel }}</span>
        <aside class="bs-hq-layout__view" :aria-label="content.minimapLabel">
          <div class="bs-hq-layout__minimap" aria-hidden="true" />
          <div class="bs-hq-layout__zoom">
            <BsButton variant="icon" :aria-label="content.zoomOutLabel" disabled><BsIcon name="minus" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.zoomInLabel" disabled><BsIcon name="add" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.fitViewLabel" disabled><BsIcon name="maximize" :size="21" /></BsButton>
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped>
.bs-hq-layout {
  color-scheme: dark;
  display: flex;
  flex-direction: column;
  height: 100svh;
  min-height: 360px;
  padding: 0 8px 8px;
  overflow: hidden;
  color: var(--bs-pearl-white);
  background: linear-gradient(120deg, color-mix(in srgb, var(--bs-navy-surface) 45%, var(--bs-color-gray-900)), var(--bs-midnight-background));
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 18%, transparent);
  border-radius: 26px;
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--bs-pearl-white) 8%, transparent);
  font-family: var(--bs-font-latin);
}
.bs-hq-layout__header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 24px;
  min-height: 70px;
  padding-inline: 44px 6px;
}
.bs-hq-layout__brand { display: flex; align-items: center; gap: 21px; white-space: nowrap; }
.bs-hq-layout__brand img { flex: none; width: 40px; height: 54px; object-fit: contain; }
.bs-hq-layout__brand h1 { margin: 0; font-size: 27px; font-weight: 750; line-height: 1.2; letter-spacing: -.8px; }
.bs-hq-layout__brand h1 span { color: var(--bs-highlight-gold); }
.bs-hq-layout__navigation {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 5%, transparent);
  border-radius: 15px;
  background: color-mix(in srgb, var(--bs-midnight-background) 74%, transparent);
}
.bs-hq-layout .bs-hq-layout__tab {
  min-width: 94px;
  min-height: 39px;
  padding: 8px 17px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--bs-cloud-gray);
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
}
.bs-hq-layout .bs-hq-layout__tab--selected {
  background: linear-gradient(var(--bs-steel-border), color-mix(in srgb, var(--bs-cloud-gray) 15%, var(--bs-midnight-background)));
  border-color: color-mix(in srgb, var(--bs-cloud-gray) 14%, transparent);
  box-shadow: 0 2px 5px color-mix(in srgb, var(--bs-midnight-background) 70%, transparent), inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 7%, transparent);
  color: var(--bs-pearl-white);
  font-weight: 650;
}
.bs-hq-layout__actions { display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
.bs-hq-layout__status {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 40px;
  padding: 8px 17px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 13%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bs-navy-surface) 35%, transparent);
  color: var(--bs-cloud-gray);
  font-size: 13px;
  white-space: nowrap;
}
.bs-hq-layout__status > span { width: 9px; height: 9px; border-radius: 50%; background: var(--bs-color-neutral-steel-gray); }
.bs-hq-layout .bs-hq-layout__ceo {
  display: inline-flex;
  gap: 9px;
  min-height: 40px;
  padding: 9px 18px;
  border: 1px solid var(--bs-premium-gold);
  border-radius: 12px;
  background: linear-gradient(var(--bs-color-gold-300), var(--bs-premium-gold));
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 35%, transparent), 0 0 20px color-mix(in srgb, var(--bs-premium-gold) 12%, transparent);
  color: var(--bs-deep-structure-navy);
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}
.bs-hq-layout .bs-hq-layout__profile {
  width: 43px;
  height: 43px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 7%, transparent);
  border-radius: 50%;
  color: var(--bs-cloud-gray);
  background: linear-gradient(color-mix(in srgb, var(--bs-cloud-gray) 16%, var(--bs-midnight-background)), color-mix(in srgb, var(--bs-cloud-gray) 6%, var(--bs-midnight-background)));
}
.bs-hq-layout__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 16%, transparent);
  border-radius: 26px 26px 21px 21px;
  background:
    radial-gradient(ellipse at 9% 37%, color-mix(in srgb, var(--bs-color-secondary-slate-blue) 46%, transparent), transparent 70%),
    linear-gradient(115deg, color-mix(in srgb, var(--bs-color-gray-700) 65%, var(--bs-navy-surface)), color-mix(in srgb, var(--bs-color-gray-900) 70%, var(--bs-navy-surface)));
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--bs-pearl-white) 4%, transparent);
}
.bs-hq-layout__footer { position: absolute; inset: auto 0 0; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 20px; }
.bs-hq-layout__workspace {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  min-height: 42px;
  padding: 9px 15px;
  border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 22%, transparent);
  border-radius: 12px;
  background: linear-gradient(color-mix(in srgb, var(--bs-cloud-gray) 8%, var(--bs-midnight-background)), var(--bs-midnight-background));
  box-shadow: 0 3px 12px color-mix(in srgb, var(--bs-midnight-background) 25%, transparent);
  color: var(--bs-soft-silver);
  font-size: 14px;
  font-weight: 550;
}
.bs-hq-layout__view { width: 218px; padding: 24px 14px 11px; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 24%, transparent); border-radius: 19px; background: color-mix(in srgb, var(--bs-midnight-background) 75%, transparent); box-shadow: 0 5px 20px color-mix(in srgb, var(--bs-midnight-background) 25%, transparent); }
.bs-hq-layout__minimap { height: 91px; margin: 0 10px 23px; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 25%, transparent); border-radius: 5px; background: color-mix(in srgb, var(--bs-midnight-background) 55%, transparent); }
.bs-hq-layout__zoom { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.bs-hq-layout .bs-hq-layout__zoom button { width: 100%; min-width: 0; height: 35px; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 12%, transparent); border-radius: 10px; background: linear-gradient(color-mix(in srgb, var(--bs-cloud-gray) 16%, var(--bs-midnight-background)), color-mix(in srgb, var(--bs-cloud-gray) 8%, var(--bs-midnight-background))); color: var(--bs-soft-silver); }
.bs-hq-layout button:disabled { opacity: 1; cursor: default; }
:global([dir="rtl"]) .bs-hq-layout { font-family: var(--bs-font-arabic); }
:global([dir="rtl"]) .bs-hq-layout__brand h1 { letter-spacing: normal; }
@media (max-width: 1279px) {
  .bs-hq-layout__header { padding-inline: 14px 6px; gap: 16px; }
  .bs-hq-layout__brand { gap: 12px; }
  .bs-hq-layout__brand h1 { font-size: 22px; }
  .bs-hq-layout__actions { gap: 10px; }
  .bs-hq-layout__status { padding-inline: 10px; font-size: 12px; }
  .bs-hq-layout .bs-hq-layout__tab { min-width: 77px; padding-inline: 12px; font-size: 14px; }
}
@media (max-width: 1023px) {
  .bs-hq-layout__header { grid-template-columns: 1fr auto; padding-block: 10px; gap: 10px 16px; }
  .bs-hq-layout__navigation { grid-column: 1 / -1; grid-row: 2; justify-self: center; }
  .bs-hq-layout__status { display: none; }
}
@media (max-width: 520px) {
  .bs-hq-layout { padding: 0 5px 5px; border-radius: 19px; }
  .bs-hq-layout__header { padding-inline: 7px; gap: 10px; }
  .bs-hq-layout__brand { gap: 9px; }
  .bs-hq-layout__brand img { width: 28px; height: 40px; }
  .bs-hq-layout__brand h1 { font-size: 17px; letter-spacing: -.5px; }
  .bs-hq-layout__actions { gap: 7px; }
  .bs-hq-layout .bs-hq-layout__ceo { max-width: 128px; padding-inline: 10px; font-size: 11px; gap: 5px; min-height: 35px; white-space: normal; line-height: 1.25; }
  .bs-hq-layout .bs-hq-layout__ceo svg { width: 16px; }
  .bs-hq-layout .bs-hq-layout__profile { width: 34px; height: 34px; }
  .bs-hq-layout .bs-hq-layout__profile svg { width: 22px; }
  .bs-hq-layout__canvas { border-radius: 19px 19px 15px 15px; }
  .bs-hq-layout__footer { padding: 12px; gap: 10px; }
  .bs-hq-layout__workspace { padding-inline: 10px; font-size: 12px; gap: 6px; }
  .bs-hq-layout__view { width: 145px; padding: 13px 9px 9px; border-radius: 13px; }
  .bs-hq-layout__minimap { height: 60px; margin: 0 4px 13px; }
  .bs-hq-layout__zoom { gap: 5px; }
  .bs-hq-layout .bs-hq-layout__zoom button { height: 32px; border-radius: 7px; }
}
@media (max-width: 374px) {
  .bs-hq-layout .bs-hq-layout__ceo { display: none; }
}
</style>
