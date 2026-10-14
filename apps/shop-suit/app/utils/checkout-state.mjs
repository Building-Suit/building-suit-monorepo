const unresolved = new Set(['creating', 'open', 'pending', 'requires_review'])
// Existing paid access is not confirmation of a newly selected plan.
export function checkoutDialogPhase({ paymentPhase, newPlanReview, quoteState, blocked, pending }) {
  if (!newPlanReview || quoteState === 'settled' || paymentPhase !== 'confirmed') return paymentPhase
  return blocked ? 'held' : pending ? 'checking' : 'ready'
}
export function checkoutSnapshot({ orders, current, historyKnown, accessState, checking, error, periodEnd, now = Date.now() }) {
  const history = orders.find(order => order.orderId === current?.orderId)
  const terminal = new Set(['paid', 'requires_review', 'expired', 'failed'])
  const freshest = history?.state === 'paid' || (history && terminal.has(history.state) && current && !terminal.has(current.state)) ? history : current
  const all = [...orders.filter(order => order.orderId !== freshest?.orderId), ...(freshest ? [freshest] : [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const unfinished = all.find(order => unresolved.has(order.state))
  const order = unfinished ?? all[0] ?? null
  const latestPaid = all.find(order => order.state === 'paid') ?? null
  if (!historyKnown) return { phase: 'checking', order, latestPaid, canStart: false }
  if (order?.state === 'requires_review') return { phase: 'held', order, latestPaid, canStart: false }
  if (unfinished) {
    const resume = !checking && !error && current?.orderId === order.orderId && current.state === 'open' && !!current.url
    return { phase: resume ? 'resume' : 'confirming', order, latestPaid, canStart: false }
  }
  const expiredAccess = accessState === 'read_only' && periodEnd && Date.parse(periodEnd) <= now && (!order || Date.parse(order.createdAt) <= Date.parse(periodEnd))
  if (expiredAccess && !checking && !error) return { phase: 'ready', order, latestPaid, canStart: true }
  if (order?.state === 'paid' && accessState !== 'active') return { phase: 'confirming', order, latestPaid, canStart: false }
  if (accessState === 'active') return { phase: 'confirmed', order, latestPaid, canStart: false }
  if (error) return { phase: 'confirming', order, latestPaid, canStart: false }
  if (order && ['failed', 'expired'].includes(order.state)) return { phase: 'failed', order, latestPaid, canStart: true }
  return { phase: checking ? 'checking' : 'ready', order, latestPaid, canStart: !checking }
}
