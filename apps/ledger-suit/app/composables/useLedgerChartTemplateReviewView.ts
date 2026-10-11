import { reviewedChartTemplates, type ChartTemplateKey } from '~/utils/setupExperience'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerChartTemplateReviewView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const selected = ref<ChartTemplateKey>('services')
const visible = computed(() => route.query.setup === 'templates')
const template = computed(() => reviewedChartTemplates.find(item => item.key === selected.value)!)

function close() {
  const query = { ...route.query }
  delete query.setup
  void router.replace({ query })
}
return { reviewedChartTemplates, t, route, router, selected, visible, template, close }
}
