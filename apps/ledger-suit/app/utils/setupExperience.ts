export type SetupState = 'complete' | 'needs_attention' | 'optional' | 'unavailable'

export interface SetupFacts {
  organizationConfigured: boolean
  accountCount: number | null
  eligibleMappingAccountCount: number | null
  mappedAccountCount: number | null
  periodCount: number | null
  acceptedOpeningCount: number | null
  memberCount: number | null
  pendingInvitationCount: number | null
}

export interface SetupChecklistItem {
  key: 'organization' | 'chart' | 'periods' | 'opening' | 'team'
  state: SetupState
  route: string
  count?: number
  mappedCount?: number
}

export function buildSetupChecklist(facts: SetupFacts): SetupChecklistItem[] {
  const chartUnavailable = facts.accountCount === null
  const mappingUnavailable = facts.eligibleMappingAccountCount === null || facts.mappedAccountCount === null
  const chartComplete = facts.accountCount !== null && facts.accountCount > 0
    && !mappingUnavailable
    && facts.eligibleMappingAccountCount! > 0
    && facts.mappedAccountCount! >= facts.eligibleMappingAccountCount!

  return [
    {
      key: 'organization',
      state: facts.organizationConfigured ? 'complete' : 'needs_attention',
      route: '/dashboard',
    },
    {
      key: 'chart',
      state: chartUnavailable || mappingUnavailable ? 'unavailable' : chartComplete ? 'complete' : 'needs_attention',
      route: '/accounts?setup=templates',
      count: facts.accountCount ?? undefined,
      mappedCount: facts.mappedAccountCount ?? undefined,
    },
    {
      key: 'periods',
      state: facts.periodCount === null ? 'unavailable' : facts.periodCount > 0 ? 'complete' : 'needs_attention',
      route: '/periods',
      count: facts.periodCount ?? undefined,
    },
    {
      key: 'opening',
      state: facts.acceptedOpeningCount === null ? 'unavailable' : facts.acceptedOpeningCount > 0 ? 'complete' : 'optional',
      route: '/opening-balances',
      count: facts.acceptedOpeningCount ?? undefined,
    },
    {
      key: 'team',
      state: facts.memberCount === null || facts.pendingInvitationCount === null
        ? 'unavailable'
        : facts.memberCount > 1 || facts.pendingInvitationCount > 0 ? 'complete' : 'optional',
      route: '/team',
      count: facts.memberCount ?? undefined,
    },
  ]
}

export type ChartTemplateKey = 'services' | 'trading'
export type TemplateAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type TemplateAccountRole = 'group' | 'control' | 'posting'

export interface ReviewedChartTemplateAccount {
  code: string
  nameKey: string
  parentCode: string | null
  type: TemplateAccountType
  role: TemplateAccountRole
  statementLine: string | null
}

export interface ReviewedChartTemplate {
  key: ChartTemplateKey
  reviewStatus: 'product_reviewed_starting_point'
  accounts: ReviewedChartTemplateAccount[]
}

const commonTemplateAccounts: ReviewedChartTemplateAccount[] = [
  { code: '1000', nameKey: 'currentAssets', parentCode: null, type: 'asset', role: 'group', statementLine: null },
  { code: '1100', nameKey: 'cash', parentCode: '1000', type: 'asset', role: 'posting', statementLine: 'current_assets' },
  { code: '1200', nameKey: 'receivables', parentCode: '1000', type: 'asset', role: 'control', statementLine: 'current_assets' },
  { code: '1500', nameKey: 'nonCurrentAssets', parentCode: null, type: 'asset', role: 'group', statementLine: null },
  { code: '1510', nameKey: 'equipment', parentCode: '1500', type: 'asset', role: 'posting', statementLine: 'property_equipment' },
  { code: '2000', nameKey: 'currentLiabilities', parentCode: null, type: 'liability', role: 'group', statementLine: null },
  { code: '2100', nameKey: 'payables', parentCode: '2000', type: 'liability', role: 'control', statementLine: 'current_liabilities' },
  { code: '3000', nameKey: 'equity', parentCode: null, type: 'equity', role: 'group', statementLine: null },
  { code: '3100', nameKey: 'retainedEarnings', parentCode: '3000', type: 'equity', role: 'posting', statementLine: 'equity' },
  { code: '4000', nameKey: 'revenue', parentCode: null, type: 'revenue', role: 'group', statementLine: null },
  { code: '5000', nameKey: 'expenses', parentCode: null, type: 'expense', role: 'group', statementLine: null },
  { code: '5100', nameKey: 'operatingExpenses', parentCode: '5000', type: 'expense', role: 'posting', statementLine: 'operating_expenses' },
]

export const reviewedChartTemplates: ReviewedChartTemplate[] = [
  {
    key: 'services',
    reviewStatus: 'product_reviewed_starting_point',
    accounts: [
      ...commonTemplateAccounts,
      { code: '4100', nameKey: 'serviceRevenue', parentCode: '4000', type: 'revenue', role: 'posting', statementLine: 'operating_revenue' },
    ],
  },
  {
    key: 'trading',
    reviewStatus: 'product_reviewed_starting_point',
    accounts: [
      ...commonTemplateAccounts,
      { code: '1300', nameKey: 'inventory', parentCode: '1000', type: 'asset', role: 'posting', statementLine: 'current_assets' },
      { code: '4100', nameKey: 'salesRevenue', parentCode: '4000', type: 'revenue', role: 'posting', statementLine: 'operating_revenue' },
      { code: '5200', nameKey: 'costOfSales', parentCode: '5000', type: 'expense', role: 'posting', statementLine: 'cost_of_sales' },
    ],
  },
]

export interface SyntheticDemoState {
  scope: 'isolated_synthetic_demo'
  organizationId: null
  revision: number
  accounts: Array<{ code: string, nameKey: string, debitMinor: string, creditMinor: string }>
}

export function createSyntheticDemo(): SyntheticDemoState {
  return {
    scope: 'isolated_synthetic_demo',
    organizationId: null,
    revision: 0,
    accounts: [
      { code: '1100', nameKey: 'cash', debitMinor: '12500000', creditMinor: '0' },
      { code: '1200', nameKey: 'receivables', debitMinor: '3500000', creditMinor: '0' },
      { code: '2100', nameKey: 'payables', debitMinor: '0', creditMinor: '2800000' },
      { code: '3100', nameKey: 'retainedEarnings', debitMinor: '0', creditMinor: '8200000' },
      { code: '4100', nameKey: 'serviceRevenue', debitMinor: '0', creditMinor: '5000000' },
    ],
  }
}

function assertSyntheticScope(state: SyntheticDemoState) {
  if (state.scope !== 'isolated_synthetic_demo' || state.organizationId !== null) {
    throw new Error('DEMO_SCOPE_REQUIRED')
  }
}

export function addSyntheticReceipt(state: SyntheticDemoState, amountMinor = '250000'): SyntheticDemoState {
  assertSyntheticScope(state)
  const amount = BigInt(amountMinor)
  if (amount <= 0n) throw new Error('DEMO_AMOUNT_INVALID')
  return {
    ...state,
    revision: state.revision + 1,
    accounts: state.accounts.map(account => {
      if (account.nameKey === 'cash') return { ...account, debitMinor: (BigInt(account.debitMinor) + amount).toString() }
      if (account.nameKey === 'serviceRevenue') return { ...account, creditMinor: (BigInt(account.creditMinor) + amount).toString() }
      return { ...account }
    }),
  }
}

export function resetSyntheticDemo(state: SyntheticDemoState): SyntheticDemoState {
  assertSyntheticScope(state)
  return createSyntheticDemo()
}
