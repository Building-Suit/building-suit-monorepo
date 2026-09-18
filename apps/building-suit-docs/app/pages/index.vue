<script setup lang="ts">
import documents from '../generated/documents.json'
const search = ref('')
const { locale } = useI18n()
const filtered = computed(() => documents.filter(document => `${document.title} ${document.text}`.toLowerCase().includes(search.value.toLowerCase())))
useHead({ title: 'Building Suit documentation' })
</script>
<template><section class="space-y-6"><h1 class="text-3xl font-black">{{ locale === 'ar' ? 'مستندات Building Suit' : 'Building Suit documentation' }}</h1><p class="text-fg-muted">{{ locale === 'ar' ? 'مواصفات المنتجات والمعمارية والهوية ونظام التصميم.' : 'Product requirements, architecture, brand rules and the shared design system.' }}</p><InputText v-model="search" type="search" class="ls-input" :aria-label="locale === 'ar' ? 'بحث في المستندات' : 'Search documents'" :placeholder="locale === 'ar' ? 'بحث في المستندات' : 'Search documents'" /><p class="text-sm text-fg-muted">{{ filtered.length }} / {{ documents.length }}</p><ul class="grid gap-3"><li v-for="document in filtered" :key="document.id" class="ls-card p-4"><NuxtLink :to="`/documents/${document.id.split('/').map(encodeURIComponent).join('/')}`" class="font-bold text-link">{{ document.title }}</NuxtLink><p class="mt-1 break-all text-xs text-fg-muted" dir="ltr">{{ document.sourcePath }}</p></li></ul></section></template>
