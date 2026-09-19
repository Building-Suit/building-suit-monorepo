/** Defaults suggest a nature; neither postings nor actual balances are restricted. */
export function defaultAccountNature(type: string, subtype?: string): 'debit' | 'credit' {
  return type === 'asset' || type === 'expense' || subtype === 'owner_drawings' ? 'debit' : 'credit'
}

/** Exact text amounts from the account view avoid bigint-to-Number rounding. */
export function accountBalanceDisplay(netDebitMinor: string): { amount: string, side: 'debit' | 'credit' | 'zero' } {
  const net = BigInt(netDebitMinor)
  return { amount: (net < 0n ? -net : net).toString(), side: net > 0n ? 'debit' : net < 0n ? 'credit' : 'zero' }
}
