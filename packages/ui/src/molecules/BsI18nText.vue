<script setup lang="ts">
withDefaults(defineProps<{ keypath: string; tag?: 'span' | 'p'; scope?: 'global' | 'parent' }>(), { tag: 'span', scope: 'parent' })
</script>

<template><i18n-t :keypath="keypath" :tag="tag" :scope="scope"><slot /></i18n-t></template>
