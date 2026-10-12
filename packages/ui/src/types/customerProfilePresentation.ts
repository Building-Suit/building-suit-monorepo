export interface BsCustomerProfileView {
  name: string; status: string; phone: string; email: string; address: string; notes: string
  created: string; updated: string; archived: string | null
  canManage: boolean; canEdit: boolean; canReceive: boolean
}
export interface BsCustomerOutstandingRow { id: string; number: string; href: string; settlement: string; due: string; amount: string; amountLimit: number }
export interface BsCustomerStatementRow { id: string; date: string; type: string; href: string; document: string; debit: string; credit: string; balance: string }
export interface BsCustomerReceivablesView { rows: BsCustomerOutstandingRow[]; page: number; pageSize: number; total: number; loading: boolean; error: string | null; balance: string; overdue: string }
export interface BsCustomerStatementView { rows: BsCustomerStatementRow[]; page: number; pageSize: number; total: number; loading: boolean; error: string | null }
export interface BsCustomerReceiptForm { date: string; method: string; reference: string; notes: string; allocations: Record<string, number> }
export interface BsCustomerReceiptEditor { dirty: boolean; pending: boolean; error: string; amount: string; submitDisabled: boolean }
export interface BsCustomerProfileCopy {
  customers_back: string
  common_retry: string
  customers_notFound: string
  customers_details: string
  customers_edit: string
  customers_archive: string
  customers_manageDenied: string
  customers_contact: string
  customers_phone: string
  customers_email: string
  customers_address: string
  customers_notes: string
  customers_created: string
  customers_updated: string
  customers_archivedOn: string
  customers_receivables: string
  payments_recordReceipt: string
  payments_loadError: string
  sales_invoiceNumber: string
  payments_settlementLabel: string
  sales_dueDate: string
  payments_outstanding: string
  customers_noOutstanding: string
  customers_statement: string
  sales_date: string
  payments_event: string
  payments_debit: string
  payments_credit: string
  payments_runningBalance: string
  customers_noStatement: string
  payments_save: string
  customers_cancel: string
  payments_allocateInvoices: string
  payments_amount: string
  payments_date: string
  payments_method: string
  payments_reference: string
  payments_notes: string
  customers_editTitle: string
  customers_save: string
  customers_name: string
}
