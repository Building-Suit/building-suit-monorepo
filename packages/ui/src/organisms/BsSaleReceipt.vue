<script setup lang="ts">
import { computed } from 'vue'
import type { BsReceiptView, BsReceiptDocumentCopy } from '../types/receiptPresentation'
import { renderReceiptDocument } from '../utils/receiptDocument'
const props = defineProps<{ receipt: BsReceiptView; copy: BsReceiptDocumentCopy; language: string; printed: boolean }>()
const markup = computed(() => renderReceiptDocument(props.receipt, props.copy, props.language, props.printed))
</script>
<template>
  <!-- All values are escaped by the shared receipt renderer. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-html="markup" />
</template>
