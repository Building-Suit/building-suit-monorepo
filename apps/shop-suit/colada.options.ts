import type { PiniaColadaOptions } from '@pinia/colada'

export default {
  queryOptions: {
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    ssrCatchError: true,
  },
} satisfies PiniaColadaOptions
