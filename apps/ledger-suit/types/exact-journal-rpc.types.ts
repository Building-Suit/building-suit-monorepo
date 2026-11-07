import type { Database } from './database.types'

/** PostgreSQL bigint filter parameters accept exact integer JSON strings. */
type Search = Database['public']['Functions']['search_transactions']
export type ExactJournalRpcDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: {
      search_transactions: {
        Args: Omit<Search['Args'], 'p_min_amount_minor' | 'p_max_amount_minor'> & { p_min_amount_minor?: string; p_max_amount_minor?: string }
        Returns: Search['Returns']
      }
    }
  }
}
