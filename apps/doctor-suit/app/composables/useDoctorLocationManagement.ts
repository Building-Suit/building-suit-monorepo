import { useRecordAction } from '@building-suit/ux'
import { doctorScopeKey } from '../utils/contextScope'
import { doctorLocationError, doctorLocationsCopy } from '../utils/locationsPresentation'
import { validDoctorLocationForm, type DoctorLocationRow } from '../utils/locations'

export function useDoctorLocationManagement() {
  const context = useDoctorContext()
  const getScope = useNuxtApp().$doctorLocationsScope
  const locations = useDoctorLocations()
  const { locale } = useI18n()
  const ar = computed(() => locale.value === 'ar')
  const copy = computed(() => doctorLocationsCopy(ar.value))
  const hydrated = ref(false)
  onMounted(() => { hydrated.value = true })
  const query = reactive({ page: 0, size: 20, search: '' })
  const form = ref({ name: '', timezone: '', phone: '', address: '' })
  const selected = shallowRef<DoctorLocationRow | null>(null)
  const archiveTarget = shallowRef<DoctorLocationRow | null>(null)
  const editor = useRecordAction(() => form.value)
  const archiving = useRecordAction(() => archiveTarget.value?.id)
  const scopeKey = computed(() => { const scope = getScope(); return scope ? doctorScopeKey(scope, 'locations') : null })
  function reset() {
    form.value = { name: '', timezone: '', phone: '', address: '' }; selected.value = null; archiveTarget.value = null
    query.page = 0; query.search = ''; editor.reset(); archiving.reset()
  }
  const unregisterPolicy=locations.registerPolicyChange(reset)
  onBeforeUnmount(unregisterPolicy)
  const unregister = context.registerClear(reset)
  onBeforeUnmount(() => { unregister(); reset() })
  async function reload() {
    const previousScope = scopeKey.value
    const result = await locations.load({ ...query })
    if (!result && previousScope && locations.state.error === 'denied') await context.refresh()
    return result
  }
  watch(scopeKey, () => { reset(); if (hydrated.value) void reload() }, { flush: 'sync' })
  function search(expected: string | null, value: string) { if (expected !== scopeKey.value) return; query.search = value; query.page = 0; void reload() }
  function page(expected: string | null, value: number, size: number) { if (expected !== scopeKey.value) return; query.page = value; query.size = size; void reload() }
  const error = computed(() => doctorLocationError(locations.state.error, ar.value))
  function create() {
    if (!hydrated.value || !locations.state.directory?.canCreate) return
    selected.value = null
    form.value = { name: '', timezone: context.state.current?.timezone || '', phone: '', address: '' }
    editor.create()
  }
  function edit(id: string) {
    const row = locations.state.directory?.rows.find(item => item.id === id)
    if (!hydrated.value || !row?.canEdit || row.archivedAt) return
    selected.value = { ...row }; form.value = { name: row.name, timezone: row.timezone, phone: row.phone, address: row.address }
    editor.edit()
  }
  function archive(id: string) {
    const row = locations.state.directory?.rows.find(item => item.id === id)
    if (!hydrated.value || !row?.canManage || row.archivedAt) return
    archiveTarget.value = { ...row }; archiving.edit()
  }
  async function save() {
    if (!editor.visible.value) return
    const row = selected.value; const values = { ...form.value }
    const done = await editor.run(async () => {
      if (!await locations.write(row, values)) {
        if (locations.state.error === 'denied') await context.refresh()
        throw new Error('DOCTOR_LOCATION_COMMAND_FAILED')
      }
    }, () => doctorLocationError(locations.state.error, ar.value) || copy.value.errors.network)
    if (done) { await context.refresh(); await reload() }
  }
  async function confirmArchive() {
    const row = archiveTarget.value
    if (!archiving.visible.value || !row) return
    const done = await archiving.run(async () => {
      if (!await locations.archive(row)) {
        if (locations.state.error === 'denied') await context.refresh()
        throw new Error('DOCTOR_LOCATION_COMMAND_FAILED')
      }
    }, () => doctorLocationError(locations.state.error, ar.value) || copy.value.errors.network)
    if (done) { await context.refresh(); await reload() }
  }
  const rows = computed(() => (locations.state.directory?.rows || []).map(row => ({ id: row.id, name: row.name, timezone: row.timezone, phone: row.phone, address: row.address, status: row.archivedAt ? copy.value.archived : copy.value.active, canEdit: hydrated.value && row.canEdit && !row.archivedAt, canArchive: hydrated.value && row.canManage && !row.archivedAt })))
  const editorView = computed(() => ({ title: editor.mode.value === 'create' ? copy.value.create : copy.value.edit, dirty: editor.dirty.value, pending: editor.pending.value, error: editor.error.value, submitDisabled: !validDoctorLocationForm(form.value) }))
  const archiveView = computed(() => ({ title: `${copy.value.archive}: ${archiveTarget.value?.name || ''}`, description: copy.value.archiveDescription, pending: archiving.pending.value, error: archiving.error.value }))
  return { context, locations, copy, hydrated, query, form, scopeKey, search, page, error, rows, editorView, archiveView, editorOpen: editor.visible, archiveOpen: archiving.visible, create, edit, archive, save, confirmArchive, reload }
}
