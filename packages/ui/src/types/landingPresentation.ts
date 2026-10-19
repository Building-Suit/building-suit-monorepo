import type { MarketingPricingCopy, MarketingPricingOption, MarketingPricingPlan } from '@building-suit/contracts'

export type BsLandingPreview = { kind: 'dashboard'; label: string; title: string; periodLabel: string; metrics: { label: string; value: string }[] } | { kind: 'features' }

/** All cinematic copy is supplied by Shop; shared UI never invents business capabilities. */
export interface BsLandingJourney {
  eyebrow: string
  title: string
  description: string
  primaryAction: string
  secondaryAction: string
  note: string
  skip: string
  scrollHint: string
  illustrative: string
  navigation: { dashboard: string; pos: string; products: string; sales: string }
  preview: {
    title: string; subtitle: string; total: string; catalog: string; customer: string
    walkIn: string; item: string; quantity: string; amount: string; zero: string
    confirm: string; payment: string; paid: string; receipt: string; receiptNumber: string
    print: string; register: string; shop: string; location: string; staff: string
    staffName: string; search: string; all: string; inStock: string; cart: string
    empty: string; added: string; paymentLabel: string; cash: string; card: string
    bank: string; checkout: string; cancel: string; confirmationTitle: string
    confirmationBody: string; subtotal: string; date: string; dateValue: string
    share: string; printNote: string; thankYou: string; order: string; orderRequest: string
    stockLabel: string; stockBefore: string; stockAfter: string; salesCount: string
    collections: string; today: string; recorded: string
    products: Array<{ name: string; price: string; sku: string; stock: string; artwork: 'cup' | 'bottle' | 'bowl' | 'service' }>
  }
  chapters: Array<{ eyebrow: string; title: string; body: string }>
  trust: { label: string; heading: string; body: string }
}

export interface BsLandingPricing {
  variant?: 'default' | 'shop'
  plans: MarketingPricingPlan[]
  currencySelection?: { value: string; label: string; options: MarketingPricingOption[]; notice?: string; pending?: boolean }
  interval: string
  intervalOptions: MarketingPricingOption[]
  copy: MarketingPricingCopy
  annualSaving: string | null
  intro?: string
  loading: boolean
  error: string | null
  columns: 3 | 4
  testId: string
  sectionTestId?: string
  noticeTestId?: string
  notice?: string
}
