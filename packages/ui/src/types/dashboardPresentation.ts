import type { BsChartPoint, BsChartSeries, BsSetupStepData } from '@building-suit/contracts'
export interface BsDashboardColumn { key: string; header: string; align?: 'start' | 'center' | 'end'; hidden?: boolean }
export interface BsDashboardMetric { id: string; title: string; value: string; hint: string; changeLabel: string; tone: string; to: string; source: { location: string; path: string } | null }
export interface BsDashboardRow { id: string; name: string; to: string; status: string; cells: Record<string, string>; source: { location: string; path: string } | null }
export interface BsDashboardTable { title: string; empty: string; rows: BsDashboardRow[]; columns: BsDashboardColumn[]; loading: boolean; error: string; to: string; action: boolean }
export interface BsDashboardFilters { period: string; date: string; location: string; months: number; custom: boolean; from: string; to: string }
export interface BsDashboardSetupForm { name: string; mode: string }
export interface BsDashboardView {
  periodLabel?: string
  title: string; subtitle: string; workspace: string; role: string; notice: string; available: boolean; loading: boolean; error: string; denied: string; empty: string; emptyDescription: string; canStart: boolean; errorDescription: string
  checklist: { visible: boolean; title: string; description: string; progress: string; steps: BsSetupStepData[]; loading: boolean; error: string | null; empty: string }
  setup: { title: string; description: string; trial: string; modeHelp: string; dirty: boolean; pending: boolean; error: string }
  plan: { visible: boolean; error: string; name: string; status: string; dateLabel: string; date: string }
  periodFilter: boolean; metricsLoading: boolean; metricsError: string; metricsTitle: string; metrics: BsDashboardMetric[]; highlightsLoading: boolean; highlights: BsDashboardMetric[]
  reportLink: { visible: boolean; title: string; description: string; to: string }
  chart: { visible: boolean; loading: boolean; error: string; title: string; pointLabel: string; tableLabel: string; empty: string; points: BsChartPoint[]; series: BsChartSeries[]; tableSeries: BsChartSeries[] }
  cashPosition: BsDashboardTable | null; commitments: BsDashboardTable | null; recent: BsDashboardTable | null
  salesMix: { visible: boolean; title: string; empty: string; action?: { label: string; to: string }; rows: { id: string; name: string; hint: string; amount: string; value?: number }[] }
  paymentMix: { visible: boolean; title: string; empty: string; action?: { label: string; to: string }; rows: { id: string; name: string; hint: string; amount: string; value?: number }[] }
  appointments: { visible: boolean; title: string; empty: string; source: { location: string; path: string } | null; metrics: { title: string; value: string }[]; busiestTitle: string; busiest: { id: string; label: string }[] }
  cash: { visible: boolean; title: string; source: { location: string; path: string } | null; metrics: { title: string; value: string }[] }
  customers: BsDashboardTable | null; staff: BsDashboardTable | null; locations: BsDashboardTable | null
}
export interface BsDashboardCopy { retry: string; cancel: string; create: string; name: string; mode: string; plan: string; filters: string; location: string; date: string; range: string; custom: string; from: string; to: string; source: string; manage: string; start: string }
