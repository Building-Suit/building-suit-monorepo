<script setup lang="ts">
import type { BsInvitationIdentityForm, BsInvitationPageCopy } from '../types/invitationPresentation'
const form = defineModel<BsInvitationIdentityForm>('form', { required: true })
const code = defineModel<string>('code', { required: true })
withDefaults(defineProps<{
  product: { name: string; assetPrefix?: string; homeLabel: string; title: string; description: string }
  stage: 'loading' | 'invalid' | 'verification' | 'ready' | 'profile' | 'signup' | 'accept' | 'unavailable'
  copy: BsInvitationPageCopy
  email: string
  pending: boolean
  error: string
  submitDisabled: boolean
  emailMaxLength?: number
  acceptanceCode?: { label: string; hint: string; maxLength: number }
  loginTo: string | { path: string; query: { invite: string } }
  recoverTo?: string
  verification: { resendDisabled: boolean; expired?: boolean; notice?: string }
}>(), { acceptanceCode: undefined, emailMaxLength: undefined, recoverTo: undefined })
const emit = defineEmits<{ submit: []; verify: []; resend: []; login: []; switchAccount: [] }>()
const ready = useClientReady()
function change<K extends keyof BsInvitationIdentityForm>(key: K, value: BsInvitationIdentityForm[K]) { form.value = { ...form.value, [key]: value } }
</script>
<template>
  <BsProductAuthFrame :product="product">
    <BsSectionSkeleton v-if="stage === 'loading'" variant="table" :rows="4" />
    <BsAuthForm v-else-if="stage === 'invalid'" :title="copy.invalid" :data-hydrated="ready" :submit-label="copy.backToLogin" @submit="emit('login')"><BsStateSurface state="error" :title="copy.invalid" /></BsAuthForm>
    <BsVerificationForm v-else-if="stage === 'verification'" v-model="code" :eyebrow="copy.verification.eyebrow" :title="copy.verification.title" :description="copy.verification.description" :email="email" :code-label="copy.verification.code" :pending="pending" :error="error" :notice="verification.notice" :submit-label="copy.verification.submit" :pending-label="copy.verification.pending" :resend-label="copy.verification.resend" :resend-disabled="verification.resendDisabled" :expired="verification.expired" :expiry-label="copy.verification.expiry" :expired-label="copy.verification.expired" :security-body="copy.verification.security" @submit="emit('verify')" @resend="emit('resend')"><template v-if="copy.login" #secondary><BsLink :to="loginTo">{{ copy.login }}</BsLink></template></BsVerificationForm>
    <BsAuthForm v-else :eyebrow="copy.eyebrow" :title="copy.title" :description="copy.description" :pending="pending" :error="error" :submit-disabled="submitDisabled" :submit-label="copy.submit" :pending-label="copy.pending" :data-hydrated="ready" @submit="emit('submit')">
      <template v-if="stage === 'signup'">
        <BsField v-slot="field" :label="copy.email"><BsInput :id="field.id" :model-value="form.email" type="email" autocomplete="email" required :maxlength="emailMaxLength" @update:model-value="change('email', String($event))" /></BsField>
        <BsField v-slot="field" :label="copy.password"><BsInput :id="field.id" :model-value="form.password" type="password" autocomplete="new-password" required minlength="8" @update:model-value="change('password', String($event))" /></BsField>
      </template>
      <template v-else-if="stage === 'accept'"><BsField v-if="acceptanceCode" v-slot="field" :label="acceptanceCode.label" :hint="acceptanceCode.hint"><BsInput :id="field.id" v-model="code" type="password" autocomplete="off" :disabled="pending" :maxlength="acceptanceCode.maxLength" :aria-describedby="field.describedby" required /></BsField><BsText size="sm">{{ email }}</BsText><BsButton v-if="copy.switchAccount" variant="secondary" :disabled="pending" @click="emit('switchAccount')">{{ copy.switchAccount }}</BsButton></template>
      <template v-else-if="stage === 'ready' || stage === 'profile'">
        <BsField v-slot="field" :label="copy.email"><BsInput :id="field.id" :model-value="email" type="email" readonly dir="ltr" aria-readonly="true" /></BsField>
        <template v-if="stage === 'profile'">
          <BsField v-slot="field" :label="copy.name ?? ''" required><BsInput :id="field.id" :model-value="form.name" type="text" autocomplete="name" required @update:model-value="change('name', String($event))" /></BsField>
          <BsField v-slot="field" :label="copy.phone ?? ''" required><BsInput :id="field.id" :model-value="form.phone" type="tel" autocomplete="tel" required dir="ltr" @update:model-value="change('phone', String($event))" /></BsField>
          <BsField v-slot="field" :label="copy.jobTitle ?? ''" required><BsInput :id="field.id" :model-value="form.jobTitle" type="text" autocomplete="organization-title" required @update:model-value="change('jobTitle', String($event))" /></BsField>
          <BsField v-slot="field" :label="copy.password" required><BsInput :id="field.id" :model-value="form.password" type="password" :minlength="8" autocomplete="new-password" required dir="ltr" @update:model-value="change('password', String($event))" /></BsField>
          <BsField v-slot="field" :label="copy.confirmation ?? ''" required><BsInput :id="field.id" :model-value="form.confirmation" type="password" :minlength="8" autocomplete="new-password" required dir="ltr" @update:model-value="change('confirmation', String($event))" /></BsField>
        </template>
      </template>
      <BsAlert v-if="copy.security" tone="success" :description="copy.security" />
      <template v-if="copy.login || copy.recover" #footer><BsStack gap="sm"><BsLink v-if="copy.login" :to="loginTo">{{ copy.login }}</BsLink><BsLink v-if="copy.recover && recoverTo" :to="recoverTo">{{ copy.recover }}</BsLink></BsStack></template>
    </BsAuthForm>
  </BsProductAuthFrame>
</template>
