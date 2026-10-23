import type { Json } from './database.types'

/** Monetary JSON transport adapters; underlying providers retain authorization. */
export type ExactReportRpcDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: {
      read_exact_financial_report: {
        Args: {
          p_report: 'overview' | 'cash_flow' | 'cash_allocation'
          p_organization_id: string
          p_from_date?: string
          p_to_date?: string
          p_as_of_date?: string
          p_entry_id?: string
        }
        Returns: Json
      }
      classify_cash_flow_entry_exact: {
        Args: {
          p_organization_id: string
          p_entry_id: string
          p_allocations: Json
          p_reason: string
          p_request_id: string
          p_expected_decision_id?: string
        }
        Returns: string
      }
    }
  }
}
