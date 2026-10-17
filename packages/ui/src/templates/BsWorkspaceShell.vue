<script setup lang="ts">
import type { NavigationGroup, NavigationLink, ScopeOption } from '@building-suit/contracts'
import type { BsShellNotifications, BsShellOnboarding, BsShellFinancialMap, BsShellJournalCreation, BsShellOperationalCreation, BsShellInvitation, BsShellWorkspaceCreation } from '../types/workspaceShellPresentation'
import type { BsWorkspaceCreationForm } from '../types/workspaceCreationPresentation'
import type { BsJournalCreationForm, BsJournalCreationFlow } from '../types/journalCreationPresentation'
import type { BsCommitmentDraft, BsRecurringDraft, BsCounterpartyDraft, BsTagDraft } from '../types/operationalCreationPresentation'
import type { BsAccessIdentityForm } from '../types/accessPresentation'
withDefaults(defineProps<{
  variant?: 'default' | 'shop'
  sidebarPlan?: { name: string; status: string; detail: string; actionLabel: string; to: string }
  ready?: boolean
  loadingLabel?: string
  bodyLayout?: 'stack' | 'page'
  trial?: { to: string; label: string; compactLabel: string }
  notifications?: BsShellNotifications
  scopeNotice?: { title: string; description: string }
  readOnly?: { title: string; description: string; actionLabel?: string; actionTo: string }
  workspaceCreation?: BsShellWorkspaceCreation
  onboarding?: BsShellOnboarding
  financialMap?: BsShellFinancialMap
  journalCreation?: BsShellJournalCreation
  operationalCreation?: BsShellOperationalCreation
  invitation?: BsShellInvitation
  productName: string
  homePath?: string
  groups: NavigationGroup[]
  mobileLinks?: NavigationLink[]
  labels: { collapse?: string; close: string; open: string; navigation: string; dashboard: string }
  context?: string
  account?: { name?: string; email?: string; label: string; signOut: string; pending?: boolean; error?: string; actions?: NavigationLink[] }
  workspace?: { value: string | null; label: string; placeholder: string; options: ScopeOption[]; createLabel?: string }
  contextScope?: { key: string; value: string | null; label: string; options: ScopeOption[] }
  headerScopes?: { key: string; value: string | null; label: string; options: ScopeOption[]; visibility?: 'always' | 'mobile' | 'desktop'; placeholder?: string; disabled?: boolean }[]
  state?: { loading: boolean; error: boolean; title: string; description?: string; retry: string; titleLevel?: 1 | 2 | 3 }
  floatingActions?: boolean
  feedback?: boolean
  logo: { kind: 'text' | 'initials' | 'product'; initials?: string; assetPrefix?: string }
}>(), { variant: 'default', sidebarPlan: undefined, ready: true, loadingLabel: '', trial: undefined, notifications: undefined, readOnly: undefined, scopeNotice: undefined, workspaceCreation: undefined, onboarding: undefined, financialMap: undefined, journalCreation: undefined, operationalCreation: undefined, invitation: undefined, bodyLayout: 'stack', context: undefined, workspace: undefined, account: undefined, contextScope: undefined, headerScopes: () => [], state: undefined, floatingActions: false, feedback: false, homePath: '/dashboard', mobileLinks: () => [] })
const emit = defineEmits<{ signOut: []; scope: [key: string, value: string | null]; retry: []; workspace: [id: string]; createWorkspace: []; closeWorkspaceCreation: []; submitWorkspaceCreation: []; createOrganization: []; acceptInvitation: []; demoReceipt: []; demoReset: []; notification: [id: string]; markAllNotifications: []; journalFlow: [value: BsJournalCreationFlow]; closeJournal: []; saveJournal: []; closeOperation: []; saveOperation: []; closeInvitation: []; submitInvitation: [] }>()
const workspaceCreationForm = defineModel<BsWorkspaceCreationForm | undefined>('workspaceCreationForm', { default: undefined })
const onboardingForm = defineModel<{ name: string; legalName: string; currency: string; invitationToken: string } | undefined>('onboardingForm', { default: undefined })
const journalForm = defineModel<BsJournalCreationForm | undefined>('journalForm', { default: undefined })
const commitment = defineModel<BsCommitmentDraft | undefined>('commitment', { default: undefined })
const recurring = defineModel<BsRecurringDraft | undefined>('recurring', { default: undefined })
const counterparty = defineModel<BsCounterpartyDraft | undefined>('counterparty', { default: undefined })
const tag = defineModel<BsTagDraft | undefined>('tag', { default: undefined })
const invitationForm = defineModel<BsAccessIdentityForm | undefined>('invitationForm', { default: undefined })
</script>
<template>
  <BsStateSurface v-if="!ready" state="loading" :title="loadingLabel"/>
  <BsAppShell v-else :variant="variant" :home-path="homePath" :product-name="productName" :groups="groups" :mobile-links="mobileLinks" :labels="labels" :floating-actions="floatingActions">
    <template #logo>
      <BsProductLogo v-if="logo.kind === 'product'" :name="productName" :asset-prefix="logo.assetPrefix" />
      <BsInline v-else-if="logo.kind === 'initials'"><BsText as="span" size="sm">{{ logo.initials }}</BsText><BsText as="span">{{ productName }}</BsText></BsInline>
      <BsText v-else as="span">{{ productName }}</BsText>
    </template>
    <template #mark><BsProductLogo v-if="logo.kind === 'product'" :name="productName" :asset-prefix="logo.assetPrefix" kind="mark" /></template>
    <template #sidebar-footer="{ collapsed }"><BsSidebarAccount v-if="variant === 'shop' && account" :collapsed="collapsed" :name="account.name" :email="account.email" :actions="account.actions" :account-label="account.label" :sign-out-label="account.signOut" :sign-out-pending="account.pending" :error="account.error" :plan="sidebarPlan" @sign-out="emit('signOut')" /></template>
    <template #context><BsContextSwitcher v-if="workspace" :model-value="workspace.value" :label="workspace.label" :placeholder="workspace.placeholder" :options="workspace.options" :create-label="workspace.createLabel" @update:model-value="value => { if (value) emit('workspace', value) }" @create="emit('createWorkspace')"/><BsScopeSwitcher v-if="contextScope" :model-value="contextScope.value" :label="contextScope.label" :options="contextScope.options" visibility="mobile" @update:model-value="emit('scope', contextScope.key, $event)"/><BsText v-if="context" as="p" size="xs" tone="muted" emphasis="semibold">{{ context }}</BsText></template>
    <template #header><BsTrialCountdown v-if="trial" :to="trial.to" :label="trial.label" :compact-label="trial.compactLabel"/><BsNotificationMenu v-if="notifications" :items="notifications.items" :label="notifications.label" :empty-label="notifications.emptyLabel" :mark-all-label="notifications.markAllLabel" :pending="notifications.pending" @select="emit('notification', $event)" @mark-all="emit('markAllNotifications')"/><BsScopeSwitcher v-for="scope in headerScopes" :key="scope.key" :model-value="scope.value" :label="scope.label" :options="scope.options" :placeholder="scope.placeholder" :disabled="scope.disabled" compact :visibility="scope.visibility" @update:model-value="emit('scope', scope.key, $event)"/><BsUserMenu v-if="account && variant !== 'shop'" :actions="account.actions" :name="account.name" :email="account.email" :sign-out-pending="account.pending" :error="account.error" :account-label="account.label" :sign-out-label="account.signOut" @sign-out="emit('signOut')" /><BsSettingsMenu v-else-if="!account" /></template>
    <BsStateSurface v-if="state?.error" state="error" :title-level="state.titleLevel" :title="state.title" :description="state.description" :action-label="state.retry" @action="emit('retry')"/><BsSectionSkeleton v-else-if="state?.loading" variant="cards"/><BsWorkspaceOnboarding v-else-if="onboarding && onboardingForm" v-model:form="onboardingForm" :pending="onboarding.pending" :error="onboarding.error" :copy="onboarding.copy" :accounts="onboarding.accounts" :revision="onboarding.revision" @create="emit('createOrganization')" @accept="emit('acceptInvitation')" @receipt="emit('demoReceipt')" @reset="emit('demoReset')"/><BsStack v-else gap="sm"><BsAlert v-if="scopeNotice" tone="info" :title="scopeNotice.title" :description="scopeNotice.description"/><BsReadOnlyBanner v-if="readOnly" :title="readOnly.title" :description="readOnly.description" :action-label="readOnly.actionLabel" :action-to="readOnly.actionTo"/><BsPageBody v-if="bodyLayout === 'page'"><slot/></BsPageBody><slot v-else/></BsStack>
    <template #overlays>
      <BsWorkspaceCreationDialog v-if="workspaceCreation && workspaceCreationForm" v-model:form="workspaceCreationForm" :view="workspaceCreation" @close="emit('closeWorkspaceCreation')" @submit="emit('submitWorkspaceCreation')"/>
      <BsFinancialSystemMap v-if="financialMap" :copy="financialMap.copy" :flows="financialMap.flows" :checks="financialMap.checks" :reports="financialMap.reports"/>
      <BsJournalCreationDialog v-if="journalCreation && journalForm" v-model:form="journalForm" :flow="journalCreation.flow" :view="journalCreation.view" :copy="journalCreation.copy" :options="journalCreation.options" @flow="emit('journalFlow', $event)" @close="emit('closeJournal')" @save="emit('saveJournal')"/>
      <BsOperationalCreationDialog v-if="operationalCreation && commitment && recurring && counterparty && tag" v-model:commitment="commitment" v-model:recurring="recurring" v-model:counterparty="counterparty" v-model:tag="tag" :view="operationalCreation.view" :copy="operationalCreation.copy" :options="operationalCreation.options" @close="emit('closeOperation')" @save="emit('saveOperation')"/>
      <BsAccessIdentityEditor v-if="invitation && invitationForm" v-model="invitationForm" :state="invitation.state" :copy="invitation.copy" :roles="invitation.roles" :usage="invitation.usage" @close="emit('closeInvitation')" @submit="emit('submitInvitation')"/>
      <BsToastHost v-if="feedback"/>
    </template>
  </BsAppShell>
</template>
