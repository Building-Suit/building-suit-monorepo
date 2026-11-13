import { doctorPolicyLinks } from './policyPresentation.ts'
import type { LandingContent } from '@building-suit/contracts'
/** Implemented administrative preview with owner-approved launch list prices. */
export function doctorLandingContent(ar: boolean): LandingContent {
  return ar ? {
    eyebrow:'Doctor Suit · إدارة الممارسة',heroTitle:'ممارستك الطبية، في مساحة واحدة',
    heroBody:'نظّم المواعيد والاستقبال ودليل المرضى الإداري عبر مواقع عملك. احتفظ بملكية الممارسة وفوّض فريقك بصلاحيات واضحة لكل موقع.',
    createWorkspace:'إنشاء حساب',explore:'استكشف مساحة العمل',trialNote:'معاينة إدارية ببيانات تجريبية فقط. الرعاية السريرية والمدفوعات غير متاحتين.',
    featuresEyebrow:'يوم عمل أكثر وضوحاً',featuresTitle:'من الموعد إلى الاستقبال',featuresBody:'أدوات إدارية مترابطة للطبيب والسكرتير، مع سياق واضح للممارسة والموقع.',
    workflowEyebrow:'ابدأ بطريقتك',workflowTitle:'ممارسة واحدة، ومواقع عمل متعددة',pricingEyebrow:'خطط Doctor Suit',pricingTitle:'اختر السعة المناسبة لممارستك',pricingBody:'أسعار واضحة ومزايا قياسية موحدة ضمن حدود كل خطة.',
    features:[
      {icon:'invoice',title:'المواعيد',body:'راجع المواعيد وعدّلها مع توثيق موقع العمل ومنع الالتزامات المتعارضة.'},
      {icon:'repeat',title:'الاستقبال وقائمة الانتظار',body:'تابع وصول المرضى وحالة الموعد الإدارية خلال يوم العمل.'},
      {icon:'user',title:'دليل المرضى',body:'احتفظ ببيانات التعريف والتواصل الإدارية مع مراجعة التكرار وسجل التعديلات.'},
      {icon:'team',title:'فريق بصلاحيات محددة',body:'ادعُ السكرتير وحدد المواقع والصلاحيات بصورة مستقلة لكل ممارسة.'},
    ],
    workflow:[
      {title:'أنشئ ممارستك',body:'ابدأ كطبيب مستقل وأضف موقعك الأول. وجود سكرتير ليس شرطاً.'},
      {title:'اختر سياق يومك',body:'انتقل بوضوح بين الممارسة والموقع والمنطقة الزمنية قبل العمل.'},
      {title:'فوّض عند الحاجة',body:'دع الفريق يشارك في الإدارة دون نقل ملكية الممارسة أو منح صلاحيات سريرية.'},
    ],
  } : {
    eyebrow:'Doctor Suit · Practice administration',heroTitle:'Your practice, in one workspace',
    heroBody:'Organize appointments, reception and administrative patient records across your working locations. Keep ownership of your practice and give your team clear permissions at each location.',
    createWorkspace:'Create an account',explore:'Explore the workspace',trialNote:'Administrative preview with synthetic data only. Clinical care and payments are unavailable.',
    featuresEyebrow:'A clearer working day',featuresTitle:'From appointment to reception',featuresBody:'Connected administrative tools for doctors and secretaries, with a clear practice and location context.',
    workflowEyebrow:'Start your way',workflowTitle:'One practice, multiple working locations',pricingEyebrow:'Doctor Suit plans',pricingTitle:'Choose capacity for your practice',pricingBody:'Clear list prices and standard features within each plan’s limits.',
    features:[
      {icon:'invoice',title:'Appointments',body:'Review and reschedule appointments with location history and checks against overlapping commitments.'},
      {icon:'repeat',title:'Reception and queues',body:'Follow arrivals and administrative appointment status throughout the working day.'},
      {icon:'user',title:'Patient directory',body:'Maintain administrative identity and contact details with duplicate review and correction history.'},
      {icon:'team',title:'A team with clear permissions',body:'Invite secretaries with independent permissions and location access for each practice.'},
    ],
    workflow:[
      {title:'Create your practice',body:'Start independently and add your first working location. A secretary is optional.'},
      {title:'Choose your daily context',body:'Switch clearly between practice, location and timezone before working.'},
      {title:'Delegate when needed',body:'Let your team help with administration while practice ownership and clinical authority remain separate.'},
    ],
  }
}
export function doctorMarketingCopy(ar: boolean) {
  return ar ? {
    navigation:[{to:'/#features',label:'المزايا'},{to:'/#workflow',label:'طريقة العمل'},{to:'/#pricing',label:'الأسعار'}],legalLinks:[{to:'/preview',label:'نطاق المعاينة'},...doctorPolicyLinks(true)],
    labels:{home:'الرئيسية',navigation:'التنقل',openApp:'مساحة العمل',signIn:'تسجيل الدخول',startTrial:'إنشاء حساب',close:'إغلاق',open:'فتح القائمة',footer:'Doctor Suit من Building Suit · معاينة إدارية ببيانات تجريبية.',footerNavigation:'روابط Doctor Suit'},
  } : {
    navigation:[{to:'/#features',label:'Features'},{to:'/#workflow',label:'How it works'},{to:'/#pricing',label:'Pricing'}],legalLinks:[{to:'/preview',label:'Preview scope'},...doctorPolicyLinks(false)],
    labels:{home:'Home',navigation:'Navigation',openApp:'Open workspace',signIn:'Sign in',startTrial:'Create an account',close:'Close',open:'Open menu',footer:'Doctor Suit by Building Suit · Administrative preview with synthetic data.',footerNavigation:'Doctor Suit links'},
  }
}
