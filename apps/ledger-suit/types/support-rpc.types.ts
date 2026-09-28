import type { Json } from './database.types'

export type SupportRpcDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: {
      submit_support_request: {
        Args: {
          p_category: string
          p_subject: string
          p_message: string
          p_reply_email: string
          p_consent: boolean
          p_honeypot?: string
        }
        Returns: Json
      }
    }
  }
}
