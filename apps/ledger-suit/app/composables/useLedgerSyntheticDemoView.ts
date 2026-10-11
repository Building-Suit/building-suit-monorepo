import { addSyntheticReceipt, createSyntheticDemo, resetSyntheticDemo } from '~/utils/setupExperience'

/** Ledger-owned orchestration; mounted by a shared workflow scope in its route/layout. */
export function useLedgerSyntheticDemoView() {
const { t, locale } = useI18n()
const state = ref(createSyntheticDemo())
const amount = (value: string) => formatMoney(value, 'EGP', locale.value)

function addReceipt() { state.value = addSyntheticReceipt(state.value) }
function reset() { state.value = resetSyntheticDemo(state.value) }
return { addSyntheticReceipt, createSyntheticDemo, resetSyntheticDemo, t, locale, state, amount, addReceipt, reset }
}
