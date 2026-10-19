import { useShopMutation } from './useShopMutation'
import { useShopQueryCache } from './useShopQueryCache'

const privateReads = new Set(['/api/website/customer-portal', '/api/website/booking/options', '/api/website/booking/manage', '/api/website/booking/slots'])
/** Cookie-authenticated website reads remain nonpersistent and are revalidated on every request. */
export function useShopRequest() {
  const request = useRequestFetch()
  const queries = useShopQueryCache()
  const mutate = useShopMutation()
  const run = ((...args: Parameters<typeof request>) => {
    const endpoint = String(args[0])
    if (privateReads.has(endpoint)) {
      const entry = queries.cache.ensure({
        key: [...queries.scopeKey(), 'website', endpoint, ++queries.scope.requestSequence],
        meta: { shopResource: `website:${endpoint}` }, staleTime: 0, gcTime: 0,
        query: ({ signal }) => {
          const options = args[1]
          const callerSignal = options?.signal
          return request(args[0], { ...options, signal: callerSignal ? AbortSignal.any([signal, callerSignal]) : signal })
        },
      })
      return queries.cache.fetch(entry).then(result => { if (result.error) throw result.error; return result.data }).finally(() => queries.cache.remove(entry))
    }
    return mutate(() => Promise.resolve(Reflect.apply(request, undefined, args))).then(result => {
      if (endpoint.includes('appointment-access') || endpoint.includes('booking/command')) { queries.clear(key => key.startsWith('website:')); queries.scope.publicAccessRevision++ }
      return result
    })
  }) as typeof request
  return run
}
