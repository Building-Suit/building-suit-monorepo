<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  variant?: 'default' | 'flat' | 'plain'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}>(), { title: undefined, description: undefined, variant: 'default', padding: 'md' })
const slots = useSlots()
</script>

<template>
  <section v-if="variant === 'plain'" class="ls-content-section">
    <BsSectionHeader v-if="title || description || slots.actions" :title="title || ''" :description="description"><template v-if="slots.actions" #actions><slot name="actions" /></template></BsSectionHeader>
    <div :class="{ 'mt-4': title || description || slots.actions }"><slot /></div>
  </section>
  <BsCard v-else as="section" :variant="variant" :padding="padding">
    <BsSectionHeader v-if="title || description || slots.actions" :title="title || ''" :description="description"><template v-if="slots.actions" #actions><slot name="actions" /></template></BsSectionHeader>
    <div :class="{ 'mt-4': title || description || slots.actions }"><slot /></div>
  </BsCard>
</template>
