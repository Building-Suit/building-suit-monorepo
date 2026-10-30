/** Colada's pinned payload stores [data, error, age, meta] for each query.
 * Keep provider error instances, causes and request details out of hydration.
 * Active server query errors and the owning caller are left untouched.
 */
export function shopQueryPayload(payload: Record<string, unknown[]>) {
  return Object.fromEntries(Object.entries(payload).map(([key, entry]) => [key, [
    entry[0], entry[1] == null ? entry[1] : { message: 'Shop query failed' }, ...entry.slice(2),
  ]]))
}
