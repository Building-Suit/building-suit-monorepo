// Product RPC contract for the dedicated Shop project public schema.
export type ShopRpcDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      create_owner_shop: {
        Args: { p_shop_name: string; p_plan_slug: string }
        Returns: string
      }
      save_product: {
        Args: {
          p_shop_id: string
          p_product_id: string | null
          p_name: string
          p_sku: string | null
          p_barcode: string | null
          p_sale_price: number
        }
        Returns: string
      }
      archive_product: {
        Args: { p_shop_id: string; p_product_id: string }
        Returns: undefined
      }
      save_service: {
        Args: {
          p_shop_id: string
          p_service_id: string | null
          p_name: string
          p_description: string | null
          p_base_sale_price: number
          p_discount_type: 'amount' | 'percent'
          p_discount_value: number
        }
        Returns: string
      }
      archive_service: {
        Args: { p_shop_id: string; p_service_id: string }
        Returns: undefined
      }
      save_expense: {
        Args: {
          p_shop_id: string
          p_expense_id: string | null
          p_request_id: string | null
          p_title: string
          p_amount: number
          p_category_name: string
          p_expense_date: string
          p_notes: string | null
        }
        Returns: string
      }
      void_expense: {
        Args: { p_shop_id: string; p_expense_id: string }
        Returns: undefined
      }
      adjust_stock: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_product_id: string
          p_quantity_change: number
          p_unit_cost: number | null
          p_note: string | null
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
