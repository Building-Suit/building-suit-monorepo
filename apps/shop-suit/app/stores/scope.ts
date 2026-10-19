import { defineStore } from 'pinia'

/** Selection and cache identity only. Authorization always comes from the server. */
export const useShopScopeStore = defineStore('shop-scope', {
  state: () => ({ actorId: null as string | null, revision: 0, shopId: null as string | null, locationId: null as string | null, publicAccessRevision: 0, requestSequence: 0 }),
})
