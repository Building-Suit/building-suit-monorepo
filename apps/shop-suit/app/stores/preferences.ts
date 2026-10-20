import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Request-scoped UI/public payload state; never persists credentials or business records. */
export const useShopPreferencesStore = defineStore('shop-preferences', () => {
  const values = ref<Record<string, unknown>>({})
  return { values }
})
