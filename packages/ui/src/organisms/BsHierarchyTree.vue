<script setup lang="ts">
import type { BsHierarchyNode } from '@building-suit/contracts'
const props = defineProps<{ nodes: BsHierarchyNode[]; expanded: string[]; label: string; expandLabel: string; collapseLabel: string; emptyLabel: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:expanded': [ids: string[]]; select: [node: BsHierarchyNode] }>()
const rows = computed(() => {
  const result: Array<{ node: BsHierarchyNode; depth: number }> = []
  function visit(nodes: BsHierarchyNode[], depth: number, ancestors: Set<string>) {
    for (const node of nodes) {
      if (ancestors.has(node.id)) continue
      result.push({ node, depth })
      if (props.expanded.includes(node.id)) visit(node.children || [], depth + 1, new Set([...ancestors, node.id]))
    }
  }
  visit(props.nodes, 0, new Set())
  return result
})
function toggle(id: string) { if (!props.disabled) emit('update:expanded', props.expanded.includes(id) ? props.expanded.filter(value => value !== id) : [...props.expanded, id]) }
</script>

<template>
  <section :aria-label="label">
    <BsStateSurface v-if="!rows.length" state="empty" :title="emptyLabel" />
    <ul v-else class="bs-hierarchy">
      <li v-for="{ node, depth } in rows" :key="node.id" :style="{ '--bs-tree-depth': depth }">
        <div class="bs-hierarchy__branch">
          <BsButton v-if="node.children?.length" variant="icon" :aria-label="`${expanded.includes(node.id) ? collapseLabel : expandLabel}: ${node.label}`" :aria-expanded="expanded.includes(node.id)" :disabled="disabled" @click="toggle(node.id)">
            <BsIcon :name="expanded.includes(node.id) ? 'arrowDown' : 'arrowRight'" directional />
          </BsButton>
          <span v-else class="bs-hierarchy__leaf" aria-hidden="true" />
          <div>
            <BsButton variant="link" :disabled="disabled" @click="emit('select', node)">{{ node.label }}</BsButton>
            <p v-if="node.description">{{ node.description }}</p>
          </div>
          <BsStatusBadge v-if="node.status" :status="node.status" :tone="node.tone" />
          <span v-if="node.meta" class="bs-hierarchy__meta">{{ node.meta }}</span>
          <slot name="actions" :node="node" />
        </div>
      </li>
    </ul>
  </section>
</template>
