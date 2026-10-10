<script setup lang="ts">
withDefaults(defineProps<{ code?: string; language?: string; label?: string; wrap?: boolean; scroll?: boolean }>(), {
  code: undefined, language: undefined, label: undefined, wrap: false, scroll: true,
})
</script>

<template><figure class="bs-code-block"><figcaption v-if="label">{{ label }}</figcaption><pre :class="[{ 'bs-code-block--wrap': wrap, 'bs-code-block--scroll': scroll }]" :aria-label="label"><code :data-language="language">{{ code }}<slot /></code></pre></figure></template>
