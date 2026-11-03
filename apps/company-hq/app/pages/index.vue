<script setup lang="ts">
definePageMeta({ layout: false })
const hq = useCompanyHq()
const { t } = useI18n()
useHead({ title: 'Building Suit HQ', htmlAttrs: { dir: () => hq.locale.value === 'ar' ? 'rtl' : 'ltr', lang: () => hq.locale.value } })
</script>
<template><BsAgentOfficePage v-model:message-draft="hq.messageDraft.value" v-model:task-draft="hq.taskDraft.value" v-model:conversation-open="hq.conversationOpen.value" v-model:task-open="hq.taskOpen.value" :content="hq.content.value" :rooms="hq.rooms.value" :tasks="hq.tasks.value" :messages="hq.messages.value" :brain-notes="hq.brainNotes.value" :activity="hq.activity.value" :connection-label="hq.connectionLabel.value" :loading="hq.loading.value" :read-only="hq.readOnly.value" :pending="hq.pending.value" :error="hq.error.value" :message-error="hq.messageError.value" :task-error="hq.taskError.value" :account-label="hq.authenticated.value ? t('hq.signOut') : t('hq.signIn')" :language-label="t('hq.language')" :theme-label="t('hq.theme')" @account="hq.authenticated.value ? hq.signOut() : navigateTo('/auth/login')" @language="hq.setLocale(hq.locale.value === 'en' ? 'ar' : 'en')" @retry="hq.load" @send-message="hq.sendMessage" @create-task="hq.createTask" @approve-task="hq.approveTask" @cancel-task="hq.cancelTask" /></template>
