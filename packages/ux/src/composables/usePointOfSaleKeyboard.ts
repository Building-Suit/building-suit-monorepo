import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { captureBarcodeKey, emptyScanState } from '../utils/barcode.js'

/** Shared POS shortcut, scanner and focus policy; product adapters execute semantic commands. */
export function usePointOfSaleKeyboard(options: {
  blocked: () => boolean
  focusCatalog: () => void
  focusCustomer: () => void
  checkout: () => void
  dismissFeedback: () => void
  barcode: (code: string) => void
}) {
  let scanState = emptyScanState()
  function handle(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey || options.blocked()) return
    if (document.querySelector('[role="combobox"][aria-expanded="true"]')) return
    if (event.key === 'F2') { event.preventDefault(); options.focusCatalog(); return }
    if (event.key === 'F4') { event.preventDefault(); options.focusCustomer(); return }
    if (event.key === 'F8') { event.preventDefault(); options.checkout(); return }
    if (event.key === 'Escape') { options.dismissFeedback(); return }
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.id !== 'pos-catalog-search' && target?.closest('input, textarea, select, button, a, [role="combobox"], [contenteditable="true"]')) { scanState = emptyScanState(); return }
    const captured = captureBarcodeKey(scanState, event.key, performance.now())
    scanState = captured.state
    if (captured.code) { event.preventDefault(); options.barcode(captured.code) }
  }
  const focusCatalog = () => nextTick(options.focusCatalog)
  const focusCustomer = () => nextTick(options.focusCustomer)
  onMounted(() => { window.addEventListener('keydown', handle); void focusCatalog() })
  onBeforeUnmount(() => { window.removeEventListener('keydown', handle); scanState = emptyScanState() })
  return { focusCatalog, focusCustomer }
}
