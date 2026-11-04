<script setup lang="ts">
import type { HqLayoutContent } from '@building-suit/ui/types/hqLayoutPresentation'

definePageMeta({ layout: false })
const { t, locale } = useI18n()
const content = computed<HqLayoutContent>(() => ({
  brandName: 'Building Suit',
  brandSuffix: 'HQ',
  logoSrc: '/brand/building-suit-logo-light.png',
  workspaceLabel: t('hq.workspaceLabel'),
  tasksLabel: t('hq.tasksLabel'),
  brainLabel: t('hq.brainLabel'),
  statusLabel: t('hq.statusLabel'),
  talkToCeoLabel: t('hq.talkToCeoLabel'),
  profileLabel: t('hq.profileLabel'),
  canvasLabel: t('hq.canvasLabel'),
  minimapLabel: t('hq.minimapLabel'),
  zoomOutLabel: t('hq.zoomOutLabel'),
  zoomInLabel: t('hq.zoomInLabel'),
  fitViewLabel: t('hq.fitViewLabel'),
  hologramLabel: t('hq.hologramLabel'),
  sceneUnavailableLabel: t('hq.sceneUnavailableLabel'),
  mouseControlsLabel: t('hq.mouseControlsLabel'),
  touchControlsLabel: t('hq.touchControlsLabel'),
  keyboardControlsLabel: t('hq.keyboardControlsLabel'),
  zoomLabel: t('hq.zoomLabel'),
}))
useHead({ title: 'Building Suit HQ', htmlAttrs: { dir: () => locale.value === 'ar' ? 'rtl' : 'ltr', lang: () => locale.value } })
</script>
<template><BsHqLayoutPage :content="content" /></template>
