import { useRecordAction } from '@building-suit/ux'
import { doctorScopeKey } from '../utils/contextScope'
import { doctorPatientToday,validDoctorPatientForm,type DoctorPatientRow,type DoctorPatientQuery } from '../utils/patients'
import { doctorPatientsCopy,doctorPatientError } from '../utils/patientsPresentation'
const empty = () => ({ name: '',phone: '',email: '',dateOfBirth: '' })
export function useDoctorPatientDirectory() {
  const context = useDoctorContext(); const patients = useDoctorPatients(); const getScope = useNuxtApp().$doctorPatientsScope
  const { locale } = useI18n(); const ar = computed(() => locale.value==='ar'); const words = computed(() => doctorPatientsCopy(ar.value))
  const hydrated = ref(false); onMounted(() => { hydrated.value = true })
  const scopeKey = computed(() => { const scope = getScope(); return scope ? doctorScopeKey(scope,'patients') : null })
  const query = reactive<DoctorPatientQuery>({ page: 0,size: 20,search: '',status: 'active' })
  const form = ref(empty()); const selected = shallowRef<DoctorPatientRow | null>(null); const target = shallowRef<DoctorPatientRow | null>(null); const acknowledged = ref(false)
  const editor = useRecordAction(() => form.value); const archiving = useRecordAction(() => target.value?.id)
  function reset() { form.value = empty(); selected.value = null; target.value = null; acknowledged.value = false; Object.assign(query,{ page: 0,size: 20,search: '',status: 'active' }); editor.reset(); archiving.reset() }
  const unregister = context.registerClear(reset)
  onBeforeUnmount(() => { unregister(); reset(); patients.clear() })
  watch(form,() => { acknowledged.value = false; patients.changed(selected.value,form.value) },{ deep: true,flush: 'sync' })
  watch(() => patients.state.duplicates,() => { acknowledged.value = false })
  async function reload() { const result = await patients.load({ ...query }); if (!result && scopeKey.value && patients.state.error==='denied') await context.refresh(); return result }
  watch(scopeKey,() => { reset(); if (hydrated.value) void reload() },{ flush: 'sync' })
  const canCreate = computed(() => hydrated.value && Boolean(scopeKey.value) && !patients.state.loading && Boolean(patients.state.directory?.canWrite))
  function closeEditor() { editor.reset(); patients.discard(); selected.value = null; form.value = empty(); acknowledged.value = false }
  watch(editor.visible,value => { if (!value && !editor.pending.value) { patients.discard(); acknowledged.value = false } })
  function create() { if (!canCreate.value) return; patients.discard(); selected.value = null; form.value = empty(); acknowledged.value = false; editor.create() }
  function edit(id: string) {
    const row = patients.state.directory?.rows.find(item => item.id===id)
    if (!canCreate.value || !row || row.archivedAt) return
    patients.discard(); selected.value = { ...row }; form.value = { name: row.name,phone: row.phone,email: row.email,dateOfBirth: row.dateOfBirth }; acknowledged.value = false; editor.edit()
  }
  function archive(id: string) { const row = patients.state.directory?.rows.find(item => item.id===id); if (canCreate.value && row && !row.archivedAt) { patients.discard(); target.value = { ...row }; archiving.edit() } }
  async function failure() { if (patients.state.error==='denied') await context.refresh(); throw new Error('DOCTOR_PATIENT_COMMAND_FAILED') }
  async function save() {
    if (!editor.visible.value) return
    const row = selected.value; const values = { ...form.value }; const reviewed = acknowledged.value
    const done = await editor.run(async () => { if (!await patients.write(row,values,reviewed)) await failure() },() => doctorPatientError(patients.state.error,ar.value) || words.value.errors.network)
    if (done) { closeEditor(); await reload() }
  }
  async function confirmArchive() {
    const row = target.value; if (!archiving.visible.value || !row) return
    const done = await archiving.run(async () => { if (!await patients.archive(row)) await failure() },() => doctorPatientError(patients.state.error,ar.value) || words.value.errors.network)
    if (done) { target.value = null; await reload() }
  }
  function search(expected: string | null,value: string) { if (expected!==scopeKey.value || patients.state.pending) return; query.search = value; query.page = 0; void reload() }
  function page(expected: string | null,value: number,size: number) { if (expected!==scopeKey.value || patients.state.pending) return; query.page = value; query.size = size; void reload() }
  function status(expected: string | null,value: string) { if (expected!==scopeKey.value || patients.state.pending || !['active','archived','all'].includes(value)) return; query.status = value as DoctorPatientQuery['status']; query.page = 0; void reload() }
  function date(value: string) { return new Intl.DateTimeFormat(ar.value ? 'ar' : 'en',{ dateStyle: 'medium',timeStyle: 'short',timeZone: getScope()?.timezone || 'Etc/UTC' }).format(new Date(value)) }
  const rows = computed(() => (patients.state.directory?.rows || []).map(row => ({ id: row.id,name: row.name,phone: row.phone,email: row.email,dateOfBirth: row.dateOfBirth,status: row.archivedAt ? words.value.archived : words.value.active,updated: date(row.updatedAt),canEdit: canCreate.value && !row.archivedAt,canArchive: canCreate.value && !row.archivedAt })))
  const copy = computed(() => ({ ...words.value,duplicateCount: words.value.duplicateCount(patients.state.duplicates?.rows.length || 0,patients.state.duplicates?.total || 0) }))
  const latestDate = computed(() => doctorPatientToday(getScope()?.timezone || 'Etc/UTC'))
  const editorView = computed(() => ({ title: editor.mode.value==='create' ? words.value.create : words.value.edit,dirty: editor.dirty.value,pending: editor.pending.value,error: editor.error.value,latestDate: latestDate.value,submitDisabled: !validDoctorPatientForm(form.value,latestDate.value) || Boolean(patients.state.duplicates?.total && !acknowledged.value),duplicates: (patients.state.duplicates?.rows || []).map(row => ({ id: row.id,name: row.name,phone: row.phone,email: row.email,status: row.archivedAt ? words.value.archived : words.value.active })),duplicateTotal: patients.state.duplicates?.total || 0 }))
  const archiveView = computed(() => ({ title: `${words.value.archive}: ${target.value?.name || ''}`,description: words.value.archiveDescription,pending: archiving.pending.value,error: archiving.error.value }))
  const scopeLabel = computed(() => { const scope = context.state.current; return scope ? `${scope.doctorName} · ${scope.practiceName} · ${scope.locationName} · ${scope.timezone}` : '' })
  return { context,patients,query,form,acknowledged,copy,scopeKey,scopeLabel,hydrated,canCreate,rows,editorView,archiveView,editorOpen: editor.visible,archiveOpen: archiving.visible,create,edit,archive,save,confirmArchive,reload,search,page,status,
    statusOptions: computed(() => [{ value: 'active',label: words.value.active },{ value: 'archived',label: words.value.archived },{ value: 'all',label: words.value.all }]),
    error: computed(() => patients.state.directory ? null : patients.state.error==='network' ? ar.value ? 'تعذر تحميل دليل المرضى. أعد المحاولة.' : 'The patient directory could not be loaded. Retry.' : doctorPatientError(patients.state.error,ar.value)),
  }
}
