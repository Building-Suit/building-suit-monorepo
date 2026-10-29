export interface BsSignupForm {
  name: string; phone: string; jobTitle: string; email: string; password: string
  workspaceName: string; legalName: string; businessType: string; country: string; currency: string; timezone: string; fiscalMonth: number; taxIdentifier: string
  locationName: string; locationCode: string; locationAddress: string; locationPhone: string; businessMode: string
}
export interface BsSignupChoice { value: string | number; label: string }
export interface BsSignupFeatures { accountEmail?: boolean; profileName?: boolean; profileNameMaxLength?: number; standaloneTimezone?: boolean; locationContactFields?: boolean; phone: boolean; jobTitle: boolean; organizationDetails: boolean; mainLocation: boolean; businessMode: boolean; passwordMinLength: number; workspaceMinLength: number | null; workspaceMaxLength: number | null; locationMinLength: number | null; locationMaxLength: number | null; locationCodeMaxLength: number | null; locationAddressMaxLength: number | null; locationPhoneMaxLength: number | null }
export interface BsSignupView { showVerifiedIdentity?: boolean; nameLocked?: boolean; stage: 'account' | 'workspace' | 'verification' | 'recovery'; step: number; pending: boolean; error: string; notice: string; existingAccount: boolean; hydrated: boolean | undefined; submitDisabled: boolean; submitLabel: string; pendingLabel: string; expired: boolean; resendDisabled: boolean; verified: boolean; canStartOver: boolean }
export interface BsSignupCopy {
  eyebrow: string; title: string; description: string; name: string; phone: string; jobTitle: string; email: string; password: string; passwordHint: string
  workspaceName: string; legalName: string; businessType: string; country: string; currency: string; timezone: string; fiscalMonth: string; taxIdentifier: string; optional: string
  mainLocation: string; locationName: string; locationCode: string; locationAddress: string; locationPhone: string; businessMode: string; businessModeHelp: string; trialTitle: string; trialBody: string
  back: string; formFooter: string; signIn: string; recoveryTitle: string; recoveryBody: string; recover: string; startOver: string
  steps: { id: string | number; title: string; body: string }[]
}
export interface BsSignupVerificationCopy { eyebrow?: string; title: string; description: string; codeLabel: string; expiryLabel: string; expiredLabel: string; submitLabel: string; pendingLabel: string; resendLabel: string; attemptsLabel?: string; resendPrompt?: string; securityTitle?: string; securityBody?: string }
export interface BsSignupProduct { framed: boolean; name: string; assetPrefix: string; homeLabel: string; title: string; description: string }
export interface BsSignupLegalConsent { keypath: string; termsLabel: string; termsTo: string; refundLabel: string; refundTo: string; privacyLabel: string; privacyTo: string }
export interface BsSignupChoices { timezones?: BsSignupChoice[]; businessTypes: BsSignupChoice[]; countries: BsSignupChoice[]; currencies: BsSignupChoice[]; fiscalMonths: BsSignupChoice[]; businessModes: BsSignupChoice[] }
export interface BsSignupLinks { signInTo: string; recoveryTo: string; formSignInLabel: string; verificationFooter: boolean; legal: { to: string; label: string }[] }
