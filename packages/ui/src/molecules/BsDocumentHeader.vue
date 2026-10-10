<script setup lang="ts">
defineProps<{ title: string; issuer: string; reference?: string; date?: string; details?: string[] }>()
</script>

<template>
  <header class="bs-document-header">
    <div>
      <h1>{{ title }}</h1>
      <p>{{ issuer }}</p>
      <p v-for="(detail, index) in details" :key="index">{{ detail }}</p>
    </div>
    <div>
      <p v-if="reference" dir="auto">{{ reference }}</p>
      <p v-if="date">{{ date }}</p>
    </div>
    <slot />
  </header>
</template>
