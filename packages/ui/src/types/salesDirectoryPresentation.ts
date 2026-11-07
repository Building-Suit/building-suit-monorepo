export interface BsSalesChoice { value: string; label: string }
export interface BsSalesDirectoryRow { id: string; number: string; lineCount: string; customer: string; status: string; statusTone?: 'neutral' | 'success' | 'info' | 'warning' | 'danger'; total: string; date: string; editable: boolean; href: string }
export interface BsSalesDraftLine { overridePrice?: string; overrideReason?: string; allowSplit?: boolean; cuttingLoss?: string; unitSelection?: string; key: string; itemType: string; sourceId: string; quantity: number }
export interface BsSalesLineView { pricing?: import('./priceApprovalPresentation').BsPriceApproval; physical?: { unit: string; canSplit: boolean }; unitChoices?: BsSalesChoice[]; quantityStep?: number; baseEquivalent?: string; key: string; options: BsSalesChoice[]; total: string; discount: string }
export interface BsSalesDraftForm { customerId: string; dueDate: string; notes: string; paymentMethod: string; paymentReference: string; lines: BsSalesDraftLine[] }
export interface BsSalesDirectoryView { available: boolean; loadingContext: boolean; denied: boolean; canManage: boolean; canIssue: boolean; canFastPay: boolean; loading: boolean; error: string; total: number; pageSize: number; catalogLoading: boolean; catalogError: boolean; editing: boolean; saving: boolean; issuing: boolean; errorMessage: string; dirty: boolean; locked: boolean; previewTotal: string }
export interface BsSalesDirectoryCopy { physicalSplit?: string; physicalLoss?: string; physicalLossHelp?: string; unit?: string;
  addLine: string
  allStatuses: string
  cancel: string
  catalogError: string
  customer: string
  customerlessNotice: string
  date: string
  discount: string
  draft: string
  draftNumber: string
  dueDate: string
  edit: string
  editDraft: string
  empty: string
  fastPay: string
  fastPayRetry: string
  from: string
  invoiceNumber: string
  issued: string
  issuing: string
  item: string
  lineTotal: string
  lines: string
  loadError: string
  manageDenied: string
  newSale: string
  noShop: string
  notes: string
  paymentBoundary: string
  permissionDenied: string
  previewNotice: string
  quantity: string
  removeLine: string
  saveDraft: string
  saving: string
  search: string
  selectCustomer: string
  selectItem: string
  status: string
  subtitle: string
  title: string
  to: string
  total: string
  retry: string
  paymentMethod: string
  paymentReference: string
  stockNotice: string
  issueLabel: string
}
