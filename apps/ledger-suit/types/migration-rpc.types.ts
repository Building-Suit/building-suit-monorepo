import type { Json } from './database.types'

// Product-owned contract for the append-only migration staging RPCs. The
// generated common database snapshot can be refreshed after the migration is
// applied to a disposable local database.
type Rpc<Args, Returns = string> = { Args: Args, Returns: Returns }

export type MigrationSourceType = 'excel_csv' | 'other_system_export' | 'accountant_paper_workbook'
export type MigrationDepth = 'fast_cutover' | 'current_fiscal_year' | 'full_history'

export type MigrationRpcDatabase = { public: {
  Tables: Record<string, never>
  Views: Record<string, never>
  Enums: Record<string, never>
  CompositeTypes: Record<string, never>
  Functions: {
    create_migration_project: Rpc<{
      p_organization_id: string
      p_name: string
      p_source_type: MigrationSourceType
      p_cutover_date: string
      p_idempotency_key: string
      p_migration_depth?: MigrationDepth
    }>
    upload_migration_source: Rpc<{
      p_project_id: string
      p_filename: string
      p_media_type: string
      p_content: string
      p_declared_sha256: string
      p_source_identity: Json
      p_rows: Json
      p_idempotency_key: string
    }>
    create_migration_mapping_revision: Rpc<{
      p_project_id: string
      p_source_revision_id: string
      p_mappings: Json
      p_review_note: string
      p_idempotency_key: string
    }>
    stage_migration_rows: Rpc<{
      p_project_id: string
      p_source_revision_id: string
      p_mapping_revision_id: string
      p_rows: Json
      p_idempotency_key: string
    }>
    validate_migration_project: Rpc<{
      p_project_id: string
      p_staging_batch_id: string
    }, Json>
    link_migration_opening_balance_batch: Rpc<{
      p_project_id: string
      p_opening_balance_batch_id: string
    }>
    read_migration_project: Rpc<{ p_project_id: string }, Json>
    download_migration_source: Rpc<{ p_source_revision_id: string }, string>
  }
} }
