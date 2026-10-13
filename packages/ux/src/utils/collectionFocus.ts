import { nextTick } from 'vue'
/** Restore a useful keyboard target after a controlled collection removal. */
export async function focusAfterRecordRemoval(root: () => HTMLElement | null, ids: string[], removed: string, fallback: () => void) {
  const index = ids.indexOf(removed)
  const target = ids[index + 1] || ids[index - 1]
  await nextTick()
  const row = Array.from(root()?.querySelectorAll<HTMLElement>('[data-record-key]') ?? []).find(node => node.dataset.recordKey === target)
  const button = row?.querySelector<HTMLButtonElement>('button')
  if (button) button.focus(); else fallback()
}
