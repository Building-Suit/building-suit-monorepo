import { nextTick, ref } from 'vue'
/** Local presentation selection; both business projections remain mounted. */
export function usePointOfSaleSections() {
  const selected = ref<'catalog' | 'cart'>('catalog')
  async function select(section: 'catalog' | 'cart', focus?: () => void) { selected.value = section; await nextTick(); focus?.() }
  return { selected, select }
}
