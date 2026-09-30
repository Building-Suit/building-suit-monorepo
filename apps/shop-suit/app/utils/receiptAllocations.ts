/** Validate selections retained across server pages; the receipt RPC remains authoritative. */
export function receiptAllocations(
  amounts: Record<string, number>,
  invoices: Record<string, { outstanding: number }>,
): Array<{ invoice_id: string; amount: number }> | null {
  const result: Array<{ invoice_id: string; amount: number }> = []
  for (const [invoiceId, value] of Object.entries(amounts)) {
    const amount = Number(value || 0)
    if (amount === 0) continue
    if (!Number.isFinite(amount) || amount < 0 || !invoices[invoiceId]
      || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6
      || amount > Number(invoices[invoiceId].outstanding)) return null
    result.push({ invoice_id: invoiceId, amount })
  }
  return result.length ? result : null
}
