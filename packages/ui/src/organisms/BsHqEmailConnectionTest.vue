<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HqEmailConnectionCommand, HqEmailConnectionPresentation } from '../types/hqEmailConnection'
const props = defineProps<{ state: HqEmailConnectionPresentation }>()
const emit = defineEmits<{ command: [command: HqEmailConnectionCommand] }>()
const recipient = ref(''), subject = ref(''), body = ref(''), existingId = ref('')
const validId = computed(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingId.value))
const valid = computed(() => Boolean(recipient.value && subject.value && body.value))
function prepare() {
  if (!valid.value || props.state.pending) return
  emit('command', { action: 'prepare', recipient: recipient.value, subject: subject.value, body: body.value })
}
function decide(approve: boolean) {
  const test = props.state.test
  if (!test || props.state.pending || !props.state.approvalAvailable) return
  emit('command', { action: 'decide', id: test.id, digest: test.digest, approve })
}
</script>
<template>
  <section aria-label="Resend connection test">
    <h3>Resend connection test</h3>
    <p>Dina (AG-EMAIL-002) · Supervisor: Youssef (AG-EMAIL-001)</p>
    <p>Founder-approved test only. No unapproved emails, campaigns or customer outreach. A successful test does not grant general sending permission.</p>
    <BsButton :disabled="state.pending" @click="emit('command', { action: 'refresh' })">Refresh email connection</BsButton>
    <BsField v-slot="field" label="Existing test ID (optional recovery)"><BsInput :id="field.id" v-model="existingId" maxlength="36" :disabled="state.pending" :aria-describedby="field.describedby" /></BsField>
    <BsButton :disabled="state.pending || !validId" @click="emit('command', { action: 'refresh', id: existingId })">Load existing test</BsButton>
    <p v-if="!state.readiness" role="status">Connection status not checked.</p>
    <template v-else>
      <p role="status">{{ state.readiness.configured ? 'Host credential configured' : 'Host credential not confirmed' }} · {{ state.readiness.providerTested ? 'Earlier provider test accepted' : 'Provider test not completed' }}</p>
      <p>Configuration is a recent host observation, not verification of the credential scope. Provider acceptance is not inbox delivery.</p>
      <p>Sender: <bdi>{{ state.readiness.sender }}</bdi></p>
    </template>
    <p v-if="state.message" role="status">{{ state.message }}</p>
    <form @submit.prevent="prepare">
      <BsField v-slot="field" label="Exact test recipient" required><BsInput :id="field.id" v-model="recipient" type="email" maxlength="254" required :disabled="state.pending" :aria-describedby="field.describedby" /></BsField>
      <BsField v-slot="field" label="Exact subject" required><BsInput :id="field.id" v-model="subject" maxlength="200" required :disabled="state.pending" :aria-describedby="field.describedby" /></BsField>
      <BsField v-slot="field" label="Exact plain-text message" required><BsTextarea :id="field.id" v-model="body" maxlength="8000" required :disabled="state.pending" :aria-describedby="field.describedby" /></BsField>
      <BsButton type="submit" :disabled="state.pending || !valid">Prepare preview only</BsButton>
    </form>
    <section v-if="state.test" aria-label="Exact email approval preview">
      <h4>Review this immutable message</h4>
      <dl>
        <dt>From</dt><dd><bdi>{{ state.test.sender }}</bdi></dd>
        <dt>To</dt><dd><bdi>{{ state.test.recipient }}</bdi></dd>
        <dt>Subject</dt><dd dir="auto">{{ state.test.subject }}</dd>
        <dt>Message</dt><dd class="bs-hq-email-test__body" dir="auto">{{ state.test.body }}</dd>
        <dt>State</dt><dd>{{ state.test.state }}</dd>
        <dt>Approval expires</dt><dd>{{ state.test.expiresAt }}</dd>
        <dt>Test ID</dt><dd><bdi>{{ state.test.id }}</bdi></dd>
      </dl>
      <p>Approval wakes the existing Oracle worker to attempt exactly this one test email after its current jobs settle. Changes in the form above do not change this preview. Prepare a new preview to approve different content.</p>
      <BsButton :disabled="state.pending || !state.approvalAvailable || state.test.state !== 'prepared'" @click="decide(true)">Approve this exact test email</BsButton>
      <BsButton :disabled="state.pending || !state.approvalAvailable" @click="decide(false)">Revoke this test approval</BsButton>
      <p v-if="state.test.state === 'approved'">Approved; awaiting the Oracle worker to attempt this exact approved email. No email has been confirmed sent.</p>
      <p v-if="state.test.state === 'reserved' || state.test.state === 'uncertain'">Outcome requires reconciliation. Do not prepare a replacement or resend.</p>
      <p v-if="state.test.providerAccepted">Provider accepted this message. Inbox delivery is not confirmed.</p>
    </section>
  </section>
</template>
<style scoped>
.bs-hq-email-test__body { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
