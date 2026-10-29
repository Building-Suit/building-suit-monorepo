import { useMutationCache } from '@pinia/colada'

/** Execute once with Colada tracking; command results stay with their owning lifecycle. */
export function useShopMutation() {
  const cache = useMutationCache()
  return async function execute<T>(operation: () => Promise<T>): Promise<T> {
    let result!: T
    let failed = false
    let failure: unknown
    const run = async () => {
      try { result = await operation() }
      catch (cause) {
        failed = true; failure = cause
      }
      // Provider errors can retain request bodies or one-time access codes.
      if (failed) throw new Error('Shop command failed')
    }
    const entry = cache.ensure(cache.create({ mutation: (command: () => Promise<void>) => command(), gcTime: 0, meta: { shopMutation: true } }), run)
    try {
      await cache.mutate(entry)
      return result
    } catch (cause) { throw failed ? failure : cause }
    finally {
      cache.remove(entry)
      entry.vars = undefined
    }
  }
}
