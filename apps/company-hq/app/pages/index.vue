<script setup lang="ts">
import type { HqCompanyPlansCopy, HqCompanyPlansPresentation, HqDepartmentOffice, HqLayoutContent } from '@building-suit/ui/types/hqLayoutPresentation'

definePageMeta({ layout: false })
const { t, locale } = useI18n()
const { brain, refresh, selectNote } = useCompanyBrain()
const companyPlansCopy = computed<HqCompanyPlansCopy>(() => ({
  title: t('hq.companyPlans.title'),
  executiveLabel: t('hq.companyPlans.executiveLabel'),
  loginTitle: t('hq.companyPlans.loginTitle'),
  loginDescription: t('hq.companyPlans.loginDescription'),
  emailLabel: t('hq.companyPlans.emailLabel'),
  passwordLabel: t('hq.companyPlans.passwordLabel'),
  signInLabel: t('hq.companyPlans.signInLabel'),
  registerLabel: t('hq.companyPlans.registerLabel'),
  signOutLabel: t('hq.companyPlans.signOutLabel'),
  confirmationRequired: t('hq.companyPlans.confirmationRequired'),
  invalidCredentials: t('hq.companyPlans.invalidCredentials'),
  denied: t('hq.companyPlans.denied'),
  unavailable: t('hq.companyPlans.unavailable'),
  signOutFailed: t('hq.companyPlans.signOutFailed'),
  loading: t('hq.companyPlans.loading'),
  empty: t('hq.companyPlans.empty'),
  refreshLabel: t('hq.companyPlans.refreshLabel'),
  departmentsLabel: t('hq.companyPlans.departmentsLabel'),
  hiringLabel: t('hq.companyPlans.hiringLabel'),
  skillsLabel: t('hq.companyPlans.skillsLabel'),
  hrReviewLabel: t('hq.companyPlans.hrReviewLabel'),
  ceoReviewLabel: t('hq.companyPlans.ceoReviewLabel'),
  readyLabel: t('hq.companyPlans.readyLabel'),
  approvedLabel: t('hq.companyPlans.approvedLabel'),
  rejectedLabel: t('hq.companyPlans.rejectedLabel'),
  approveLabel: t('hq.companyPlans.approveLabel'),
  rejectLabel: t('hq.companyPlans.rejectLabel'),
  approveConfirmation: t('hq.companyPlans.approveConfirmation'),
  rejectConfirmation: t('hq.companyPlans.rejectConfirmation'),
  cancelLabel: t('hq.companyPlans.cancelLabel'),
  conflict: t('hq.companyPlans.conflict'),
  decisionFailed: t('hq.companyPlans.decisionFailed'),
  legacyLabel: t('hq.companyPlans.legacyLabel'),
}))
const { access, signIn, register, signOut } = useHqFounderAccess(() => ({
  invalidCredentials: companyPlansCopy.value.invalidCredentials,
  denied: companyPlansCopy.value.denied,
  unavailable: companyPlansCopy.value.unavailable,
  signOutFailed: companyPlansCopy.value.signOutFailed,
  confirmationRequired: companyPlansCopy.value.confirmationRequired,
}))
const { workspace, departments, refresh: refreshPlans, decide: decidePlan } = useHqCompanyPlans(() => access.value.status, () => ({
  unavailable: companyPlansCopy.value.unavailable,
  conflict: companyPlansCopy.value.conflict,
  decisionFailed: companyPlansCopy.value.decisionFailed,
}))
const localizedDepartments = computed<readonly HqDepartmentOffice[]>(() => departments.value.map(department => ({
  ...department,
  name: locale.value === 'ar' ? department.nameAr ?? department.name : department.name,
})))
const companyPlans = computed<HqCompanyPlansPresentation>(() => ({
  ...workspace.value,
  plans: workspace.value.plans.map(plan => ({
    ...plan,
    departments: plan.departments.map(department => ({ ...department, name: locale.value === 'ar' ? department.nameAr ?? department.name : department.name })),
  })),
}))
const content = computed<HqLayoutContent>(() => ({
  brandName: 'Building Suit',
  brandSuffix: 'HQ',
  logoSrc: '/brand/building-suit-logo-light.png',
  workspaceLabel: t('hq.workspaceLabel'),
  tasksLabel: t('hq.tasksLabel'),
  calendarLabel: t('hq.calendarLabel'),
  brainLabel: t('hq.brainLabel'),
  statusLabel: t('hq.statusLabel'),
  talkToCeoLabel: t('hq.talkToCeoLabel'),
  profileLabel: t('hq.profileLabel'),
  loginLabel: t('hq.loginLabel'),
  canvasLabel: t('hq.canvasLabel'),
  minimapLabel: t('hq.minimapLabel'),
  zoomOutLabel: t('hq.zoomOutLabel'),
  zoomInLabel: t('hq.zoomInLabel'),
  fitViewLabel: t('hq.fitViewLabel'),
  hologramLabel: t('hq.hologramLabel'),
  sceneUnavailableLabel: t('hq.sceneUnavailableLabel'),
  mouseControlsLabel: t('hq.mouseControlsLabel'),
  touchControlsLabel: t('hq.touchControlsLabel'),
  keyboardControlsLabel: t('hq.keyboardControlsLabel'),
  zoomLabel: t('hq.zoomLabel'),
  companyPlans: companyPlansCopy.value,
  companyBrain: {
    title: t('hq.companyBrain.title'),
    openLabel: t('hq.companyBrain.openLabel'),
    loadingLabel: t('hq.companyBrain.loadingLabel'),
    connectedLabel: t('hq.companyBrain.connectedLabel'),
    unavailableLabel: t('hq.companyBrain.unavailableLabel'),
    errorLabel: t('hq.companyBrain.errorLabel'),
    sourceLabel: t('hq.companyBrain.sourceLabel'),
    freshnessLabel: t('hq.companyBrain.freshnessLabel'),
    refreshLabel: t('hq.companyBrain.refreshLabel'),
    searchLabel: t('hq.companyBrain.searchLabel'),
    showMoreLabel: t('hq.companyBrain.showMoreLabel'),
    emptyLabel: t('hq.companyBrain.emptyLabel'),
    selectLabel: t('hq.companyBrain.selectLabel'),
    noteErrorLabel: t('hq.companyBrain.noteErrorLabel'),
    observedLabel: t('hq.companyBrain.observedLabel'),
    modifiedLabel: t('hq.companyBrain.modifiedLabel'),
    partialLabel: t('hq.companyBrain.partialLabel'),
    readOnlyLabel: t('hq.companyBrain.readOnlyLabel'),
    setupRequiredLabel: t('hq.companyBrain.setupRequiredLabel'),
    authorizationRequiredLabel: t('hq.companyBrain.authorizationRequiredLabel'),
    setupInstructionsLabel: t('hq.companyBrain.setupInstructionsLabel'),
    versionLabel: t('hq.companyBrain.versionLabel'),
  },
}))
useHead({ title: 'Building Suit HQ', htmlAttrs: { dir: () => locale.value === 'ar' ? 'rtl' : 'ltr', lang: () => locale.value } })
</script>
<template><BsHqLayoutPage :content="content" :brain="brain" :access="access" :company-plans="companyPlans" :departments="localizedDepartments" @refresh-brain="refresh" @select-brain-note="selectNote" @login="signIn" @register="register" @logout="signOut" @refresh-plans="refreshPlans" @decide-plan="decidePlan" /></template>
