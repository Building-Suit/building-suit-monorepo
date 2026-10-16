import { standardCatalogReasons } from './catalog-standard-reasons.mjs'
// Only exact server-authored guard tokens and fixed SQLSTATE categories may reach logs.
// Never return PostgREST message/detail/hint/body, even when it resembles a token.
const guardReasons = new Set([
  'IMMUTABLE_CANDIDATE_HISTORY', 'PER_MERGE_RELEASES_RETIRED', 'IMMUTABLE_RELEASE',
  'UNREADY_OR_WRONG_PROMOTION_PROVENANCE', 'VERSION_CONFLICT', 'INVALID_GENERATED_ENTRIES',
  'MISSING_EXACT_CANDIDATE_RECEIPT', 'LEGACY_RELEASE_HISTORY_REVIEW_REQUIRED',
  'CANDIDATE_RECONCILIATION_REQUIRED', 'STAGING_CANDIDATE_NOT_READY',
  'SERVER_REQUIRED', 'RELEASE_CONFIGURATION_REQUIRED', 'WRONG_ENVIRONMENT', 'WRONG_REFERENCE',
  'INVALID_CANDIDATE', 'INVALID_CANDIDATE_REF', 'DUPLICATE_CHANGE_ITEM', 'INVALID_CHANGE_ITEM',
  'INVALID_COPY', 'UNREGISTERED_SUIT', 'UNREGISTERED_INTERNAL_CONSUMER',
  'VERIFIED_PRODUCTION_BASELINE_REQUIRED', 'PRODUCTION_BASELINE_CHANGED',
  'PRODUCTION_BASELINE_ACK_REQUIRED', 'DIGEST_CONFLICT', 'STALE_CANDIDATE',
])
const sqlReasons = new Map([
  ['22021', 'CATALOG_CHARACTER_ENCODING_INVALID'],
  ['23502', 'CATALOG_NOT_NULL_CONSTRAINT'],
  ['42703', 'CATALOG_UNDEFINED_COLUMN'],
  ['42804', 'CATALOG_DATATYPE_MISMATCH'],
  ['22023', 'CATALOG_INVALID_PARAMETER'],
  ['54001', 'CATALOG_STACK_DEPTH_LIMIT'],
  ['54000', 'CATALOG_PROGRAM_LIMIT'],
  ['57014', 'CATALOG_QUERY_CANCELLED'],
  ['42P01', 'CATALOG_UNDEFINED_TABLE'],
  ['42883', 'CATALOG_UNDEFINED_FUNCTION'],
  ['PGRST102', 'CATALOG_REQUEST_JSON_INVALID'],
  ['PGRST202', 'CATALOG_RPC_NOT_IN_SCHEMA_CACHE'],
  ['PGRST203', 'CATALOG_RPC_AMBIGUOUS'],
  ['PGRST301', 'CATALOG_JWT_INVALID'],
  ['2201B', 'CATALOG_INVALID_REGULAR_EXPRESSION'],
  ['22P02', 'CATALOG_INVALID_TEXT_REPRESENTATION'],
  ['23505', 'CATALOG_UNIQUE_CONSTRAINT'],
  ['23503', 'CATALOG_FOREIGN_KEY_CONSTRAINT'],
  ['23514', 'CATALOG_CHECK_CONSTRAINT'],
  ['42501', 'CATALOG_PERMISSION_DENIED'],
  ['42702', 'CATALOG_AMBIGUOUS_COLUMN'],
  ['P0003', 'CATALOG_MULTIPLE_ROWS'],
  ['P0002', 'CATALOG_NO_DATA'],
])
export async function catalogRejectionReason(response) {
  let reader
  try {
    reader = response.body?.getReader()
    if (!reader) return 'CATALOG_ERROR_BODY_MISSING'
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) return 'CATALOG_ERROR_BODY_OVERSIZED'
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    let body
    try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { return 'CATALOG_ERROR_JSON_INVALID' }
    if (typeof body?.code !== 'string' || !body.code) return 'CATALOG_ERROR_CODE_MISSING'
    if (body.code === 'P0001') return guardReasons.has(body.message) ? body.message : 'CATALOG_GUARD_UNRECOGNIZED'
    return sqlReasons.get(body.code) ?? standardCatalogReasons.get(body.code) ?? 'CATALOG_ERROR_CODE_UNRECOGNIZED'
  } catch { return 'CATALOG_ERROR_READ_FAILED' }
  finally { try { await reader?.cancel() } catch { /* No upstream exception is logged. */ } }
}
