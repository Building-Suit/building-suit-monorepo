import type { DoctorLocationError } from './locationsController'
export function doctorLocationsCopy(ar: boolean) {
  return ar ? {
    title: 'مواقع العمل', description: 'الممارسة مملوكة للطبيب عبر مواقع العمل. الأرشفة تحفظ السجل ولا تنقل الملكية.',
    currentLocation: 'موقع العمل الحالي', workspaceDescription: 'الممارسة وموقع العمل المختاران من سياق تحقق منه الخادم.', context: 'الممارسة والموقع', choose: 'اختر الممارسة وموقع العمل', chooseDescription: 'لا تُحمّل بيانات العمل قبل التحقق من السياق المختار.', noContext: 'لا يوجد موقع عمل نشط. يمكن للمالك إدارة مواقع ممارسته المؤرشفة.',
    owner: 'مالك الممارسة', secretary: 'عضوية مفوّضة', create: 'إضافة موقع', edit: 'تعديل الموقع', archive: 'أرشفة الموقع', archiveDescription: 'سيُحفظ الموقع وسجله. لن يكون متاحاً كسياق عمل نشط بعد الأرشفة.',
    name: 'اسم الموقع', timezone: 'المنطقة الزمنية بصيغة IANA', phone: 'هاتف التواصل', address: 'عنوان التواصل', status: 'الحالة', active: 'نشط', archived: 'مؤرشف', search: 'البحث في المواقع',
    save: 'حفظ الموقع', cancel: 'إلغاء', retry: 'إعادة التحميل', loading: 'جارٍ تحميل المواقع', empty: 'لا توجد مواقع مطابقة', denied: 'لا يوجد سياق مصرح لإدارة المواقع',
    errors: { denied: 'لا تملك الصلاحية لهذا الموقع.', invalid: 'تحقق من الاسم والمنطقة الزمنية وحدود حقول التواصل.', conflict: 'تغير الموقع من طلب آخر. أعد التحميل قبل المحاولة.', dependencies: 'يتطلب هذا الموقع حل النشاط المجدول قبل أرشفته.', network: 'تعذّر إتمام الطلب. أعد المحاولة أو التحميل للتحقق من النتيجة.' },
    contextErrors: { session: 'يجب التحقق من الجلسة مجدداً.', unavailable: 'اتصال السياق غير متاح.', denied: 'السياق غير مصرح به.', stale: 'تغيرت صلاحيات السياق. أعد تحميل الخيارات.', network: 'تعذّر تحميل السياقات.', cleanup: 'تعذّر إتمام مسح الحالة السابقة. أعد المحاولة.' },
  } : {
    title: 'Working locations', description: 'The doctor owns the practice across working locations. Archiving retains history and ownership.',
    currentLocation: 'Current working location', workspaceDescription: 'Selected practice and working location from a server-verified context.', context: 'Practice and location', choose: 'Choose a practice and working location', chooseDescription: 'Work data loads only after the selected context is verified.', noContext: 'No active working location. Owners can manage their archived practice locations.',
    owner: 'Practice owner', secretary: 'Delegated membership', create: 'Add location', edit: 'Edit location', archive: 'Archive location', archiveDescription: 'The location and its history are retained. It will no longer be an active working context.',
    name: 'Location name', timezone: 'IANA timezone', phone: 'Contact phone', address: 'Contact address', status: 'Status', active: 'Active', archived: 'Archived', search: 'Search locations',
    save: 'Save location', cancel: 'Cancel', retry: 'Reload', loading: 'Loading locations', empty: 'No matching locations', denied: 'No authorized location-management context',
    errors: { denied: 'You do not have permission for this location.', invalid: 'Check the name, IANA timezone and contact-field limits.', conflict: 'Another request changed the location. Reload before retrying.', dependencies: 'Resolve scheduled activity before archiving this location.', network: 'The request failed. Retry or reload to check its outcome.' },
    contextErrors: { session: 'The session must be verified again.', unavailable: 'The context connection is unavailable.', denied: 'This context is not authorized.', stale: 'Context permissions changed. Reload available choices.', network: 'Contexts could not be loaded.', cleanup: 'Previous private state could not be cleared. Retry.' },
  }
}
export function doctorLocationError(error: DoctorLocationError, ar: boolean) { return error ? doctorLocationsCopy(ar).errors[error] : null }
