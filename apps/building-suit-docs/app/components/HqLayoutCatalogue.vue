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
  companyBrain: {
    title: c("Company Brain", "معرفة الشركة"),
    openLabel: c("Open Company Brain", "فتح معرفة الشركة"),
    loadingLabel: c("Reading Brain…", "جارٍ قراءة المعرفة…"),
    connectedLabel: c("Local Brain available", "المعرفة المحلية متاحة"),
    unavailableLabel: c("Brain folder unavailable", "مجلد المعرفة غير متاح"),
    errorLabel: c("Could not read the Brain", "تعذرت قراءة المعرفة"),
    sourceLabel: c("Source: synced Brain folder on this computer", "المصدر: مجلد المعرفة المتزامن على هذا الجهاز"),
    freshnessLabel: c("Refresh reads the local files. Cloud sync status is not available here.", "التحديث يقرأ الملفات المحلية. حالة المزامنة السحابية غير متاحة هنا."),
    refreshLabel: c("Refresh", "تحديث"),
    searchLabel: c("Find a note by name or folder", "ابحث عن ملاحظة بالاسم أو المجلد"),
    emptyLabel: c("No matching notes.", "لا توجد ملاحظات مطابقة."),
    selectLabel: c("Select a note to read it.", "اختر ملاحظة لقراءتها."),
    noteErrorLabel: c("This note could not be read. Refresh and try again.", "تعذرت قراءة هذه الملاحظة. حدّث وحاول مجددًا."),
    observedLabel: c("Folder read", "قراءة المجلد"),
    modifiedLabel: c("File modified", "تعديل الملف"),
    partialLabel: c("The directory is incomplete. Some notes exceed the read limits or are unavailable.", "قائمة الملاحظات غير مكتملة. بعض الملاحظات تتجاوز حدود القراءة أو غير متاحة."),
    readOnlyLabel: c("Read only", "للقراءة فقط"),
  },
}))
</script>

<template>
  <BsContentSection :title="c('HQ workspace', 'مساحة عمل HQ')" :description="c('Interactive 3D hologram with orbit, pan, zoom and reset. The Brain opens a read-only note browser; this catalogue has no Brain folder connection.', 'هولوغرام ثلاثي الأبعاد تفاعلي مع التدوير والتحريك والتكبير وإعادة العرض. تفتح المعرفة مستعرض ملاحظات للقراءة فقط، ولا يتصل هذا المثال بمجلد المعرفة.')">
    <BsHqLayoutPage :content="content" />
  </BsContentSection>
</template>
