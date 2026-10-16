// Only exact server-authored guard tokens and fixed SQLSTATE categories may reach logs.
// Never return PostgREST message/detail/hint/body, even when it resembles a token.
const guardReasons = new Set([
  'SERVER_REQUIRED', 'RELEASE_CONFIGURATION_REQUIRED', 'WRONG_ENVIRONMENT', 'WRONG_REFERENCE',
  'INVALID_CANDIDATE', 'INVALID_CANDIDATE_REF', 'DUPLICATE_CHANGE_ITEM', 'INVALID_CHANGE_ITEM',
  'INVALID_COPY', 'UNREGISTERED_SUIT', 'UNREGISTERED_INTERNAL_CONSUMER',
  'VERIFIED_PRODUCTION_BASELINE_REQUIRED', 'PRODUCTION_BASELINE_CHANGED',
  'PRODUCTION_BASELINE_ACK_REQUIRED', 'DIGEST_CONFLICT', 'STALE_CANDIDATE',
])
const sqlReasons = new Map([
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
    if (!reader) return 'CATALOG_REJECTED'
    const chunks = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) return 'CATALOG_REJECTED'
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const body = JSON.parse(new TextDecoder().decode(bytes))
    if (body?.code === 'P0001' && guardReasons.has(body.message)) return body.message
    return sqlReasons.get(body?.code) ?? 'CATALOG_REJECTED'
  } catch { return 'CATALOG_REJECTED' }
  finally { try { await reader?.cancel() } catch { /* No upstream exception is logged. */ } }
}
