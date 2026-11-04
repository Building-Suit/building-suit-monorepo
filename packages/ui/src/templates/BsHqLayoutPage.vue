<script setup lang="ts">
import { computed, useId } from 'vue'
import { SPATIAL_VIEWPORT_DEFAULT_CAMERA, useSpatialViewport } from '@building-suit/ux'
import type { HqLayoutContent } from '../types/hqLayoutPresentation'

defineProps<{ content: HqLayoutContent }>()
const { viewportRef, camera, resetVersion, isInteracting, zoomPercent, canZoomIn, canZoomOut, onPointerDown, onPointerMove, onPointerEnd, onWheel, onKeydown, zoomBy, reset } = useSpatialViewport()
const hintId = useId()
const orbMarker = computed(() => ({
  left: `${Math.max(9, Math.min(91, 50 - camera.panX * 9))}%`,
  top: `${Math.max(12, Math.min(88, 50 + camera.panY * 11))}%`,
}))
const viewMarker = computed(() => ({
  width: `${Math.min(94, 62 / camera.zoom)}%`,
  height: `${Math.min(90, 62 / camera.zoom)}%`,
  transform: `translate(-50%, -50%) rotate(${(camera.yaw - SPATIAL_VIEWPORT_DEFAULT_CAMERA.yaw) * 180 / Math.PI}deg)`,
}))
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

    <main ref="viewportRef" class="bs-hq-layout__canvas" :class="{ 'bs-hq-layout__canvas--interacting': isInteracting }" :aria-label="content.canvasLabel" :aria-describedby="hintId" tabindex="0" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerEnd" @pointercancel="onPointerEnd" @lostpointercapture="onPointerEnd" @wheel.prevent="onWheel" @keydown="onKeydown" @contextmenu.prevent>
      <BsHologramScene :camera="camera" :reset-version="resetVersion" :label="content.hologramLabel" :unavailable-label="content.sceneUnavailableLabel" />
      <div class="bs-hq-layout__footer" dir="ltr">
        <div class="bs-hq-layout__workspace-info" dir="auto">
          <span class="bs-hq-layout__workspace"><BsIcon name="cube" :size="22" />{{ content.workspaceLabel }}</span>
          <p :id="hintId" class="bs-hq-layout__gesture-hint"><span class="bs-hq-layout__mouse-hint">{{ content.mouseControlsLabel }}</span><span class="bs-hq-layout__touch-hint">{{ content.touchControlsLabel }}</span><span class="bs-hq-layout__keyboard-hint">{{ content.keyboardControlsLabel }}</span></p>
        </div>
        <aside class="bs-hq-layout__view" :aria-label="content.minimapLabel" data-spatial-controls>
          <span class="bs-hq-layout__zoom-value" :aria-label="content.zoomLabel">{{ zoomPercent }}%</span>
          <div class="bs-hq-layout__minimap" role="img" :aria-label="content.hologramLabel">
            <span class="bs-hq-layout__minimap-view" :style="viewMarker" aria-hidden="true" />
            <span class="bs-hq-layout__orb-marker" :style="orbMarker" aria-hidden="true"><BsIcon name="orb" :size="21" /></span>
          </div>
          <div class="bs-hq-layout__zoom">
            <BsButton variant="icon" :aria-label="content.zoomOutLabel" :disabled="!canZoomOut" @click="zoomBy(1 / 1.2)"><BsIcon name="minus" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.zoomInLabel" :disabled="!canZoomIn" @click="zoomBy(1.2)"><BsIcon name="add" :size="21" /></BsButton>
            <BsButton variant="icon" :aria-label="content.fitViewLabel" :title="content.fitViewLabel" @click="reset"><BsIcon name="repeat" :size="21" /></BsButton>
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
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.bs-hq-layout__canvas--interacting { cursor: grabbing; }
.bs-hq-layout__canvas:focus-visible { outline: 2px solid var(--bs-sky-steel); outline-offset: -4px; }
.bs-hq-layout__footer { position: absolute; inset: auto 0 0; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 20px; pointer-events: none; }
.bs-hq-layout__workspace-info { display: grid; min-width: 0; justify-items: start; gap: 10px; }
.bs-hq-layout__gesture-hint { max-width: 450px; margin: 0; color: var(--bs-cloud-gray); opacity: 0.7; font-size: 11px; line-height: 1.6; }
.bs-hq-layout__touch-hint { display: none; }
.bs-hq-layout__keyboard-hint { display: block; }
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
.bs-hq-layout__view { position: relative; flex: none; width: 218px; padding: 29px 14px 11px; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 24%, transparent); border-radius: 19px; background: color-mix(in srgb, var(--bs-midnight-background) 75%, transparent); box-shadow: 0 5px 20px color-mix(in srgb, var(--bs-midnight-background) 25%, transparent); pointer-events: auto; cursor: default; }
.bs-hq-layout__zoom-value { position: absolute; top: 7px; right: 17px; color: var(--bs-cloud-gray); font-size: 10px; font-variant-numeric: tabular-nums; }
.bs-hq-layout__minimap { position: relative; height: 91px; margin: 0 10px 23px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 25%, transparent); border-radius: 5px; background: color-mix(in srgb, var(--bs-midnight-background) 55%, transparent); }
.bs-hq-layout__minimap-view { position: absolute; top: 50%; left: 50%; border: 1px solid color-mix(in srgb, var(--bs-sky-steel) 30%, transparent); background: color-mix(in srgb, var(--bs-sky-steel) 5%, transparent); border-radius: 3px; }
.bs-hq-layout__orb-marker { position: absolute; display: grid; place-items: center; width: 30px; height: 30px; transform: translate(-50%, -50%); border: 1px solid color-mix(in srgb, var(--bs-color-secondary-pale-sky) 40%, transparent); border-radius: 50%; color: var(--bs-color-secondary-pale-sky); background: color-mix(in srgb, var(--bs-sky-steel) 22%, var(--bs-midnight-background)); box-shadow: 0 0 19px color-mix(in srgb, var(--bs-sky-steel) 25%, transparent); }
.bs-hq-layout__zoom { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.bs-hq-layout .bs-hq-layout__zoom button { width: 100%; min-width: 0; height: 44px; border: 1px solid color-mix(in srgb, var(--bs-cloud-gray) 12%, transparent); border-radius: 10px; background: linear-gradient(color-mix(in srgb, var(--bs-cloud-gray) 16%, var(--bs-midnight-background)), color-mix(in srgb, var(--bs-cloud-gray) 8%, var(--bs-midnight-background))); color: var(--bs-soft-silver); }
.bs-hq-layout button:disabled { opacity: 1; cursor: default; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled) { cursor: pointer; }
.bs-hq-layout .bs-hq-layout__zoom button:not(:disabled):hover { border-color: var(--bs-sky-steel); color: var(--bs-pearl-white); }
.bs-hq-layout .bs-hq-layout__zoom button:focus-visible { outline: 2px solid var(--bs-highlight-gold); outline-offset: 2px; }
.bs-hq-layout .bs-hq-layout__zoom button:disabled { opacity: 0.4; }
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
  .bs-hq-layout__workspace-info { max-width: 165px; gap: 8px; }
  .bs-hq-layout__gesture-hint { font-size: 10px; }
  .bs-hq-layout__keyboard-hint { display: none; }
  .bs-hq-layout__view { width: 164px; padding: 27px 9px 9px; border-radius: 13px; }
  .bs-hq-layout__minimap { height: 60px; margin: 0 4px 13px; }
  .bs-hq-layout__zoom { gap: 5px; }
  .bs-hq-layout .bs-hq-layout__zoom button { border-radius: 7px; }
}
@media (max-width: 374px) {
  .bs-hq-layout .bs-hq-layout__ceo { display: none; }
  .bs-hq-layout__workspace-info { max-width: 110px; }
  .bs-hq-layout__footer { padding: 10px; }
}
@media (pointer: coarse) {
  .bs-hq-layout__mouse-hint { display: none; }
  .bs-hq-layout__touch-hint { display: inline; }
  .bs-hq-layout__keyboard-hint { display: none; }
}
</style>
