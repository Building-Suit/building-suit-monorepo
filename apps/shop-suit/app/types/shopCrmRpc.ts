// Product RPC contract for the dedicated Shop project public schema.
export type ShopRpcDatabase = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: {
      appointment_access_status: {Args:{p_shop_id:string;p_appointment_id:string};Returns:import('../../shared/appointmentAccess').AppointmentAccessStatus}
      appointment_access_issue: {Args:{p_shop_id:string;p_appointment_id:string};Returns:{code:string}}
      appointment_access_revoke: {Args:{p_shop_id:string;p_appointment_id:string};Returns:undefined}
      shop_website_showcase: {Args:{p_slug:string;p_page?:number};Returns:import('../../shared/publicWebsite').PublicWebsitePayload|null}
      shop_website_inquiry_submit: {Args:{p_slug:string;p_name:string;p_contact:string;p_message:string;p_locale:string;p_honeypot?:string};Returns:{ok:boolean}}
      shop_website_inquiries: {Args:{p_shop_id:string;p_status?:string;p_page?:number};Returns:import('../../shared/websiteInquiries').WebsiteInquiryInbox}
      shop_website_inquiry_status: {Args:{p_shop_id:string;p_inquiry_id:string;p_status:string};Returns:undefined}
      shop_website_catalog: { Args: {p_shop_id:string;p_search?:string;p_page?:number}; Returns: import('../../shared/websiteCatalog').WebsiteCatalogSettings }
      shop_website_catalog_save: { Args: {p_shop_id:string;p_kind:import('../../shared/websiteCatalog').WebsiteCatalogKind;p_item_id:string;p_entry:import('../../shared/websiteCatalog').WebsiteCatalogEntry};Returns:undefined }
      shop_website_catalog_publish: { Args: {p_shop_id:string;p_kind:import('../../shared/websiteCatalog').WebsiteCatalogKind;p_item_id:string;p_published:boolean};Returns:undefined }
      shop_website_public_catalog: { Args: {p_slug:string;p_page?:number};Returns: import('../../shared/websiteCatalog').PublicWebsiteCatalog|null }
      shop_website_profile: { Args: { p_shop_id: string }; Returns: import('../../shared/websiteProfile').WebsiteProfileSettings }
      shop_website_profile_save: { Args: { p_shop_id: string; p_profile: import('../../shared/websiteProfile').WebsiteProfileDraft }; Returns: import('../../shared/websiteProfile').WebsiteProfileSettings }
      shop_website_logo_replace: { Args: { p_shop_id: string; p_data_url: string | null }; Returns: import('../../shared/websiteProfile').WebsiteProfileSettings }
      shop_website_profile_publish: { Args: { p_shop_id: string; p_owner_opt_in: boolean }; Returns: import('../../shared/websiteProfile').WebsiteProfileSettings }
      shop_website_profile_unpublish: { Args: { p_shop_id: string }; Returns: import('../../shared/websiteProfile').WebsiteProfileSettings }
      shop_website_public_profile: { Args: { p_slug: string }; Returns: unknown }
      shop_website_address: { Args: { p_shop_id: string }; Returns: import('../../shared/websiteAddress').WebsiteAddress | null }
      shop_website_address_save: { Args: { p_shop_id: string; p_slug: string }; Returns: import('../../shared/websiteAddress').WebsiteAddress }
      shop_website_host_resolve: { Args: { p_slug: string }; Returns: { canonicalSlug: string; isAlias: boolean } | null }
      queue_eta_invoice: {Args:{p_request_id:string;p_shop_id:string;p_invoice_id:string;p_receiver:{type:'B';id:string;name:string;address:{country:string;governate:string;regionCity:string;street:string;buildingNumber:string}};p_reason:string};Returns:string}
      eta_original_document_reference: {Args:{p_shop_id:string;p_invoice_id:string};Returns:unknown}
      eta_settings: {Args:{p_shop_id:string;p_offset?:number};Returns:unknown}
      save_eta_configuration: {Args:{p_request_id:string;p_shop_id:string;p_configuration:unknown;p_reason:string};Returns:string}
      queue_eta_receipt: {Args:{p_request_id:string;p_shop_id:string;p_invoice_id:string;p_buyer:{type:string;id?:string;name?:string};p_payment_method:string};Returns:string}
      preview_sale_return: { Args: {p_shop_id: string; p_location_id: string; p_invoice_id: string; p_lines: import('./saleReturns').SaleReturnLineInput[]}; Returns: unknown }
      create_sale_return: { Args: {p_request_id: string; p_shop_id: string; p_location_id: string; p_invoice_id: string; p_lines: import('./saleReturns').SaleReturnLineInput[]; p_reason: string; p_expected_plan: import('./saleReturns').SaleReturnPlan}; Returns: string }
      sale_return_context: { Args: {p_shop_id: string; p_location_id: string; p_invoice_id: string; p_offset?: number}; Returns: unknown }
      get_sale_return: { Args: {p_shop_id: string; p_location_id: string; p_return_id: string}; Returns: unknown }
      record_sale_return_refund: { Args: {p_request_id: string; p_shop_id: string; p_location_id: string; p_refund_id: string; p_operation: 'external_record' | 'cash_handover' | 'failed'; p_reference: string; p_reason: string}; Returns: string }
      complete_service: { Args: { p_request_id: string; p_shop_id: string; p_location_id: string; p_line_id: string | null; p_quantity: number; p_appointment_id?: string | null; p_materials?: Array<{productId: string; unit: string; quantity: number}> | null; p_reason?: string }; Returns: string }
      service_fulfillment_context: { Args: {p_shop_id: string; p_location_id: string; p_invoice_id?: string | null; p_offset?: number}; Returns: unknown }
      service_recipe_context: { Args: {p_shop_id: string; p_offset?: number}; Returns: unknown }
      define_service_material_unit: { Args: {p_shop_id: string; p_product_id: string; p_unit: string}; Returns: undefined }
      save_service_recipe: { Args: {p_request_id: string; p_shop_id: string; p_service_id: string; p_effective_at: string | null; p_materials: Array<{productId: string; unit: string; quantity: number}>; p_reason: string}; Returns: string }
      correct_service_material: { Args: {p_request_id: string; p_shop_id: string; p_consumption_id: string; p_quantity: number; p_reason: string}; Returns: string }
      reconcile_service_completion: { Args: {p_shop_id: string; p_args: Record<string, unknown>; p_resolution_request_id: string; p_reason: string}; Returns: {state: 'synced'; invoiceId: string} | {state: 'cancelled'; resolutionRequestId: string} }

      quote_sale_tax: { Args: { p_shop_id: string; p_location_id: string; p_lines: { item_type: string; source_id: string; quantity: number }[] }; Returns: unknown }
      save_tax_policy: { Args: { p_request_id: string; p_shop_id: string; p_effective_at: string; p_policy: import('./tax').TaxPolicy; p_reason: string }; Returns: string }
      tax_settings: { Args: { p_shop_id: string }; Returns: unknown }
      get_sale_tax_snapshot: { Args: { p_shop_id: string; p_invoice_id: string }; Returns: unknown }
      set_sale_order_discount: { Args: { p_shop_id: string; p_invoice_id: string; p_discount: number }; Returns: undefined }

      save_commission_policy: { Args: { p_request_id: string; p_shop_id: string; p_policy: import('./commission').CommissionPolicy; p_reason: string }; Returns: string }
      commission_history: { Args: { p_shop_id: string; p_invoice_id?: string | null; p_offset?: number }; Returns: unknown }
      assign_sale_commission: { Args: { p_shop_id: string; p_line_id: string; p_membership_id: string | null; p_appointment_id?: string | null }; Returns: undefined }
      commission_assignment_context: { Args: { p_shop_id: string; p_invoice_id: string }; Returns: unknown }
      record_commission_adjustment: { Args: { p_shop_id: string; p_snapshot_id: string; p_request_id: string; p_kind: 'correction' | 'exported'; p_amount: number; p_reason: string }; Returns: undefined }
      shop_billing_change_preview: { Args:{p_shop_id:string;p_catalog_terms_id:string|null;p_private_offer?:Record<string,string|number>|null};Returns:unknown }
      shop_billing_change_schedule: { Args:{p_request_id:string;p_shop_id:string;p_catalog_terms_id:string|null;p_private_offer?:Record<string,string|number>|null};Returns:unknown }
      shop_billing_change_read: { Args:{p_shop_id:string};Returns:unknown }
      shop_billing_change_cancel: { Args:{p_shop_id:string;p_change_id:string};Returns:unknown }
      shop_xpay_proration_quote: { Args: { p_request_id: string; p_shop_id: string; p_catalog_terms_id: string | null; p_private_offer?: Record<string, string | number> | null }; Returns: unknown }
      shop_xpay_proration_read: { Args: { p_shop_id: string; p_quote_id: string }; Returns: unknown }
      shop_xpay_proration_order: { Args: { p_shop_id: string; p_quote_id: string }; Returns: unknown }
      shop_xpay_proration_credit_confirm: { Args: { p_shop_id: string; p_quote_id: string }; Returns: unknown }
      shop_xpay_proration_abandon: { Args: { p_shop_id: string; p_quote_id: string }; Returns: unknown }
      shop_xpay_proration_status: { Args: { p_shop_id: string }; Returns: unknown }
      shop_xpay_order_read: { Args: { p_shop_id: string; p_order_id: string | null }; Returns: unknown }
      shop_catalog_media: {
        Args: { p_shop_id: string; p_action: 'products' | 'services' | 'pos' | 'save_product' | 'save_service'; p_payload: Record<string, string | number | boolean | string[] | null> }
        Returns: unknown
      }

      fast_pay_location_sale: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_invoice_id: string | null
          p_customer_id: string | null
          p_due_date: string | null
          p_notes: string | null
          p_lines: Array<{ item_type: 'product' | 'service'; source_id: string; quantity: number }>
          p_amount: number
          p_paid_at: string
          p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
          p_reference: string | null
        }
        Returns: string
      }
      shop_cash_policy: { Args: { p_shop_id: string }; Returns: boolean }
      set_shop_cash_policy: { Args: { p_shop_id: string; p_required: boolean }; Returns: boolean }
      create_owner_shop: {
        Args: {
          p_shop_name: string
          p_business_mode: 'product' | 'service' | 'mixed'
          p_main_location_name?: string
          p_main_location_code?: string | null
          p_main_location_address?: string | null
          p_main_location_phone?: string | null
        }
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
      shop_private_offer_read: {
        Args: { p_shop_id: string; p_offer_id: string; p_offer_version: number; p_target_binding_id: string; p_target_environment_id: string; p_redemption_token: string }
        Returns: unknown
      }
      redeem_shop_private_offer: {
        Args: { p_request_id: string; p_shop_id: string; p_offer_id: string; p_offer_version: number; p_target_binding_id: string; p_target_environment_id: string; p_redemption_token: string; p_paid_amount: number; p_transfer_date: string; p_transfer_reference: string }
        Returns: string
      }
      shop_billing_read: {
        Args: { p_shop_id: string }
        Returns: unknown
      }
      shop_plan_usage: {
        Args: { p_shop_id: string }
        Returns: unknown
      }
      shop_plan_change_validation: {
        Args: { p_shop_id: string; p_target_plan_slug: string }
        Returns: unknown
      }
      reserve_shop_billing_payment_evidence: {
        Args: { p_submission_id: string; p_original_file_name: string; p_mime_type: string; p_size_bytes: number; p_sha256: string }
        Returns: { evidenceId: string; bucket: string; objectName: string; mimeType: string; sizeBytes: number }
      }
      shop_billing_payment_evidence_read: {
        Args: { p_submission_id: string }
        Returns: Array<{ evidenceId: string; originalFileName: string; sha256: string }>
      }
      submit_shop_billing_notice: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_requested_plan_slug: string
          p_requested_catalog_terms_id: string
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
          p_action: 'configure_instructions' | 'mark_under_review' | 'approve' | 'reject' | 'set_price_override'
          p_submission_id: string | null
          p_reason: string
          p_payload?: Record<string, unknown>
        }
        Returns: unknown
      }
      shop_public_plan_catalog: {
        Args: Record<string, never>
        Returns: Array<{
          id: string
          name: string
          slug: string
          catalog_terms_id: string
          plan_variant: 'standard' | 'solo_1' | 'solo_2' | 'multi_2' | 'multi_3'
          variant_name: string
          price_amount: number
          currency: string
          billing_interval: 'monthly' | 'annual'
          trial_days: number
          features: Record<string, unknown>
          resource_limits: Record<string, number | null>
          is_purchasable: boolean
          is_coming_soon: boolean
        }>
      }
      platform_plan_read: {
        Args: {
          p_resource?: 'catalog' | 'shop' | 'audit'
          p_shop_id?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      platform_plan_command: {
        Args: {
          p_request_id: string
          p_action: 'publish_terms' | 'set_availability' | 'change_subscription' | 'renew_subscription' | 'suspend_subscription' | 'set_price_override' | 'remove_price_override'
          p_reason: string
          p_plan_id?: string | null
          p_shop_id?: string | null
          p_payload?: Record<string, unknown>
        }
        Returns: unknown
      }
      set_shop_business_mode: {
        Args: { p_shop_id: string; p_business_mode: 'product' | 'service' | 'mixed' }
        Returns: 'product' | 'service' | 'mixed'
      }
      save_shop_profile: {
        Args: { p_shop_id: string; p_display_name: string }
        Returns: string
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
      restore_shop_location: {
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
      invite_shop_staff: {
        Args: { p_request_id: string; p_shop_id: string; p_email: string; p_display_name: string; p_job_title: string | null; p_role_key: string; p_location_ids: string[] }
        Returns: unknown
      }
      save_shop_team_role: {
        Args: { p_request_id: string; p_shop_id: string; p_role_key: string | null; p_name: string; p_name_ar: string; p_permission_keys: string[]; p_archive?: boolean }
        Returns: string
      }
      save_shop_team_member: {
        Args: { p_request_id: string; p_shop_id: string; p_membership_id: string; p_full_name: string; p_job_title: string | null; p_role_key: string; p_location_ids: string[] }
        Returns: undefined
      }
      save_shop_member_details: {
        Args: { p_request_id: string; p_shop_id: string; p_membership_id: string; p_full_name: string; p_job_title: string | null }
        Returns: undefined
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
      shop_operating_report: {
        Args: {
          p_shop_id: string
          p_location_id?: string | null
          p_period?: 'day' | 'week' | 'month'
          p_anchor_date?: string
        }
        Returns: unknown
      }
      shop_operational_report: {
        Args: {
          p_shop_id: string
          p_report: 'sales' | 'collections' | 'receivables' | 'suppliers' | 'expenses' | 'inventory' | 'margin' | 'activity'
          p_location_id?: string | null
          p_from?: string | null
          p_to?: string | null
          p_page?: number
          p_page_size?: number
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
      sale_correction_state: {
        Args: { p_shop_id: string; p_location_id: string; p_invoice_id: string }
        Returns: unknown
      }
      correct_location_sale: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_invoice_id: string
          p_effective_at: string
          p_reason: string
          p_reference?: string | null
        }
        Returns: string
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
      save_document_settings: { Args: { p_shop_id: string; p_settings: Record<string, unknown> }; Returns: unknown }
      business_currency_settings: { Args: { p_shop_id: string }; Returns: unknown }
      save_business_currency: { Args: { p_shop_id: string; p_currency: string }; Returns: unknown }
      receipt_settings: {
        Args: { p_shop_id: string }
        Returns: unknown
      }
      save_receipt_settings: {
        Args: {
          p_shop_id: string
          p_display_name: string
          p_address: string | null
          p_phone: string | null
          p_footer: string | null
          p_paper_size: 'thermal_80' | 'a4'
        }
        Returns: unknown
      }
      get_location_sale_receipt: {
        Args: { p_shop_id: string; p_location_id: string; p_invoice_id: string }
        Returns: unknown
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
      save_product_with_category: {
        Args: {
          p_shop_id: string; p_product_id: string | null; p_name: string; p_sku: string | null
          p_barcode: string | null; p_sale_price: number; p_category_id: string | null
        }
        Returns: string
      }
      list_products: {
        Args: { p_shop_id: string; p_search?: string | null; p_category_id?: string | null; p_page?: number; p_page_size?: number }
        Returns: unknown
      }
      list_catalog_categories: {
        Args: { p_shop_id: string }
        Returns: Array<{ id: string; name: string }>
      }
      save_catalog_category: {
        Args: { p_shop_id: string; p_category_id: string | null; p_name: string }
        Returns: string
      }
      set_catalog_item_category: {
        Args: { p_shop_id: string; p_item_type: 'product' | 'service'; p_item_id: string; p_category_id: string | null }
        Returns: undefined
      }
      catalog_import: {
        Args: { p_request_id: string; p_shop_id: string; p_kind: 'products' | 'customers' | 'suppliers'; p_rows: Array<Record<string, unknown>>; p_dry_run?: boolean }
        Returns: unknown
      }
      barcode_label_data: {
        Args: { p_shop_id: string; p_search?: string | null; p_category_id?: string | null; p_page?: number; p_page_size?: number }
        Returns: unknown
      }
      catalog_sales_report: {
        Args: { p_shop_id: string; p_category_id?: string | null; p_from?: string; p_to?: string }
        Returns: unknown
      }
      archive_product: {
        Args: { p_shop_id: string; p_product_id: string }
        Returns: undefined
      }
      list_services: {
        Args: { p_shop_id: string; p_search?: string | null; p_page?: number; p_page_size?: number }
        Returns: unknown
      }
      list_services_by_category: {
        Args: { p_shop_id: string; p_search?: string | null; p_category_id?: string | null; p_page?: number; p_page_size?: number }
        Returns: unknown
      }
      service_scheduling_options: {
        Args: { p_shop_id: string }
        Returns: unknown
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
          p_scheduling_enabled: boolean
          p_duration_minutes: number | null
          p_cleanup_minutes: number
          p_location_ids: string[]
          p_staff_membership_ids: string[]
        }
        Returns: string
      }
      save_service_with_category: {
        Args: {
          p_shop_id: string; p_service_id: string | null; p_name: string; p_description: string | null
          p_base_sale_price: number; p_discount_type: 'amount' | 'percent'; p_discount_value: number
          p_scheduling_enabled: boolean; p_duration_minutes: number | null; p_cleanup_minutes: number
          p_location_ids: string[]; p_staff_membership_ids: string[]; p_category_id: string | null
        }
        Returns: string
      }
      archive_service: {
        Args: { p_shop_id: string; p_service_id: string }
        Returns: undefined
      }
      appointment_options: {
        Args: { p_shop_id: string }
        Returns: unknown
      }
      appointment_calendar: {
        Args: {
          p_shop_id: string
          p_location_id: string
          p_from: string
          p_to: string
          p_membership_id?: string | null
        }
        Returns: unknown
      }
      save_appointment: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_appointment_id: string | null
          p_location_id: string
          p_membership_id: string
          p_service_id: string
          p_starts_at: string
          p_identity_kind: 'customer' | 'walk_in'
          p_customer_id: string | null
          p_walk_in_name: string | null
          p_walk_in_phone: string | null
          p_notes: string | null
        }
        Returns: string
      }
      transition_appointment: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_appointment_id: string
          p_status: 'arrived' | 'waiting' | 'in_service' | 'completed' | 'cancelled' | 'no_show'
          p_reason?: string | null
        }
        Returns: string
      }
      link_appointment_sale: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_appointment_id: string
          p_sale_id: string
        }
        Returns: string
      }
      pos_catalog_search: {
        Args: {
          p_shop_id: string
          p_location_id: string
          p_search?: string | null
          p_item_type?: 'product' | 'service' | null
          p_barcode?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      pos_catalog_search_by_category: {
        Args: {
          p_shop_id: string
          p_location_id: string
          p_search?: string | null
          p_item_type?: 'product' | 'service' | null
          p_barcode?: string | null
          p_category_id?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      pos_checkout_context: {
        Args: { p_shop_id: string; p_location_id: string; p_customer_search?: string | null }
        Returns: unknown
      }
      save_pos_sale_draft: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_invoice_id: string | null
          p_staff_membership_id: string
          p_appointment_id: string | null
          p_customer_id: string | null
          p_notes: string | null
          p_lines: Array<{ item_type: 'product' | 'service'; source_id: string; quantity: number }>
        }
        Returns: string
      }
      replay_offline_cash_command: {
        Args: { p_kind: 'movement' | 'close'; p_shop_id: string; p_args: Record<string, unknown> }
        Returns: string
      }
      reconcile_offline_cash_command: {
        Args: { p_kind: 'movement' | 'close'; p_shop_id: string; p_args: Record<string, unknown>; p_resolution_request_id: string; p_reason: string }
        Returns: { state: 'synced'; resultId: string } | { state: 'cancelled'; resolutionRequestId: string }
      }
      reconcile_offline_pos_sale: {
        Args: { p_request_id: string; p_shop_id: string; p_location_id: string; p_original_args: Record<string, unknown>; p_resolution_request_id: string; p_reason: string }
        Returns: { state: 'synced'; invoiceId: string } | { state: 'cancelled'; resolutionRequestId: string }
      }
      replay_offline_pos_sale: {
        Args: {
          p_request_id: string; p_save_request_id: string; p_issue_request_id: string; p_payment_request_id: string
          p_appointment_request_id: string | null; p_shop_id: string; p_location_id: string; p_shift_id: string
          p_staff_membership_id: string; p_appointment_id: string | null; p_customer_id: string | null; p_notes: string | null
          p_lines: Array<{ item_type: 'product' | 'service'; source_id: string; quantity: number }>
          p_amount: number; p_paid_at: string; p_method: 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'; p_reference: string | null
        }
        Returns: string
      }
      checkout_pos_sale: {
        Args: {
          p_request_id: string
          p_issue_request_id: string
          p_payment_request_id: string
          p_appointment_request_id: string | null
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
      cash_shift_dashboard: {
        Args: {
          p_shop_id: string
          p_location_id: string
          p_cashier_membership_id?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
      }
      open_cash_shift: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_register_key: string
          p_opening_amount: number
          p_notes?: string | null
        }
        Returns: string
      }
      record_cash_movement: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_session_id: string
          p_kind: 'pay_in' | 'pay_out'
          p_amount: number
          p_reason: string
          p_reference: string
        }
        Returns: string
      }
      close_cash_shift: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_session_id: string
          p_counted_amount: number
          p_notes?: string | null
        }
        Returns: string
      }
      save_staff_schedule: {
        Args: {
          p_shop_id: string
          p_location_id: string
          p_membership_id: string
          p_timezone: string
          p_working_hours: Array<{ weekday: number; startsLocal: string; endsLocal: string }>
          p_blocks: Array<{ kind: 'break' | 'time_off'; startsAt: string; endsAt: string; note: string | null }>
        }
        Returns: undefined
      }
      save_expense: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_expense_id: string | null
          p_title: string
          p_amount: number
          p_category_name: string
          p_expense_date: string
          p_notes: string | null
          p_correction_reason?: string | null
        }
        Returns: string
      }
      void_expense: {
        Args: {
          p_request_id: string
          p_shop_id: string
          p_location_id: string
          p_expense_id: string
          p_reason: string
        }
        Returns: undefined
      }
      list_expenses: {
        Args: {
          p_shop_id: string
          p_location_id: string
          p_search?: string | null
          p_status?: 'paid' | 'void' | null
          p_category_id?: string | null
          p_from?: string | null
          p_to?: string | null
          p_page?: number
          p_page_size?: number
        }
        Returns: unknown
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
