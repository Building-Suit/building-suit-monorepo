export interface BsInvitationIdentityForm {
  email: string
  password: string
  confirmation: string
  name: string
  phone: string
  jobTitle: string
}
export interface BsInvitationPageCopy {
  eyebrow?: string
  title: string
  description: string
  submit: string
  pending: string
  invalid: string
  backToLogin?: string
  email: string
  password: string
  confirmation?: string
  name?: string
  phone?: string
  jobTitle?: string
  switchAccount?: string
  security?: string
  verification: { eyebrow?: string; title: string; description: string; code: string; submit: string; pending: string; resend: string; expired: string; expiry?: string; security?: string }
  login?: string
  recover?: string
}
