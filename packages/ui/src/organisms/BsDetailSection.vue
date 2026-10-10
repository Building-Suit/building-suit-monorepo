<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; columns?: 1 | 2 | 3; density?: 'compact' | 'comfortable'; divided?: boolean }>(), { description: undefined, columns: 1, density: 'comfortable', divided: false })
</script>

<template>
  <BsContentSection :title="title" :description="description" variant="flat">
    <BsDescriptionList :columns="columns" :density="density" :divided="divided"><slot /></BsDescriptionList>
  </BsContentSection>
</template>
