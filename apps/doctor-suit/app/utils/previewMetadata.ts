import { doctorPublicPreview } from './publicPreview.ts'
export function doctorPageMetadata(path: string,arabic: boolean,workflow: { title: string; description: string }) {
  const locale = arabic ? 'ar_EG' : 'en_US'
  if(path!=='/' && path!=='/preview')return { publicPage: false,title: arabic ? 'Doctor Suit · مساحة خاصة' : 'Doctor Suit · Private area',description: undefined,locale,robots: 'noindex, nofollow, noarchive, nosnippet' }
  const copy = doctorPublicPreview(arabic)
  return { publicPage: true,title: path==='/' ? `${copy.productName} · ${copy.eyebrow}` : `${copy.productName} · ${workflow.title}`,description: path==='/' ? copy.description : workflow.description,locale,robots: 'noindex, nofollow' }
}
export function doctorMissingPage(arabic: boolean) {
  return arabic ? { title: 'الصفحة غير متاحة',description: 'لم نعثر على هذه الصفحة في المعاينة التجريبية. استخدم روابط المعاينة المعروفة.',links: [{ to: '/',label: 'العودة إلى معاينة Doctor Suit' },{ to: '/preview',label: 'عرض نطاق المعاينة' }] }
    : { title: 'Page unavailable',description: 'This page was not found in the synthetic preview. Use a known preview destination.',links: [{ to: '/',label: 'Back to Doctor Suit preview' },{ to: '/preview',label: 'View preview scope' }] }
}
