<script setup lang="ts">
import { useTagSelection } from '@building-suit/ux'
/** Product adapters commit emitted intent; assignment is never optimistic here. */
const props = defineProps<{ label: string; tags: Array<{ id: string; label: string }>; options: Array<{ id: string; label: string }>; addLabel: string; removeLabel: string; emptyLabel: string; loading?: boolean; error?: string | null; pending?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ add: [id: string]; remove: [id: string] }>()
const { selected, available } = useTagSelection(() => props.tags, () => props.options)
</script>
<template>
  <BsStack gap="sm" :aria-label="label" :aria-busy="loading || pending">
    <BsSectionSkeleton v-if="loading" variant="table" :rows="1" />
    <BsStateSurface v-else-if="error" state="error" :title="error" />
    <template v-else>
      <BsText v-if="!tags.length" tone="muted">{{ emptyLabel }}</BsText>
      <BsInline v-else gap="sm" wrap>
        <BsText v-for="tag in readonly ? tags : []" :key="tag.id">{{ tag.label }}</BsText>
        <BsButton v-for="tag in readonly ? [] : tags" :key="tag.id" variant="chip" :disabled="pending" :aria-label="`${removeLabel}: ${tag.label}`" @click="emit('remove', tag.id)">{{ tag.label }} ×</BsButton>
      </BsInline>
      <BsInline v-if="!readonly && available.length" gap="sm" wrap>
        <BsSelect v-model="selected" :label="label" :options="available" option-label="label" option-value="id" :disabled="pending" />
        <BsButton :disabled="pending || selected === null" @click="selected !== null && emit('add', String(selected))">{{ addLabel }}</BsButton>
      </BsInline>
    </template>
  </BsStack>
</template>
