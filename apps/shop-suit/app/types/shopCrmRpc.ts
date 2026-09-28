// Product RPC contract for the dedicated Shop project public schema.
export type ShopRpcDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      create_owner_shop: {
        Args: { p_shop_name: string; p_plan_slug: string; p_business_mode: 'product' | 'service' | 'mixed' }
        Returns: string
      }
      platform_admin_session: {
        Args: Record<string, never>
        Returns: {
          userId: string
          role: 'observer' | 'operator'
          canMutate: boolean
          displayName: string | null
        }
      }
      platform_admin_read: {
        Args: {
          p_resource: 'dashboard' | 'shops' | 'shop' | 'audit'
          p_shop_id?: string | null
          p_search?: string | null
          p_status?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      platform_admin_command: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_action: string
          p_reason: string
          p_payload?: Record<string, unknown>
        }
        Returns: unknown
      }
      shop_billing_read: {
        Args: { p_shop_id: string }
        Returns: unknown
      }
      submit_shop_billing_notice: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_paid_amount: number
          p_transfer_date: string
          p_transfer_reference: string
        }
        Returns: string
      }
      platform_admin_billing_read: {
        Args: {
          p_resource?: 'queue' | 'configuration' | 'summary' | 'audit'
          p_status?: 'submitted' | 'under_review' | 'approved' | 'rejected' | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      platform_admin_billing_command: {
        Args: {
          p_request_id: string
          p_action: 'configure_instructions' | 'mark_under_review' | 'approve' | 'reject'
          p_submission_id: string | null
          p_reason: string
          p_payload?: Record<string, unknown>
        }
        Returns: unknown
      }
      set_shop_business_mode: {
        Args: { p_shop_id: string; p_business_mode: 'product' | 'service' | 'mixed' }
        Returns: 'product' | 'service' | 'mixed'
      }
      list_shop_locations: {
        Args: { p_shop_id: string }
        Returns: Array<{
          id: string
          shop_id: string
          name: string
          code: string | null
          address: string | null
          phone: string | null
          status: 'active' | 'archived'
          is_default: boolean
          archived_at: string | null
        }>
      }
      save_shop_location: {
        Args: {
          p_shop_id: string
          p_location_id: string | null
          p_name: string
          p_code?: string | null
          p_address?: string | null
          p_phone?: string | null
        }
        Returns: string
      }
      archive_shop_location: {
        Args: { p_shop_id: string; p_location_id: string }
        Returns: undefined
      }
      assign_membership_locations: {
        Args: { p_shop_id: string; p_membership_id: string; p_location_ids: string[] }
        Returns: undefined
      }
      shop_team_read: {
        Args: { p_shop_id: string }
        Returns: unknown
      }
      shop_permission_access: {
        Args: { p_shop_id: string; p_permission_keys: string[] }
        Returns: Record<string, boolean>
      }
      invite_shop_member: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_email: string
          p_display_name: string | null
          p_role_key: string
          p_location_ids: string[]
        }
        Returns: unknown
      }
      accept_shop_invitation: {
        Args: { p_request_id: string; p_invitation_code: string }
        Returns: string
      }
      revoke_shop_invitation: {
        Args: { p_request_id: string; p_shop_id: string; p_invitation_id: string; p_reason?: string | null }
        Returns: undefined
      }
      manage_shop_member: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_membership_id: string
          p_action: 'suspend' | 'reactivate' | 'remove' | 'change_role' | 'assign_locations'
          p_role_key?: string | null
          p_location_ids?: string[] | null
          p_reason?: string | null
        }
        Returns: undefined
      }
      transfer_shop_ownership: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_target_membership_id: string
          p_reason: string
        }
        Returns: undefined
      }
      location_operational_report: {
        Args: {
          p_shop_id: string
          p_location_id?: string | null
          p_from?: string | null
          p_to?: string | null
        }
        Returns: unknown
      }
      save_location_sale_draft: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_invoice_id: string | null
          p_customer_id: string | null
          p_due_date: string | null
          p_notes: string | null
          p_lines: Array<{ item_type: 'product' | 'service'; source_id: string; quantity: number }>
        }
        Returns: string
      }
      list_location_sales: {
        Args: {
          p_shop_id: string
          p_location_id: string
          p_search?: string | null
          p_status?: 'draft' | 'issued' | null
          p_from?: string | null
          p_to?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      get_location_sale: {
        Args: { p_shop_id: string; p_location_id: string; p_invoice_id: string }
        Returns: unknown
      }
      issue_location_sale: {
        Args: { p_request_id: string; p_shop_id: string; p_location_id: string; p_invoice_id: string }
        Returns: string
      }
      checkout_location_sale: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_invoice_id: string
          p_amount: number
          p_paid_at: string
          p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
          p_reference: string | null
        }
        Returns: string
      }
      record_location_customer_receipt: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_customer_id: string
          p_amount: number
          p_paid_at: string
          p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
          p_reference: string | null
          p_notes: string | null
          p_allocations: Array<{ invoice_id: string; amount: number }>
        }
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
      inventory_access: {
        Args: { p_shop_id: string }
        Returns: Array<{
          can_view: boolean
          can_manage: boolean
          inventory_enabled: boolean
        }>
      }
      set_reorder_threshold: {
        Args: {
          p_shop_id: string
          p_product_id: string
          p_threshold: number
        }
        Returns: undefined
      }
      record_stock_count: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_product_id: string
          p_counted_quantity: number
          p_counted_at: string
          p_reason: string
          p_reference: string
          p_positive_variance_unit_cost: number | null
        }
        Returns: string
      }
      list_inventory: {
        Args: { p_shop_id: string; p_low_stock_only?: boolean }
        Returns: unknown
      }
      list_inventory_history: {
        Args: {
          p_shop_id: string
          p_product_id?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      list_stock_counts: {
        Args: {
          p_shop_id: string
          p_product_id?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      create_vendor: {
        Args: {
          p_shop_id: string
          p_name: string
          p_contact_name: string | null
          p_phone: string | null
          p_email: string | null
          p_address: string | null
          p_tax_number: string | null
          p_notes: string | null
        }
        Returns: string
      }
      supplier_access: {
        Args: { p_shop_id: string }
        Returns: Array<{
          can_view: boolean
          can_manage_suppliers: boolean
          can_manage_purchases: boolean
          can_record_payment: boolean
          can_reverse_payment: boolean
          can_record_credit: boolean
          can_return_stock: boolean
        }>
      }
      save_vendor: {
        Args: {
          p_shop_id: string
          p_vendor_id: string | null
          p_name: string
          p_contact_name: string | null
          p_phone: string | null
          p_email: string | null
          p_address: string | null
          p_tax_number: string | null
          p_notes: string | null
        }
        Returns: string
      }
      archive_vendor: {
        Args: { p_shop_id: string; p_vendor_id: string }
        Returns: undefined
      }
      list_vendors: {
        Args: {
          p_shop_id: string
          p_search?: string | null
          p_is_active?: boolean | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      list_purchases: {
        Args: {
          p_shop_id: string
          p_search?: string | null
          p_vendor_id?: string | null
          p_status?: 'draft' | 'posted' | 'void' | null
          p_settlement?: 'unpaid' | 'partial' | 'paid' | null
          p_from?: string | null
          p_to?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      get_purchase: {
        Args: { p_shop_id: string; p_purchase_id: string }
        Returns: unknown
      }
      record_supplier_payment: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_vendor_id: string
          p_amount: number
          p_paid_at: string
          p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
          p_reference: string | null
          p_notes: string | null
          p_allocations: Array<{ vendor_invoice_id: string; amount: number }>
        }
        Returns: string
      }
      reverse_supplier_payment: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_original_payment_id: string
          p_effective_at: string
          p_reason: string
          p_reference: string | null
          p_allocations: Array<{ allocation_id: string; amount: number }>
        }
        Returns: string
      }
      record_supplier_credit: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_vendor_id: string
          p_purchase_id: string
          p_amount: number
          p_effective_at: string
          p_reason: string
          p_reference: string | null
        }
        Returns: string
      }
      record_purchase_return: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_purchase_id: string
          p_returned_at: string
          p_reason: string
          p_reference: string | null
          p_items: Array<{ vendor_invoice_item_id: string; quantity: number }>
        }
        Returns: string
      }
      create_supplier_purchase: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_vendor_id: string
          p_invoice_number: string | null
          p_issued_on: string
          p_notes: string | null
          p_items: Array<{ product_id: string; quantity: number; unit_cost: number }>
        }
        Returns: string
      }
      void_supplier_purchase: {
        Args: { p_shop_id: string; p_purchase_id: string }
        Returns: undefined
      }
      customer_access: {
        Args: { p_shop_id: string }
        Returns: Array<{ can_view: boolean; can_manage: boolean }>
      }
      list_customers: {
        Args: {
          p_shop_id: string
          p_search?: string | null
          p_is_active?: boolean | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      get_customer: {
        Args: { p_shop_id: string; p_customer_id: string }
        Returns: Array<{
          id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          archived_at: string | null
          can_manage: boolean
        }>
      }
      save_customer: {
        Args: {
          p_shop_id: string
          p_customer_id: string | null
          p_name: string
          p_phone: string | null
          p_email: string | null
          p_address: string | null
          p_notes: string | null
        }
        Returns: string
      }
      archive_customer: {
        Args: { p_shop_id: string; p_customer_id: string }
        Returns: undefined
      }
      sale_access: {
        Args: { p_shop_id: string }
        Returns: Array<{ can_view: boolean; can_manage: boolean; can_issue: boolean }>
      }
      sale_catalog: {
        Args: { p_shop_id: string }
        Returns: unknown
      }
      save_sale_draft: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_invoice_id: string | null
          p_customer_id: string | null
          p_notes: string | null
          p_lines: Array<{ item_type: 'product' | 'service'; source_id: string; quantity: number }>
        }
        Returns: string
      }
      save_sale_draft_with_due_date: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_invoice_id: string | null
          p_customer_id: string | null
          p_due_date: string | null
          p_notes: string | null
          p_lines: Array<{ item_type: 'product' | 'service'; source_id: string; quantity: number }>
        }
        Returns: string
      }
      issue_sale: {
        Args: { p_request_id: string; p_shop_id: string; p_invoice_id: string }
        Returns: string
      }
      list_sales: {
        Args: {
          p_shop_id: string
          p_search?: string | null
          p_status?: 'draft' | 'issued' | null
          p_from?: string | null
          p_to?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      get_sale: {
        Args: { p_shop_id: string; p_invoice_id: string }
        Returns: unknown
      }
      payment_access: {
        Args: { p_shop_id: string }
        Returns: Array<{ can_view: boolean; can_receive: boolean; can_reverse: boolean; can_refund: boolean }>
      }
      record_customer_receipt: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_customer_id: string
          p_amount: number
          p_paid_at: string
          p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
          p_reference: string | null
          p_notes: string | null
          p_allocations: Array<{ invoice_id: string; amount: number }>
        }
        Returns: string
      }
      reverse_customer_receipt: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_original_payment_id: string
          p_effective_at: string
          p_reason: string
          p_allocations: Array<{ allocation_id: string; amount: number }>
        }
        Returns: string
      }
      refund_customer_receipt: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_original_payment_id: string
          p_effective_at: string
          p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
          p_reference: string | null
          p_reason: string
          p_allocations: Array<{ allocation_id: string; amount: number }>
        }
        Returns: string
      }
      list_outstanding_invoices: {
        Args: { p_shop_id: string; p_customer_id?: string | null; p_overdue_only?: boolean; p_page?: number; p_page_size?: number }
        Returns: unknown
      }
      customer_statement: {
        Args: { p_shop_id: string; p_customer_id: string; p_page?: number; p_page_size?: number }
        Returns: unknown
      }
      checkout_customerless_sale: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_invoice_id: string
          p_amount: number
          p_paid_at: string
          p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
          p_reference: string | null
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
