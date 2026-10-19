import { defineStore } from 'pinia'

/** Only the current actor/scope's receipt selection; server snapshots live in Colada. */
export const usePosReceiptStore = defineStore('shop-pos-receipt', {
  state: () => ({ scope: '', invoiceId: null as string | null, printed: false, printedIds: [] as string[] }),
  actions: {
    selectScope(scope: string) {
      if (scope === this.scope) return
      this.scope = scope; this.invoiceId = null; this.printed = false; this.printedIds = []
    },
    markPrinted() { if (!this.invoiceId) return; this.printedIds = [...new Set([...this.printedIds, this.invoiceId])].slice(-10); this.printed = true },
    remember(invoiceId: string) { this.invoiceId = invoiceId; this.printed = this.printedIds.includes(invoiceId) },
  },
})
