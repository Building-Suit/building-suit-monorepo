<script setup lang="ts">
const props = defineProps<{ title: string; description: string; logoSrc: string; logoAlt: string; passwordLabel: string; submitLabel: string; pending?: boolean; error?: string | null }>()
const password = defineModel<string>('password', { default: '' })
const emit = defineEmits<{ submit: [] }>()
const id = useId()
</script>
<template>
  <main class="bs-workspace-access">
    <NuxtLink to="/"><img :src="props.logoSrc" :alt="props.logoAlt"></NuxtLink>
    <h1>{{ title }}</h1><p>{{ description }}</p>
    <BsForm :pending="pending" :error="error" @submit="emit('submit')">
      <BsField :for="id" :label="passwordLabel" required><BsInput :id="id" v-model="password" type="password" autocomplete="current-password" required :maxlength="512" /></BsField>
      <BsButton type="submit" variant="primary" :pending="pending">{{ submitLabel }}</BsButton>
    </BsForm>
  </main>
</template>
<style scoped>
.bs-workspace-access { max-inline-size: 30rem; margin: 10dvh auto; padding: var(--bs-space-6); }
.bs-workspace-access img { block-size: 5rem; inline-size: auto; }
.bs-workspace-access h1 { font-size: var(--bs-type-h1-size); margin-block: var(--bs-space-4); }
.bs-workspace-access p { margin-block-end: var(--bs-space-4); }
</style>
