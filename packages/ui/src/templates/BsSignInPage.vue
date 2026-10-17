<script setup lang="ts">
type OAuthProvider = 'google'
const email = defineModel<string>('email', { required: true })
const password = defineModel<string>('password', { required: true })
const rememberEmail = defineModel<boolean>('rememberEmail', { default: false })

const props = defineProps<{
  availability?: { state: 'loading' | 'error' | 'permission'; title: string; description: string }
  product: {
    name: string
    presentation?: 'default' | 'flat' | 'glass'
    assetPrefix?: string
    homeLabel: string
    title: string
    description: string
  }
  copy: {
    eyebrow?: string
    title: string
    description: string
    email: string
    password: string
    submit: string
    pending: string
    accountPrompt?: string
    signup?: string
    continue?: string
    back?: string
    remember?: string
    or?: string
    google?: string
    checkingEmail?: string
  }
  signupTo?: string
  forgot?: { to: string; label: string }
  legal?: { to: string; label: string }[]
  emailAutocomplete?: 'email' | 'username'
  oauthProviders?: OAuthProvider[]
  pending?: boolean
  emailStepRequired?: boolean
  emailStepPending?: boolean
  emailStepApproved?: boolean
  emailStepError?: string | null
  /** Shown directly under the password field for failed password authentication. */
  passwordError?: string | null
  /** Separate from generic OAuth pending so the password arrow only spins for password login. */
  passwordPending?: boolean
  error?: string | null
  hydrated?: boolean
  sessionAction?: { label: string; pending: boolean }
}>()
const emit = defineEmits<{ submit: []; endSession: []; oauth: [provider: OAuthProvider]; validateEmail: [email: string]; editEmail: [] }>()

// Email-first is an interaction stage only. The owning Suit still performs its
// existing password authentication; shared UI never selects an auth backend.
const passwordStep = ref(false)
const passwordControl = ref<{ focus: () => void } | null>(null)
watch(() => props.emailStepApproved, (approved) => {
  if (approved && !passwordStep.value) passwordStep.value = true
})
watch(passwordStep, async (visible) => {
  if (visible) {
    await nextTick()
    passwordControl.value?.focus()
  }
})
const glass = computed(() => (props.product.presentation ?? 'glass') === 'glass')
const enabledProviders = computed(() => props.oauthProviders ?? [])
const authenticatingPassword = computed(() => props.passwordPending ?? props.pending ?? false)
// Legacy Suits still supply only `error`; they get inline password feedback too.
// Shop Suit supplies passwordError explicitly and retains separate form-level
// errors for OAuth, connectivity, account confirmation, and rate limits.
const passwordFieldError = computed(() => {
  if (!glass.value || !passwordStep.value) return null
  return props.passwordError === undefined ? props.error : props.passwordError
})
const formLevelError = computed(() => {
  if (glass.value && passwordStep.value && props.passwordError === undefined) return null
  return props.error
})
watch(passwordFieldError, async (message) => {
  if (!message || !passwordStep.value) return
  await nextTick()
  passwordControl.value?.focus()
})
function onSubmit() {
  if (props.pending || props.emailStepPending) return
  if (glass.value && !passwordStep.value) {
    if (email.value.trim()) {
      if (props.emailStepRequired) emit('validateEmail', email.value.trim())
      else passwordStep.value = true
    }
    return
  }
  emit('submit')
}
function goBack() {
  if (props.pending || props.emailStepPending) return
  password.value = ''
  passwordStep.value = false
  emit('editEmail')
}
</script>

<template>
  <BsAuthLayout
    :presentation="product.presentation ?? 'glass'"
    :product-name="product.name"
    :home-label="product.homeLabel"
    :title="product.title"
    :description="product.description"
  >
    <template #logo="{ tone }">
      <BsProductLogo
        :name="product.name"
        :asset-prefix="product.assetPrefix"
        :kind="glass ? 'mark' : 'wordmark'"
        :tone="tone"
        size="auth"
      />
    </template>

    <BsStateSurface
      v-if="availability"
      :title-level="1"
      :state="availability.state"
      :title="availability.title"
      :description="availability.description"
    />

    <BsAuthForm
      v-else-if="glass"
      :eyebrow="copy.eyebrow"
      :title="copy.title"
      :description="copy.description"
      :pending="pending"
      :error="formLevelError"
      :novalidate="emailStepRequired || undefined"
      :data-hydrated="hydrated"
      :data-client-ready="hydrated ? 'true' : 'false'"
      @submit="onSubmit"
    >
      <div
        class="bs-sign-in__identity"
        :class="{
          'bs-sign-in__identity--locked': passwordStep,
          'bs-sign-in__identity--invalid': Boolean(emailStepError),
        }"
        :aria-busy="emailStepPending || undefined"
      >
        <BsField v-slot="field" :label="copy.email" :error="emailStepError" required>
          <BsInput
            :id="field.id"
            v-model="email"
            :invalid="Boolean(emailStepError)"
            :aria-describedby="field.describedby"
            type="email"
            :autocomplete="emailAutocomplete ?? 'email'"
            :readonly="passwordStep || emailStepPending"
            required
            dir="ltr"
          />
        </BsField>
        <Transition name="bs-sign-in-arrow">
          <BsButton
            v-if="!passwordStep"
            type="submit"
            variant="primary"
            class="bs-sign-in__arrow"
            :aria-label="emailStepPending ? (copy.checkingEmail ?? copy.continue ?? copy.submit) : (copy.continue ?? copy.submit)"
            :disabled="pending || emailStepPending"
          >
            <span v-if="emailStepPending" class="bs-sign-in__spinner" aria-hidden="true" />
            <BsIcon v-else name="arrowRight" directional />
          </BsButton>
        </Transition>
        <Transition name="bs-sign-in-arrow">
          <BsButton
            v-if="passwordStep"
            type="button"
            variant="link"
            class="bs-sign-in__edit-email"
            :disabled="pending"
            @click="goBack"
          >{{ copy.back ?? copy.email }}</BsButton>
        </Transition>
      </div>

      <Transition name="bs-sign-in-password">
        <div
          v-if="passwordStep"
          class="bs-sign-in__identity bs-sign-in__password-row"
          :class="{ 'bs-sign-in__identity--invalid': Boolean(passwordFieldError) }"
        >
          <BsField v-slot="field" :label="copy.password" :error="passwordFieldError" :required="passwordStep">
            <BsInput
              :id="field.id"
              ref="passwordControl"
              v-model="password"
              :invalid="Boolean(passwordFieldError)"
              :aria-describedby="field.describedby"
              type="password"
              autocomplete="current-password"
              :required="passwordStep"
              dir="ltr"
            />
          </BsField>
          <Transition name="bs-sign-in-arrow" appear>
            <BsButton
              type="submit"
              variant="primary"
              class="bs-sign-in__arrow"
              :aria-label="authenticatingPassword ? copy.pending : copy.submit"
              :aria-busy="authenticatingPassword || undefined"
              :disabled="pending"
            >
              <span v-if="authenticatingPassword" class="bs-sign-in__spinner" aria-hidden="true" />
              <BsIcon v-else name="arrowRight" directional />
            </BsButton>
          </Transition>
        </div>
      </Transition>

      <span v-if="emailStepPending" role="status" class="sr-only">{{ copy.checkingEmail ?? copy.continue }}</span>
      <span v-if="authenticatingPassword && passwordStep" role="status" class="sr-only">{{ copy.pending }}</span>
      <div class="bs-sign-in__options">
        <BsCheckbox
          v-if="copy.remember"
          :model-value="rememberEmail"
          :label="copy.remember"
          :disabled="pending"
          @update:model-value="rememberEmail = typeof $event === 'boolean' ? $event : false"
        />
        <BsLink v-if="passwordStep && forgot" :to="forgot.to" variant="muted">{{ forgot.label }}</BsLink>
      </div>

      <div v-if="enabledProviders.length" class="bs-sign-in__divider" aria-hidden="true">
        <span>{{ copy.or }}</span>
      </div>
      <div v-if="enabledProviders.length" class="bs-sign-in__providers">
        <BsButton
          v-if="enabledProviders.includes('google')"
          type="button"
          variant="secondary"
          class="bs-sign-in__provider"
          :disabled="pending"
          @click="emit('oauth', 'google')"
        >
          <span class="bs-sign-in__provider-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="23" height="23" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M21.35 12.24c0-.72-.06-1.25-.2-1.8H12v3.46h5.36a4.59 4.59 0 0 1-2 3.03v2.5h3.22c1.9-1.75 2.77-4.34 2.77-7.19Z"/>
              <path fill="#34A853" d="M12 21.73c2.64 0 4.86-.87 6.48-2.36l-3.22-2.5c-.9.6-2.04.97-3.26.97-2.5 0-4.63-1.7-5.39-4.01H3.3v2.57A9.78 9.78 0 0 0 12 21.73Z"/>
              <path fill="#FBBC05" d="M6.61 13.83a5.88 5.88 0 0 1 0-3.66V7.6H3.3a9.78 9.78 0 0 0 0 8.8l3.31-2.57Z"/>
              <path fill="#EA4335" d="M12 6.16c1.44 0 2.73.49 3.75 1.47l2.8-2.79A9.06 9.06 0 0 0 12 2.27 9.78 9.78 0 0 0 3.3 7.6l3.31 2.57C7.37 7.86 9.5 6.16 12 6.16Z"/>
            </svg>
          </span>
          <span class="bs-sign-in__provider-label">{{ copy.google }}</span>
          <span class="bs-sign-in__provider-arrow" aria-hidden="true"><BsIcon name="arrowRight" directional /></span>
        </BsButton>
      </div>
      <template v-if="signupTo" #footer>
        {{ copy.accountPrompt }}
        <BsLink :to="signupTo" variant="standalone">{{ copy.signup }}</BsLink>
      </template>
    </BsAuthForm>

    <!-- Existing split/flat presentation remains compatible with every consumer. -->
    <BsAuthForm
      v-else
      :eyebrow="copy.eyebrow"
      :title="copy.title"
      :description="copy.description"
      :pending="pending"
      :error="error"
      :submit-label="copy.submit"
      :pending-label="copy.pending"
      :data-hydrated="hydrated"
      :data-client-ready="hydrated ? 'true' : 'false'"
      @submit="onSubmit"
    >
      <BsField v-slot="field" :label="copy.email" required>
        <BsInput :id="field.id" v-model="email" type="email" :autocomplete="emailAutocomplete ?? 'email'" required dir="ltr" />
      </BsField>
      <BsField v-slot="field" :label="copy.password" required>
        <BsInput :id="field.id" v-model="password" type="password" autocomplete="current-password" required dir="ltr" />
      </BsField>
      <BsLink v-if="forgot" :to="forgot.to" variant="muted">{{ forgot.label }}</BsLink>
      <template v-if="signupTo" #footer>{{ copy.accountPrompt }} <BsLink :to="signupTo" variant="standalone">{{ copy.signup }}</BsLink></template>
    </BsAuthForm>

    <BsButton v-if="sessionAction" :pending="sessionAction.pending" :disabled="sessionAction.pending" @click="emit('endSession')">{{ sessionAction.label }}</BsButton>
    <BsInline v-if="legal" as="nav" justify="center"><BsLink v-for="link in legal" :key="link.to" :to="link.to" variant="muted">{{ link.label }}</BsLink></BsInline>
  </BsAuthLayout>
</template>
