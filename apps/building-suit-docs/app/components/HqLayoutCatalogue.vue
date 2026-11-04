<script setup lang="ts">
import type { HqLayoutContent } from '@building-suit/ui/types/hqLayoutPresentation'
const { locale } = useI18n()
const c = (en: string, ar: string) => locale.value === 'ar' ? ar : en
const content = computed<HqLayoutContent>(() => ({
  brandName: 'Building Suit',
  brandSuffix: 'HQ',
  logoSrc: '/brand/building-suit-logo-light.png',
  workspaceLabel: c('Workspace', 'مساحة العمل'),
  tasksLabel: c('Tasks', 'المهام'),
  brainLabel: c('Brain', 'المعرفة'),
  statusLabel: c('No agents connected', 'لا يوجد وكلاء متصلون'),
  talkToCeoLabel: c('Talk to CEO', 'تحدث مع المدير التنفيذي'),
  profileLabel: c('Profile', 'الملف الشخصي'),
  canvasLabel: c('Empty HQ workspace', 'مساحة عمل HQ فارغة'),
  minimapLabel: c('Workspace overview', 'نظرة عامة على مساحة العمل'),
  zoomOutLabel: c('Zoom out', 'تصغير'),
  zoomInLabel: c('Zoom in', 'تكبير'),
  fitViewLabel: c('Fit view', 'ملاءمة العرض'),
}))
</script>

<template>
  <BsContentSection :title="c('HQ layout', 'تخطيط HQ')" :description="c('Static header and empty workspace canvas. Navigation and controls are disabled; this example has no application connection.', 'رأس ثابت ومساحة عمل فارغة. التنقل وأدوات التحكم معطلة، ولا يتصل هذا المثال بأي تطبيق.')">
    <BsHqLayoutPage :content="content" />
  </BsContentSection>
</template>
