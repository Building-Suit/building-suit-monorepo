<script setup lang="ts">
definePageMeta({ layout: false })
const { copy, product, availability } = useDoctorAuthPresentation()
const registration = useDoctorRegistration()
const { form, otp, consent, features, view, signupCopy, verificationCopy, submit, verify, resend, startOver, back, clearSecrets } = registration
</script>
<template>
  <BsSignupPage v-model:form="form" v-model:otp="otp" v-model:consent="consent" :product="{ ...product, framed: true }" :features="features" :view="view" :copy="signupCopy" :verification-copy="verificationCopy" :availability="registration.availability.value || availability" :choices="{ businessTypes: [], countries: [], currencies: [], fiscalMonths: [], businessModes: [] }" :links="{ signInTo: '/sign-in', recoveryTo: '/recover', formSignInLabel: copy.signIn, verificationFooter: true, legal: [] }" :legal-consent="null" @retry="registration.retryIdentity()" @back="back" @submit="submit" @verify="verify" @resend="resend" @start-over="startOver" @sign-in="navigateTo('/sign-in')" @clear-draft="clearSecrets" />
</template>
