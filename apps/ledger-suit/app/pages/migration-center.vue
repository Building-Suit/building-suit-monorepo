<script setup lang="ts">
import type { BsMigrationCenterCopy, BsMigrationCenterView, BsMigrationCenterCreateForm, BsMigrationCenterChoices } from '@building-suit/ui/types/migrationCenterPresentation'
import type { Database } from '~~/types/database.types'
import type { MigrationDepth, MigrationSourceType } from '~~/types/migration-rpc.types'
import type { MigrationMappingDecision } from '~/composables/useMigrationCenter'
import { downloadCsv } from '~/utils/csv'
import { migrationOpenItemsTemplate, migrationOperationalTemplate, migrationProgress, migrationSourceTemplate } from '~/utils/migrationCenter'

definePageMeta({ layout: 'default' })
type Account = Pick<Database['public']['Tables']['accounts']['Row'], 'id' | 'code' | 'name' | 'account_role' | 'is_archived'>
type Counterparty = Pick<Database['public']['Tables']['counterparties']['Row'], 'id' | 'name' | 'type' | 'is_archived'>

const supabase = useSupabaseClient<Database>()
const { currentId, baseCurrency, can } = useTenant()
const { t, locale } = useI18n()
const toasts = useToasts()
const describeError = useErrorMessage()
const center = useMigrationCenter()
const selectedProjectId = ref('')
const createOpen = ref(false)
const createForm = reactive({ name: '', sourceType: 'excel_csv' as MigrationSourceType, cutoverDate: '', depth: 'fast_cutover' as MigrationDepth })
const createError = ref('')
const { dirty: createDirty } = useRecordAction(() => createForm, computed(() => createOpen.value))
const mappingDecisions = ref<MigrationMappingDecision[]>([])
const reviewNote = ref('')
const selectedOpeningId = ref('')
const approvalAcknowledged = ref(false)

useHead({ title: () => `${t('migration.title')} · ${t('app.name')}` })

const referenceKey = computed(() => `org:migration-center-references:${currentId.value ?? ''}`)
const { data: references } = useLazyAsyncData(referenceKey, async () => {
  if (!currentId.value || !can('migrations.read')) return { accounts: [], counterparties: [] }
  const [accounts, counterparties] = await Promise.all([
    supabase.from('accounts').select('id,code,name,account_role,is_archived').eq('organization_id', currentId.value).order('code'),
    supabase.from('counterparties').select('id,name,type,is_archived').eq('organization_id', currentId.value).order('name'),
  ])
  if (accounts.error) throw accounts.error
  if (counterparties.error) throw counterparties.error
  return { accounts: accounts.data as Account[], counterparties: counterparties.data as Counterparty[] }
}, { default: () => ({ accounts: [] as Account[], counterparties: [] as Counterparty[] }) })

const activeAccounts = computed(() => references.value.accounts.filter(account => !account.is_archived && account.account_role === 'posting'))
const activeCounterparties = computed(() => references.value.counterparties.filter(item => !item.is_archived))
const projectOptions = computed(() => center.projects.value.map(project => ({ id: project.id, label: `${project.name} · ${project.cutover_date}` })))
const progress = computed(() => center.context.value ? migrationProgress(center.context.value, center.review.value) : [])
const openingReview = computed(() => center.review.value?.modules.opening_trial_balance)
const canApprove = computed(() => can('migrations.review') && can('opening_balances.approve') && center.review.value?.valid && !center.review.value.approved && approvalAcknowledged.value)
const amount = (value: string | number | undefined, currency = openingReview.value?.currency || baseCurrency.value) => value == null ? '—' : formatMoney(value, currency, locale.value)
const dateTime = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const sourceRows = computed(() => center.context.value?.original_rows ?? [])
function rowIssues(sourceRow: number) {
  return center.context.value?.normalized_rows.find(row => row.source_row === sourceRow)?.validation_errors ?? []
}

watch(() => center.projects.value, (projects) => {
  if (!selectedProjectId.value && projects[0]) selectedProjectId.value = projects[0].id
}, { immediate: true })
watch(selectedProjectId, (id) => { if (id) void center.load(id) })
watch(() => center.context.value, (context) => {
  approvalAcknowledged.value = false
  selectedOpeningId.value = context?.project.opening_balance_batch_id || context?.opening_candidates[0]?.id || ''
  if (!context?.project.current_source_revision_id || context.project.current_mapping_revision_id) {
    mappingDecisions.value = []
    return
  }
  const unique = new Map<string, MigrationMappingDecision>()
  for (const row of context.original_rows) {
    const raw = row.raw_payload
    const sourceKind = raw.source_kind as MigrationMappingDecision['source_kind']
    const sourceKey = raw.source_key
    if (!sourceKind || !sourceKey) continue
    unique.set(`${sourceKind}:${sourceKey}`, { source_kind: sourceKind, source_key: sourceKey, source_name: raw.source_name || sourceKey, target_id: '', create_reviewed: false })
  }
  mappingDecisions.value = [...unique.values()]
}, { deep: false })

async function act(action: () => Promise<unknown>, success?: string) {
  try {
    await action()
    if (success) toasts.success(t('migration.successTitle'), t(success))
  }
  catch (failure) { toasts.error(t('migration.errorTitle'), describeError(failure)) }
}

async function createProject() {
  createError.value = ''
  try {
    const id = await center.createProject(createForm)
    selectedProjectId.value = id
    createOpen.value = false
    createForm.name = ''
    toasts.success(t('migration.successTitle'), t('migration.created'))
  }
  catch (failure) {
    createError.value = describeError(failure)
    toasts.error(t('migration.errorTitle'), createError.value)
  }
}

async function selectSource(file: File | null) {
  if (file) await act(() => center.uploadSource(file), 'migration.sourceUploaded')
}

function setMappingTarget(decision: MigrationMappingDecision, value: string) {
  decision.create_reviewed = value === '__create__'
  decision.target_id = decision.create_reviewed ? '' : value
}


function mappingTarget(decision: MigrationMappingDecision) {
  return decision.create_reviewed ? '__create__' : decision.target_id
}

function mappingOptions(decision: MigrationMappingDecision) {
  if (decision.source_kind === 'account') return activeAccounts.value.map(item => ({ id: item.id, label: `${item.code} · ${item.name}` }))
  const type = decision.source_kind === 'supplier' ? 'vendor' : 'customer'
  return activeCounterparties.value.filter(item => item.type === type).map(item => ({ id: item.id, label: item.name }))
}

const mappingReady = computed(() => mappingDecisions.value.length > 0 && mappingDecisions.value.every(item => item.create_reviewed || item.target_id) && reviewNote.value.trim().length >= 8)
function isApplicable(key: string) {
  const operational = center.context.value?.operational_batches[0]
  if (!operational) return false
  if (key === 'open_items') return operational.open_items_applicable
  if (key === 'assets') return operational.assets_applicable
  if (key === 'bank') return operational.bank_applicable
  if (key === 'inventory') return operational.inventory_applicable
  return operational.tax_applicable
}
const ledgerPresentation = useLedgerPresentation()

const migrationCopy = computed<BsMigrationCenterCopy>(() => ({
  ap_title: t('ap.title'),
  ar_title: t('ar.title'),
  common_cancel: t('common.cancel'),
  common_saving: t('common.saving'),
  migration_allModulesNotApplicable: t('migration.allModulesNotApplicable'),
  migration_applicable: t('migration.applicable'),
  migration_approvalAcknowledgement: t('migration.approvalAcknowledgement', { revision: center.review.value?.source_revision ?? 0, date: center.review.value?.cutover_date ?? '' }),
  migration_approvalBlocked: t('migration.approvalBlocked'),
  migration_approved: t('migration.approved'),
  migration_approvedEvidence: center.review.value?.approved_at ? t('migration.approvedEvidence', { time: dateTime(center.review.value.approved_at), revision: center.review.value.source_revision }) : '',
  migration_chooseOpening: t('migration.chooseOpening'),
  migration_chooseProject: t('migration.chooseProject'),
  migration_chooseTarget: t('migration.chooseTarget'),
  migration_correctionPolicy: t('migration.correctionPolicy'),
  migration_createProject: t('migration.createProject'),
  migration_cutoverDate: t('migration.cutoverDate'),
  migration_depth: t('migration.depth'),
  migration_depths_current_fiscal_year: t('migration.depths.current_fiscal_year'),
  migration_depths_fast_cutover: t('migration.depths.fast_cutover'),
  migration_depths_full_history: t('migration.depths.full_history'),
  migration_fastCutoverPolicy: t('migration.fastCutoverPolicy'),
  migration_finalApprove: t('migration.finalApprove'),
  migration_finalReviewHint: t('migration.finalReviewHint', { revision: center.review.value?.source_revision ?? 0 }),
  migration_glBalance: t('migration.glBalance'),
  migration_historyPolicy: t('migration.historyPolicy'),
  migration_ledgerTarget: t('migration.ledgerTarget'),
  migration_linkOpening: t('migration.linkOpening'),
  migration_loadFailed: t('migration.loadFailed'),
  migration_mappingHint: t('migration.mappingHint'),
  migration_mappingReview: t('migration.mappingReview'),
  migration_module: t('migration.module'),
  migration_moduleDetail: t('migration.moduleDetail'),
  migration_modulesHint: t('migration.modulesHint'),
  migration_modulesTitle: t('migration.modulesTitle'),
  migration_newProject: t('migration.newProject'),
  migration_noAccess: t('migration.noAccess'),
  migration_notApplicable: t('migration.notApplicable'),
  migration_openItemsTemplate: t('migration.openItemsTemplate'),
  migration_openingBatch: t('migration.openingBatch'),
  migration_openingHint: t('migration.openingHint'),
  migration_openingLinkedStatus: t('migration.openingLinkedStatus', { status: t(`opening.status.${center.context.value?.opening_batch?.status}`) }),
  migration_openingTemplate: t('migration.openingTemplate'),
  migration_operationalTemplate: t('migration.operationalTemplate'),
  migration_originalRows: t('migration.originalRows', { count: sourceRows.value.length }),
  migration_prepareOpening: t('migration.prepareOpening'),
  migration_progress: t('migration.progress'),
  migration_project: t('migration.project'),
  migration_projectName: t('migration.projectName'),
  migration_reconciled: t('migration.reconciled'),
  migration_reconciliations: t('migration.reconciliations'),
  migration_resolution: t('migration.resolution'),
  migration_reviewNote: t('migration.reviewNote'),
  migration_reviewedCreation: t('migration.reviewedCreation'),
  migration_rowIssues: t('migration.rowIssues'),
  migration_rowValid: t('migration.rowValid'),
  migration_sections_accounts: t('migration.sections.accounts'),
  migration_sections_final_review: t('migration.sections.final_review'),
  migration_sections_opening: t('migration.sections.opening'),
  migration_sections_source: t('migration.sections.source'),
  migration_sourceHint: t('migration.sourceHint'),
  migration_sourceKey: t('migration.sourceKey'),
  migration_sourceKind: t('migration.sourceKind'),
  migration_sourceName: t('migration.sourceName'),
  migration_sourcePreview: t('migration.sourcePreview'),
  migration_sourceTemplate: t('migration.sourceTemplate'),
  migration_sourceType: t('migration.sourceType'),
  migration_sourceTypes_accountant_paper_workbook: t('migration.sourceTypes.accountant_paper_workbook'),
  migration_sourceTypes_excel_csv: t('migration.sourceTypes.excel_csv'),
  migration_sourceTypes_other_system_export: t('migration.sourceTypes.other_system_export'),
  migration_subtitle: t('migration.subtitle'),
  migration_title: t('migration.title'),
  migration_uploadSource: t('migration.uploadSource'),
  migration_validateMapping: t('migration.validateMapping'),
  nav_bankReconciliation: t('nav.bankReconciliation'),
  nav_fixedAssets: t('nav.fixedAssets'),
  nav_inventoryAccounting: t('nav.inventoryAccounting'),
  nav_reports: t('nav.reports'),
  nav_taxVat: t('nav.taxVat'),
  opening_creditTotal: t('opening.creditTotal'),
  opening_debitTotal: t('opening.debitTotal'),
  opening_difference: t('opening.difference'),
  pageContext_label: t('pageContext.label'),
  sourceHashLabel: 'SHA-256',
}))
const migrationCreateForm = computed<BsMigrationCenterCreateForm>({ get: () => ({ ...createForm }), set: value => {
  createForm.name = value.name; createForm.cutoverDate = value.cutoverDate
  if (['excel_csv', 'other_system_export', 'accountant_paper_workbook'].includes(value.sourceType)) createForm.sourceType = value.sourceType as MigrationSourceType
  if (['fast_cutover', 'current_fiscal_year', 'full_history'].includes(value.depth)) createForm.depth = value.depth as MigrationDepth
} })
function displayString(value: unknown): string { return typeof value === 'string' ? value : '' }
function reviewedTarget(row: Record<string, unknown>): string {
  const proposed = row.proposed_record
  const name = proposed && typeof proposed === 'object' && 'name' in proposed ? displayString(proposed.name) : ''
  return displayString(row.target_account_id) || displayString(row.target_counterparty_id) || name
}
const migrationView = computed<BsMigrationCenterView>(() => ({
  context: ledgerPresentation.context(undefined, undefined, center.context.value?.project.cutover_date), contextLabel: t('pageContext.label'), canRead: can('migrations.read'), canManage: can('migrations.manage'), available: Boolean(center.context.value), loading: center.pending.value === 'context', error: Boolean(center.error.value), busy: Boolean(center.pending.value), createDirty: createDirty.value, createPending: center.pending.value === 'create', createError: createError.value, projectNameMaxLength: 160, reviewNoteMinLength: 8, reviewNoteMaxLength: 1000,
  progress: progress.value.map(section => ({ key: section.key, state: section.state, label: t(`migration.sections.${section.key}`), description: t(`migration.states.${section.state}`), tone: section.state === 'complete' ? 'success' : section.state === 'warning' ? 'warning' : section.state === 'not_applicable' ? 'muted' : 'danger' })), canUpload: can('migrations.manage') && !center.context.value?.approval,
  source: center.context.value?.sources[0] ? { name: center.context.value.sources[0].filename, revision: t('migration.revision', { revision: center.context.value.sources[0].revision }), hash: center.context.value.sources[0].content_sha256 } : null,
  sourceRows: sourceRows.value.map(row => ({ sourceRow: row.source_row, kind: t(`migration.kinds.${row.raw_payload.source_kind}`), key: row.raw_payload.source_key ?? '', name: row.raw_payload.source_name ?? '', issues: rowIssues(row.source_row).join(', ') })), staged: Boolean(center.context.value?.project.current_staging_batch_id),
  mappings: mappingDecisions.value.map(decision => ({ id: `${decision.source_kind}:${decision.source_key}`, kind: t(`migration.kinds.${decision.source_kind}`), sourceKey: decision.source_key, sourceName: decision.source_name, target: mappingTarget(decision), choices: [...mappingOptions(decision).map(option => ({ value: option.id, label: option.label })), ...(decision.source_kind !== 'account' ? [{ value: '__create__', label: t('migration.reviewedCreation') }] : [])] })), mappingDisabled: !mappingReady.value || Boolean(center.pending.value), mappingLabel: center.pending.value === 'mapping' ? t('common.saving') : t('migration.validateMapping'), mappingNote: center.context.value?.mapping_revisions[0]?.review_note ?? '',
  reviewedMappings: (center.context.value?.mapping_entries ?? []).map(row => ({ id: displayString(row.id), kind: displayString(row.source_kind), sourceKey: displayString(row.source_key), resolution: displayString(row.resolution), target: reviewedTarget(row) })), openingLinked: Boolean(center.context.value?.project.opening_balance_batch_id), openingLinkDisabled: !selectedOpeningId.value || Boolean(center.pending.value),
  modules: center.context.value?.operational_batches[0] ? ['open_items', 'assets', 'bank', 'inventory', 'tax'].map(key => ({ id: key, label: t(`migration.moduleNames.${key}`), status: t(isApplicable(key) ? 'migration.applicable' : 'migration.notApplicable') })) : [], canMarkModules: center.context.value?.project.status === 'validated' && can('migrations.manage'),
  review: center.review.value ? { debit: amount(openingReview.value?.debit_total_minor), credit: amount(openingReview.value?.credit_total_minor), difference: amount(openingReview.value?.difference_minor), variances: center.review.value.variances.map((row, index) => ({ id: String(index), module: row.module, detail: amount(row.detail_minor), gl: amount(row.gl_minor), variance: amount(row.variance_minor), tone: row.variance_minor === '0' ? 'success' : 'danger' })), errors: center.review.value.errors.map(code => t(`migration.errors.${code}`)), approved: center.review.value.approved, links: [{ to: '/reports', label: t('nav.reports') }, ...(isApplicable('open_items') ? [{ to: '/receivables', label: t('ar.title') }, { to: '/payables', label: t('ap.title') }] : []), ...(['bank', 'assets', 'inventory', 'tax'] as const).filter(isApplicable).map(key => ({ to: { bank: '/bank-reconciliation', assets: '/fixed-assets', inventory: '/inventory-accounting', tax: '/tax-vat' }[key], label: t({ bank: 'nav.bankReconciliation', assets: 'nav.fixedAssets', inventory: 'nav.inventoryAccounting', tax: 'nav.taxVat' }[key]) }))] } : null,
  approveDisabled: !canApprove.value || Boolean(center.pending.value), approveLabel: center.pending.value === 'approve' ? t('common.saving') : t('migration.finalApprove'), openingTo: '/opening-balances',
}))
const migrationChoices = computed<BsMigrationCenterChoices>(() => ({ projects: projectOptions.value.map(option => ({ value: option.id, label: option.label })), sourceTypes: ['excel_csv', 'other_system_export', 'accountant_paper_workbook'].map(value => ({ value, label: t(`migration.sourceTypes.${value}`) })), depths: ['fast_cutover', 'current_fiscal_year', 'full_history'].map(value => ({ value, label: t(`migration.depths.${value}`) })), openings: (center.context.value?.opening_candidates ?? []).map(batch => ({ value: batch.id, label: `${batch.source_filename} · ${t(`opening.status.${batch.status}`)}` })) }))
function openMigrationProject() { createError.value = ''; createOpen.value = true }
function mapMigrationTarget(id: string, value: string) { const decision = mappingDecisions.value.find(row => `${row.source_kind}:${row.source_key}` === id); if (decision) setMappingTarget(decision, value) }
function downloadMigrationSource() { downloadCsv(`migration-source-${locale.value}.csv`, migrationSourceTemplate(locale.value)) }
function downloadMigrationOpenItems() { downloadCsv('migration-open-items.csv', migrationOpenItemsTemplate()) }
function downloadMigrationOperational() { downloadCsv('migration-operational-registers.csv', migrationOperationalTemplate()) }
async function reviewMigrationMappings() { await act(() => center.reviewMappings(mappingDecisions.value, reviewNote.value), 'migration.mappingSaved') }
async function linkMigrationOpening() { await act(() => center.linkOpeningBalance(selectedOpeningId.value), 'migration.openingLinked') }
async function markMigrationModules() { await act(() => center.markModulesNotApplicable(), 'migration.modulesSaved') }
async function approveMigration() { await act(() => center.approve(), 'migration.approvalSuccess') }
</script>
<template>
  <BsMigrationCenterPage v-model:create-open="createOpen" v-model:create-form="migrationCreateForm" v-model:selected-project-id="selectedProjectId" v-model:selected-opening-id="selectedOpeningId" v-model:review-note="reviewNote" v-model:approval-acknowledged="approvalAcknowledged" :copy="migrationCopy" :view="migrationView" :choices="migrationChoices" @open-create="openMigrationProject" @create-project="createProject" @download-source="downloadMigrationSource" @download-open-items="downloadMigrationOpenItems" @download-operational="downloadMigrationOperational" @file="selectSource" @map-target="mapMigrationTarget" @review-mappings="reviewMigrationMappings" @link-opening="linkMigrationOpening" @mark-modules="markMigrationModules" @approve="approveMigration" />
</template>
