export interface BsTaxWorkspaceCopy {
  common_cancel: string
  common_retry: string
  common_save: string
  vat_addInput: string
  vat_addInputCredit: string
  vat_addOutput: string
  vat_addOutputCredit: string
  vat_base: string
  vat_baseAccount: string
  vat_calculatedTax: string
  vat_confirmRegistration: string
  vat_counterparty: string
  vat_denied: string
  vat_direction: string
  vat_documentDate: string
  vat_documents: string
  vat_effectiveFrom: string
  vat_egypt: string
  vat_empty: string
  vat_errors_load: string
  vat_evidenceDate: string
  vat_from: string
  vat_grossAccount: string
  vat_history: string
  vat_inputAccount: string
  vat_inputDifference: string
  vat_inputVat: string
  vat_journal: string
  vat_jurisdiction: string
  vat_netVat: string
  vat_notReconciled: string
  vat_original: string
  vat_outputAccount: string
  vat_outputDifference: string
  vat_outputVat: string
  vat_policy: string
  vat_rate: string
  vat_reconciled: string
  vat_reference: string
  vat_registration: string
  vat_reverse: string
  vat_run: string
  vat_scopeWarning: string
  vat_setupPolicy: string
  vat_setupTitle: string
  vat_tax: string
  vat_taxPointDate: string
  vat_title: string
  vat_to: string
}
export interface BsTaxWorkspaceChoice { value: string; label: string }
export interface BsTaxWorkspaceSetupForm { registration: string; effective: string; output: string; input: string }
export interface BsTaxWorkspaceDocumentForm { documentDate: string; taxPointDate: string; reference: string; base: string; baseAccount: string; grossAccount: string; counterparty: string; original: string; reason: string }
export interface BsTaxWorkspaceDocument { id: string; taxPointDate: string; documentDate: string; reference: string; kindLabel: string; base: string; tax: string; journalTo: string; canReverse: boolean }
export interface BsTaxWorkspaceView {
  context: { label: string; value: string }[]; contextLabel: string; canRead: boolean; canConfigure: boolean; canPost: boolean; canAdjust: boolean; readOnly: boolean
  pending: boolean; loadError: boolean; available: boolean; setupError: string; setupPending: boolean; setupDisabled: boolean
  profile: { registration: string; rate: string; evidenceDate: string; ruleName: string } | null
  report: { output: string; input: string; net: string; outputDifference: string; inputDifference: string; reconciled: boolean; documents: BsTaxWorkspaceDocument[] } | null
  dialogTitle: string; dialogPending: boolean; dialogDirty: boolean; dialogError: string; isCredit: boolean; isReversal: boolean; needsReason: boolean; reasonLabel: string; amountError: string; previewTax: string
}
export interface BsTaxWorkspaceChoices { output: BsTaxWorkspaceChoice[]; input: BsTaxWorkspaceChoice[]; base: BsTaxWorkspaceChoice[]; gross: BsTaxWorkspaceChoice[]; originals: BsTaxWorkspaceChoice[]; counterparties: BsTaxWorkspaceChoice[] }
