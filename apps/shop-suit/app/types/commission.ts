export interface CommissionRate { type: 'percentage' | 'fixed'; rate: number }
export interface CommissionEmployee { membershipId: string; enabled: boolean; service?: CommissionRate | null; product?: CommissionRate | null }
export interface CommissionPolicy { enabled: boolean; currency: string; service: CommissionRate | null; product: CommissionRate | null; employees: CommissionEmployee[] }
export interface CommissionHistory { totalCount: number; policy: { id?: string; policy: CommissionPolicy }; members: { id: string; name: string }[]; lines: { id: string; invoiceId: string; employeeName: string; currency: string; estimate: number; earned: number; adjustments: number; postExportAdjustments: number }[] }
