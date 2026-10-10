/** Ledger-owned formatting and context mapping for shared presentation. */
export interface LedgerSeriesPoint {
  month: string
  revenue_minor: number
  expense_minor: number
  net_minor: number
}

export function useLedgerPresentation() {
  const { baseCurrency, current } = useTenant()
  const { t, locale } = useI18n()

  function currency(value?: string | null) { return value ?? baseCurrency.value }
  function date(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed)
  }
  function context(from?: string, to?: string, asOf?: string) {
    const period = asOf ? t('pageContext.asOfValue', { date: date(asOf) })
      : from && to ? t('pageContext.periodValue', { from: date(from), to: date(to) }) : ''
    return [
      { label: t('pageContext.organization'), value: current.value?.name ?? t('org.none') },
      ...(period ? [{ label: t('pageContext.reportingPeriod'), value: period }] : []),
    ]
  }
  function kpi(amount: number | string | null | undefined, previous: number | null | undefined = null, direction: 'up' | 'down' | 'neutral' = 'up') {
    if (previous === null || previous === undefined || previous === 0) return { label: undefined, tone: 'neutral' }
    const change = ((Number(amount ?? 0) - previous) / Math.abs(previous)) * 100
    const improving = direction === 'up' ? change > 0 : change < 0
    return {
      label: t('dashboard.changeVsLastMonth', { change: formatPercent(change, locale.value) }),
      tone: direction === 'neutral' || Math.abs(change) < 0.05 ? 'neutral' : improving ? 'success' : 'danger',
    }
  }
  const chartSeries = computed(() => [
    { id: 'revenue', label: t('dashboard.revenue'), tone: 'success' as const },
    { id: 'expense', label: t('dashboard.expenses'), tone: 'info' as const },
  ])
  const chartTableSeries = computed(() => [...chartSeries.value, { id: 'net', label: t('dashboard.net'), tone: 'neutral' as const }])
  function chartPoints(series: LedgerSeriesPoint[]) {
    return series.map(point => ({
      id: point.month,
      label: formatMonth(point.month, locale.value),
      values: { revenue: Number(point.revenue_minor), expense: Number(point.expense_minor), net: Number(point.net_minor) },
      formattedValues: {
        revenue: formatMoney(point.revenue_minor, baseCurrency.value, locale.value),
        expense: formatMoney(point.expense_minor, baseCurrency.value, locale.value),
        net: formatMoney(point.net_minor, baseCurrency.value, locale.value),
      },
    }))
  }
  return reactive({ currency, context, kpi, chartSeries, chartTableSeries, chartPoints, locale, t })
}
