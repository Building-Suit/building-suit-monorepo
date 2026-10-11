export interface BsInventoryAccountingCopy {
  common_cancel: string
  common_retry: string
  common_save: string
  inventory_accountingDate: string
  inventory_actor: string
  inventory_asOf: string
  inventory_boundary: string
  inventory_closingNote: string
  inventory_cogs: string
  inventory_cogsDelta: string
  inventory_configure: string
  inventory_control: string
  inventory_controlName: string
  inventory_denied: string
  inventory_effectiveDate: string
  inventory_empty: string
  inventory_facts: string
  inventory_inventoryDelta: string
  inventory_loadError: string
  inventory_movement: string
  inventory_newControl: string
  inventory_noSource: string
  inventory_offset: string
  inventory_policy: string
  inventory_related: string
  inventory_run: string
  inventory_setupPolicy: string
  inventory_snapshot: string
  inventory_sourceId: string
  inventory_sourceKey: string
  inventory_title: string
  inventory_trace: string
  inventory_valuation: string
  pageContext_label: string
}
export interface BsInventoryAccountingForm { source: string; actor: string; effective: string; control: string; cogs: string; offset: string; name: string }
export interface BsInventoryAccountingChoice { value: string; label: string }
export interface BsInventoryAccountingView { context: { label: string; value: string }[]; contextLabel: string; canRead: boolean; canConfigure: boolean; pending: boolean; failed: boolean; available: boolean; configurationDisabled: boolean; sources: { id: string; key: string; status: string; statusLabel: string; tone: 'success' | 'warning'; amounts: { id: string; label: string; value: string }[]; sequence: string; actor: string }[]; facts: { id: string; accountingDate: string; effectiveDate: string; movement: string; kind: string; valuation: string; policy: string; inventory: string; cogs: string; journal: string; journalTo: string; related: string; reason: string }[]; first: number; total: number; pageSize: number; controlMode: boolean; formTitle: string; saving: boolean; dirty: boolean; formError: string; readOnly: boolean; sourceKeyMaxLength: number }
export interface BsInventoryAccountingChoices { controls: BsInventoryAccountingChoice[]; cogs: BsInventoryAccountingChoice[]; offsets: BsInventoryAccountingChoice[] }
