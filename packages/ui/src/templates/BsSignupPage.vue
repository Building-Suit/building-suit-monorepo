<script setup lang="ts">
import type { BsSignupForm, BsSignupProduct, BsSignupFeatures, BsSignupView, BsSignupCopy, BsSignupVerificationCopy, BsSignupLegalConsent, BsSignupChoices, BsSignupLinks } from '../types/signupPresentation'
defineProps<{ draftAction?: string;  availability?: { state: 'loading' | 'error' | 'permission'; title: string; description: string };  product: BsSignupProduct; features: BsSignupFeatures; view: BsSignupView; copy: BsSignupCopy; verificationCopy: BsSignupVerificationCopy; choices: BsSignupChoices; links: BsSignupLinks; legalConsent: BsSignupLegalConsent | null }>()
const form = defineModel<BsSignupForm>('form', { required: true })
const otp = defineModel<string>('otp', { required: true })
const consent = defineModel<boolean>('consent', { required: true })
const emit = defineEmits<{ submit: []; back: []; verify: []; resend: []; startOver: []; signIn: []; clearDraft: []; saveDraft: [] }>()
</script>
<template>
  <BsAuthLayout v-if="product.framed" :product-name="product.name" :home-label="product.homeLabel" :title="product.title" :description="product.description" wide>
    <template #logo="{ tone }"><BsProductLogo :name="product.name" :asset-prefix="product.assetPrefix" :tone="tone" size="auth" /></template>
    <BsStateSurface v-if="availability" :title-level="1" :state="availability.state" :title="availability.title" :description="availability.description" />
    <BsSignupEnrollment v-else v-model:form="form" v-model:otp="otp" v-model:consent="consent" :draft-action="draftAction" :features="features" :view="view" :copy="copy" :verification-copy="verificationCopy" :choices="choices" :links="links" :legal-consent="legalConsent" @save-draft="emit('saveDraft')" @submit="emit('submit')" @back="emit('back')" @verify="emit('verify')" @resend="emit('resend')" @start-over="emit('startOver')" @sign-in="emit('signIn')" @clear-draft="emit('clearDraft')" />
    <template v-if="links.legal.length" #legal><BsInline justify="center"><template v-for="(link, index) in links.legal" :key="link.to"><BsText v-if="index" tone="muted">·</BsText><BsLink :to="link.to">{{ link.label }}</BsLink></template></BsInline></template>
  </BsAuthLayout>
  <BsStateSurface v-else-if="availability" :title-level="1" :state="availability.state" :title="availability.title" :description="availability.description" />
  <BsSignupEnrollment v-else v-model:form="form" v-model:otp="otp" v-model:consent="consent" :draft-action="draftAction" :features="features" :view="view" :copy="copy" :verification-copy="verificationCopy" :choices="choices" :links="links" :legal-consent="legalConsent" @save-draft="emit('saveDraft')" @submit="emit('submit')" @back="emit('back')" @verify="emit('verify')" @resend="emit('resend')" @start-over="emit('startOver')" @sign-in="emit('signIn')" @clear-draft="emit('clearDraft')" />
</template>
