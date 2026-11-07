import { readonly, ref, watch } from 'vue'

export type HqOfficeSection = 'overview' | 'tasks' | 'calendar' | 'settings'
/** Office switches/auth invalidations discard a nested selection, not the camera session. */
export function useHqOfficeInspection(scope: () => string | null, agentIds: () => readonly string[]) {
  const section = ref<HqOfficeSection>('overview')
  const selectedAgentId = ref<string | null>(null)
  watch(scope, () => { section.value = 'overview'; selectedAgentId.value = null }, { flush: 'sync' })
  watch(agentIds, ids => { if (selectedAgentId.value && !ids.includes(selectedAgentId.value)) selectedAgentId.value = null }, { flush: 'sync' })
  function selectSection(value: string) {
    if (['overview','tasks','calendar','settings'].includes(value)) section.value = value as HqOfficeSection
  }
  function selectAgent(id: string) { if (agentIds().includes(id)) selectedAgentId.value = id }
  function closeAgent() { selectedAgentId.value = null }
  return { section: readonly(section), selectedAgentId: readonly(selectedAgentId), selectSection, selectAgent, closeAgent }
}
