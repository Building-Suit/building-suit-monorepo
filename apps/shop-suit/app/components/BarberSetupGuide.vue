<script setup lang="ts">
const { locale } = useI18n()
const { current, isOwner, activeLocations } = useShop()
const copy = computed(() => locale.value === 'ar' ? {
  title: 'جهّز نشاط الحلاقة لاستقبال أول عميل',
  help: 'راجع هذه الخطوات بالترتيب. تأكد من إعداد الفريق والخدمات وساعات العمل في كلا الفرعين قبل الحجز.',
  business: 'إعداد النشاط', businessHelp: 'اختر خدمات فقط، أو منتجات وخدمات إذا كنت تبيع منتجات أيضًا.',
  locations: 'تجهيز فرعين', locationsHelp: `الفروع النشطة: ${activeLocations.value.length}. أضف الفرع الثاني وراجع أسماء الفروع.`,
  team: 'إضافة الفريق', teamHelp: 'أضف الموظفين وحدد صلاحياتهم والفروع التي يعملون بها.',
  services: 'خدمات الحلاقة ومددها', servicesHelp: 'حدد السعر والمدة ووقت التنظيف والموظفين المؤهلين لكل فرع.',
  hours: 'ساعات العمل', hoursHelp: 'اختر كل فرع وموظف في التقويم، ثم اضبط ساعات العمل والاستراحات.',
  billing: 'التجربة والاشتراك', billingHelp: 'راجع نهاية التجربة وحالة الوصول وتعليمات تجديد الاشتراك.',
} : {
  title: 'Prepare your barber business for its first customer',
  help: 'Review these steps in order. Check staff, services, and working hours at both locations before booking.',
  business: 'Business setup', businessHelp: 'Choose Services only, or Products and services if you also sell retail items.',
  locations: 'Set up two locations', locationsHelp: `${activeLocations.value.length} active locations. Add your second location and review branch names.`,
  team: 'Add your team', teamHelp: 'Add staff, assign permissions, and choose the locations where they work.',
  services: 'Barber services and durations', servicesHelp: 'Set prices, durations, cleanup time, and eligible staff at each location.',
  hours: 'Working hours', hoursHelp: 'Select each location and staff member in Calendar, then set working hours and breaks.',
  billing: 'Trial and billing', billingHelp: 'Check the trial end date, access status, and subscription renewal instructions.',
})
const steps = computed(() => [
  { to: '/settings', title: copy.value.business, help: copy.value.businessHelp },
  { to: '/settings#locations', title: copy.value.locations, help: copy.value.locationsHelp },
  { to: '/team', title: copy.value.team, help: copy.value.teamHelp },
  { to: '/services', title: copy.value.services, help: copy.value.servicesHelp },
  { to: '/appointments', title: copy.value.hours, help: copy.value.hoursHelp },
  { to: '/billing', title: copy.value.billing, help: copy.value.billingHelp },
])
</script>

<template>
  <section v-if="isOwner && current?.business_mode !== 'product'" class="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="barber-setup-title">
    <h2 id="barber-setup-title" class="text-lg font-extrabold">{{ copy.title }}</h2>
    <p class="mt-2 text-sm text-muted-foreground">{{ copy.help }}</p>
    <ol class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <li v-for="(step, index) in steps" :key="step.to">
        <NuxtLink :to="step.to" class="flex h-full min-h-11 gap-3 rounded-xl border border-border p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span class="font-extrabold" aria-hidden="true">{{ index + 1 }}.</span>
          <span><strong class="block text-sm text-[var(--bs-link)]">{{ step.title }}</strong><span class="mt-1 block text-sm text-muted-foreground">{{ step.help }}</span></span>
        </NuxtLink>
      </li>
    </ol>
  </section>
</template>
