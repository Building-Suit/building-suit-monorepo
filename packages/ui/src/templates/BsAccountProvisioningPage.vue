<script setup lang="ts">
interface Form {email:string;displayName:string;shopName:string;mainLocationName:string;businessMode:string|null;planId:string|null;reason:string}
interface View {
 state:string;loading:boolean;failed:boolean;configured:boolean;uncertain:boolean;
 projection:{email:string;provisioningId:string;ownerVerified:boolean;phase:'reserved'|'active'|'conflict'|'review_required';phaseLabel:string;invitationLabel:string;startLabel:string;endLabel:string}|null;
 attempt:{kind:'create'|'resend';input:{requestId:string}}|null;resend:boolean;valid:boolean;dirty:boolean;pending:boolean;error:string|null;
 planOptions:{value:string;label:string}[];modeOptions:{value:string;label:string}[];
}
const props = defineProps<{ copy: Record<'accounts.close' | 'accounts.end' | 'accounts.keepRequest' | 'accounts.loading' | 'accounts.noPayment' | 'accounts.none' | 'accounts.open' | 'accounts.plan' | 'accounts.reason' | 'accounts.request' | 'accounts.retrySame' | 'accounts.start' | 'accounts.unavailable' | 'auth.denied' | 'auth.retry' | 'product.name' | 'provision.acknowledge' | 'provision.awaitingOwner' | 'provision.confirm' | 'provision.consequences' | 'provision.create' | 'provision.description' | 'provision.email' | 'provision.existing' | 'provision.invitation' | 'provision.location' | 'provision.mode' | 'provision.noActivation' | 'provision.ownerName' | 'provision.record' | 'provision.refresh' | 'provision.resend' | 'provision.resendConsequences' | 'provision.resendWarning' | 'provision.shopName' | 'provision.startsNow' | 'provision.title' | 'provision.unconfigured' | 'provision.unknown' | 'provision.verification' | 'provision.verified', string>; view: View }>()
const { copy } = toRefs(props)
const form=defineModel<Form>('form',{required:true})
const visible=defineModel<boolean>('visible',{required:true})
const acknowledged=defineModel<boolean>('acknowledged',{required:true})
const resendReason=defineModel<string>('resendReason',{required:true})
const emit=defineEmits<{existing:[];retry:[];refresh:[];retryAttempt:[];resend:[];create:[];submit:[]}>()
const state=computed(()=>props.view.state)
const loading=computed(()=>props.view.loading)
const failed=computed(()=>props.view.failed)
const configured=computed(()=>props.view.configured)
const uncertain=computed(()=>props.view.uncertain)
const projection=computed(()=>props.view.projection)
const attempt=computed(()=>props.view.attempt)
const resend=computed(()=>props.view.resend)
const valid=computed(()=>props.view.valid)
const dirty=computed(()=>props.view.dirty)
const pending=computed(()=>props.view.pending)
const error=computed(()=>props.view.error)
const planOptions=computed(()=>props.view.planOptions)
const modeOptions=computed(()=>props.view.modeOptions)
</script>

<template>
  <BsAppShell :product-name="copy['product.name']" :groups="[]" home-path="/" :labels="{open:copy['accounts.open'],close:copy['accounts.close'],navigation:copy['provision.title'],dashboard:copy['provision.title']}">
    <template #logo><BsProductLogo :name="copy['product.name']" /></template><template #header><BsSettingsMenu /></template>
    <BsContentSection :title="copy['provision.title']" :description="copy['provision.description']" padding="lg">
      <BsStack gap="lg">
        <BsButton @click="emit('existing')">{{ copy['provision.existing'] }}</BsButton>
        <BsStateSurface v-if="state!=='success'" state="permission" :title="copy['auth.denied']" />
        <BsStateSurface v-else-if="loading" state="loading" :title="copy['accounts.loading']" />
        <BsStateSurface v-else-if="failed" state="error" :title="copy['accounts.unavailable']" :action-label="copy['auth.retry']" @action="emit('retry')" />
        <BsStateSurface v-else-if="!configured" state="empty" :title="copy['provision.unconfigured']" />
        <BsStack v-else gap="lg">
          <BsAlert v-if="projection" :tone="projection.phase==='active'?'success':projection.phase==='conflict'?'error':'warning'" :title="projection.phaseLabel" :description="projection.phase==='active'?copy['accounts.noPayment']:copy['provision.noActivation']" />
          <BsDescriptionList v-if="projection" :columns="2">
            <BsDescriptionItem :term="copy['provision.email']">{{ projection.email }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy['provision.invitation']">{{ projection.invitationLabel }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy['provision.verification']">{{ projection.ownerVerified?copy['provision.verified']:copy['provision.awaitingOwner'] }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy['accounts.start']">{{ projection.startLabel }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy['accounts.end']">{{ projection.endLabel }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy['provision.record']">{{ projection.provisioningId }}</BsDescriptionItem>
          </BsDescriptionList>
          <BsAlert v-if="uncertain" tone="warning" :title="copy['provision.unknown']" :description="copy['accounts.keepRequest']" />
          <BsButton v-if="projection" @click="emit('refresh')">{{ copy['provision.refresh'] }}</BsButton>
          <BsButton v-if="attempt" @click="emit('retryAttempt')">{{ copy['accounts.retrySame'] }}</BsButton>
          <BsButton v-if="projection?.phase==='active'&&!projection.ownerVerified&&attempt?.kind!=='resend'" :disabled="pending" @click="emit('resend')">{{ copy['provision.resend'] }}</BsButton>
          <BsForm v-if="!projection||projection.phase!=='active'" :disabled="!!attempt||pending||visible||projection?.phase==='conflict'" @submit="emit('create')">
            <BsField :label="copy['provision.email']" for="provision-email" required><BsInput id="provision-email" :model-value="form.email" type="email" autocomplete="email" maxlength="254" required @update:model-value="form = { ...form, email: String($event) }" /></BsField>
            <BsField :label="copy['provision.ownerName']" for="provision-owner" required><BsInput id="provision-owner" :model-value="form.displayName" minlength="2" maxlength="120" required @update:model-value="form = { ...form, displayName: String($event) }" /></BsField>
            <BsField :label="copy['provision.shopName']" for="provision-shop" required><BsInput id="provision-shop" :model-value="form.shopName" minlength="2" maxlength="120" required @update:model-value="form = { ...form, shopName: String($event) }" /></BsField>
            <BsField :label="copy['provision.location']" for="provision-location" required><BsInput id="provision-location" :model-value="form.mainLocationName" minlength="2" maxlength="120" required @update:model-value="form = { ...form, mainLocationName: String($event) }" /></BsField>
            <BsField :label="copy['provision.mode']" for="provision-mode" required><BsSelect id="provision-mode" :model-value="form.businessMode" :label="copy['provision.mode']" :options="modeOptions" option-label="label" option-value="value" required @update:model-value="form = { ...form, businessMode: $event === null ? null : String($event) }" /></BsField>
            <BsField :label="copy['accounts.plan']" for="provision-plan" required><BsSelect id="provision-plan" :model-value="form.planId" :label="copy['accounts.plan']" :options="planOptions" option-label="label" option-value="value" required @update:model-value="form = { ...form, planId: $event === null ? null : String($event) }" /></BsField>
            <BsField :label="copy['accounts.reason']" for="provision-reason" required><BsTextarea id="provision-reason" :model-value="form.reason" minlength="8" maxlength="1000" required @update:model-value="form = { ...form, reason: $event }" /></BsField>
            <BsFormActions><BsButton type="submit" variant="primary" :disabled="!valid">{{ copy['provision.create'] }}</BsButton></BsFormActions>
          </BsForm>
        </BsStack>
      </BsStack>
    </BsContentSection>
    <BsRecordActionDialog v-model:visible="visible" :title="resend?copy['provision.resend']:copy['provision.confirm']" :dirty="dirty" :pending="pending" :error="error" :submit-disabled="!valid" :submit-label="attempt&&(!resend||attempt.kind==='resend')?copy['accounts.retrySame']:copy['provision.confirm']" @submit="emit('submit')">
      <BsAlert tone="warning" :title="resend?copy['provision.resendWarning']:copy['provision.startsNow']" :description="resend?copy['provision.resendConsequences']:copy['provision.consequences']" />
      <BsDescriptionList><BsDescriptionItem :term="copy['provision.email']">{{ projection?.email||form.email }}</BsDescriptionItem><BsDescriptionItem :term="copy['accounts.request']">{{ attempt?.input.requestId||copy['accounts.none'] }}</BsDescriptionItem></BsDescriptionList>
      <BsField v-if="resend" :label="copy['accounts.reason']" for="resend-reason" required><BsTextarea id="resend-reason" v-model="resendReason" minlength="8" maxlength="1000" :disabled="attempt?.kind==='resend'" required /></BsField>
      <BsCheckbox v-if="resend" v-model="acknowledged" :label="copy['provision.acknowledge']" :disabled="attempt?.kind==='resend'" required />
    </BsRecordActionDialog>
  </BsAppShell>
</template>
