import { useRecordAction } from '@building-suit/ux'
import { doctorAccountCopy,doctorAccountError } from '../utils/accountPresentation'
import { validDoctorAccountForm,type DoctorAccountForm } from '../utils/accountSettings'
export function useDoctorAccountPresentation() {
  const { locale } = useI18n();const auth = useDoctorAuth();const account = useNuxtApp().$doctorAccount
  const copy = computed(() => doctorAccountCopy(locale.value==='ar'))
  const form = ref<DoctorAccountForm>({ personalName: '',contactPhone: '',inAppConfirmations: false })
  const editor = useRecordAction(() => form.value)
  const error = computed(() => doctorAccountError(account.state.error,locale.value==='ar'))
  const identityKey = computed(() => auth.state.identity ? JSON.stringify([auth.state.identity.userId,auth.state.identity.sessionId]) : null)
  watch(identityKey,() => { editor.reset();form.value = { personalName: '',contactPhone: '',inAppConfirmations: false };if(identityKey.value)void account.load() },{ immediate: true })
  watch(() => account.state.settings,value => { if(!value) { editor.reset();form.value = { personalName: '',contactPhone: '',inAppConfirmations: false } } })
  function edit() { const data = account.state.settings;if(!data || account.state.pending)return;form.value = { personalName: data.personalName,contactPhone: data.contactPhone,inAppConfirmations: data.inAppConfirmations };editor.edit() }
  async function save() {
    await editor.run(async () => { if(!await account.update(form.value))throw new Error('account-command') },() => error.value || copy.value.retry)
  }
  async function reauthenticate() { editor.reset();form.value = { personalName: '',contactPhone: '',inAppConfirmations: false };await auth.signOut();await navigateTo('/sign-in?next=/account') }
  const view = computed(() => {
    const data = account.state.settings
    return { title: copy.value.title,description: copy.value.description,loading: account.state.pending && !data,loadingLabel: copy.value.loading,error: error.value,saved: account.state.saved ? copy.value.saved : null,canEdit: Boolean(data) && !account.state.pending,
      summary: data ? [{ label: copy.value.name,value: data.personalName || copy.value.empty },{ label: copy.value.phone,value: data.contactPhone || copy.value.empty },{ label: copy.value.confirmations,value: data.inAppConfirmations ? copy.value.on : copy.value.off }] : [],
      copy: copy.value,needsReauthentication: account.state.error==='reauthenticate',
      editor: { dirty: editor.dirty.value,pending: editor.pending.value,error: editor.error.value,submitDisabled: !validDoctorAccountForm(form.value) || account.state.pending },
    }
  })
  onUnmounted(() => { editor.reset();form.value = { personalName: '',contactPhone: '',inAppConfirmations: false } })
  return { account,view,form,editorOpen: editor.visible,edit,save,reauthenticate }
}
