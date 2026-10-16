<script setup lang="ts">
import type { BsSignupForm, BsSignupFeatures, BsSignupView, BsSignupCopy, BsSignupVerificationCopy, BsSignupLegalConsent, BsSignupChoices, BsSignupLinks } from '../types/signupPresentation'
defineProps<{ draftAction?: string;  features: BsSignupFeatures; view: BsSignupView; copy: BsSignupCopy; verificationCopy: BsSignupVerificationCopy; choices: BsSignupChoices; links: BsSignupLinks; legalConsent: BsSignupLegalConsent | null }>()
const form = defineModel<BsSignupForm>('form', { required: true })
const otp = defineModel<string>('otp', { required: true })
const consent = defineModel<boolean>('consent', { required: true })
const emit = defineEmits<{ submit: []; back: []; verify: []; resend: []; startOver: []; signIn: []; clearDraft: []; saveDraft: [] }>()
function updateText(key: Exclude<keyof BsSignupForm, 'fiscalMonth'>, value: string | number | boolean | (string | number)[] | null | undefined) { if (Array.isArray(value)) return; form.value = { ...form.value, [key]: String(value ?? '') } }
</script>
<template>
  <BsAuthForm v-if="view.stage === 'recovery'" :eyebrow="copy.eyebrow || undefined" :title="copy.recoveryTitle" :description="copy.recoveryBody" :pending="view.pending" :error="view.error" :submit-label="copy.signIn" @submit="emit('signIn')">
    <BsLink :to="links.recoveryTo" @click="emit('clearDraft')">{{ copy.recover }}</BsLink>
    <BsButton type="button" variant="secondary" :disabled="view.pending || view.resendDisabled" @click="emit('resend')">{{ verificationCopy.resendLabel }}</BsButton>
    <template #footer><BsButton type="button" variant="link" :disabled="view.pending" @click="emit('startOver')">{{ copy.startOver }}</BsButton></template>
  </BsAuthForm>
  <BsAuthForm v-else-if="view.stage !== 'verification'" :eyebrow="copy.eyebrow || undefined" :title="copy.title" :description="copy.description" :pending="view.pending" :data-hydrated="view.hydrated" @submit="emit('submit')">
    <BsSignupWizard :step="view.step" :steps="copy.steps" :pending="view.pending" :error="view.error" :notice="view.notice" :back-label="copy.back || undefined" :submit-label="view.submitLabel" :pending-label="view.pendingLabel" :submit-disabled="view.submitDisabled" @back="emit('back')">
      <BsGrid v-if="view.stage === 'account'" :columns="2">
        <BsField v-slot="field" :label="copy.name" required><BsInput :id="field.id" :model-value="form.name" autocomplete="name" required @update:model-value="updateText('name', $event)" /></BsField>
        <BsField v-if="features.phone" v-slot="field" :label="copy.phone" required><BsInput :id="field.id" :model-value="form.phone" type="tel" autocomplete="tel" dir="ltr" required @update:model-value="updateText('phone', $event)" /></BsField>
        <BsField v-if="features.jobTitle" v-slot="field" :label="copy.jobTitle" required><BsInput :id="field.id" :model-value="form.jobTitle" required @update:model-value="updateText('jobTitle', $event)" /></BsField>
        <BsField v-slot="field" :label="copy.email" required><BsInput :id="field.id" :model-value="form.email" type="email" autocomplete="email" dir="ltr" :readonly="view.existingAccount" required @update:model-value="updateText('email', $event)" /></BsField>
        <BsField v-if="!view.existingAccount" v-slot="field" :label="copy.password" :hint="copy.passwordHint || undefined" required><BsInput :id="field.id" :model-value="form.password" type="password" autocomplete="new-password" dir="ltr" :minlength="features.passwordMinLength" required @update:model-value="updateText('password', $event)" /></BsField>
      </BsGrid>
      <BsStack v-else>
        <BsGrid :columns="2">
          <BsField v-if="features.profileName" v-slot="field" :label="copy.name" required><BsInput :id="field.id" :model-value="form.name" autocomplete="name" required :maxlength="features.profileNameMaxLength" @update:model-value="updateText('name', $event)" /></BsField>
          <BsField v-if="features.standaloneTimezone && !features.organizationDetails" v-slot="field" :label="copy.timezone" required><BsInput :id="field.id" :model-value="form.timezone" dir="ltr" required @update:model-value="updateText('timezone', $event)" /></BsField>
          <BsField v-slot="field" :label="copy.workspaceName" required><BsInput :id="field.id" :model-value="form.workspaceName" :minlength="features.workspaceMinLength ?? undefined" :maxlength="features.workspaceMaxLength ?? undefined" required @update:model-value="updateText('workspaceName', $event)" /></BsField>
          <template v-if="features.organizationDetails">
            <BsField v-slot="field" :label="copy.legalName" required><BsInput :id="field.id" :model-value="form.legalName" required @update:model-value="updateText('legalName', $event)" /></BsField>
            <BsField :label="copy.businessType"><BsSelect :model-value="form.businessType" :label="copy.businessType" :options="choices.businessTypes" option-label="label" option-value="value" @update:model-value="updateText('businessType', $event)" /></BsField>
            <BsField :label="copy.country"><BsSelect :model-value="form.country" :label="copy.country" :options="choices.countries" option-label="label" option-value="value" @update:model-value="updateText('country', $event)" /></BsField>
            <BsField :label="copy.currency"><BsSelect :model-value="form.currency" :label="copy.currency" :options="choices.currencies" option-label="label" option-value="value" @update:model-value="updateText('currency', $event)" /></BsField>
            <BsField v-slot="field" :label="copy.timezone" required><BsInput :id="field.id" :model-value="form.timezone" dir="ltr" required @update:model-value="updateText('timezone', $event)" /></BsField>
            <BsField :label="copy.fiscalMonth"><BsSelect :model-value="form.fiscalMonth" :label="copy.fiscalMonth" :options="choices.fiscalMonths" option-label="label" option-value="value" @update:model-value="form = { ...form, fiscalMonth: Number($event) }" /></BsField>
            <BsField v-slot="field" :label="copy.taxIdentifier" :hint="copy.optional"><BsInput :id="field.id" :model-value="form.taxIdentifier" @update:model-value="updateText('taxIdentifier', $event)" /></BsField>
          </template>
        </BsGrid>
        <BsFieldGroup v-if="features.mainLocation" :legend="copy.mainLocation" layout="grid" :columns="2">
          <BsField v-slot="field" :label="copy.locationName" required><BsInput :id="field.id" :model-value="form.locationName" :minlength="features.locationMinLength ?? undefined" :maxlength="features.locationMaxLength ?? undefined" required @update:model-value="updateText('locationName', $event)" /></BsField>
          <BsField v-if="features.locationContactFields !== false" v-slot="field" :label="copy.locationCode"><BsInput :id="field.id" :model-value="form.locationCode" :maxlength="features.locationCodeMaxLength ?? undefined" @update:model-value="updateText('locationCode', $event)" /></BsField>
          <BsField v-if="features.locationContactFields !== false" v-slot="field" :label="copy.locationAddress"><BsInput :id="field.id" :model-value="form.locationAddress" :maxlength="features.locationAddressMaxLength ?? undefined" @update:model-value="updateText('locationAddress', $event)" /></BsField>
          <BsField v-if="features.locationContactFields !== false" v-slot="field" :label="copy.locationPhone"><BsInput :id="field.id" :model-value="form.locationPhone" :maxlength="features.locationPhoneMaxLength ?? undefined" dir="auto" @update:model-value="updateText('locationPhone', $event)" /></BsField>
        </BsFieldGroup>
        <BsAlert v-if="copy.trialTitle" tone="info" :title="copy.trialTitle" :description="copy.trialBody" />
        <BsChoiceGroup v-if="features.businessMode" :model-value="form.businessMode" type="radio" name="signup-business-mode" :legend="copy.businessMode" :description="copy.businessModeHelp" :options="choices.businessModes" @update:model-value="updateText('businessMode', $event)" />
        <BsLegalConsent v-if="legalConsent" v-model="consent" :keypath="legalConsent.keypath" :terms-label="legalConsent.termsLabel" :terms-to="legalConsent.termsTo" :refund-label="legalConsent.refundLabel" :refund-to="legalConsent.refundTo" :privacy-label="legalConsent.privacyLabel" :privacy-to="legalConsent.privacyTo" required />
      </BsStack>
      <template v-if="view.stage === 'workspace' && (copy.formFooter || draftAction)" #footer><BsText v-if="copy.formFooter">{{ copy.formFooter }}</BsText><BsButton v-if="draftAction" type="button" variant="secondary" :disabled="view.pending" @click="emit('saveDraft')">{{ draftAction }}</BsButton></template>
    </BsSignupWizard>
    <template v-if="links.formSignInLabel" #footer><BsLink :to="links.signInTo">{{ links.formSignInLabel }}</BsLink></template>
  </BsAuthForm>
  <BsVerificationForm v-else v-model="otp" :data-hydrated="view.hydrated" :eyebrow="verificationCopy.eyebrow" :title="verificationCopy.title" :description="verificationCopy.description" :email="form.email" :code-label="verificationCopy.codeLabel" :pending="view.pending" :error="view.error" :notice="view.notice" :expired="view.expired" :verified="view.verified" :expiry-label="verificationCopy.expiryLabel" :expired-label="verificationCopy.expiredLabel" :attempts-label="verificationCopy.attemptsLabel" :submit-label="verificationCopy.submitLabel" :pending-label="verificationCopy.pendingLabel" :resend-prompt="verificationCopy.resendPrompt" :resend-label="verificationCopy.resendLabel" :resend-disabled="view.resendDisabled" :security-title="verificationCopy.securityTitle" :security-body="verificationCopy.securityBody" @submit="emit('verify')" @resend="emit('resend')">
    <template v-if="view.canStartOver" #secondary><BsButton variant="link" type="button" :disabled="view.pending" @click="emit('startOver')">{{ copy.startOver }}</BsButton></template>
    <template v-if="links.verificationFooter" #footer><BsLink :to="links.signInTo" variant="standalone" @click="emit('clearDraft')">{{ copy.signIn }}</BsLink> · <BsLink :to="links.recoveryTo" @click="emit('clearDraft')">{{ copy.recover }}</BsLink></template>
  </BsVerificationForm>
</template>
