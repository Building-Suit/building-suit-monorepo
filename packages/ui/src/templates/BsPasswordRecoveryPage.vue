<script setup lang="ts">
const email = defineModel<string>('email', { default: '' })
const password = defineModel<string>('password', { default: '' })
const confirmation = defineModel<string>('confirmation', { default: '' })
defineProps<{
  mode: 'request' | 'reset'
  copy: { eyebrow: string; title: string; description: string; submit: string; pending: string; success: string; successDescription?: string; email?: string; emailPlaceholder?: string; password?: string; confirmation?: string; reveal?: string; invalid?: string; successAction?: string; invalidAction?: string; back?: string }
  pending?: boolean
  error?: string | null
  complete?: boolean
  valid?: boolean
  backTo?: string
}>()
const emit = defineEmits<{ submit: []; successAction: []; invalidAction: [] }>()
const visibility = usePasswordVisibility()
</script>
<template>
  <BsAuthForm :eyebrow="copy.eyebrow" :title="copy.title" :description="copy.description" :pending="pending" :error="error" :submit-label="complete || (mode === 'reset' && !valid) ? undefined : copy.submit" :pending-label="copy.pending" :novalidate="mode === 'request'" @submit="emit('submit')">
    <BsStateSurface v-if="complete" state="success" :title="copy.success" :description="copy.successDescription" :action-label="copy.successAction" @action="emit('successAction')" />
    <BsStateSurface v-else-if="mode === 'reset' && !valid" state="error" :title="copy.invalid ?? ' '" :action-label="copy.invalidAction" @action="emit('invalidAction')" />
    <BsField v-else-if="mode === 'request'" v-slot="field" :label="copy.email || ''" required><BsInput :id="field.id" v-model="email" type="email" autocomplete="email" required :placeholder="copy.emailPlaceholder" /></BsField>
    <template v-else>
      <BsField v-slot="field" :label="copy.password || ''"><BsInput :id="field.id" v-model="password" :type="visibility.inputType.value" autocomplete="new-password" /></BsField>
      <BsButton variant="link" :aria-label="copy.reveal" :aria-pressed="visibility.visible.value" @click="visibility.toggle"><BsIcon :name="visibility.visible.value ? 'eyeOff' : 'eye'" />{{ copy.reveal }}</BsButton>
      <BsField v-slot="field" :label="copy.confirmation || ''"><BsInput :id="field.id" v-model="confirmation" :type="visibility.inputType.value" autocomplete="new-password" /></BsField>
    </template>
    <template v-if="backTo && copy.back" #footer><BsLink :to="backTo" variant="standalone">{{ copy.back }}</BsLink></template>
  </BsAuthForm>
</template>
