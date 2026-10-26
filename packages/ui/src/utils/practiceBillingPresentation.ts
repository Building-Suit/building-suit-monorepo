export type BsPracticeBillingLabel = 'title' | 'notice' | 'retry' | 'uncertain' | 'retryOperation' | 'readOnly' | 'location' | 'prices' | 'charges' | 'visits' | 'empty' | 'createPrice' | 'editPrice' | 'createCharge' | 'correctCharge' | 'label' | 'amount' | 'currency' | 'exponent' | 'precisionHelp' | 'version' | 'effectiveAt' | 'visit' | 'service' | 'quantity' | 'reason' | 'save' | 'cancel' | 'history' | 'previous' | 'next' | 'loading' | 'denied' | 'createdAt' | 'account' | 'review'
export interface BsBillingPriceFields { label: string; amount: string; currency: string; exponent: string }
export interface BsBillingChargeFields { priceId: string; visitId: string; quantity: string; reason: string }
export interface BsBillingPage { page: number; total: number; size: number }
export interface BsPracticeBillingView {
 practiceName: string; ready: boolean; loading: boolean; pending: boolean; uncertain: boolean; denied: boolean; error: string | null; canWrite: boolean; readOnly: boolean
 locationId: string | null; locations: { value: string; label: string }[]; locationPage: BsBillingPage
 priceRows: { id: string; label: string; amount: string; version: string; effectiveAt: string }[]
 chargeRows: { id: string; visit: string; service: string; amount: string; version: string; createdAt: string }[]
 pricePage: BsBillingPage; chargePage: BsBillingPage; visitPage: BsBillingPage
 priceOptions: { value: string; label: string }[]; visitOptions: { value: string; label: string }[]
 priceEditor: { visible: boolean; title: string; dirty: boolean; disabled: boolean }
 chargeEditor: { visible: boolean; title: string; dirty: boolean; disabled: boolean; correcting: boolean; error: string | null }
 history: { visible: boolean; loading: boolean; previous: boolean; next: boolean; rows: { id: string; version: string; amount: string; reason: string; createdAt: string }[] }
}
