<script setup lang="ts">
const { current, answer } = useConfirmation()
const ui = useUiCopy()
</script>
<template>
  <BsDialog
    v-if="current"
    :visible="true"
    :title="current.title || ui('confirm')"
    size="sm"
    @update:visible="value => { if (!value) answer(false) }"
  >
    <p>{{ current.message }}</p>
    <template #footer>
      <BsButton type="button" autofocus @click="answer(false)">{{ current.cancelLabel || ui('cancel') }}</BsButton>
      <BsButton type="button" :variant="current.tone === 'danger' ? 'danger' : 'primary'" @click="answer(true)">
        {{ current.confirmLabel || ui('confirm') }}
      </BsButton>
    </template>
  </BsDialog>
</template>
