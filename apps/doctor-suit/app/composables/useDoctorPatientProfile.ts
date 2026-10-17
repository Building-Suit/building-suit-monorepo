import { downloadBlob,useBlobUrl,usePageRevalidation,useRecordAction } from '@building-suit/ux'
import { doctorProfileCopy } from '../utils/patientProfilePresentation'
import type { DoctorDocumentVersion } from '../utils/patientProfile'
export function useDoctorPatientProfile() {
  const route = useRoute(); const localePath = useLocalePath(); const { locale } = useI18n()
  const context = useDoctorContext(); const profile = useNuxtApp().$doctorPatientProfile; const state = profile.state
  const copy = computed(() => doctorProfileCopy(locale.value==='ar')); const hydrated = ref(false)
  const scopeKey = computed(() => profile.scopeKey()); const patientId = computed(() => String(route.params.id || ''))
  const upload = useRecordAction(() => ({ file: state.file?.name || '',size: state.file?.size || 0,replacement: state.replacement?.id || '' }))
  const historyOpen = ref(false); const previewOpen = ref(false); const previewName = ref(''); const preview = useBlobUrl(); const confirm = useConfirmation()
  function reset() { upload.reset(); profile.discard(); profile.closeHistory(); historyOpen.value = false; previewOpen.value = false; previewName.value = ''; preview.clear() }
  const unregister = context.registerClear(reset)
  onBeforeUnmount(() => { unregister(); reset(); profile.clear() })
  watch(previewOpen,value => { if (!value) { preview.clear(); previewName.value = '' } })
  watch(historyOpen,value => { if (!value) profile.closeHistory() })
  watch(upload.visible,value => { if (!value && !state.pending) profile.discard() })
  async function denied() { if (state.error==='denied' || state.actionError==='denied' || state.documentsError==='denied' || state.historyError==='denied') { reset(); await context.refresh() } }
  async function reload() { reset(); const result = await profile.load(patientId.value); await denied(); return result }
  watch([scopeKey,patientId],() => { reset(); profile.clear(); if (hydrated.value) void reload() },{ flush: 'sync' })
  onMounted(() => { hydrated.value = true })
  usePageRevalidation(async () => { await context.refresh(); await reload() },() => hydrated.value && Boolean(scopeKey.value) && !state.pending && !upload.visible.value && !historyOpen.value && !previewOpen.value)
  function error(value: string | null,service = false) { return !value ? null : value==='denied' ? copy.value.denied : value==='invalid' ? copy.value.invalid : value==='conflict' ? copy.value.conflict : service ? copy.value.unavailable : copy.value.network }
  const file = computed({ get: () => state.file,set: value => { profile.choose(value,state.replacement?.id || null) } })
  function openUpload(id: string | null = null) { if (!hydrated.value || !profile.choose(null,id)) return; upload.create() }
  async function save() {
    if (!upload.visible.value) return
    const done = await upload.run(async () => { if (!await profile.upload()) { await denied(); throw new Error('DOCTOR_DOCUMENT_COMMAND_FAILED') } },() => error(state.actionError) || copy.value.network)
    if (done) { upload.reset(); await profile.documents() }
  }
  async function archive(id: string) {
    const expected = scopeKey.value; const patient = patientId.value; const version = state.documents?.rows.find(row => row.id===id)?.version
    if (!await confirm.ask({ title: copy.value.archive,message: copy.value.archiveDescription,confirmLabel: copy.value.archive,cancelLabel: copy.value.cancel,tone: 'danger' })) return
    if (expected!==scopeKey.value || patient!==patientId.value) return
    if (!version || state.documents?.rows.find(row => row.id===id)?.version!==version) { state.actionError = 'conflict'; return }
    if (await profile.archive(id,version)) { previewOpen.value = false; await profile.documents() } else await denied()
  }
  async function showHistory(id: string) { previewOpen.value = false; historyOpen.value = true; await profile.history(id); await denied() }
  async function delivery(id: string,versionId: string,show: boolean) {
    const result = await profile.download(id,versionId)
    if (!result) { await denied(); return }
    if (show && result.version.mime.startsWith('image/')) { preview.replace(result.blob); previewName.value = result.version.filename; previewOpen.value = true }
    else downloadBlob(result.version.filename,result.blob)
  }
  function date(value: string,timezone = context.state.current?.timezone || 'Etc/UTC') { return new Intl.DateTimeFormat(locale.value,{ dateStyle: 'medium',timeStyle: 'short',timeZone: timezone }).format(new Date(value)) }
  const label = (value: string,id: string) => value || id
  function versionView(value: DoctorDocumentVersion) { return { id: value.id,documentId: value.documentId,name: value.filename,revision: String(value.revision),size: `${value.size.toLocaleString(locale.value)} B`,uploader: label(value.uploaderLabel,value.uploadedBy),uploaded: date(value.uploadedAt,value.timezone),location: `${value.locationName} · ${value.timezone}`,canDownload: state.available && hydrated.value,canPreview: value.mime.startsWith('image/') } }
  const documentRows = computed(() => (state.documents?.rows || []).map(row => ({ ...versionView(row.current),id: row.id,versionId: row.current.id,mime: row.current.mime,status: row.archivedAt ? copy.value.archived : copy.value.unreviewed,canReplace: hydrated.value && profile.writable() && !row.archivedAt,canArchive: hydrated.value && profile.writable() && !row.archivedAt })))
  const eventName = (value: string) => ({ 'patient.created': copy.value.created,'patient.corrected': copy.value.corrected,'patient.archived': copy.value.patientArchived,'document.uploaded': copy.value.uploadedEvent,'document.replaced': copy.value.replaced,'document.archived': copy.value.archivedEvent,'document.download_requested': copy.value.downloaded })[value] || value
  const view = computed(() => { const data = state.profile; if (!data) return null; const row = data.patient; return { name: row.name,source: `${copy.value.source}: ${label(data.source.actorLabel,row.createdBy)} · ${data.source.locationName} · ${date(row.createdAt)}`,fields: [{ label: copy.value.patientName,value: row.name },{ label: copy.value.phone,value: row.phone || copy.value.unknown },{ label: copy.value.email,value: row.email || copy.value.unknown },{ label: copy.value.birth,value: row.dateOfBirth || copy.value.unknown },{ label: copy.value.provenance,value: copy.value.entered },{ label: copy.value.status,value: row.archivedAt ? copy.value.archived : copy.value.active }] } })
  return { context,profile,copy,scopeKey,hydrated,file,uploadOpen: upload.visible,historyOpen,previewOpen,reload,view,
    scopeLabel: computed(() => { const value = context.state.current; return value ? `${value.doctorName} · ${value.practiceName} · ${value.locationName} · ${value.timezone}` : '' }),backHref: computed(() => localePath('/patients')),
    activity: computed(() => (state.profile?.activity || []).map(item => ({ id: item.id,event: eventName(item.type),actor: label(item.actorLabel,item.actorId),location: item.locationName,date: date(item.happenedAt),version: String(item.version) }))),
    activityCount: computed(() => `${state.profile?.activity.length || 0} / ${state.profile?.activityTotal || 0}`),
    documentsView: computed(() => ({ rows: documentRows.value,total: state.documents?.total || 0,page: state.page,size: state.size,loading: state.documentsLoading,error: error(state.documentsError,true),denied: Boolean(state.profile && !state.profile.documentsRead),canUpload: hydrated.value && profile.writable(),pending: state.pending,actionError: error(state.actionError) })),
    uploadView: computed(() => ({ title: state.replacement ? copy.value.replace : copy.value.upload,dirty: upload.dirty.value,pending: upload.pending.value,error: upload.error.value || error(state.actionError),disabled: !state.file || !profile.writable() })),
    historyView: computed(() => ({ rows: (state.history?.versions || []).map(versionView),total: state.history?.total || 0,page: state.historyPage,loading: state.historyLoading,error: error(state.historyError),events: (state.history?.events || []).map(item => ({ id: item.id,event: eventName(item.type),actor: label(item.actorLabel,item.actorId),location: `${item.locationName} · ${item.timezone}`,date: date(item.happenedAt,item.timezone) })) })),
    previewView: computed(() => ({ url: preview.url.value,name: previewName.value })),error: computed(() => error(state.error)),openUpload,save,archive,showHistory,
    download: (id: string,versionId: string) => delivery(id,versionId,false),showPreview: (id: string,versionId: string) => delivery(id,versionId,true),
    documentsPage: (page: number,size: number) => { if (!state.pending) { profile.closeHistory(); historyOpen.value = false; void profile.documents(page,size) } },
    retryDocuments: async () => { const result = await profile.documents(); await denied(); return result },historyPage: (page: number) => state.historyDocumentId ? profile.history(state.historyDocumentId,page) : false,retryHistory: () => state.historyDocumentId ? profile.history(state.historyDocumentId,state.historyPage) : false,
  }
}
