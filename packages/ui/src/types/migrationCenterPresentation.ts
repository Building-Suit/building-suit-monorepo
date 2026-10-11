export interface BsMigrationCenterCopy {
  ap_title: string
  ar_title: string
  common_cancel: string
  common_saving: string
  migration_allModulesNotApplicable: string
  migration_applicable: string
  migration_approvalAcknowledgement: string
  migration_approvalBlocked: string
  migration_approved: string
  migration_approvedEvidence: string
  migration_chooseOpening: string
  migration_chooseProject: string
  migration_chooseTarget: string
  migration_correctionPolicy: string
  migration_createProject: string
  migration_cutoverDate: string
  migration_depth: string
  migration_depths_current_fiscal_year: string
  migration_depths_fast_cutover: string
  migration_depths_full_history: string
  migration_fastCutoverPolicy: string
  migration_finalApprove: string
  migration_finalReviewHint: string
  migration_glBalance: string
  migration_historyPolicy: string
  migration_ledgerTarget: string
  migration_linkOpening: string
  migration_loadFailed: string
  migration_mappingHint: string
  migration_mappingReview: string
  migration_module: string
  migration_moduleDetail: string
  migration_modulesHint: string
  migration_modulesTitle: string
  migration_newProject: string
  migration_noAccess: string
  migration_notApplicable: string
  migration_openItemsTemplate: string
  migration_openingBatch: string
  migration_openingHint: string
  migration_openingLinkedStatus: string
  migration_openingTemplate: string
  migration_operationalTemplate: string
  migration_originalRows: string
  migration_prepareOpening: string
  migration_progress: string
  migration_project: string
  migration_projectName: string
  migration_reconciled: string
  migration_reconciliations: string
  migration_resolution: string
  migration_reviewNote: string
  migration_reviewedCreation: string
  migration_rowIssues: string
  migration_rowValid: string
  migration_sections_accounts: string
  migration_sections_final_review: string
  migration_sections_opening: string
  migration_sections_source: string
  migration_sourceHint: string
  migration_sourceKey: string
  migration_sourceKind: string
  migration_sourceName: string
  migration_sourcePreview: string
  migration_sourceTemplate: string
  migration_sourceType: string
  migration_sourceTypes_accountant_paper_workbook: string
  migration_sourceTypes_excel_csv: string
  migration_sourceTypes_other_system_export: string
  migration_subtitle: string
  migration_title: string
  migration_uploadSource: string
  migration_validateMapping: string
  nav_bankReconciliation: string
  nav_fixedAssets: string
  nav_inventoryAccounting: string
  nav_reports: string
  nav_taxVat: string
  opening_creditTotal: string
  opening_debitTotal: string
  opening_difference: string
  pageContext_label: string
  sourceHashLabel: string
}
export interface BsMigrationCenterChoice { value: string; label: string }
export interface BsMigrationCenterCreateForm { name: string; sourceType: string; cutoverDate: string; depth: string }
export interface BsMigrationCenterSourceRow { sourceRow: number; kind: string; key: string; name: string; issues: string }
export interface BsMigrationCenterMappingRow { id: string; kind: string; sourceKey: string; sourceName: string; target: string; choices: BsMigrationCenterChoice[] }
export interface BsMigrationCenterView {
  context: { label: string; value: string }[]; contextLabel: string; canRead: boolean; canManage: boolean; available: boolean; loading: boolean; error: boolean; busy: boolean
  createDirty: boolean; createPending: boolean; createError: string; projectNameMaxLength: number; reviewNoteMinLength: number; reviewNoteMaxLength: number
  progress: { key: string; state: string; label: string; description: string; tone: 'success' | 'warning' | 'muted' | 'danger' }[]
  canUpload: boolean; source: { name: string; revision: string; hash: string } | null; sourceRows: BsMigrationCenterSourceRow[]; staged: boolean
  mappings: BsMigrationCenterMappingRow[]; mappingDisabled: boolean; mappingLabel: string; mappingNote: string; reviewedMappings: { id: string; kind: string; sourceKey: string; resolution: string; target: string }[]
  openingLinked: boolean; openingLinkDisabled: boolean; modules: { id: string; label: string; status: string }[]; canMarkModules: boolean
  review: { debit: string; credit: string; difference: string; variances: { id: string; module: string; detail: string; gl: string; variance: string; tone: 'success' | 'danger' }[]; errors: string[]; approved: boolean; links: { to: string; label: string }[] } | null
  approveDisabled: boolean; approveLabel: string; openingTo: string
}
export interface BsMigrationCenterChoices { projects: BsMigrationCenterChoice[]; sourceTypes: BsMigrationCenterChoice[]; depths: BsMigrationCenterChoice[]; openings: BsMigrationCenterChoice[] }
