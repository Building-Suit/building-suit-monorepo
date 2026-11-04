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
  canvasLabel: c('Interactive 3D workspace', 'مساحة عمل ثلاثية الأبعاد تفاعلية'),
  minimapLabel: c('Workspace overview', 'نظرة عامة على مساحة العمل'),
  zoomOutLabel: c('Zoom out', 'تصغير'),
  zoomInLabel: c('Zoom in', 'تكبير'),
  fitViewLabel: c('Reset view: center, 100% zoom and default camera', 'إعادة العرض: توسيط وتكبير ١٠٠٪ وزاوية الكاميرا الافتراضية'),
  hologramLabel: c('Floating holographic orb above its base', 'كرة هولوغرام عائمة فوق قاعدتها'),
  sceneUnavailableLabel: c('3D rendering is unavailable in this browser. Enable hardware acceleration to show the hologram.', 'العرض ثلاثي الأبعاد غير متاح في هذا المتصفح. فعّل تسريع الأجهزة لعرض الهولوغرام.'),
  mouseControlsLabel: c('Drag to rotate. Shift-drag or right-drag to move. Scroll to zoom.', 'اسحب للتدوير. اضغط Shift مع السحب أو اسحب بزر الفأرة الأيمن للتحريك. مرّر للتكبير.'),
  touchControlsLabel: c('Drag to rotate. Use two fingers to move and pinch to zoom.', 'اسحب للتدوير. استخدم إصبعين للتحريك والتكبير بالقرص.'),
  keyboardControlsLabel: c('Arrow keys rotate. Shift + arrows move. Home resets.', 'الأسهم للتدوير. Shift مع الأسهم للتحريك. Home لإعادة العرض.'),
  zoomLabel: c('Zoom', 'التكبير'),
}))
</script>

<template>
  <BsContentSection :title="c('HQ workspace', 'مساحة عمل HQ')" :description="c('Interactive 3D hologram with orbit, pan, zoom and reset. Header actions remain placeholders; this example has no application connection.', 'هولوغرام ثلاثي الأبعاد تفاعلي مع التدوير والتحريك والتكبير وإعادة العرض. إجراءات الرأس تظل عناصر شكلية، ولا يتصل هذا المثال بأي تطبيق.')">
    <BsHqLayoutPage :content="content" />
  </BsContentSection>
</template>
