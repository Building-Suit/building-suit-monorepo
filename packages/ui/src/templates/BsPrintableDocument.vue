<script setup lang="ts">
defineProps<{ label: string; format?: 'receipt' | 'statement' }>()
</script>

<template>
  <article class="bs-printable-document" :data-format="format || 'statement'" :aria-label="label">
    <slot name="actions" />
    <div class="bs-printable-document__paper">
      <slot name="header" />
      <slot />
      <slot name="totals" />
      <footer v-if="$slots.footer">
        <slot name="footer" />
      </footer>
    </div>
  </article>
</template>
