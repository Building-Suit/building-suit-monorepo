<script setup lang="ts">
interface View {
 state:string; failed:boolean; loading:boolean; configured:boolean; provisioningAvailable:boolean;
 outcomeSuccess:boolean; auditId:string|null; storageFailed:boolean; hasRows:boolean; blocked:boolean; canActivate:boolean; canChoosePlan:boolean; notTrial:boolean;
 previousDisabled:boolean; nextDisabled:boolean; owner:{name:string;email:string|null;statusLabel:string}|null;
 attempt:{shopId:string;planId:string;requestId:string}|null; selectedPlan:{planName:string;intervalLabel:string}|null;
 dates:{start:string;end:string;trialStart:string;trialEnd:string};
 rowOptions:{value:string;label:string}[];planOptions:{value:string;label:string}[];dirty:boolean;pending:boolean;error:string|null;
}
const props = defineProps<{ copy: Record<'accounts.account' | 'accounts.activate' | 'accounts.activated' | 'accounts.audit' | 'accounts.choosePlan' | 'accounts.close' | 'accounts.confirm' | 'accounts.consequences' | 'accounts.description' | 'accounts.empty' | 'accounts.end' | 'accounts.home' | 'accounts.keepRequest' | 'accounts.loading' | 'accounts.next' | 'accounts.noPayment' | 'accounts.none' | 'accounts.notTrial' | 'accounts.open' | 'accounts.owner' | 'accounts.plan' | 'accounts.previous' | 'accounts.quotaBlocked' | 'accounts.reason' | 'accounts.request' | 'accounts.retrySame' | 'accounts.start' | 'accounts.startsNow' | 'accounts.status' | 'accounts.storageUnavailable' | 'accounts.term' | 'accounts.title' | 'accounts.trialEnd' | 'accounts.trialStart' | 'accounts.unavailable' | 'accounts.unconfigured' | 'accounts.unknown' | 'auth.denied' | 'auth.retry' | 'product.name' | 'provision.create', string>; view: View }>()
const { copy, view } = toRefs(props)
const shopId = defineModel<string|null>('shopId',{required:true})
const planId = defineModel<string|null>('planId',{required:true})
const reason = defineModel<string>('reason',{required:true})
const visible = defineModel<boolean>('visible',{required:true})
const emit=defineEmits<{home:[];create:[];retry:[];open:[];previous:[];next:[];submit:[]}>()
const state = computed(() => props.view.state)
const failed = computed(() => props.view.failed)
const loading = computed(() => props.view.loading)
const configured = computed(() => props.view.configured)
const provisioningAvailable = computed(() => props.view.provisioningAvailable)
const storageFailed = computed(() => props.view.storageFailed)
const attempt = computed(() => props.view.attempt)
const owner = computed(() => props.view.owner)
const selectedPlan = computed(() => props.view.selectedPlan)
const blocked = computed(() => props.view.blocked)
const canActivate = computed(() => props.view.canActivate)
const rowOptions = computed(() => props.view.rowOptions)
const planOptions = computed(() => props.view.planOptions)
const dirty = computed(() => props.view.dirty)
const pending = computed(() => props.view.pending)
const error = computed(() => props.view.error)
</script>

<template>
  <BsAppShell :product-name="copy['product.name']" :groups="[]" home-path="/" :labels="{ open: copy['accounts.open'], close: copy['accounts.close'], navigation: copy['accounts.title'], dashboard: copy['accounts.title'] }">
    <template #logo><BsProductLogo :name="copy['product.name']" /></template>
    <template #header><BsSettingsMenu /></template>
    <BsContentSection :title="copy['accounts.title']" :description="copy['accounts.description']" padding="lg">
      <BsStack gap="lg">
        <BsButton @click="emit('home')">{{ copy['accounts.home'] }}</BsButton>
        <BsStateSurface v-if="state !== 'success'" :state="state === 'loading' ? 'loading' : 'permission'" :title="copy['auth.denied']" />
        <BsStateSurface v-else-if="failed" state="error" :title="copy['accounts.unavailable']" :action-label="copy['auth.retry']" @action="emit('retry')" />
        <BsStateSurface v-else-if="loading" state="loading" :title="copy['accounts.loading']" />
        <BsStateSurface v-else-if="!configured" state="empty" :title="copy['accounts.unconfigured']" />
        <BsStack v-else gap="lg">
          <BsButton v-if="provisioningAvailable" :disabled="!!attempt" @click="emit('create')">{{ copy['provision.create'] }}</BsButton>
          <BsAlert v-if="view.outcomeSuccess" tone="success" :title="copy['accounts.activated']" :description="copy['accounts.noPayment']" />
          <BsDescriptionList v-if="view.outcomeSuccess" :columns="2">
            <BsDescriptionItem :term="copy['accounts.start']">{{ view.dates.start }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy['accounts.end']">{{ view.dates.end }}</BsDescriptionItem>
            <BsDescriptionItem :term="copy['accounts.audit']">{{ view.auditId }}</BsDescriptionItem>
          </BsDescriptionList>
          <BsAlert v-if="attempt" tone="warning" :title="copy['accounts.unknown']" :description="copy['accounts.keepRequest']" />
          <BsButton v-if="attempt" @click="emit('open')">{{ copy['accounts.retrySame'] }}</BsButton>
          <BsAlert v-if="storageFailed" tone="error" :title="copy['accounts.storageUnavailable']" />
          <BsStateSurface v-if="!view.hasRows" state="empty" :title="copy['accounts.empty']" />
          <BsForm v-else @submit="emit('open')">
            <BsField :label="copy['accounts.account']" for="sas-account">
              <BsSelect id="sas-account" v-model="shopId" :label="copy['accounts.account']" :options="rowOptions" option-label="label" option-value="value" filter :disabled="!!attempt || pending || loading" />
            </BsField>
            <BsDescriptionList v-if="owner" :columns="2">
              <BsDescriptionItem :term="copy['accounts.owner']">{{ view.owner?.email }}</BsDescriptionItem>
              <BsDescriptionItem :term="copy['accounts.status']">{{ view.owner?.statusLabel }}</BsDescriptionItem>
              <BsDescriptionItem :term="copy['accounts.trialStart']">{{ view.dates.trialStart }}</BsDescriptionItem>
              <BsDescriptionItem :term="copy['accounts.trialEnd']">{{ view.dates.trialEnd }}</BsDescriptionItem>
            </BsDescriptionList>
            <BsAlert v-if="view.notTrial" tone="info" :title="copy['accounts.notTrial']" />
            <BsFormActions align="between">
              <BsButton type="button" :disabled="view.previousDisabled" @click="emit('previous')">{{ copy['accounts.previous'] }}</BsButton>
              <BsButton type="button" :disabled="view.nextDisabled" @click="emit('next')">{{ copy['accounts.next'] }}</BsButton>
              <BsButton type="submit" variant="primary" :disabled="!view.canChoosePlan">{{ copy['accounts.choosePlan'] }}</BsButton>
            </BsFormActions>
          </BsForm>
        </BsStack>
      </BsStack>
    </BsContentSection>
    <BsRecordActionDialog v-model:visible="visible" :title="copy['accounts.confirm']" :dirty="dirty" :pending="pending" :error="error" :submit-disabled="!canActivate" :submit-label="attempt ? copy['accounts.retrySame'] : copy['accounts.activate']" @submit="emit('submit')">
      <BsField :label="copy['accounts.plan']" for="sas-plan" required>
        <BsSelect id="sas-plan" v-model="planId" :label="copy['accounts.plan']" :options="planOptions" option-label="label" option-value="value" :disabled="!!attempt" required />
      </BsField>
      <BsField :label="copy['accounts.reason']" for="sas-reason" required>
        <BsTextarea id="sas-reason" v-model="reason" :disabled="!!attempt" minlength="8" maxlength="1000" required />
      </BsField>
      <BsAlert v-if="blocked && !attempt" tone="warning" :title="copy['accounts.quotaBlocked']" />
      <BsAlert tone="info" :title="copy['accounts.startsNow']" :description="copy['accounts.consequences']" />
      <BsDescriptionList :columns="2">
        <BsDescriptionItem :term="copy['accounts.account']">{{ owner?.name || attempt?.shopId }}</BsDescriptionItem>
        <BsDescriptionItem :term="copy['accounts.plan']">{{ selectedPlan?.planName || attempt?.planId }}</BsDescriptionItem>
        <BsDescriptionItem :term="copy['accounts.term']">{{ view.selectedPlan?.intervalLabel || copy['accounts.none'] }}</BsDescriptionItem>
        <BsDescriptionItem :term="copy['accounts.request']">{{ attempt?.requestId || copy['accounts.none'] }}</BsDescriptionItem>
      </BsDescriptionList>
    </BsRecordActionDialog>
  </BsAppShell>
</template>
