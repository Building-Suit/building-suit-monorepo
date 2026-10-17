import { doctorPublicPreview } from './publicPreview.ts'
import { doctorLandingContent } from './landingPresentation.ts'
export function doctorPageMetadata(path: string,arabic: boolean,workflow: { title: string; description: string }) {
  const locale = arabic ? 'ar_EG' : 'en_US'
  if(path!=='/' && path!=='/preview')return { publicPage: false,title: arabic ? 'Doctor Suit · مساحة خاصة' : 'Doctor Suit · Private area',description: undefined,locale,robots: 'noindex, nofollow, noarchive, nosnippet' }
  const copy = doctorPublicPreview(arabic)
  const landing=doctorLandingContent(arabic)
  return { publicPage: true,title: path==='/' ? `Doctor Suit · ${landing.heroTitle}` : `${copy.productName} · ${workflow.title}`,description: path==='/' ? landing.heroBody : workflow.description,locale,robots: 'noindex, nofollow' }
}
export function doctorMissingPage(arabic: boolean) {
  return arabic ? { title: 'الصفحة غير متاحة',description: 'لم نعثر على هذه الصفحة في المعاينة التجريبية. استخدم روابط المعاينة المعروفة.',links: [{ to: '/',label: 'العودة إلى معاينة Doctor Suit' },{ to: '/preview',label: 'عرض نطاق المعاينة' }] }
    : { title: 'Page unavailable',description: 'This page was not found in the synthetic preview. Use a known preview destination.',links: [{ to: '/',label: 'Back to Doctor Suit preview' },{ to: '/preview',label: 'View preview scope' }] }
}
