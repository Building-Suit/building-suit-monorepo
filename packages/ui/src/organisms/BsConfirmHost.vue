<script setup lang="ts">
const { current, answer } = useConfirmation()
const ui = useUiCopy()
</script>
<template><BsDialog v-if="current" :visible="true" :title="current.title || ui('confirm')" size="sm" @update:visible="value => { if (!value) answer(false) }"><p>{{ current.message }}</p><template #footer><BsButton type="button" class="ls-btn" autofocus @click="answer(false)">{{ ui('cancel') }}</BsButton><BsButton type="button" class="ls-btn ls-btn-primary" @click="answer(true)">{{ ui('confirm') }}</BsButton></template></BsDialog></template>
