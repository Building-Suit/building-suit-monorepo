import { computed, ref, watch, type Ref } from 'vue'
/** Tree expansion is interaction state; the caller owns hierarchy construction. */
export function useTreeExpansion(scope: Ref<string>, branchIds: Ref<string[]>) {
 const collapsed = ref(new Set<string>())
 watch(scope, () => { collapsed.value = new Set() }, { flush: 'sync' })
 function toggle(id: string) { const next = new Set(collapsed.value); if (next.has(id)) next.delete(id); else next.add(id); collapsed.value = next }
 function expandAll() { collapsed.value = new Set() }
 function collapseAll() { collapsed.value = new Set(branchIds.value) }
 return { collapsed, toggle, expandAll, collapseAll, expanded: computed(() => branchIds.value.filter(id => !collapsed.value.has(id))) }
}
