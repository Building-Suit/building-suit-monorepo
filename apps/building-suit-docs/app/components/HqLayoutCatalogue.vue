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
  hologramLabel: c('Shielded Company Brain orb above its base', 'كرة معرفة الشركة المحمية بدرع فوق قاعدتها'),
  sceneUnavailableLabel: c('3D rendering is unavailable in this browser. Enable hardware acceleration to show the hologram.', 'العرض ثلاثي الأبعاد غير متاح في هذا المتصفح. فعّل تسريع الأجهزة لعرض الهولوغرام.'),
  mouseControlsLabel: c('Hover to pulse. Click to open. Drag to rotate. Shift-drag or right-drag to move. Scroll to zoom.', 'اسحب للتدوير. اضغط Shift مع السحب أو اسحب بزر الفأرة الأيمن للتحريك. مرّر للتكبير.'),
  touchControlsLabel: c('Hold to pulse. Tap to open. Drag to rotate. Use two fingers to move and pinch to zoom.', 'اسحب للتدوير. استخدم إصبعين للتحريك والتكبير بالقرص.'),
  keyboardControlsLabel: c('Arrow keys rotate. Shift + arrows move. Home resets.', 'الأسهم للتدوير. Shift مع الأسهم للتحريك. Home لإعادة العرض.'),
  zoomLabel: c('Zoom', 'التكبير'),
  companyBrain: {
    title: c("Company Brain", "معرفة الشركة"),
    openLabel: c("Open Company Brain", "فتح معرفة الشركة"),
    loadingLabel: c("Reading Brain…", "جارٍ قراءة المعرفة…"),
    connectedLabel: c("Cloud Brain connected", "معرفة الشركة السحابية متصلة"),
    unavailableLabel: c("Cloud Brain unavailable", "المعرفة السحابية غير متاحة"),
    errorLabel: c("Cloud Brain connection interrupted", "انقطع اتصال المعرفة السحابية"),
    sourceLabel: c("Source: private Company Brain on Google Drive", "المصدر: مجلد معرفة الشركة الخاص على Google Drive"),
    freshnessLabel: c("Checks Google Drive every 15 seconds while this page is visible and connected. Failed connections retry less often.", "يُفحص Google Drive كل ١٥ ثانية ما دامت الصفحة ظاهرة ومتصلة. تقل وتيرة المحاولة عند تعذر الاتصال."),
    refreshLabel: c("Refresh", "تحديث"),
    searchLabel: c("Find a note by name or folder", "ابحث عن ملاحظة بالاسم أو المجلد"),
    showMoreLabel: c("Show more notes", "عرض المزيد من الملاحظات"),
    emptyLabel: c("No matching notes.", "لا توجد ملاحظات مطابقة."),
    selectLabel: c("Select a note to read it.", "اختر ملاحظة لقراءتها."),
    noteErrorLabel: c("This note could not be read. Refresh and try again.", "تعذرت قراءة هذه الملاحظة. حدّث وحاول مجددًا."),
    observedLabel: c("Last successful cloud check", "آخر فحص سحابي ناجح"),
    modifiedLabel: c("Modified in Google Drive", "آخر تعديل على Google Drive"),
    partialLabel: c("The directory is incomplete. Some notes exceed the read limits or are unavailable.", "قائمة الملاحظات غير مكتملة. بعض الملاحظات تتجاوز حدود القراءة أو غير متاحة."),
    readOnlyLabel: c("Read only", "للقراءة فقط"),
    setupRequiredLabel: c("Google Drive reader setup required", "يلزم إعداد قارئ Google Drive"),
    authorizationRequiredLabel: c("Google Drive access required", "يلزم منح الوصول إلى Google Drive"),
    setupInstructionsLabel: c("Configure the private Google Drive reader on the HQ server and give it Viewer access to the Company Brain folder.", "أعدّ قارئ Google Drive الخاص على خادم HQ وامنحه صلاحية عارض لمجلد معرفة الشركة."),
    versionLabel: c("Version", "الإصدار"),
  },
}))
</script>

<template>
  <BsContentSection :title="c('HQ workspace', 'مساحة عمل HQ')" :description="c('Irregular shield pieces, a broad base and a moving aura surround the 3D Brain. Closed-state hover or hold feedback opens into the shared reveal and camera focus. The read-only panel overlays the workspace, sliding from the left in English or right in Arabic. This catalogue has no cloud connection.', 'قطع درع غير منتظمة وقاعدة واسعة وهالة متحركة تحيط بالدماغ ثلاثي الأبعاد. يتفاعل الدرع المغلق مع التمرير أو اللمس المطول، ثم ينفتح مع تقريب الكاميرا. تظهر لوحة القراءة فوق مساحة العمل من اليسار بالإنجليزية ومن اليمين بالعربية. لا يحتوي المثال على اتصال سحابي.')">
    <BsHqLayoutPage :content="content" />
  </BsContentSection>
</template>
