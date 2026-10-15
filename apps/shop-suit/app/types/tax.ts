export interface TaxRule { treatment: 'vat' | 'zero_rated' | 'exempt' | 'non_taxable'; rate: number; priceMode: 'inclusive' | 'exclusive'; subtype: string }
export interface TaxPolicy { enabled: boolean; default: TaxRule; items: (TaxRule & { itemType: string; sourceId: string })[] }
export interface TaxSettings { versions: { id: string; effective_at: string; policy: TaxPolicy; reason: string }[]; items: { id: string; name: string; itemType: string }[] }
export interface TaxQuote { total: number; tax: number; net: number; calculationEnabled: boolean; lines: { id?: string; total: number; net: number; tax: number; originalQuantity: number }[] }
