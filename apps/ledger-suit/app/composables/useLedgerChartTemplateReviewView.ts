import { reviewedChartTemplates, type ChartTemplateKey } from '~/utils/setupExperience'

/** Product-owned reviewed chart blueprints and route selection. */
export function useLedgerChartTemplateReviewView() {
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
