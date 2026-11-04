<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { HqCompanyPlanPresentation, HqCompanyPlansCopy, HqCompanyPlansPresentation, HqDepartmentOffice, HqFounderAccessPresentation } from '../types/hqLayoutPresentation'

const props = withDefaults(defineProps<{ copy: HqCompanyPlansCopy; access: HqFounderAccessPresentation; workspace: HqCompanyPlansPresentation; departments?: readonly HqDepartmentOffice[] }>(), { departments: () => [] })
const emit = defineEmits<{
  login: [email: string, password: string]
  register: [email: string, password: string]
  logout: []
  refresh: []
  decision: [id: string, revision: number, decision: 'approved' | 'rejected']
}>()
const confirmation = useConfirmation()
const headingId = useId()
const detailId = useId()
const email = ref('')
const password = ref('')
const authMode = ref<'login' | 'register'>('login')
const selectedId = ref<string | null>(null)
const confirming = ref(false)
const decisionError = ref<string | null>(null)
let disposed = false

const selected = computed(() => props.workspace.plans.find(plan => plan.id === selectedId.value) ?? props.workspace.plans[0] ?? null)
const confirmationNotice = computed(() => props.access.message === props.copy.confirmationRequired)
const accessError = computed(() => {
  if (confirmationNotice.value) return null
  if (props.access.message) return props.access.message
  if (props.access.status === 'denied') return props.copy.denied
  if (props.access.status === 'error') return props.copy.unavailable
  return null
})
const canDecide = computed(() => props.access.status === 'founder' && !props.access.pending && props.workspace.status === 'ready'
  && !props.workspace.pending && !confirming.value && selected.value?.status === 'ready' && !selected.value.legacy)

function submitCredentials() {
  if (props.access.pending || props.access.status === 'loading' || !email.value.trim() || !password.value) return
  // Credentials exist only in this mounted form and the synchronous semantic
  // command. Clear the password before handing it to product orchestration.
  const enteredPassword = password.value
  password.value = ''
  if (authMode.value === 'register') emit('register', email.value.trim(), enteredPassword)
  else emit('login', email.value.trim(), enteredPassword)
}
function changeAuthMode() {
  if (props.access.pending) return
  password.value = ''
  authMode.value = authMode.value === 'login' ? 'register' : 'login'
}
function selectPlan(plan: HqCompanyPlanPresentation) {
  if (confirming.value || props.workspace.pending) return
  selectedId.value = plan.id
  decisionError.value = null
}
function statusLabel(status: HqCompanyPlanPresentation['status']) {
  return status === 'approved' ? props.copy.approvedLabel : status === 'rejected' ? props.copy.rejectedLabel : props.copy.readyLabel
}
function departmentReference(id: string) {
  return selected.value?.departments.find(department => department.id === id)?.name
    ?? props.departments.find(department => department.id === id)?.name ?? props.copy.departmentsLabel
}
async function decide(decision: 'approved' | 'rejected') {
  if (!canDecide.value || !selected.value) return
  const { id, revision, title } = selected.value
  confirming.value = true
  decisionError.value = null
  try {
    const accepted = await confirmation.ask({
      title,
      message: decision === 'approved' ? props.copy.approveConfirmation : props.copy.rejectConfirmation,
      confirmLabel: decision === 'approved' ? props.copy.approveLabel : props.copy.rejectLabel,
      cancelLabel: props.copy.cancelLabel,
      tone: decision === 'rejected' ? 'danger' : 'default',
    })
    if (!accepted || disposed) return
    const current = props.workspace.plans.find(plan => plan.id === id)
    if (props.access.status !== 'founder' || props.access.pending || props.workspace.status !== 'ready' || props.workspace.pending
      || selected.value?.id !== id || !current || current.revision !== revision || current.status !== 'ready' || current.legacy) {
      decisionError.value = props.copy.conflict
      return
    }
    emit('decision', id, revision, decision)
  }
  catch {
    if (!disposed) decisionError.value = props.copy.decisionFailed
  }
  finally {
    if (!disposed) confirming.value = false
  }
}

watch(() => props.access.status, status => {
  password.value = ''
  if (status !== 'founder') { selectedId.value = null; decisionError.value = null }
})
watch(confirmationNotice, notice => {
  if (notice) { authMode.value = 'login'; password.value = '' }
})
onBeforeUnmount(() => { disposed = true; password.value = ''; email.value = '' })
</script>

<template>
  <section class="bs-hq-plans" :aria-labelledby="headingId" :aria-busy="access.pending || workspace.pending">
    <header class="bs-hq-plans__header">
      <div>
        <h2 :id="headingId">{{ copy.title }}</h2>
        <p v-if="access.status === 'founder' && access.user" class="bs-hq-plans__identity">{{ access.user.displayName }}</p>
      </div>
      <div v-if="access.status === 'founder'" class="bs-hq-plans__toolbar">
        <BsButton type="button" variant="text" size="sm" :disabled="access.pending || workspace.pending || confirming" @click="emit('refresh')">{{ copy.refreshLabel }}</BsButton>
        <BsButton type="button" variant="text" size="sm" :pending="access.pending" :disabled="workspace.pending || confirming" @click="emit('logout')">{{ copy.signOutLabel }}</BsButton>
      </div>
    </header>

    <p v-if="access.status === 'loading'" class="bs-hq-plans__notice" role="status">{{ copy.loading }}</p>
    <BsAuthForm v-else-if="access.status !== 'founder'" :title="authMode === 'register' ? copy.registerLabel : copy.loginTitle" :description="copy.loginDescription" :pending="access.pending" :pending-label="copy.loading" :error="accessError" :submit-label="authMode === 'register' ? copy.registerLabel : copy.signInLabel" align="start" @submit="submitCredentials">
      <p v-if="confirmationNotice" class="bs-hq-plans__notice" role="status">{{ copy.confirmationRequired }}</p>
      <BsField v-slot="field" :label="copy.emailLabel" required>
        <BsInput :id="field.id" v-model="email" type="email" autocomplete="email" name="email" dir="ltr" required :aria-describedby="field.describedby" />
      </BsField>
      <BsField v-slot="field" :label="copy.passwordLabel" required>
        <BsInput :id="field.id" v-model="password" type="password" :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'" name="password" required :aria-describedby="field.describedby" />
      </BsField>
      <template #footer>
        <p v-if="authMode === 'register'" class="bs-hq-plans__notice">{{ copy.confirmationRequired }}</p>
        <BsButton type="button" variant="link" :disabled="access.pending" @click="changeAuthMode">{{ authMode === 'login' ? copy.registerLabel : copy.signInLabel }}</BsButton>
        <BsButton v-if="access.status === 'denied'" type="button" variant="text" :disabled="access.pending" @click="emit('logout')">{{ copy.signOutLabel }}</BsButton>
      </template>
    </BsAuthForm>

    <template v-else>
      <p v-if="access.message" class="bs-hq-plans__notice" role="alert">{{ access.message }}</p>
      <p v-if="decisionError || workspace.message" class="bs-hq-plans__notice" role="alert">{{ decisionError || workspace.message }}</p>
      <p v-if="workspace.status === 'loading'" class="bs-hq-plans__notice" role="status">{{ copy.loading }}</p>
      <div v-else-if="workspace.status === 'unavailable'" class="bs-hq-plans__state">
        <p role="status">{{ copy.unavailable }}</p>
        <BsButton type="button" variant="secondary" :pending="workspace.pending" :disabled="access.pending || confirming" @click="emit('refresh')">{{ copy.refreshLabel }}</BsButton>
      </div>
      <p v-else-if="!workspace.plans.length" class="bs-hq-plans__notice" role="status">{{ copy.empty }}</p>
      <div v-else class="bs-hq-plans__workspace">
        <nav class="bs-hq-plans__list" :aria-label="copy.title">
          <BsButton v-for="plan in workspace.plans" :key="plan.id" type="button" variant="tile" align="start" class="bs-hq-plans__choice" :aria-pressed="selected?.id === plan.id" :aria-controls="detailId" :disabled="confirming || workspace.pending" @click="selectPlan(plan)">
            <span class="bs-hq-plans__choice-title">{{ plan.title }}</span>
            <span class="bs-hq-plans__meta">{{ statusLabel(plan.status) }}</span>
            <span v-if="plan.legacy" class="bs-hq-plans__meta">{{ copy.legacyLabel }}</span>
          </BsButton>
        </nav>

        <article v-if="selected" :id="detailId" class="bs-hq-plans__detail">
          <header class="bs-hq-plans__plan-header">
            <h3>{{ selected.title }}</h3>
            <p class="bs-hq-plans__status">{{ statusLabel(selected.status) }}</p>
            <p v-if="selected.legacy" class="bs-hq-plans__notice">{{ copy.legacyLabel }}</p>
            <p v-if="selected.summary" class="bs-hq-plans__prose">{{ selected.summary }}</p>
          </header>
          <div class="bs-hq-plans__body bs-hq-plans__prose" dir="auto">{{ selected.body }}</div>

          <section class="bs-hq-plans__section">
            <h4>{{ copy.departmentsLabel }}</h4>
            <ul v-if="selected.departments.length" class="bs-hq-plans__items">
              <li v-for="department in selected.departments" :key="department.id">
                <strong>{{ department.name }}</strong>
                <span v-if="department.nameAr && department.nameAr !== department.name" class="bs-hq-plans__meta" dir="auto">{{ department.nameAr }}</span>
              </li>
            </ul>
            <p v-else class="bs-hq-plans__meta">{{ copy.empty }}</p>
          </section>
          <section class="bs-hq-plans__section">
            <h4>{{ copy.hiringLabel }}</h4>
            <ul v-if="selected.hiring.length" class="bs-hq-plans__items">
              <li v-for="hire in selected.hiring" :key="hire.id">
                <strong>{{ hire.role }}</strong>
                <p v-if="hire.departmentId" class="bs-hq-plans__meta">{{ departmentReference(hire.departmentId) }}</p>
                <p class="bs-hq-plans__prose">{{ hire.reason }}</p>
              </li>
            </ul>
            <p v-else class="bs-hq-plans__meta">{{ copy.empty }}</p>
          </section>
          <section class="bs-hq-plans__section">
            <h4>{{ copy.skillsLabel }}</h4>
            <ul v-if="selected.skills.length" class="bs-hq-plans__items">
              <li v-for="upgrade in selected.skills" :key="upgrade.id">
                <strong>{{ upgrade.skill }}</strong>
                <code>{{ upgrade.employeeId }}</code>
                <p class="bs-hq-plans__prose">{{ upgrade.reason }}</p>
              </li>
            </ul>
            <p v-else class="bs-hq-plans__meta">{{ copy.empty }}</p>
          </section>
          <section v-if="selected.hrReview" class="bs-hq-plans__section">
            <h4>{{ copy.hrReviewLabel }}</h4>
            <p class="bs-hq-plans__prose">{{ selected.hrReview.summary }}</p>
            <code>{{ selected.hrReview.reference }}</code>
          </section>
          <section v-if="selected.ceoReview" class="bs-hq-plans__section">
            <h4>{{ copy.ceoReviewLabel }}</h4>
            <p class="bs-hq-plans__prose">{{ selected.ceoReview.summary }}</p>
            <code>{{ selected.ceoReview.reference }}</code>
          </section>

          <footer v-if="selected.status === 'ready' && !selected.legacy" class="bs-hq-plans__decisions">
            <BsButton type="button" variant="primary" :disabled="!canDecide" :pending="workspace.pending" @click="decide('approved')">{{ copy.approveLabel }}</BsButton>
            <BsButton type="button" variant="secondary" :disabled="!canDecide" @click="decide('rejected')">{{ copy.rejectLabel }}</BsButton>
          </footer>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.bs-hq-plans { --bs-surface: var(--bs-color-neutral-charcoal); --bs-text: var(--bs-color-brand-pearl-white); --bs-text-muted: var(--bs-color-brand-soft-silver); --bs-border: var(--bs-color-neutral-graphite); --bs-accent: var(--bs-color-brand-premium-gold); display: grid; gap: var(--bs-space-5); min-width: 0; color: var(--bs-text); }
.bs-hq-plans__header { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: var(--bs-space-3); }
.bs-hq-plans h2, .bs-hq-plans h3, .bs-hq-plans h4, .bs-hq-plans p { margin: 0; }
.bs-hq-plans h2 { font-size: 1.1rem; font-weight: var(--bs-weight-bold); }
.bs-hq-plans h3 { font-size: 1rem; line-height: 1.5; font-weight: var(--bs-weight-bold); }
.bs-hq-plans h4 { font-size: 0.85rem; font-weight: var(--bs-weight-bold); }
.bs-hq-plans__toolbar { display: flex; flex-wrap: wrap; gap: var(--bs-space-2); }
.bs-hq-plans__identity, .bs-hq-plans__meta { color: var(--bs-text-muted); font-size: 0.75rem; line-height: 1.6; overflow-wrap: anywhere; }
.bs-hq-plans__identity { margin-block-start: var(--bs-space-1) !important; }
.bs-hq-plans__notice, .bs-hq-plans__state { padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-control); background: var(--bs-color-neutral-ink); color: var(--bs-text-muted); font-size: 0.8rem; line-height: 1.7; overflow-wrap: anywhere; }
.bs-hq-plans__state { display: grid; justify-items: start; gap: var(--bs-space-3); }
.bs-hq-plans__workspace { display: grid; gap: var(--bs-space-5); min-width: 0; }
.bs-hq-plans__list { display: grid; gap: var(--bs-space-2); min-width: 0; }
.bs-hq-plans .bs-hq-plans__choice { display: grid; justify-items: start; gap: var(--bs-space-1); min-width: 0; width: 100%; min-height: 44px; padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-control); background: var(--bs-color-neutral-ink); color: var(--bs-text); text-align: start; }
.bs-hq-plans .bs-hq-plans__choice[aria-pressed='true'] { border-color: var(--bs-accent); background: var(--bs-color-neutral-graphite); }
.bs-hq-plans .bs-hq-plans__choice:focus-visible { outline: 2px solid var(--bs-accent); outline-offset: 2px; }
.bs-hq-plans__choice-title { font-size: 0.85rem; font-weight: var(--bs-weight-bold); line-height: 1.6; overflow-wrap: anywhere; }
.bs-hq-plans__detail { display: grid; gap: var(--bs-space-5); min-width: 0; padding-block-start: var(--bs-space-4); border-block-start: 1px solid var(--bs-border); }
.bs-hq-plans__plan-header { display: grid; gap: var(--bs-space-2); }
.bs-hq-plans__status { color: var(--bs-accent); font-size: 0.75rem; line-height: 1.6; }
.bs-hq-plans__prose { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.85rem; line-height: 1.85; }
.bs-hq-plans__body { padding: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-control); background: var(--bs-color-neutral-ink); }
.bs-hq-plans__section { display: grid; gap: var(--bs-space-2); min-width: 0; }
.bs-hq-plans__items { display: grid; gap: var(--bs-space-3); margin: 0; padding: 0; list-style: none; }
.bs-hq-plans__items li { display: grid; gap: var(--bs-space-1); min-width: 0; padding-inline-start: var(--bs-space-3); border-inline-start: 1px solid var(--bs-border); }
.bs-hq-plans__items strong { font-size: 0.85rem; line-height: 1.7; overflow-wrap: anywhere; }
.bs-hq-plans code { display: block; width: fit-content; max-width: 100%; color: var(--bs-text-muted); direction: ltr; unicode-bidi: isolate; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.72rem; line-height: 1.7; }
.bs-hq-plans__decisions { display: flex; flex-wrap: wrap; gap: var(--bs-space-2); padding-block-start: var(--bs-space-4); border-block-start: 1px solid var(--bs-border); }
.bs-hq-plans :deep(.ls-input) { color: var(--bs-text); border-color: var(--bs-border); background: var(--bs-color-neutral-ink); }
.bs-hq-plans :deep(.bs-auth-form) { background: var(--bs-surface); border-color: var(--bs-border); box-shadow: none; }
</style>
