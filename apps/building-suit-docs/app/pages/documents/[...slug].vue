<script setup lang="ts">
import documents from '../../generated/documents.json'
const route = useRoute()
const document = computed(() => { const id = Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug; return documents.find(item => item.id === id) })
if (!document.value) throw createError({ statusCode: 404, statusMessage: 'Document not found' })
useHead(() => ({ title: `${document.value?.title} · Building Suit` }))
</script>
<template><section v-if="document" class="space-y-6"><NuxtLink to="/" class="text-link">← Building Suit</NuxtLink><p class="break-all text-xs text-fg-muted" dir="ltr">{{ document.sourcePath }}</p>
<!-- Generated only from repository Markdown; raw HTML is disabled by the generator. -->
<!-- eslint-disable-next-line vue/no-v-html -->
<article class="bs-document" :dir="document.arabic ? 'rtl' : undefined" v-html="document.html" /></section></template>
<style>
.bs-document { overflow-wrap: anywhere; line-height: 1.8; }
.bs-document h1 { font-size: 2rem; font-weight: 800; margin: 1.5rem 0; }
.bs-document h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; }
.bs-document h3 { font-size: 1.2rem; font-weight: 700; margin: 1.5rem 0 .75rem; }
.bs-document p, .bs-document ul, .bs-document ol, .bs-document pre { margin: 1rem 0; }
.bs-document ul { list-style: disc; padding-inline-start: 1.5rem; }
.bs-document ol { list-style: decimal; padding-inline-start: 1.5rem; }
.bs-document a { color: var(--bs-link); text-decoration: underline; }
.bs-document pre { overflow-x: auto; padding: 1rem; background: var(--bs-surface-muted); border-radius: var(--bs-radius-card); }
.bs-document table { display: block; overflow-x: auto; border-collapse: collapse; }
.bs-document th, .bs-document td { padding: .75rem; border: 1px solid var(--bs-border); text-align: start; }
.bs-document img { max-width: 100%; }
.bs-document blockquote { padding-inline-start: 1rem; border-inline-start: 3px solid var(--bs-accent); color: var(--bs-text-muted); }
</style>
