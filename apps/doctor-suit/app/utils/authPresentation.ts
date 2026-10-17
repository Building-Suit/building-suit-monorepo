import type { DoctorAuthError, DoctorAuthState } from './authController'

export function doctorAuthCopy(ar: boolean) {
  return ar ? {
    home: 'الرئيسية في Doctor Suit', title: 'مرحباً بك في Doctor Suit', description: 'المواعيد والاستقبال وإدارة الممارسة في مساحة واحدة. معاينة ببيانات تجريبية؛ تأكيد الحساب لا يثبت التأهيل المهني أو صلاحية تقديم الرعاية.',
    signIn: 'تسجيل الدخول', signUp: 'إنشاء حساب تجريبي', name: 'الاسم المعروض', email: 'البريد الإلكتروني', password: 'كلمة المرور', pending: 'جارٍ التحقق…', forgot: 'استعادة كلمة المرور',
    accountPrompt: 'ليس لديك حساب؟', passwordHint: 'استخدم 12 حرفاً على الأقل.', invalid: 'تحقق من الحقول. يجب تطابق كلمتي المرور واستخدام 12 حرفاً على الأقل.',
    verify: 'تأكيد الحساب', code: 'رمز التأكيد', verifyDescription: 'أدخل رمز البريد المسجل أو افتح رابط التأكيد في المتصفح الذي بدأ التسجيل.', expired: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.', resend: 'إعادة إرسال الرمز',
    recovery: 'استعادة الوصول', recoveryDescription: 'اطلب رابط الاستعادة، ثم افتحه في المتصفح الذي بدأ الطلب.', reset: 'تعيين كلمة المرور', confirmation: 'تأكيد كلمة المرور', reveal: 'إظهار كلمة المرور',
    sent: 'تم إرسال الطلب', sentDescription: 'إذا كان البريد مؤهلاً، فقد يرسل المزوّد تعليمات. لا يؤكد ذلك وجود الحساب أو وصول البريد.', invalidRecovery: 'رابط الاستعادة غير صالح أو منتهي الصلاحية. اطلب رابطاً جديداً.',
    changed: 'تم تحديث كلمة المرور', changedDescription: 'تابع إلى حسابك التجريبي.', continue: 'متابعة',
    account: 'الحساب التجريبي', accountDescription: 'جلسة حالية تحقق منها الخادم.', status: 'الحساب مؤكّد', statusDescription: 'إعداد الممارسة لم يكتمل بعد. لا توجد صلاحيات سريرية أو اشتراك مدفوع من خلال تأكيد البريد.', signOut: 'تسجيل الخروج',
    unavailable: 'تسجيل الدخول غير متاح', unavailableDescription: 'لم يتم إعداد اتصال Doctor Suit والتحقق منه. لا تُدخل بيانات دخول هنا.', checking: 'جارٍ التحقق من الاتصال', checkingDescription: 'لن تظهر حقول الدخول قبل التحقق من اتصال Doctor Suit.',
    errors: { unavailable: 'الاتصال غير متاح.', credentials: 'تعذّر تسجيل الدخول. تحقق من البيانات وتأكيد البريد.', expired: 'الرابط أو الرمز منتهي الصلاحية.', 'rate-limit': 'طلبات كثيرة. انتظر قبل المحاولة مجدداً.', network: 'تعذّر إتمام الطلب. تحقق من الاتصال وحاول مجدداً.', session: 'تعذّر التحقق من جلسة حالية. سجل الدخول مجدداً.', password: 'لم يقبل المزوّد كلمة المرور الجديدة.', 'sign-out': 'تم قفل العرض المحلي. لم يؤكد المزوّد إلغاء الجلسة؛ أعد المحاولة.' },
  } : {
    home: 'Doctor Suit home', title: 'Welcome to Doctor Suit', description: 'Appointments, reception and practice administration in one workspace. Synthetic data only; account verification does not establish professional credentials or clinical authority.',
    signIn: 'Sign in', signUp: 'Create synthetic account', name: 'Display name', email: 'Email', password: 'Password', pending: 'Checking…', forgot: 'Recover password',
    accountPrompt: 'Need an account?', passwordHint: 'Use at least 12 characters.', invalid: 'Check the fields. Passwords must match and contain at least 12 characters.',
    verify: 'Verify account', code: 'Verification code', verifyDescription: 'Enter the code for the registered email, or open the verification link in the browser that started signup.', expired: 'The code expired. Request another code.', resend: 'Resend code',
    recovery: 'Recover access', recoveryDescription: 'Request a recovery link, then open it in the browser that started the request.', reset: 'Set password', confirmation: 'Confirm password', reveal: 'Show password',
    sent: 'Request submitted', sentDescription: 'If the address is eligible, the provider may send instructions. This does not confirm an account exists or that email arrived.', invalidRecovery: 'The recovery link is invalid or expired. Request another link.',
    changed: 'Password updated', changedDescription: 'Continue to your synthetic account.', continue: 'Continue',
    account: 'Synthetic account', accountDescription: 'The server verified a current session.', status: 'Account verified', statusDescription: 'Practice setup remains incomplete. Email verification grants no clinical authority or paid subscription.', signOut: 'Sign out',
    unavailable: 'Sign-in unavailable', unavailableDescription: 'A Doctor Suit connection has not been configured and verified. Do not enter credentials here.', checking: 'Checking connection', checkingDescription: 'Credential fields appear only after the Doctor Suit connection is verified.',
    errors: { unavailable: 'The connection is unavailable.', credentials: 'Sign-in failed. Check credentials and email verification.', expired: 'The link or code expired.', 'rate-limit': 'Too many requests. Wait before retrying.', network: 'The request failed. Check the connection and retry.', session: 'A current session could not be verified. Sign in again.', password: 'The provider did not accept the new password.', 'sign-out': 'The local view is locked. The provider did not confirm session revocation; retry sign-out.' },
  }
}
export function doctorAuthAvailability(state: DoctorAuthState, ar: boolean) {
  const copy = doctorAuthCopy(ar)
  if (state.phase === 'checking') return { state: 'loading' as const, title: copy.checking, description: copy.checkingDescription }
  if (!state.providerReady || state.phase === 'unavailable') return { state: 'permission' as const, title: copy.unavailable, description: copy.unavailableDescription }
  return undefined
}
export function doctorAuthError(error: DoctorAuthError | null, ar: boolean) { return error ? doctorAuthCopy(ar).errors[error] : null }
