export type ChartAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export interface ChartAccount {
  organization_id: string
  account_id: string
  code: string | null
  name: string
  type: ChartAccountType
  subtype: string
  currency: string
  account_role: 'posting' | 'control' | 'group'
  control_subledger_type: 'customer' | 'supplier' | null
  control_binding_locked: boolean
  normal_balance: 'debit' | 'credit'
  contra_account_id: string | null
  is_system: boolean
  classification_locked: boolean
  net_debit_minor: string
  statement_balance_minor: string
  entry_count: number
  is_archived: boolean
  is_liquid: boolean
  parent_account_id: string | null
}

// Navigation groups for the chart, not dated financial-statement classifications.
// Existing parent links take precedence; never infer loan maturity from its name.
export const CHART_SECTIONS: Record<ChartAccountType, Record<string, readonly string[]>> = {
  asset: {
    currentAssets: ['cash', 'bank', 'mobile_wallet', 'accounts_receivable', 'inventory', 'prepaid_expenses'],
    fixedAssets: ['equipment', 'vehicles', 'property'],
    otherAssets: ['other_asset'],
  },
  liability: {
    tradeLiabilities: ['accounts_payable'],
    financing: ['loan', 'credit_card'],
    otherLiabilities: ['taxes_payable', 'accrued_expenses', 'other_liability'],
  },
  equity: {
    capital: ['owner_capital'], retainedEarnings: ['retained_earnings'],
    drawings: ['owner_drawings'], otherEquity: ['opening_balance_equity', 'other_equity'],
  },
  revenue: { operatingRevenue: ['product_sales', 'service_revenue', 'commission'], otherRevenue: ['other_income'] },
  expense: {
    costOfSales: ['cost_of_sales'],
    operatingExpenses: ['salaries', 'rent', 'utilities', 'marketing', 'transportation', 'software', 'professional_fees', 'depreciation'],
    financeCosts: ['bank_fees', 'interest_expense'], taxes: ['taxes'], otherExpenses: ['other_expense'],
  },
}

export interface AccountTreeNode {
  id: string
  kind: 'type' | 'section' | 'account'
  label: string
  type: ChartAccountType
  account?: ChartAccount
  children: AccountTreeNode[]
  total: string
  count: number
}
export interface AccountTreeRow extends AccountTreeNode { depth: number, expanded: boolean }

export function buildAccountTree(accounts: readonly ChartAccount[], label: (key: string) => string): AccountTreeNode[] {
  const sorted = [...accounts].sort((a, b) => (a.code ?? '\uffff').localeCompare(b.code ?? '\uffff', undefined, { numeric: true }) || a.name.localeCompare(b.name) || a.account_id.localeCompare(b.account_id))
  const byId = new Map(sorted.map(account => [account.account_id, account]))
  const children = new Map<string, ChartAccount[]>()
  const roots: ChartAccount[] = []
  // Treat missing/foreign/type-mismatched or cyclic parents as roots, never lose rows.
  for (const account of sorted) {
    let parent = byId.get(account.parent_account_id ?? '')
    const seen = new Set([account.account_id])
    for (let ancestor = parent; ancestor; ancestor = byId.get(ancestor.parent_account_id ?? '')) {
      if (seen.has(ancestor.account_id) || ancestor.organization_id !== account.organization_id || ancestor.type !== account.type) { parent = undefined; break }
      seen.add(ancestor.account_id)
    }
    if (parent) children.set(parent.account_id, [...(children.get(parent.account_id) ?? []), account])
    else roots.push(account)
  }
  function accountNode(account: ChartAccount): AccountTreeNode {
    const nested = (children.get(account.account_id) ?? []).map(accountNode)
    return {
      id: account.account_id, kind: 'account', label: account.name, type: account.type, account, children: nested,
      // Include historical parent postings and each child exactly once, with contra signs.
      total: nested.reduce((sum, child) => sum + BigInt(child.total), BigInt(account.statement_balance_minor)).toString(),
      count: 1 + nested.reduce((sum, child) => sum + child.count, 0),
    }
  }
  function group(id: string, kind: 'type' | 'section', type: ChartAccountType, title: string, nested: AccountTreeNode[]): AccountTreeNode {
    return { id, kind, type, label: title, children: nested,
      total: nested.reduce((sum, child) => sum + BigInt(child.total), 0n).toString(),
      count: nested.reduce((sum, child) => sum + child.count, 0) }
  }
  return (Object.keys(CHART_SECTIONS) as ChartAccountType[]).map(type => {
    const sections = Object.entries(CHART_SECTIONS[type])
    const grouped = sections.map(([key], index) => group(`section:${key}`, 'section', type, label(`accountTree.sections.${key}`),
      roots.filter(account => account.type === type && (sections.findIndex(([, subtypes]) => subtypes.includes(account.subtype)) === index
        || (index === sections.length - 1 && !sections.some(([, subtypes]) => subtypes.includes(account.subtype)))))
        .map(accountNode)))
    return group(`type:${type}`, 'type', type, label(`accounts.groups.${type}`), grouped)
  })
}

export function flattenAccountTree(nodes: readonly AccountTreeNode[], collapsed: ReadonlySet<string>, search = ''): AccountTreeRow[] {
  const query = search.trim().toLocaleLowerCase()
  function visit(node: AccountTreeNode, depth: number, ancestorMatches: boolean): AccountTreeRow[] {
    const matches = ancestorMatches || Boolean(query && `${node.label} ${node.account?.code ?? ''}`.toLocaleLowerCase().includes(query))
    const nested = node.children.flatMap(child => visit(child, depth + 1, matches))
    if (query && !matches && !nested.length) return []
    const expanded = Boolean(query) || !collapsed.has(node.id)
    return [{ ...node, depth, expanded }, ...(expanded ? nested : [])]
  }
  return nodes.flatMap(node => visit(node, 0, false))
}
