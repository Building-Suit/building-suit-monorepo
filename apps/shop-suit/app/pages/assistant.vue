<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: ['auth'] })
const { copy, view, draft, maximumLength, send, confirmExpense, discard, reset, authorize } = useShopAssistant()
</script>

<template>
  <BsAssistantChatPage
    v-model:draft="draft"
    :copy="copy"
    :view="view"
    :maximum-length="maximumLength"
    @send="send"
    @reset="reset"
    @confirm="confirmExpense"
    @discard="discard"
    @authorize="authorize"
  />
</template>
