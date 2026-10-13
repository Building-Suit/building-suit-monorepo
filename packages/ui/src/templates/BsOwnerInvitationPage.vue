<script setup lang="ts">
interface View { phase:'loading'|'ready'|'error'|'done';pending:boolean;failed:boolean }
const props = defineProps<{ copy: Record<'ownerInvite.askAdmin' | 'ownerInvite.confirm' | 'ownerInvite.description' | 'ownerInvite.done' | 'ownerInvite.home' | 'ownerInvite.invalid' | 'ownerInvite.loading' | 'ownerInvite.login' | 'ownerInvite.open' | 'ownerInvite.password' | 'ownerInvite.passwordError' | 'ownerInvite.passwordTitle' | 'ownerInvite.save' | 'ownerInvite.title' | 'ownerInvite.verified', string>; view: View }>()
const { copy } = toRefs(props)
const password=defineModel<string>('password',{required:true})
const confirmation=defineModel<string>('confirmation',{required:true})
const emit=defineEmits<{login:[];open:[];submit:[]}>()
const phase=computed(()=>props.view.phase)
const pending=computed(()=>props.view.pending)
const failed=computed(()=>props.view.failed)
</script>

<template>
  <BsAuthLayout product-name="Shop Suit" :home-label="copy['ownerInvite.home']" :title="copy['ownerInvite.title']" :description="copy['ownerInvite.description']">
    <template #logo="{ tone }"><BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" :tone="tone" /></template>
    <BsStateSurface v-if="phase === 'loading'" state="loading" :title="copy['ownerInvite.loading']" />
    <BsStateSurface v-else-if="phase === 'error'" state="error" :title="copy['ownerInvite.invalid']" :description="copy['ownerInvite.askAdmin']" :action-label="copy['ownerInvite.login']" @action="emit('login')" />
    <BsStateSurface v-else-if="phase === 'done'" state="success" :title="copy['ownerInvite.done']" :action-label="copy['ownerInvite.open']" @action="emit('open')" />
    <BsAuthForm v-else :title="copy['ownerInvite.passwordTitle']" :description="copy['ownerInvite.verified']" :error="failed ? copy['ownerInvite.passwordError'] : undefined" :pending="pending" :submit-label="copy['ownerInvite.save']" @submit="emit('submit')">
      <BsField :label="copy['ownerInvite.password']" for="owner-password" required>
        <BsInput id="owner-password" v-model="password" type="password" autocomplete="new-password" minlength="6" required />
      </BsField>
      <BsField :label="copy['ownerInvite.confirm']" for="owner-confirm" required>
        <BsInput id="owner-confirm" v-model="confirmation" type="password" autocomplete="new-password" minlength="6" required />
      </BsField>
    </BsAuthForm>
  </BsAuthLayout>
</template>
