// Only expose the bounded response for the query currently in the filter.
// Keep the selected identity available across searches and appointment context.
/**
 * @param {{ search: string, resolvedSearch?: string, pending: boolean,
 * customers: Array<{ id: string, name: string, phone: string | null }>,
 * selected: { id: string, name: string, phone: string | null } | null }} context
 */
export function posCustomerOptions({ search, resolvedSearch, pending, customers, selected }) {
  const query = search.trim()
  const matches = !pending && query.length >= 2 && query === resolvedSearch ? customers : []
  const options = selected ? [selected, ...matches.filter(customer => customer.id !== selected.id)] : matches
  return options.map(customer => ({ ...customer, identity: [customer.name, customer.phone].filter(Boolean).join(' · ') }))
}
