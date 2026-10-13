<script setup lang="ts">
import type { SupportRequestCopy, SupportRequestValue } from '@building-suit/contracts'
const model = defineModel<SupportRequestValue>({ required: true })
defineProps<{ copy: SupportRequestCopy; categories: Array<{ value: string; label: string }>; pending?: boolean; error?: string | null; sent?: boolean }>()
defineEmits<{ submit: [event: Event] }>()
</script>
<template>
  <BsForm class="bs-support-request" :pending="pending" :error="error" novalidate @submit="$emit('submit', $event)">
    <header class="bs-support-request__header"><h2>{{ copy.title }}</h2><p>{{ copy.intro }}</p></header>
    <div class="bs-support-request__row">
      <BsField :label="copy.category" required><template #default="field"><BsSelect v-model="model.category" :label="copy.category" :options="categories" option-label="label" option-value="value" :required="field.required" /></template></BsField>
      <BsField :label="copy.replyEmail" required><template #default="field"><BsInput :id="field.id" v-model="model.email" type="email" required autocomplete="email" :aria-describedby="field.describedby" /></template></BsField>
    </div>
    <BsField :label="copy.subject" required><template #default="field"><BsInput :id="field.id" v-model="model.subject" :maxlength="200" required :aria-describedby="field.describedby" /></template></BsField>
    <BsField :label="copy.message" required><template #default="field"><BsTextarea :id="field.id" v-model="model.message" :rows="6" :maxlength="10000" required :aria-describedby="field.describedby" /></template></BsField>
    <label class="bs-support-request__honeypot" aria-hidden="true"><span>{{ copy.website }}</span><input v-model="model.honeypot" tabindex="-1" autocomplete="off"></label>
    <BsCheckbox v-model="model.consent" :label="copy.consent" required />
    <p v-if="sent" role="status" class="bs-support-request__success">{{ copy.success }}</p>
    <BsButton class="bs-support-request__submit" type="submit" variant="primary" :pending="pending">{{ pending ? copy.pending : copy.submit }}</BsButton>
  </BsForm>
</template>
<style>
.bs-support-request { display: grid; gap: var(--bs-space-4); padding: var(--bs-space-6); }.bs-support-request__header h2 { font-size: 1.25rem; font-weight: var(--bs-weight-extrabold); }.bs-support-request__header p { margin-top: var(--bs-space-2); color: var(--bs-text-muted); font-size: var(--bs-type-body-m-size); }.bs-support-request__row { display: grid; gap: var(--bs-space-4); }.bs-support-request__honeypot { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }.bs-support-request__success { color: var(--bs-status-success); font-size: var(--bs-type-body-m-size); }.bs-support-request__submit { width: fit-content; }@media (min-width: 640px) { .bs-support-request { padding: var(--bs-space-8) var(--bs-space-9); } }@media (min-width: 768px) { .bs-support-request__row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
