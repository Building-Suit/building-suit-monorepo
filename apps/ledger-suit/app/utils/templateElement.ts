import type { ComponentPublicInstance } from 'vue'

/** Resolve a shared control's native element for Ledger's existing focus/file adapters. */
export function resolveTemplateElement<T extends HTMLElement = HTMLElement>(value: Element | ComponentPublicInstance | null): T | null {
  if (!value) return null
  if ('nativeElement' in value) return value.nativeElement as T | null
  return ('$el' in value ? value.$el : value) as T
}
