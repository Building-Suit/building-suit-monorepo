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
</script>

<template>
  <BsStack data-migration-center gap="lg">
    <BsPageHeader
      :title="t('migration.title')"
      :subtitle="t('migration.subtitle')"
      :context="ledgerPresentation.context(undefined, undefined, center.context.value?.project.cutover_date)"
      :context-label="ledgerPresentation.t('pageContext.label')"
    />
    <BsText v-if="!can('migrations.read')" tone="muted">{{ t('migration.noAccess') }}</BsText>
    <template v-else>
      <BsCard aria-labelledby="migration-projects" as="section" padding="md">
        <BsStack gap="md">
          <BsInline gap="md" :wrap="true" align="end" justify="between">
            <BsFloatingField :label="t('migration.project')">
              <BsSelect
                id="migration-project"
                v-model="selectedProjectId"
                :label="t('migration.project')"
                :placeholder="t('migration.chooseProject')"
                :options="projectOptions"
                option-label="label"
                option-value="id"
              />
            </BsFloatingField>
            <BsButton v-if="can('migrations.manage')" type="button" variant="primary" @click="createError = ''; createOpen = true">{{ t('migration.newProject') }}</BsButton>
          </BsInline>
        </BsStack>
      </BsCard>
      <BsRecordActionDialog
        v-if="createOpen"
        v-model:visible="createOpen"
        :title="t('migration.newProject')"
        :dirty="createDirty"
        :pending="center.pending.value === 'create'"
        :error="createError"
        size="lg"
        :submit-label="t('migration.createProject')"
        :cancel-label="t('common.cancel')"
        @submit="createProject"
      >
        <BsGrid :columns="2" gap="md">
          <BsFloatingField :label="t('migration.projectName')">
            <BsInput v-model="createForm.name" required maxlength="160" />
          </BsFloatingField>
          <BsFloatingField :label="t('migration.sourceType')">
            <BsSelect v-model="createForm.sourceType" native>
              <BsSelectOption value="excel_csv">{{ t('migration.sourceTypes.excel_csv') }}</BsSelectOption>
              <BsSelectOption value="other_system_export">{{ t('migration.sourceTypes.other_system_export') }}</BsSelectOption>
              <BsSelectOption value="accountant_paper_workbook">{{ t('migration.sourceTypes.accountant_paper_workbook') }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsFloatingField :label="t('migration.cutoverDate')">
            <BsInput v-model="createForm.cutoverDate" type="date" required />
          </BsFloatingField>
          <BsFloatingField :label="t('migration.depth')">
            <BsSelect v-model="createForm.depth" native>
              <BsSelectOption value="fast_cutover">{{ t('migration.depths.fast_cutover') }}</BsSelectOption>
              <BsSelectOption value="current_fiscal_year">{{ t('migration.depths.current_fiscal_year') }}</BsSelectOption>
              <BsSelectOption value="full_history">{{ t('migration.depths.full_history') }}</BsSelectOption>
            </BsSelect>
          </BsFloatingField>
          <BsText size="sm" tone="muted">{{ t('migration.fastCutoverPolicy') }}</BsText>
        </BsGrid>
      </BsRecordActionDialog>
      <BsText v-if="center.error.value" role="alert" tone="danger">{{ t('migration.loadFailed') }}</BsText>
      <BsSectionSkeleton v-else-if="center.pending.value === 'context'" variant="table" :rows="6" />
      <template v-else-if="center.context.value">
        <BsCard aria-labelledby="migration-progress" as="section" padding="md">
          <BsHeading id="migration-progress" :level="2" size="h2">{{ t('migration.progress') }}</BsHeading>
          <BsList data-migration-progress :ordered="true" marker="none">
            <BsListItem v-for="(section, index) in progress" :key="section.key" :data-section="section.key" :data-state="section.state">
              <BsText as="span" size="xs" tone="muted">{{ index + 1 }}</BsText>
              <BsText emphasis="semibold">{{ t(`migration.sections.${section.key}`) }}</BsText>
              <BsText size="sm" :tone="section.state === 'complete' ? 'success' : section.state === 'warning' ? 'warning' : section.state === 'not_applicable' ? 'muted' : 'danger'">{{ t(`migration.states.${section.state}`) }}</BsText>
            </BsListItem>
          </BsList>
        </BsCard>
        <BsCard aria-labelledby="migration-source" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-source" :level="2" size="h2">{{ t('migration.sections.source') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ t('migration.sourceHint') }}</BsText>
            </BsBox>
            <BsInline gap="sm" :wrap="true">
              <BsButton type="button" size="sm" @click="downloadCsv(`migration-source-${locale}.csv`, migrationSourceTemplate(locale))">{{ t('migration.sourceTemplate') }}</BsButton>
              <BsButton type="button" size="sm" @click="downloadCsv('migration-open-items.csv', migrationOpenItemsTemplate())">{{ t('migration.openItemsTemplate') }}</BsButton>
              <BsButton type="button" size="sm" @click="downloadCsv('migration-operational-registers.csv', migrationOperationalTemplate())">{{ t('migration.operationalTemplate') }}</BsButton>
              <BsLink to="/opening-balances">{{ t('migration.openingTemplate') }}</BsLink>
            </BsInline>
            <BsFieldLabel v-if="can('migrations.manage') && !center.context.value.approval" for="migration-source-file">{{ t('migration.uploadSource') }}</BsFieldLabel>
            <BsFileInput id="migration-source-file" accept=".csv,text/csv" :disabled="Boolean(center.pending.value)" bare @change="selectSource"  hide-control />
            <BsBox v-if="center.context.value.sources[0]" padding="md" surface="muted" radius="control">
              <BsText emphasis="semibold">{{ center.context.value.sources[0].filename }} · {{ t('migration.revision', { revision: center.context.value.sources[0].revision }) }}</BsText>
              <BsText tone="muted">SHA-256: {{ center.context.value.sources[0].content_sha256 }}</BsText>
              <BsText>{{ t('migration.originalRows', { count: sourceRows.length }) }}</BsText>
            </BsBox>
            <BsDataTable
              v-if="sourceRows.length"
              :value="sourceRows"
              row-key="source_row"
              :label="t('migration.sourcePreview')"
              :columns="[{ key: 'source_row', field: 'source_row', header: '#' }, { key: 'column2', header: t('migration.sourceKind') }, { key: 'column3', header: t('migration.sourceKey') }, { key: 'column4', header: t('migration.sourceName') }, { key: 'column5', header: t('migration.rowIssues') }]"
            >
              <template #cell-column2="{ row: data }">{{ t(`migration.kinds.${data.raw_payload.source_kind}`) }}</template>
              <template #cell-column3="{ row: data }">{{ data.raw_payload.source_key }}</template>
              <template #cell-column4="{ row: data }">{{ data.raw_payload.source_name }}</template>
              <template #cell-column5="{ row: data }">
                <BsText v-if="rowIssues(data.source_row).length" as="span" tone="danger">{{ rowIssues(data.source_row).join(', ') }}</BsText>
                <BsText v-else-if="center.context.value?.project.current_staging_batch_id" as="span" tone="success">{{ t('migration.rowValid') }}</BsText>
                <BsText v-else as="span">—</BsText>
              </template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsCard v-if="mappingDecisions.length" aria-labelledby="migration-mapping" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-mapping" :level="2" size="h2">{{ t('migration.sections.accounts') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ t('migration.mappingHint') }}</BsText>
            </BsBox>
            <BsDataTable
              :value="mappingDecisions"
              row-key="source_key"
              :label="t('migration.mappingReview')"
              :columns="[{ key: 'column1', header: t('migration.sourceKind') }, { key: 'source_key', field: 'source_key', header: t('migration.sourceKey') }, { key: 'source_name', field: 'source_name', header: t('migration.sourceName') }, { key: 'column4', header: t('migration.ledgerTarget') }]"
            >
              <template #cell-column1="{ row: data }">{{ t(`migration.kinds.${data.source_kind}`) }}</template>
              <template #cell-column4="{ row: data }">
                <BsSelect :value="mappingTarget(data)" native @change="onMappingTarget(data, $event)">
                  <BsSelectOption value="">{{ t('migration.chooseTarget') }}</BsSelectOption>
                  <BsSelectOption v-for="option in mappingOptions(data)" :key="option.id" :value="option.id">{{ option.label }}</BsSelectOption>
                  <BsSelectOption v-if="data.source_kind !== 'account'" value="__create__">{{ t('migration.reviewedCreation') }}</BsSelectOption>
                </BsSelect>
              </template>
            </BsDataTable>
            <BsFloatingField :label="t('migration.reviewNote')">
              <BsTextarea v-model="reviewNote" minlength="8" maxlength="1000" />
            </BsFloatingField>
            <BsButton
              type="button"
              :disabled="!mappingReady || Boolean(center.pending.value)"
              variant="primary"
              @click="act(() => center.reviewMappings(mappingDecisions, reviewNote), 'migration.mappingSaved')"
            >{{ center.pending.value === 'mapping' ? t('common.saving') : t('migration.validateMapping') }}</BsButton>
          </BsStack>
        </BsCard>
        <BsCard v-else-if="center.context.value.mapping_entries.length" aria-labelledby="migration-mapping-reviewed" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-mapping-reviewed" :level="2" size="h2">{{ t('migration.mappingReview') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ center.context.value.mapping_revisions[0]?.review_note }}</BsText>
            </BsBox>
            <BsDataTable
              :value="center.context.value.mapping_entries"
              row-key="id"
              :label="t('migration.mappingReview')"
              :columns="[{ key: 'source_kind', field: 'source_kind', header: t('migration.sourceKind') }, { key: 'source_key', field: 'source_key', header: t('migration.sourceKey') }, { key: 'resolution', field: 'resolution', header: t('migration.resolution') }, { key: 'column4', header: t('migration.ledgerTarget') }]"
            >
              <template #cell-column4="{ row: data }">{{ data.target_account_id || data.target_counterparty_id || data.proposed_record?.name }}</template>
            </BsDataTable>
          </BsStack>
        </BsCard>
        <BsCard aria-labelledby="migration-opening" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-opening" :level="2" size="h2">{{ t('migration.sections.opening') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ t('migration.openingHint') }}</BsText>
            </BsBox>
            <BsInline v-if="!center.context.value.project.opening_balance_batch_id" gap="md" :wrap="true" align="end">
              <BsFloatingField :label="t('migration.openingBatch')">
                <BsSelect v-model="selectedOpeningId" native>
                  <BsSelectOption value="">{{ t('migration.chooseOpening') }}</BsSelectOption>
                  <BsSelectOption v-for="batch in center.context.value.opening_candidates" :key="batch.id" :value="batch.id">{{ batch.source_filename }} · {{ t(`opening.status.${batch.status}`) }}</BsSelectOption>
                </BsSelect>
              </BsFloatingField>
              <BsButton
                type="button"
                :disabled="!selectedOpeningId || Boolean(center.pending.value)"
                variant="primary"
                @click="act(() => center.linkOpeningBalance(selectedOpeningId), 'migration.openingLinked')"
              >{{ t('migration.linkOpening') }}</BsButton>
              <BsLink to="/opening-balances">{{ t('migration.prepareOpening') }}</BsLink>
            </BsInline>
            <BsText v-else size="sm">{{ t('migration.openingLinkedStatus', { status: t(`opening.status.${center.context.value.opening_batch?.status}`) }) }}</BsText>
          </BsStack>
        </BsCard>
        <BsCard aria-labelledby="migration-modules" as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-modules" :level="2" size="h2">{{ t('migration.modulesTitle') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ t('migration.modulesHint') }}</BsText>
            </BsBox>
            <BsGrid v-if="center.context.value.operational_batches[0]" :columns="5" gap="sm">
              <BsText v-for="key in ['open_items','assets','bank','inventory','tax']" :key="key" size="sm"><BsText as="span" emphasis="semibold">{{ t(`migration.moduleNames.${key}`) }}</BsText><BsLineBreak />{{ isApplicable(key) ? t('migration.applicable') : t('migration.notApplicable') }}</BsText>
            </BsGrid>
            <BsButton
              v-else-if="center.context.value.project.status === 'validated' && can('migrations.manage')"
              type="button"
              :disabled="Boolean(center.pending.value)"
              @click="act(() => center.markModulesNotApplicable(), 'migration.modulesSaved')"
            >{{ t('migration.allModulesNotApplicable') }}</BsButton>
            <BsText size="sm">{{ t('migration.historyPolicy') }}</BsText>
          </BsStack>
        </BsCard>
        <BsCard v-if="center.review.value" aria-labelledby="migration-final-review" data-final-review as="section" padding="md">
          <BsStack gap="md">
            <BsBox>
              <BsHeading id="migration-final-review" :level="2" size="h2">{{ t('migration.sections.final_review') }}</BsHeading>
              <BsText size="sm" tone="muted">{{ t('migration.finalReviewHint', { revision: center.review.value.source_revision }) }}</BsText>
            </BsBox>
            <BsGrid :columns="3" gap="md">
              <BsText>
                <BsText as="span" tone="muted">{{ t('opening.debitTotal') }}</BsText>
                <BsLineBreak />
                <BsText as="strong">{{ amount(openingReview?.debit_total_minor) }}</BsText>
              </BsText>
              <BsText>
                <BsText as="span" tone="muted">{{ t('opening.creditTotal') }}</BsText>
                <BsLineBreak />
                <BsText as="strong">{{ amount(openingReview?.credit_total_minor) }}</BsText>
              </BsText>
              <BsText>
                <BsText as="span" tone="muted">{{ t('opening.difference') }}</BsText>
                <BsLineBreak />
                <BsText as="strong">{{ amount(openingReview?.difference_minor) }}</BsText>
              </BsText>
            </BsGrid>
            <BsDataTable
              v-if="center.review.value.variances.length"
              :value="center.review.value.variances"
              :label="t('migration.reconciliations')"
              :columns="[{ key: 'module', field: 'module', header: t('migration.module') }, { key: 'column2', header: t('migration.moduleDetail') }, { key: 'column3', header: t('migration.glBalance') }, { key: 'column4', header: t('opening.difference') }]"
            >
              <template #cell-column2="{ row: data }">{{ amount(data.detail_minor) }}</template>
              <template #cell-column3="{ row: data }">{{ amount(data.gl_minor) }}</template>
              <template #cell-column4="{ row: data }">
                <BsText as="span" :tone="data.variance_minor === '0' ? 'success' : 'danger'">{{ amount(data.variance_minor) }}</BsText>
              </template>
            </BsDataTable>
            <BsBox v-if="center.review.value.errors.length" role="alert">
              <BsText emphasis="semibold">{{ t('migration.approvalBlocked') }}</BsText>
              <BsList :ordered="false" marker="disc">
                <BsListItem v-for="code in center.review.value.errors" :key="code">{{ t(`migration.errors.${code}`) }}</BsListItem>
              </BsList>
            </BsBox>
            <BsBox v-else role="status" padding="md" radius="control">{{ t('migration.reconciled') }}</BsBox>
            <BsBox v-if="center.review.value.approved" data-cutover-approved padding="lg" border radius="control">
              <BsText tone="success" emphasis="bold">{{ t('migration.approved') }}</BsText>
              <BsText size="sm">{{ t('migration.approvedEvidence', { time: dateTime(center.review.value.approved_at!), revision: center.review.value.source_revision }) }}</BsText>
              <BsInline gap="sm" :wrap="true">
                <BsLink to="/reports">{{ t('nav.reports') }}</BsLink>
                <BsLink v-if="isApplicable('open_items')" to="/receivables">{{ t('ar.title') }}</BsLink>
                <BsLink v-if="isApplicable('open_items')" to="/payables">{{ t('ap.title') }}</BsLink>
                <BsLink v-if="isApplicable('bank')" to="/bank-reconciliation">{{ t('nav.bankReconciliation') }}</BsLink>
                <BsLink v-if="isApplicable('assets')" to="/fixed-assets">{{ t('nav.fixedAssets') }}</BsLink>
                <BsLink v-if="isApplicable('inventory')" to="/inventory-accounting">{{ t('nav.inventoryAccounting') }}</BsLink>
                <BsLink v-if="isApplicable('tax')" to="/tax-vat">{{ t('nav.taxVat') }}</BsLink>
              </BsInline>
            </BsBox>
            <template v-else>
              <BsFieldLabel>
                <BsCheckbox v-model="approvalAcknowledged" bare />
                <BsText as="span">{{ t('migration.approvalAcknowledgement', { revision: center.review.value.source_revision, date: center.review.value.cutover_date }) }}</BsText>
              </BsFieldLabel>
              <BsText size="sm" tone="muted">{{ t('migration.correctionPolicy') }}</BsText>
              <BsButton
                type="button"
                :disabled="!canApprove || Boolean(center.pending.value)"
                variant="primary"
                @click="act(() => center.approve(), 'migration.approvalSuccess')"
              >{{ center.pending.value === 'approve' ? t('common.saving') : t('migration.finalApprove') }}</BsButton>
            </template>
          </BsStack>
        </BsCard>
      </template>
    </template>
  </BsStack>
</template>
