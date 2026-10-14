<script setup lang="ts">
import type { BsImportIssue } from '@building-suit/contracts'
defineProps<{ title: string; summary: string; issues: BsImportIssue[]; tone?: 'info' | 'success' | 'warning' | 'error' }>()
</script>

<template>
  <BsStack gap="md">
    <BsAlert :title="title" :tone="tone || 'info'">{{ summary }}</BsAlert>
    <ul v-if="issues.length" class="bs-import-issues">
      <li v-for="issue in issues" :key="issue.id">
        <strong>{{ issue.message }}</strong>
        <p v-if="issue.detail">{{ issue.detail }}</p>
      </li>
    </ul>
  </BsStack>
</template>
