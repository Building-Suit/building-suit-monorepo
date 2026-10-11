export function useShopSetupGuide() {

const { locale } = useI18n()
const { activeLocations } = useShop()
const copy = computed(() => locale.value === 'ar' ? {
  title: 'جهّز متجرك لاستقبال أول عميل',
  help: 'راجع هذه الخطوات بالترتيب. تأكد من إعداد الفريق والخدمات وساعات العمل في كلا الفرعين قبل الحجز.',
  business: 'إعداد النشاط', businessHelp: 'اختر خدمات فقط، أو منتجات وخدمات إذا كنت تبيع منتجات أيضًا.',
  locations: 'تجهيز فرعين', locationsHelp: `الفروع النشطة: ${activeLocations.value.length}. أضف الفرع الثاني وراجع أسماء الفروع.`,
  team: 'إضافة الفريق', teamHelp: 'أضف الموظفين وحدد صلاحياتهم والفروع التي يعملون بها.',
  services: 'الخدمات ومددها', servicesHelp: 'حدد السعر والمدة ووقت التنظيف والموظفين المؤهلين لكل فرع.',
  hours: 'ساعات العمل', hoursHelp: 'اختر كل فرع وموظف في التقويم، ثم اضبط ساعات العمل والاستراحات.',
  billing: 'التجربة والاشتراك', billingHelp: 'راجع نهاية التجربة وحالة الوصول وتعليمات تجديد الاشتراك.',
} : {
  title: 'Prepare your shop for its first customer',
  help: 'Review these steps in order. Check staff, services, and working hours at both locations before booking.',
  business: 'Business setup', businessHelp: 'Choose Services only, or Products and services if you also sell retail items.',
  locations: 'Set up two locations', locationsHelp: `${activeLocations.value.length} active locations. Add your second location and review branch names.`,
  team: 'Add your team', teamHelp: 'Add staff, assign permissions, and choose the locations where they work.',
  services: 'Services and durations', servicesHelp: 'Set prices, durations, cleanup time, and eligible staff at each location.',
  hours: 'Working hours', hoursHelp: 'Select each location and staff member in Calendar, then set working hours and breaks.',
  billing: 'Trial and billing', billingHelp: 'Check the trial end date, access status, and subscription renewal instructions.',
})
const steps = computed(() => [
  { id: '/settings', title: copy.value.business, description: copy.value.businessHelp, action: { label: copy.value.business, to: '/settings' } },
  { id: '/settings#locations', title: copy.value.locations, description: copy.value.locationsHelp, action: { label: copy.value.locations, to: '/settings#locations' } },
  { id: '/team', title: copy.value.team, description: copy.value.teamHelp, action: { label: copy.value.team, to: '/team' } },
  { id: '/services', title: copy.value.services, description: copy.value.servicesHelp, action: { label: copy.value.services, to: '/services' } },
  { id: '/appointments', title: copy.value.hours, description: copy.value.hoursHelp, action: { label: copy.value.hours, to: '/appointments' } },
  { id: '/billing', title: copy.value.billing, description: copy.value.billingHelp, action: { label: copy.value.billing, to: '/billing' } },
])

return { copy, steps }
}
