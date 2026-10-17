/** Shop amounts are decimal major units; sum cents to keep provisional drawer totals exact. */
export function projectOfflineCash(active, records) {
  if (!active) return 0
  const cents = records.filter(record => record.state !== 'synced' && record.resolution?.phase !== 'reconciled').reduce((total, record) => {
    const command = record.envelope.command
    const amount = Number(command.args.p_amount)
    if (!Number.isFinite(amount)) return total
    if (command.kind === 'sale' && command.args.p_shift_id === active.id && command.args.p_method === 'cash') return total + Math.round(amount * 100)
    if (command.kind === 'movement' && command.args.p_session_id === active.id) return total + Math.round(amount * 100) * (command.args.p_kind === 'pay_out' ? -1 : 1)
    return total
  }, Math.round(Number(active.expectedCash) * 100))
  return cents / 100
}

export function isCounterCashAmount(value, allowZero = false) {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) return false
  const cents = Math.round(value * 100)
  return Number.isSafeInteger(cents) && value === cents / 100
}
