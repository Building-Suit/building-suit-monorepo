<script setup lang="ts">
import type { HqLayoutContent } from '@building-suit/ui/types/hqLayoutPresentation'

definePageMeta({ layout: false })
const { t, locale } = useI18n()
const { brain, refresh, selectNote } = useCompanyBrain()
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
  companyBrain: {
    title: t('hq.companyBrain.title'),
    openLabel: t('hq.companyBrain.openLabel'),
    loadingLabel: t('hq.companyBrain.loadingLabel'),
    connectedLabel: t('hq.companyBrain.connectedLabel'),
    unavailableLabel: t('hq.companyBrain.unavailableLabel'),
    errorLabel: t('hq.companyBrain.errorLabel'),
    sourceLabel: t('hq.companyBrain.sourceLabel'),
    freshnessLabel: t('hq.companyBrain.freshnessLabel'),
    refreshLabel: t('hq.companyBrain.refreshLabel'),
    searchLabel: t('hq.companyBrain.searchLabel'),
    emptyLabel: t('hq.companyBrain.emptyLabel'),
    selectLabel: t('hq.companyBrain.selectLabel'),
    noteErrorLabel: t('hq.companyBrain.noteErrorLabel'),
    observedLabel: t('hq.companyBrain.observedLabel'),
    modifiedLabel: t('hq.companyBrain.modifiedLabel'),
    partialLabel: t('hq.companyBrain.partialLabel'),
    readOnlyLabel: t('hq.companyBrain.readOnlyLabel'),
    setupRequiredLabel: t('hq.companyBrain.setupRequiredLabel'),
    authorizationRequiredLabel: t('hq.companyBrain.authorizationRequiredLabel'),
    setupInstructionsLabel: t('hq.companyBrain.setupInstructionsLabel'),
    versionLabel: t('hq.companyBrain.versionLabel'),
  },
}))
useHead({ title: 'Building Suit HQ', htmlAttrs: { dir: () => locale.value === 'ar' ? 'rtl' : 'ltr', lang: () => locale.value } })
</script>
<template><BsHqLayoutPage :content="content" :brain="brain" @refresh-brain="refresh" @select-brain-note="selectNote" /></template>
