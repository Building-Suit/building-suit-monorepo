// Supabase RPC errors are plain objects, not necessarily Error instances.
export function shopCommandErrorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message)
    : String(error ?? '')
}
