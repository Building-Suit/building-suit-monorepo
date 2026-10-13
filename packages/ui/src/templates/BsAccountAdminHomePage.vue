<script setup lang="ts">
interface View {state:string;pending:boolean;actionError:boolean;moduleError:boolean;stateTitle:string;modules:{id:string;label:string}[]}
const props = defineProps<{ copy: Record<'accounts.close' | 'accounts.open' | 'accounts.title' | 'accounts.unavailable' | 'auth.actionError' | 'auth.authorized' | 'auth.deniedDescription' | 'auth.description' | 'auth.email' | 'auth.empty' | 'auth.password' | 'auth.pending' | 'auth.retry' | 'auth.signIn' | 'auth.signInError' | 'auth.signOut' | 'description' | 'product.name' | 'welcome', string>; view: View }>()
const { copy, view } = toRefs(props)
const email=defineModel<string>('email',{required:true})
const password=defineModel<string>('password',{required:true})
const emit=defineEmits<{module:[id:string];signOut:[];signIn:[];retry:[]}>()
const state=computed(()=>props.view.state)
const pending=computed(()=>props.view.pending)
const actionError=computed(()=>props.view.actionError)
const moduleError=computed(()=>props.view.moduleError)
</script>

<template>
  <BsAppShell v-if="state === 'success'" :product-name="copy['product.name']" home-path="/" :groups="[]" :labels="{ open: copy['accounts.open'], close: copy['accounts.close'], navigation: copy['accounts.title'], dashboard: copy['welcome'] }">
    <template #logo><BsProductLogo :name="copy['product.name']" /></template>
    <template #header><BsSettingsMenu /></template>
    <BsContentSection :title="copy['welcome']" :description="copy['description']" padding="lg">
      <BsStateSurface state="success" :title="copy['auth.authorized']" />
      <BsStack v-if="view.modules.length" gap="md">
        <BsButton v-for="item in view.modules" :key="item.id" variant="primary" @click="emit('module',item.id)">{{ item.label }}</BsButton>
      </BsStack>
      <BsStateSurface v-else :state="moduleError ? 'error' : 'empty'" :title="moduleError ? copy['accounts.unavailable'] : copy['auth.empty']" />
      <BsButton :pending="pending" @click="emit('signOut')">{{ copy['auth.signOut'] }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="copy['auth.actionError']" />
    </BsContentSection>
  </BsAppShell>
  <BsAuthLayout v-else :product-name="copy['product.name']" :home-label="copy['product.name']" :title="copy['product.name']" :description="copy['auth.description']">
    <template #logo="{ tone }"><BsProductLogo :name="copy['product.name']" :tone="tone" /></template>
    <BsAuthForm v-if="state === 'signed-out'" :title="copy['auth.signIn']" :description="copy['auth.description']" :pending="pending" :error="actionError ? copy['auth.signInError'] : null" :submit-label="copy['auth.signIn']" :pending-label="copy['auth.pending']" @submit="emit('signIn')">
      <BsField for="admin-email" :label="copy['auth.email']" required>
        <BsInput id="admin-email" v-model="email" type="email" autocomplete="username" required />
      </BsField>
      <BsField for="admin-password" :label="copy['auth.password']" required>
        <BsInput id="admin-password" v-model="password" type="password" autocomplete="current-password" required />
      </BsField>
    </BsAuthForm>
    <BsStack v-else gap="lg">
      <BsStateSurface :state="state === 'loading' ? 'loading' : state === 'denied' ? 'denied' : 'error'" :title="view.stateTitle" :description="state === 'denied' ? copy['auth.deniedDescription'] : undefined" :action-label="state === 'loading' ? undefined : copy['auth.retry']" @action="emit('retry')" />
      <BsButton v-if="state !== 'loading'" :pending="pending" @click="emit('signOut')">{{ copy['auth.signOut'] }}</BsButton>
      <BsStateSurface v-if="actionError" state="error" :title="copy['auth.actionError']" />
    </BsStack>
  </BsAuthLayout>
</template>
