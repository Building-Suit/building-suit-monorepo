import type { Json } from '~~/types/database.types'
import type { MigrationDepth, MigrationRpcDatabase, MigrationSourceType } from '~~/types/migration-rpc.types'
import type { MigrationCenterContext, MigrationCutoverReview, MigrationProjectSummary } from '~/utils/migrationCenter'
import { bytesToPostgresHex, parseMigrationSource, sha256Hex } from '~/utils/migrationCenter'

export interface MigrationMappingDecision {
  source_kind: 'account' | 'customer' | 'supplier' | 'other_counterparty'
  source_key: string
  source_name: string
  target_id: string
  create_reviewed: boolean
}

export function useMigrationCenter() {
  const client = useSupabaseClient<MigrationRpcDatabase>()
  const user = useSupabaseUser()
  const { currentId, can } = useTenant()
  const projects = ref<MigrationProjectSummary[]>([])
  const context = ref<MigrationCenterContext | null>(null)
  const review = ref<MigrationCutoverReview | null>(null)
  const pending = ref('')
  const error = ref<unknown>(null)
  const approvalKey = ref('')
  let generation = 0

  function commandKey(scope: string) {
    return `${scope}:${crypto.randomUUID()}`
  }

  async function loadProjects() {
    const request = ++generation
    projects.value = []
    context.value = null
    review.value = null
    error.value = null
    if (!currentId.value || !user.value || !can('migrations.read')) return
    pending.value = 'projects'
    try {
      const result = await client.rpc('list_migration_projects', { p_organization_id: currentId.value })
      if (result.error) throw result.error
      if (request === generation) projects.value = result.data as unknown as MigrationProjectSummary[]
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = '' }
  }

  async function load(projectId: string) {
    const request = ++generation
    context.value = null
    review.value = null
    error.value = null
    approvalKey.value = ''
    pending.value = 'context'
    try {
      const result = await client.rpc('read_migration_center', { p_project_id: projectId })
      if (result.error) throw result.error
      if (request === generation) context.value = result.data as unknown as MigrationCenterContext
      const operationalId = (result.data as unknown as MigrationCenterContext).operational_batches[0]?.id
      if (operationalId && request === generation) await refreshReview(projectId, operationalId, request)
    }
    catch (failure) { if (request === generation) error.value = failure }
    finally { if (request === generation) pending.value = '' }
  }

  async function createProject(input: { name: string, sourceType: MigrationSourceType, cutoverDate: string, depth: MigrationDepth }) {
    if (!currentId.value) throw new Error('MIGRATION_ORGANIZATION_REQUIRED')
    pending.value = 'create'
    error.value = null
    try {
      const result = await client.rpc('create_migration_project', {
        p_organization_id: currentId.value,
        p_name: input.name,
        p_source_type: input.sourceType,
        p_cutover_date: input.cutoverDate,
        p_migration_depth: input.depth,
        p_idempotency_key: commandKey('migration-project'),
      })
      if (result.error) throw result.error
      await loadProjects()
      await load(result.data)
      return result.data
    }
    catch (failure) { error.value = failure; throw failure }
    finally { pending.value = '' }
  }

  async function uploadSource(file: File) {
    const project = context.value?.project
    if (!project) throw new Error('MIGRATION_PROJECT_REQUIRED')
    pending.value = 'source'
    error.value = null
    try {
      if (!file.name.toLowerCase().endsWith('.csv') || file.size > 10 * 1024 * 1024) throw new Error('MIGRATION_SOURCE_FILE_INVALID')
      const text = await file.text()
      const rows = parseMigrationSource(text)
      const bytes = new Uint8Array(await file.arrayBuffer())
      const hash = await sha256Hex(bytes)
      const result = await client.rpc('upload_migration_source', {
        p_project_id: project.id,
        p_filename: file.name,
        p_media_type: file.type || 'text/csv',
        p_content: bytesToPostgresHex(bytes),
        p_declared_sha256: hash,
        p_source_identity: { source_type: project.source_type, imported_by: 'migration_center' },
        p_rows: rows.map(row => ({ ...row.raw_payload, source_row: row.source_row, source_sheet: row.source_sheet })) as Json,
        p_idempotency_key: commandKey(`migration-source:${hash}`),
      })
      if (result.error) throw result.error
      await load(project.id)
      return rows
    }
    catch (failure) { error.value = failure; throw failure }
    finally { pending.value = '' }
  }

  async function reviewMappings(decisions: MigrationMappingDecision[], reviewNote: string) {
    const project = context.value?.project
    if (!project?.current_source_revision_id) throw new Error('MIGRATION_SOURCE_REQUIRED')
    pending.value = 'mapping'
    error.value = null
    try {
      const mappings = decisions.map(decision => ({
        source_kind: decision.source_kind,
        source_key: decision.source_key,
        source_identity: { source_key: decision.source_key, source_name: decision.source_name },
        resolution: decision.create_reviewed ? 'reviewed_creation' : 'existing_record',
        target_account_id: !decision.create_reviewed && decision.source_kind === 'account' ? decision.target_id : null,
        target_counterparty_id: !decision.create_reviewed && decision.source_kind !== 'account' ? decision.target_id : null,
        proposed_record: decision.create_reviewed ? {
          name: decision.source_name,
          type: decision.source_kind === 'supplier' ? 'vendor' : 'customer',
        } : null,
        approval_evidence: { reviewed_in: 'migration_center', review_note: reviewNote },
      }))
      const mappingResult = await client.rpc('create_migration_mapping_revision', {
        p_project_id: project.id,
        p_source_revision_id: project.current_source_revision_id,
        p_mappings: mappings as Json,
        p_review_note: reviewNote,
        p_idempotency_key: commandKey('migration-mapping'),
      })
      if (mappingResult.error) throw mappingResult.error
      const sourceRows = context.value?.original_rows ?? []
      const normalized = sourceRows.map((row) => {
        const raw = row.raw_payload
        return {
          source_row: row.source_row,
          source_kind: raw.source_kind,
          source_key: raw.source_key,
          normalized_payload: raw,
        }
      })
      const stageResult = await client.rpc('stage_migration_rows', {
        p_project_id: project.id,
        p_source_revision_id: project.current_source_revision_id,
        p_mapping_revision_id: mappingResult.data,
        p_rows: normalized as Json,
        p_idempotency_key: commandKey('migration-staging'),
      })
      if (stageResult.error) throw stageResult.error
      const validation = await client.rpc('validate_migration_project', { p_project_id: project.id, p_staging_batch_id: stageResult.data })
      if (validation.error) throw validation.error
      await load(project.id)
      return validation.data
    }
    catch (failure) { error.value = failure; throw failure }
    finally { pending.value = '' }
  }

  async function linkOpeningBalance(openingBatchId: string) {
    const project = context.value?.project
    if (!project) throw new Error('MIGRATION_PROJECT_REQUIRED')
    pending.value = 'opening'
    try {
      const result = await client.rpc('link_migration_opening_balance_batch', {
        p_project_id: project.id,
        p_opening_balance_batch_id: openingBatchId,
      })
      if (result.error) throw result.error
      await load(project.id)
    }
    catch (failure) { error.value = failure; throw failure }
    finally { pending.value = '' }
  }

  async function markModulesNotApplicable() {
    const project = context.value?.project
    if (!project?.current_staging_batch_id) throw new Error('MIGRATION_STAGING_REQUIRED')
    pending.value = 'modules'
    try {
      const result = await client.rpc('stage_migration_operational_cutover', {
        p_project_id: project.id,
        p_staging_batch_id: project.current_staging_batch_id,
        p_applicability: { open_items: false, assets: false, bank: false, inventory: false, tax: false },
        p_assets: [], p_bank_positions: [], p_bank_items: [], p_inventory: [], p_tax: [],
        p_idempotency_key: commandKey('migration-not-applicable'),
      })
      if (result.error) throw result.error
      await load(project.id)
    }
    catch (failure) { error.value = failure; throw failure }
    finally { pending.value = '' }
  }

  async function refreshReview(projectId = context.value?.project.id, operationalId = context.value?.operational_batches[0]?.id, request = generation) {
    if (!projectId || !operationalId) return
    const result = await client.rpc('review_migration_cutover', { p_project_id: projectId, p_operational_batch_id: operationalId })
    if (result.error) throw result.error
    if (request === generation) review.value = result.data as unknown as MigrationCutoverReview
  }

  async function approve() {
    const project = context.value?.project
    const operational = context.value?.operational_batches[0]
    if (!project || !operational || !review.value?.valid) throw new Error('MIGRATION_CUTOVER_BLOCKED')
    pending.value = 'approve'
    if (!approvalKey.value) approvalKey.value = commandKey(`migration-final:${project.id}`)
    try {
      const result = await client.rpc('approve_migration_cutover', {
        p_project_id: project.id,
        p_operational_batch_id: operational.id,
        p_idempotency_key: approvalKey.value,
      })
      if (result.error) throw result.error
      review.value = result.data as unknown as MigrationCutoverReview
      await load(project.id)
      return result.data
    }
    catch (failure) { error.value = failure; throw failure }
    finally { pending.value = '' }
  }

  watch([currentId, () => user.value?.id], () => { void loadProjects() }, { flush: 'sync', immediate: true })
  onScopeDispose(() => { generation++; projects.value = []; context.value = null; review.value = null })
  return { projects, context, review, pending, error, loadProjects, load, createProject, uploadSource, reviewMappings, linkOpeningBalance, markModulesNotApplicable, refreshReview, approve }
}
