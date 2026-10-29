import bundle from '../../config/policy-drafts.v1.json' with { type: 'json' }
import review from '../../config/policy-review.v1.json' with { type: 'json' }
export type DoctorPolicyKey = keyof typeof bundle.documents
export const doctorPolicyKeys = ['terms','privacy','subscription','payments','cancellation-refunds','health-data'] as const satisfies readonly DoctorPolicyKey[]
export function doctorPolicyDocument(key: DoctorPolicyKey, ar: boolean) { return bundle.documents[key][ar ? 'ar' : 'en'] }
export function doctorPolicyLinks(ar: boolean) {
 return doctorPolicyKeys.map(key => ({ to: `/policies/${key}`,label: doctorPolicyDocument(key,ar).title }))
}
export function doctorPolicyNavigation(ar: boolean) { return { label: ar ? 'مسودات السياسات للمراجعة' : 'Draft policies for review',links: doctorPolicyLinks(ar) } }
export function doctorPolicyMetadata(path: string,ar: boolean) {
 const key = doctorPolicyKeys.find(key => path === `/policies/${key}` || path === `/policies/${key}/`)
 return key ? doctorPolicyDocument(key,ar) : null
}
// Draft review must never masquerade as contract acceptance or live authority.
export const doctorPolicyReview = { version: bundle.version,sha256: review.sha256,status: bundle.status,acceptanceMode: review.acceptanceMode,qualifiedApproval: false as const,liveDataAllowed: false as const,livePaymentsAllowed: false as const }
