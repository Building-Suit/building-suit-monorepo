<script setup lang="ts">
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

async function selectSource(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) await act(() => center.uploadSource(file), 'migration.sourceUploaded')
  ;(event.target as HTMLInputElement).value = ''
}

function setMappingTarget(decision: MigrationMappingDecision, value: string) {
  decision.create_reviewed = value === '__create__'
  decision.target_id = decision.create_reviewed ? '' : value
}

function onMappingTarget(decision: MigrationMappingDecision, event: Event) {
  setMappingTarget(decision, (event.target as HTMLSelectElement).value)
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
const sectionClass = (state: string) => state === 'complete' ? 'text-success' : state === 'warning' ? 'text-warning' : state === 'not_applicable' ? 'text-fg-muted' : 'text-danger'
function isApplicable(key: string) {
  const operational = center.context.value?.operational_batches[0]
  if (!operational) return false
  if (key === 'open_items') return operational.open_items_applicable
  if (key === 'assets') return operational.assets_applicable
  if (key === 'bank') return operational.bank_applicable
  if (key === 'inventory') return operational.inventory_applicable
  return operational.tax_applicable
}
</script>

<template>
  <div class="space-y-6" data-migration-center>
    <LedgerPageHeader :title="t('migration.title')" :subtitle="t('migration.subtitle')" :as-of="center.context.value?.project.cutover_date" />

    <p v-if="!can('migrations.read')" class="ls-card p-6 text-fg-muted">{{ t('migration.noAccess') }}</p>
    <template v-else>
      <section class="ls-card space-y-4 p-5" aria-labelledby="migration-projects">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <BsFloatingField class="min-w-64 flex-1" :label="t('migration.project')">
            <BsSelect id="migration-project" v-model="selectedProjectId" :label="t('migration.project')" :placeholder="t('migration.chooseProject')" :options="projectOptions" option-label="label" option-value="id" />
          </BsFloatingField>
          <BsButton v-if="can('migrations.manage')" type="button" variant="primary" @click="createError = ''; createOpen = true">{{ t('migration.newProject') }}</BsButton>
        </div>
      </section>
      <BsRecordActionDialog v-if="createOpen" v-model:visible="createOpen" :title="t('migration.newProject')" :dirty="createDirty" :pending="center.pending.value === 'create'" :error="createError" size="lg" :submit-label="t('migration.createProject')" :cancel-label="t('common.cancel')" @submit="createProject">
        <div class="grid gap-4 md:grid-cols-2">
          <BsFloatingField :label="t('migration.projectName')"><input v-model="createForm.name" class="ls-input" required maxlength="160"></BsFloatingField>
          <BsFloatingField :label="t('migration.sourceType')"><select v-model="createForm.sourceType" class="ls-input"><option value="excel_csv">{{ t('migration.sourceTypes.excel_csv') }}</option><option value="other_system_export">{{ t('migration.sourceTypes.other_system_export') }}</option><option value="accountant_paper_workbook">{{ t('migration.sourceTypes.accountant_paper_workbook') }}</option></select></BsFloatingField>
          <BsFloatingField :label="t('migration.cutoverDate')"><input v-model="createForm.cutoverDate" class="ls-input" type="date" required></BsFloatingField>
          <BsFloatingField :label="t('migration.depth')"><select v-model="createForm.depth" class="ls-input"><option value="fast_cutover">{{ t('migration.depths.fast_cutover') }}</option><option value="current_fiscal_year">{{ t('migration.depths.current_fiscal_year') }}</option><option value="full_history">{{ t('migration.depths.full_history') }}</option></select></BsFloatingField>
          <p class="text-sm text-fg-muted md:col-span-2">{{ t('migration.fastCutoverPolicy') }}</p>
        </div>
      </BsRecordActionDialog>

      <p v-if="center.error.value" class="ls-error" role="alert">{{ t('migration.loadFailed') }}</p>
      <BsSectionSkeleton v-else-if="center.pending.value === 'context'" variant="table" :rows="6" />

      <template v-else-if="center.context.value">
        <section class="ls-card p-5" aria-labelledby="migration-progress">
          <h2 id="migration-progress" class="text-h2 font-bold">{{ t('migration.progress') }}</h2>
          <ol class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-migration-progress>
            <li v-for="(section, index) in progress" :key="section.key" class="rounded-control border border-line p-3" :data-section="section.key" :data-state="section.state">
              <span class="text-xs text-fg-muted">{{ index + 1 }}</span>
              <p class="font-semibold">{{ t(`migration.sections.${section.key}`) }}</p>
              <p class="text-sm" :class="sectionClass(section.state)">{{ t(`migration.states.${section.state}`) }}</p>
            </li>
          </ol>
        </section>

        <section class="ls-card space-y-4 p-5" aria-labelledby="migration-source">
          <div><h2 id="migration-source" class="text-h2 font-bold">{{ t('migration.sections.source') }}</h2><p class="text-sm text-fg-muted">{{ t('migration.sourceHint') }}</p></div>
          <div class="flex flex-wrap gap-2">
            <BsButton type="button" class="ls-btn ls-btn-sm" @click="downloadCsv(`migration-source-${locale}.csv`, migrationSourceTemplate(locale))">{{ t('migration.sourceTemplate') }}</BsButton>
            <BsButton type="button" class="ls-btn ls-btn-sm" @click="downloadCsv('migration-open-items.csv', migrationOpenItemsTemplate())">{{ t('migration.openItemsTemplate') }}</BsButton>
            <BsButton type="button" class="ls-btn ls-btn-sm" @click="downloadCsv('migration-operational-registers.csv', migrationOperationalTemplate())">{{ t('migration.operationalTemplate') }}</BsButton>
            <NuxtLink to="/opening-balances" class="ls-btn ls-btn-sm">{{ t('migration.openingTemplate') }}</NuxtLink>
          </div>
          <label v-if="can('migrations.manage') && !center.context.value.approval" class="ls-btn ls-btn-primary w-fit cursor-pointer" for="migration-source-file">{{ t('migration.uploadSource') }}</label>
          <input id="migration-source-file" class="sr-only" type="file" accept=".csv,text/csv" :disabled="Boolean(center.pending.value)" @change="selectSource">
          <div v-if="center.context.value.sources[0]" class="rounded-control bg-surface-muted p-3 text-sm">
            <p class="font-semibold">{{ center.context.value.sources[0].filename }} · {{ t('migration.revision', { revision: center.context.value.sources[0].revision }) }}</p>
            <p class="break-all text-fg-muted">SHA-256: {{ center.context.value.sources[0].content_sha256 }}</p>
            <p>{{ t('migration.originalRows', { count: sourceRows.length }) }}</p>
          </div>
          <BsDataTable v-if="sourceRows.length" :value="sourceRows" data-key="source_row" :label="t('migration.sourcePreview')" :table-style="{ minWidth: '680px' }">
            <Column field="source_row" header="#" />
            <Column :header="t('migration.sourceKind')"><template #body="{ data }">{{ t(`migration.kinds.${data.raw_payload.source_kind}`) }}</template></Column>
            <Column :header="t('migration.sourceKey')"><template #body="{ data }">{{ data.raw_payload.source_key }}</template></Column>
            <Column :header="t('migration.sourceName')"><template #body="{ data }">{{ data.raw_payload.source_name }}</template></Column>
            <Column :header="t('migration.rowIssues')"><template #body="{ data }"><span v-if="rowIssues(data.source_row).length" class="text-danger">{{ rowIssues(data.source_row).join(', ') }}</span><span v-else-if="center.context.value?.project.current_staging_batch_id" class="text-success">{{ t('migration.rowValid') }}</span><span v-else>—</span></template></Column>
          </BsDataTable>
        </section>

        <section v-if="mappingDecisions.length" class="ls-card space-y-4 p-5" aria-labelledby="migration-mapping">
          <div><h2 id="migration-mapping" class="text-h2 font-bold">{{ t('migration.sections.accounts') }}</h2><p class="text-sm text-fg-muted">{{ t('migration.mappingHint') }}</p></div>
          <BsDataTable :value="mappingDecisions" data-key="source_key" :label="t('migration.mappingReview')" :table-style="{ minWidth: '760px' }">
            <Column :header="t('migration.sourceKind')"><template #body="{ data }">{{ t(`migration.kinds.${data.source_kind}`) }}</template></Column>
            <Column field="source_key" :header="t('migration.sourceKey')" />
            <Column field="source_name" :header="t('migration.sourceName')" />
            <Column :header="t('migration.ledgerTarget')"><template #body="{ data }"><select class="ls-input min-w-64" :value="mappingTarget(data)" @change="onMappingTarget(data, $event)"><option value="">{{ t('migration.chooseTarget') }}</option><option v-for="option in mappingOptions(data)" :key="option.id" :value="option.id">{{ option.label }}</option><option v-if="data.source_kind !== 'account'" value="__create__">{{ t('migration.reviewedCreation') }}</option></select></template></Column>
          </BsDataTable>
          <BsFloatingField :label="t('migration.reviewNote')"><textarea v-model="reviewNote" class="ls-input min-h-24" minlength="8" maxlength="1000" /></BsFloatingField>
          <BsButton type="button" class="ls-btn ls-btn-primary" :disabled="!mappingReady || Boolean(center.pending.value)" @click="act(() => center.reviewMappings(mappingDecisions, reviewNote), 'migration.mappingSaved')">{{ center.pending.value === 'mapping' ? t('common.saving') : t('migration.validateMapping') }}</BsButton>
        </section>

        <section v-else-if="center.context.value.mapping_entries.length" class="ls-card space-y-4 p-5" aria-labelledby="migration-mapping-reviewed">
          <div><h2 id="migration-mapping-reviewed" class="text-h2 font-bold">{{ t('migration.mappingReview') }}</h2><p class="text-sm text-fg-muted">{{ center.context.value.mapping_revisions[0]?.review_note }}</p></div>
          <BsDataTable :value="center.context.value.mapping_entries" data-key="id" :label="t('migration.mappingReview')" :table-style="{ minWidth: '680px' }">
            <Column field="source_kind" :header="t('migration.sourceKind')" />
            <Column field="source_key" :header="t('migration.sourceKey')" />
            <Column field="resolution" :header="t('migration.resolution')" />
            <Column :header="t('migration.ledgerTarget')"><template #body="{ data }">{{ data.target_account_id || data.target_counterparty_id || data.proposed_record?.name }}</template></Column>
          </BsDataTable>
        </section>

        <section class="ls-card space-y-4 p-5" aria-labelledby="migration-opening">
          <div><h2 id="migration-opening" class="text-h2 font-bold">{{ t('migration.sections.opening') }}</h2><p class="text-sm text-fg-muted">{{ t('migration.openingHint') }}</p></div>
          <div v-if="!center.context.value.project.opening_balance_batch_id" class="flex flex-wrap items-end gap-3">
            <BsFloatingField class="min-w-72 flex-1" :label="t('migration.openingBatch')"><select v-model="selectedOpeningId" class="ls-input"><option value="">{{ t('migration.chooseOpening') }}</option><option v-for="batch in center.context.value.opening_candidates" :key="batch.id" :value="batch.id">{{ batch.source_filename }} · {{ t(`opening.status.${batch.status}`) }}</option></select></BsFloatingField>
            <BsButton type="button" class="ls-btn ls-btn-primary" :disabled="!selectedOpeningId || Boolean(center.pending.value)" @click="act(() => center.linkOpeningBalance(selectedOpeningId), 'migration.openingLinked')">{{ t('migration.linkOpening') }}</BsButton>
            <NuxtLink to="/opening-balances" class="ls-btn">{{ t('migration.prepareOpening') }}</NuxtLink>
          </div>
          <p v-else class="rounded-control bg-surface-muted p-3 text-sm">{{ t('migration.openingLinkedStatus', { status: t(`opening.status.${center.context.value.opening_batch?.status}`) }) }}</p>
        </section>

        <section class="ls-card space-y-4 p-5" aria-labelledby="migration-modules">
          <div><h2 id="migration-modules" class="text-h2 font-bold">{{ t('migration.modulesTitle') }}</h2><p class="text-sm text-fg-muted">{{ t('migration.modulesHint') }}</p></div>
          <div v-if="center.context.value.operational_batches[0]" class="grid gap-2 sm:grid-cols-5">
            <p v-for="key in ['open_items','assets','bank','inventory','tax']" :key="key" class="rounded-control border border-line p-3 text-sm"><span class="font-semibold">{{ t(`migration.moduleNames.${key}`) }}</span><br>{{ isApplicable(key) ? t('migration.applicable') : t('migration.notApplicable') }}</p>
          </div>
          <BsButton v-else-if="center.context.value.project.status === 'validated' && can('migrations.manage')" type="button" class="ls-btn" :disabled="Boolean(center.pending.value)" @click="act(() => center.markModulesNotApplicable(), 'migration.modulesSaved')">{{ t('migration.allModulesNotApplicable') }}</BsButton>
          <p class="rounded-control border border-warning bg-[var(--bs-status-warning-bg)] p-3 text-sm">{{ t('migration.historyPolicy') }}</p>
        </section>

        <section v-if="center.review.value" class="ls-card space-y-5 p-5" aria-labelledby="migration-final-review" data-final-review>
          <div><h2 id="migration-final-review" class="text-h2 font-bold">{{ t('migration.sections.final_review') }}</h2><p class="text-sm text-fg-muted">{{ t('migration.finalReviewHint', { revision: center.review.value.source_revision }) }}</p></div>
          <div class="grid gap-3 sm:grid-cols-3">
            <p><span class="text-fg-muted">{{ t('opening.debitTotal') }}</span><br><strong>{{ amount(openingReview?.debit_total_minor) }}</strong></p>
            <p><span class="text-fg-muted">{{ t('opening.creditTotal') }}</span><br><strong>{{ amount(openingReview?.credit_total_minor) }}</strong></p>
            <p><span class="text-fg-muted">{{ t('opening.difference') }}</span><br><strong>{{ amount(openingReview?.difference_minor) }}</strong></p>
          </div>
          <BsDataTable v-if="center.review.value.variances.length" :value="center.review.value.variances" :label="t('migration.reconciliations')" :table-style="{ minWidth: '680px' }">
            <Column field="module" :header="t('migration.module')" />
            <Column :header="t('migration.moduleDetail')"><template #body="{ data }">{{ amount(data.detail_minor) }}</template></Column>
            <Column :header="t('migration.glBalance')"><template #body="{ data }">{{ amount(data.gl_minor) }}</template></Column>
            <Column :header="t('opening.difference')"><template #body="{ data }"><span :class="data.variance_minor === '0' ? 'text-success' : 'text-danger'">{{ amount(data.variance_minor) }}</span></template></Column>
          </BsDataTable>
          <div v-if="center.review.value.errors.length" class="ls-error" role="alert"><p class="font-semibold">{{ t('migration.approvalBlocked') }}</p><ul class="mt-2 list-disc ps-5"><li v-for="code in center.review.value.errors" :key="code">{{ t(`migration.errors.${code}`) }}</li></ul></div>
          <div v-else class="rounded-control bg-[var(--bs-status-success-bg)] p-3 text-success" role="status">{{ t('migration.reconciled') }}</div>
          <div v-if="center.review.value.approved" class="rounded-control border border-success p-4" data-cutover-approved>
            <p class="font-bold text-success">{{ t('migration.approved') }}</p>
            <p class="text-sm">{{ t('migration.approvedEvidence', { time: dateTime(center.review.value.approved_at!), revision: center.review.value.source_revision }) }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <NuxtLink to="/reports" class="ls-btn ls-btn-sm">{{ t('nav.reports') }}</NuxtLink>
              <NuxtLink v-if="isApplicable('open_items')" to="/receivables" class="ls-btn ls-btn-sm">{{ t('ar.title') }}</NuxtLink>
              <NuxtLink v-if="isApplicable('open_items')" to="/payables" class="ls-btn ls-btn-sm">{{ t('ap.title') }}</NuxtLink>
              <NuxtLink v-if="isApplicable('bank')" to="/bank-reconciliation" class="ls-btn ls-btn-sm">{{ t('nav.bankReconciliation') }}</NuxtLink>
              <NuxtLink v-if="isApplicable('assets')" to="/fixed-assets" class="ls-btn ls-btn-sm">{{ t('nav.fixedAssets') }}</NuxtLink>
              <NuxtLink v-if="isApplicable('inventory')" to="/inventory-accounting" class="ls-btn ls-btn-sm">{{ t('nav.inventoryAccounting') }}</NuxtLink>
              <NuxtLink v-if="isApplicable('tax')" to="/tax-vat" class="ls-btn ls-btn-sm">{{ t('nav.taxVat') }}</NuxtLink>
            </div>
          </div>
          <template v-else>
            <label class="flex items-start gap-2 text-sm"><input v-model="approvalAcknowledged" type="checkbox" class="mt-1"><span>{{ t('migration.approvalAcknowledgement', { revision: center.review.value.source_revision, date: center.review.value.cutover_date }) }}</span></label>
            <p class="text-sm text-fg-muted">{{ t('migration.correctionPolicy') }}</p>
            <BsButton type="button" class="ls-btn ls-btn-primary" :disabled="!canApprove || Boolean(center.pending.value)" @click="act(() => center.approve(), 'migration.approvalSuccess')">{{ center.pending.value === 'approve' ? t('common.saving') : t('migration.finalApprove') }}</BsButton>
          </template>
        </section>
      </template>
    </template>
  </div>
</template>
