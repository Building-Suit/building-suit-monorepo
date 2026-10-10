import { addSyntheticReceipt, createSyntheticDemo, resetSyntheticDemo } from '~/utils/setupExperience'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerSyntheticDemoView(_values: Record<string, unknown>, _emit: (event: string, ...args: unknown[]) => void) {
const emit = _emit as <K extends keyof ({ close: [] })>(event: K, ...args: ({ close: [] })[K]) => void
const { t, locale } = useI18n()
const state = ref(createSyntheticDemo())
const amount = (value: string) => formatMoney(value, 'EGP', locale.value)

function addReceipt() { state.value = addSyntheticReceipt(state.value) }
function reset() { state.value = resetSyntheticDemo(state.value) }
return { addSyntheticReceipt, createSyntheticDemo, resetSyntheticDemo, emit, t, locale, state, amount, addReceipt, reset }
}
