import type { DoctorAccountError } from './accountController'
export function doctorAccountCopy(ar: boolean) {
  return ar ? {
    title: 'بيانات الحساب الشخصية',description: 'بيانات خاصة بهذا الحساب والبيئة، مستقلة عن الملف المهني وصلاحيات الممارسة.',name: 'الاسم الشخصي',phone: 'هاتف التواصل الشخصي غير الموثّق',phoneHint: 'اختياري بصيغة دولية مثل ‎+12025550123. ليس رقم تسجيل دخول أو وجهة إرسال. يتطلب تغييره تسجيل دخول خلال آخر ١٥ دقيقة.',confirmations: 'إظهار تأكيدات تحديث الحساب داخل التطبيق',preference: 'هذا الخيار خاص بحسابك فقط. لا يشترك في التسويق أو البريد أو الرسائل النصية.',edit: 'تعديل بيانات الحساب',save: 'حفظ بيانات الحساب',cancel: 'إلغاء',retry: 'إعادة تحميل بيانات الحساب',saved: 'تم حفظ بيانات حسابك.',loading: 'جارٍ تحميل بيانات الحساب',on: 'مفعّل',off: 'متوقف',empty: 'غير محدد',reauthenticate: 'سجّل الدخول مجددًا ثم أعد إدخال تغيير الهاتف واحفظه. يلزم تسجيل دخول حديث خلال ١٥ دقيقة.',signIn: 'تسجيل الدخول مجددًا',unavailable: 'الشراء الحي للاشتراكات وتصدير بيانات الحساب غير متاحين في هذا الإصدار الاصطناعي.',
  } : {
    title: 'Personal account details',description: 'Private to this product account and environment, independent of the professional profile and practice permissions.',name: 'Personal name',phone: 'Unverified personal contact phone',phoneHint: 'Optional international format such as +12025550123. This is not a login number or a delivery destination. Changes require a sign-in within the last 15 minutes.',confirmations: 'Show in-app account update confirmations',preference: 'Applies only to your account. It does not subscribe to marketing, email or SMS.',edit: 'Edit account details',save: 'Save account details',cancel: 'Cancel',retry: 'Reload account details',saved: 'Your account details were saved.',loading: 'Loading account details',on: 'On',off: 'Off',empty: 'Not set',reauthenticate: 'Sign in again, then re-enter and save the phone change. A fresh sign-in within 15 minutes is required.',signIn: 'Sign in again',unavailable: 'Live subscription purchases and account data exports are unavailable in this synthetic release.',
  }
}
export function doctorAccountError(error: DoctorAccountError,ar: boolean) {
  if(!error)return null
  if(error==='reauthenticate')return doctorAccountCopy(ar).reauthenticate
  if(error==='invalid')return ar ? 'تحقق من الاسم وصيغة الهاتف الدولية.' : 'Check the name and international phone format.'
  if(error==='conflict')return ar ? 'تغيّرت البيانات. أعد تحميلها قبل الحفظ.' : 'Account details changed. Reload before saving.'
  if(error==='denied' || error==='session')return ar ? 'انتهى الوصول. سجّل الدخول مجددًا.' : 'Account access ended. Sign in again.'
  return ar ? 'تعذر تأكيد العملية. أعد المحاولة أو أعد تحميل البيانات.' : 'The operation could not be confirmed. Retry or reload account details.'
}
