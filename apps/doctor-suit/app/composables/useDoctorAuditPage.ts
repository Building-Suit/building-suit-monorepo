import { usePageRevalidation } from '@building-suit/ux'
import { doctorAuditCopy,doctorAuditError } from '../utils/auditPresentation'
export function useDoctorAuditPage(personal = false) {
  const nuxt = useNuxtApp();const context = useDoctorContext();const auth = useDoctorAuth();const { locale } = useI18n()
  const audit = personal ? nuxt.$doctorPersonalAudit : nuxt.$doctorAudit;const getScope = personal ? nuxt.$doctorPersonalAuditScope : nuxt.$doctorAuditScope
  const search = ref('');const query = reactive({ search: '',page: 0 });const hydrated = ref(false);let stopped = false
  const scopeKey = computed(() => getScope()?.key || null)
  const copy = computed(() => doctorAuditCopy(locale.value==='ar',personal));const state = audit.state
  async function read() { if(stopped)return false;return audit.load({ ...query }) }
  async function reload() {
    audit.clear()
    if(!personal)await context.refresh()
    if(stopped)return false
    const result = await read()
    if(!result && state.error==='denied') { if(personal)await auth.refresh();else await context.refresh() }
    return result
  }
  watch(scopeKey,() => { audit.clear();search.value = '';query.search = '';query.page = 0;if(hydrated.value && !stopped)void read() },{ flush: 'sync' })
  watch(() => auth.state.phase,phase => { if(phase==='signed-out' || phase==='unavailable')void navigateTo(personal ? '/sign-in?next=/account-activity' : '/sign-in?next=/audit') })
  onMounted(async () => { hydrated.value = true;await reload() });onBeforeUnmount(() => { stopped = true;audit.clear();search.value = '' })
  usePageRevalidation(reload,() => hydrated.value)
  async function submit(expected: string|null,value: string) { if(expected!==scopeKey.value || state.pending)return;query.search = value;query.page = 0;await reload() }
  async function page(expected: string|null,value: number) { if(expected!==scopeKey.value || state.pending || !Number.isSafeInteger(value) || value<0 || value>=Math.max(1,Math.ceil((state.result?.total || 0)/20)))return;query.page = value;await reload() }
  const rows = computed(() => (state.result?.rows || []).map(row => ({ id: row.id,timestamp: new Intl.DateTimeFormat(locale.value==='ar' ? 'ar-EG' : 'en-GB',{ timeZone: 'Etc/UTC',dateStyle: 'medium',timeStyle: 'medium' }).format(new Date(row.happenedAt)),actor: row.actorId,activity: copy.value.actions[row.eventType as keyof typeof copy.value.actions] || row.eventType,action: row.eventType,entity: row.entityId,before: '',after: '',metadata: '' })))
  const windowLabel = computed(() => `${personal ? copy.value.personal : getScope()?.locationId ? copy.value.clinic : copy.value.owner} · ${copy.value.count(state.result?.total || 0,rows.value.length)}`)
  const error = computed(() => doctorAuditError(state.error,locale.value==='ar'))
  const controls = computed(() => ({ searchLabel: copy.value.search,submitLabel: copy.value.submit,retryLabel: copy.value.retry,notice: copy.value.privacy,governance: copy.value.governance,scopeKey: scopeKey.value,backTo: personal ? '/account' : '/workspace',backLabel: copy.value.back,page: state.result?.page || 0,pages: Math.max(1,Math.ceil((state.result?.total || 0)/20)),pageLabel: `${(state.result?.page || 0)+1} / ${Math.max(1,Math.ceil((state.result?.total || 0)/20))}`,previous: locale.value==='ar' ? 'الصفحة السابقة' : 'Previous page',next: locale.value==='ar' ? 'الصفحة التالية' : 'Next page' }))
  return { state,copy,search,scopeKey,hydrated,rows,windowLabel,error,controls,reload,submit,page }
}
