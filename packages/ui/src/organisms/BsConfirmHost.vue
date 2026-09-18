<script setup lang="ts">
const { current, answer } = useConfirmation()
const ui = useUiCopy()
</script>
<template><BsDialog v-if="current" :visible="true" :title="current.title || ui('confirm')" size="sm" @update:visible="value => { if (!value) answer(false) }"><p>{{ current.message }}</p><template #footer><button type="button" class="ls-btn" @click="answer(false)">{{ ui('cancel') }}</button><button type="button" class="ls-btn ls-btn-primary" @click="answer(true)">{{ ui('confirm') }}</button></template></BsDialog></template>
