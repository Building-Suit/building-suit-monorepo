<script setup lang="ts">
import type { BsWorkspaceOnboardingCopy } from '../types/workspaceOnboardingCopy'
import { useOverlayState } from '@building-suit/ux'
defineProps<{ pending: boolean; error?: string | null; accounts: { code: string; name: string; debit: string; credit: string }[]; revision: string; copy: BsWorkspaceOnboardingCopy }>()
const form = defineModel<{ name: string; legalName: string; currency: string; invitationToken: string }>('form', { required: true })
const emit = defineEmits<{ create: []; accept: []; receipt: []; reset: [] }>()
const { open: demoOpen, show: showDemo, close: closeDemo } = useOverlayState()
function field(key: keyof typeof form.value, value: string | number | null | undefined) { form.value = { ...form.value, [key]: String(value ?? '') } }
</script>
<template>
        <BsGrid :columns="2" gap="lg">
          <BsForm @submit.prevent="emit('create')">
            <BsHeading :level="2" size="h3">{{ copy.orgCreate }}</BsHeading>
            <BsText size="sm" tone="muted">{{ copy.orgCreateHint }}</BsText>
            <BsFloatingField :label="copy.orgName">
              <BsInput id="org-name" :model-value="form.name" required @update:model-value="field('name', $event)" />
            </BsFloatingField>
            <BsFloatingField :label="copy.onboardingLegalName">
              <BsInput id="org-legal-name" :model-value="form.legalName" required @update:model-value="field('legalName', $event)" />
            </BsFloatingField>
            <BsFloatingField :label="copy.accountsCurrency">
              <BsSelect id="org-currency" :model-value="form.currency" native @update:model-value="field('currency', $event)">
                <BsSelectOption v-for="code in ['EGP','USD','EUR','GBP','SAR','AED']" :key="code">{{ code }}</BsSelectOption>
              </BsSelect>
            </BsFloatingField>
            <BsButton type="submit" :disabled="pending" variant="primary" block>{{ copy.orgCreate }}</BsButton>
          </BsForm>
          <BsForm @submit.prevent="emit('accept')">
            <BsHeading :level="2" size="h3">{{ copy.orgAcceptInvite }}</BsHeading>
            <BsText size="sm" tone="muted">{{ copy.orgAcceptInviteHint }}</BsText>
            <BsFloatingField :label="copy.orgInviteToken">
              <BsInput id="invite-token" :model-value="form.invitationToken" dir="ltr" required @update:model-value="field('invitationToken', $event)" />
            </BsFloatingField>
            <BsButton type="submit" :disabled="pending" block>{{ copy.orgAcceptInvite }}</BsButton>
          </BsForm>
          <BsText v-if="error" role="alert" tone="danger">{{ error }}</BsText>
          <BsCard v-if="!demoOpen" aria-labelledby="demo-invitation-title" as="section" padding="lg" :span="2">
            <BsStack gap="md">
              <BsHeading id="demo-invitation-title" :level="2" size="h3">{{ copy.demoInvitationTitle }}</BsHeading>
              <BsText size="sm" tone="muted">{{ copy.demoInvitationHint }}</BsText>
              <BsButton type="button" @click="showDemo">{{ copy.demoOpen }}</BsButton>
            </BsStack>
          </BsCard>
              <BsCard v-else aria-labelledby="synthetic-demo-title" data-synthetic-demo data-demo-scope="isolated_synthetic_demo" as="section" padding="lg" :span="2">
                <BsStack gap="md">
                  <BsInline gap="md" :wrap="true" align="start" justify="between">
                    <BsBox>
                      <BsHeading id="synthetic-demo-title" :level="2" size="h3">{{ copy.demoTitle }}</BsHeading>
                      <BsText size="sm" tone="muted">{{ copy.demoIsolation }}</BsText>
                    </BsBox>
                    <BsButton type="button" size="sm" @click="closeDemo">{{ copy.commonClose }}</BsButton>
                  </BsInline>
                  <BsBox role="status" padding="lg" surface="muted" radius="control">
                    <BsText as="strong">{{ copy.demoSyntheticBadge }}</BsText>
                    <BsText>{{ copy.demoNoRealOrganization }}</BsText>
                  </BsBox>
                  <BsDataTable
                    :value="accounts"
                    row-key="code"
                    :label="copy.demoTitle"
                    :columns="[{ key: 'code', field: 'code', header: copy.accountsCode }, { key: 'column2', header: copy.accountsAccount }, { key: 'column3', header: copy.openingDebit, align: 'end' as const }, { key: 'column4', header: copy.openingCredit, align: 'end' as const }]"
                  >
                    <template #cell-code="{ row: account }">
                      <BsText dir="ltr" as="span" size="xs">{{ account.code }}</BsText>
                    </template>
                    <template #cell-column2="{ row: account }">{{ account.name }}</template>
                    <template #cell-column3="{ row: account }">{{ account.debit }}</template>
                    <template #cell-column4="{ row: account }">{{ account.credit }}</template>
                  </BsDataTable>
                  <BsInline gap="sm" :wrap="true">
                    <BsButton type="button" variant="primary" @click="emit('receipt')">{{ copy.demoAddReceipt }}</BsButton>
                    <BsButton type="button" @click="emit('reset')">{{ copy.demoReset }}</BsButton>
                  </BsInline>
                  <BsText size="xs" tone="muted">{{ revision }}</BsText>
                </BsStack>
              </BsCard>

        </BsGrid>

</template>
