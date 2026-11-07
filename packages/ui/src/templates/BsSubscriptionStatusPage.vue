<script setup lang="ts">
defineProps<{policyNavigation?:{label:string;links:{to:string;label:string}[]};
 copy:{title:string;description:string;notice:string;loading:string;retry:string;status:string;terms:string;unconfigured:string;paymentUnavailable:string;accept:string;start:string;account:string;continue:string;documentBody:string;documentUnavailable:string}
 paymentAction?:{label:string;to:string}
 additionalStatus?:{title:string;description:string;fields:{label:string;value:string}[];error:string|null;action?:{label:string;to:string}}|null
 document:{title:string;body:string}|null;loading:boolean;pending:boolean;ready:boolean;error:string|null;status:string;statusFields:{label:string;value:string}[];termsFields:{label:string;value:string}[];canStart:boolean;canContinue:boolean
}>()
const accepted=defineModel<boolean>('accepted',{default:false})
const emit=defineEmits<{retry:[];start:[]}>()
</script>
<template>
 <BsStack gap="lg">
  <BsPageHeader :title="copy.title" :subtitle="copy.description" />
  <BsAlert tone="info" :description="copy.notice" />
  <BsStateSurface v-if="loading" state="loading" :title="copy.loading" />
  <BsStateSurface v-else-if="error && !ready" state="error" :title="error" :action-label="copy.retry" @action="emit('retry')" />
  <template v-else>
   <BsAlert v-if="error" tone="error" :description="error" />
   <BsPanel padding="md"><BsStack gap="md"><BsHeading :level="2">{{ copy.status }}</BsHeading><BsText as="p" role="status">{{ status }}</BsText><BsDescriptionList><BsDescriptionItem v-for="field in statusFields" :key="field.label" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList></BsStack></BsPanel>
   <BsPanel padding="md"><BsStack gap="md"><BsHeading :level="2">{{ copy.terms }}</BsHeading><BsDescriptionList v-if="termsFields.length"><BsDescriptionItem v-for="field in termsFields" :key="field.label" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList><BsText v-else as="p">{{ copy.unconfigured }}</BsText><BsPanel v-if="document" padding="md"><BsStack><BsHeading :level="3">{{ document.title }}</BsHeading><BsText v-for="(paragraph,index) in document.body.split(/\n\s*\n/)" :key="index" as="p">{{ paragraph }}</BsText></BsStack></BsPanel><BsAlert v-else-if="termsFields.length" tone="info" :description="copy.documentUnavailable" /><BsCheckbox v-if="canStart" v-model="accepted" :label="copy.accept" :disabled="pending" /><BsButton v-if="canStart" :disabled="pending || !accepted" :pending="pending" @click="emit('start')">{{ copy.start }}</BsButton></BsStack></BsPanel>
   <BsAlert tone="info" :description="copy.paymentUnavailable" />
   <BsPanel v-if="additionalStatus" padding="md"><BsStack gap="md"><BsHeading :level="2">{{ additionalStatus.title }}</BsHeading><BsText as="p">{{ additionalStatus.description }}</BsText><BsAlert v-if="additionalStatus.error" tone="info" :description="additionalStatus.error" /><BsDescriptionList v-else><BsDescriptionItem v-for="field in additionalStatus.fields" :key="field.label" :term="field.label">{{ field.value }}</BsDescriptionItem></BsDescriptionList><BsLink v-if="additionalStatus.action" :to="additionalStatus.action.to">{{ additionalStatus.action.label }}</BsLink></BsStack></BsPanel>
  </template>
  <BsInline><BsLink v-if="paymentAction" :to="paymentAction.to">{{ paymentAction.label }}</BsLink><BsButton :disabled="pending || loading" @click="emit('retry')">{{ copy.retry }}</BsButton><BsLink v-if="canContinue" to="/onboarding">{{ copy.continue }}</BsLink><BsLink to="/account">{{ copy.account }}</BsLink></BsInline>
  <BsInline v-if="policyNavigation" as="nav" :aria-label="policyNavigation.label"><BsLink v-for="link in policyNavigation.links" :key="link.to" :to="link.to">{{ link.label }}</BsLink></BsInline>
 </BsStack>
</template>
