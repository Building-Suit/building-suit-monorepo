import type { DoctorPracticeError } from './practiceController'
export function doctorPracticeCopy(ar: boolean) {
  return ar ? {
    setup: 'إعداد الممارسة التجريبية', edit: 'تعديل ملف الممارسة', description: 'يمكن للطبيب إعداد ممارسته وموقع العمل الأول دون سكرتير. بيانات اصطناعية فقط.',
    name: 'الاسم المعروض للطبيب', practice: 'اسم الممارسة', location: 'الموقع الأول', locationName: 'اسم الموقع', timezone: 'المنطقة الزمنية بصيغة IANA',
    draft: 'حفظ المسودة', saved: 'حُفظت المسودة ويمكن استئنافها من جلسة أخرى.', complete: 'إنشاء الممارسة', save: 'حفظ الملف', pending: 'جارٍ الحفظ…', loading: 'جارٍ تحميل الإعداد', retry: 'إعادة التحميل',
    workspace: 'مساحة الممارسة', workspaceDescription: 'ملف الممارسة وموقع العمل الأول من بيانات الخادم المصرح بها.', account: 'الحساب', back: 'العودة إلى الحساب', signOut: 'تسجيل الخروج', navigation: 'التنقل', open: 'فتح التنقل', close: 'إغلاق التنقل',
    synthetic: 'إدارة تجريبية ببيانات اصطناعية', boundaries: 'لا يثبت إعداد الممارسة التأهيل المهني أو الاشتراك المدفوع. رعاية المرضى والعمليات السريرية غير متاحة.', unverified: 'المؤهلات المهنية غير متحقق منها', verification: 'التحقق المهني',
    denied: 'الإعداد متاح للمالك فقط', deniedDescription: 'عضوية التفويض لا تمنح ملكية ممارسة. لا يمكن تحويل حساب مفوّض إلى مالك عبر هذا النموذج.', missing: 'لم يكتمل إعداد الممارسة أو الموقع.', setupLink: 'إكمال إعداد الممارسة',
    errors: { session: 'يجب التحقق من جلسة حالية. سجل الدخول مجدداً.', unavailable: 'اتصال الممارسة غير متاح.', denied: 'لا تملك صلاحية تنفيذ هذا الإجراء.', invalid: 'تحقق من الأسماء والمنطقة الزمنية. الحقول المطلوبة لا يمكن أن تكون فارغة.', conflict: 'تغيرت البيانات أو أُكمل الإعداد من طلب آخر. أعد التحميل قبل المحاولة.', network: 'تعذّر إتمام الطلب. أعد المحاولة أو التحميل للتحقق من النتيجة.' },
  } : {
    setup: 'Set up synthetic practice', edit: 'Edit practice profile', description: 'A doctor can set up a practice and initial working location without a secretary. Synthetic data only.',
    name: 'Doctor display name', practice: 'Practice name', location: 'Initial location', locationName: 'Location name', timezone: 'IANA timezone',
    draft: 'Save draft', saved: 'Draft saved. Resume it from another session.', complete: 'Create practice', save: 'Save profile', pending: 'Saving…', loading: 'Loading setup', retry: 'Reload',
    workspace: 'Practice workspace', workspaceDescription: 'Practice profile and initial location from authorized server data.', account: 'Account', back: 'Back to account', signOut: 'Sign out', navigation: 'Navigation', open: 'Open navigation', close: 'Close navigation',
    synthetic: 'Synthetic administrative workspace', boundaries: 'Practice setup establishes no professional verification or paid subscription. Patient care and clinical operations remain unavailable.', unverified: 'Professional credentials unverified', verification: 'Professional verification',
    denied: 'Owner setup unavailable', deniedDescription: 'Delegated membership grants no practice ownership. This form cannot convert a delegated account into an owner.', missing: 'Practice or location setup is incomplete.', setupLink: 'Complete practice setup',
    errors: { session: 'A current session must be verified. Sign in again.', unavailable: 'The practice connection is unavailable.', denied: 'You do not have permission for this action.', invalid: 'Check names and IANA timezone. Required fields cannot be blank.', conflict: 'Data changed or another request completed setup. Reload before retrying.', network: 'The request failed. Retry or reload to check its outcome.' },
  }
}
export function doctorPracticeError(error: DoctorPracticeError, ar: boolean) { return error ? doctorPracticeCopy(ar).errors[error] : null }
