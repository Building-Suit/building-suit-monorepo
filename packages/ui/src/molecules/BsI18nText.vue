<script setup lang="ts">
withDefaults(defineProps<{ keypath: string; tag?: 'span' | 'p'; scope?: 'global' | 'parent' }>(), { tag: 'span', scope: 'parent' })
</script>

<template>
  <i18n-t :keypath="keypath" :tag="tag" :scope="scope">
    <template v-for="(_, name) in $slots" :key="name" #[name]><slot :name="name" /></template>
  </i18n-t>
</template>
