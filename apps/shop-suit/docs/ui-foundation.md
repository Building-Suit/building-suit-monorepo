# Shop UI foundation — UI-D01 / SS-UX-FOUNDATION-001

PrimeVue 4.x is the primary interactive foundation, with Tailwind 4 and Building Suit tokens. Use existing `@building-suit/ui` wrappers before composing a new shared wrapper around a PrimeVue primitive. Simple semantic inputs, dates, textareas, small enum selects and radio groups remain native where that preserves straightforward labels, validation and keyboard behavior. Do not introduce Nuxt UI, Reka, another palette or a vendor fork. `pnpm check` enforces versions, shared table/overlay/picker boundaries and competing-library exclusions.

| Interaction | Contract |
| --- | --- |
| Operational action | `BsButton` wraps PrimeVue Button, defaults to `type="button"`; submit actions explicitly use `type="submit"`. Pending disables activation and announces busy state. Canonical target minimum is 44 × 44 CSS px. |
| Form | `BsForm` retains native constraint validation, disables/inerts its fieldset during submission, announces saving, and focuses a linked error summary. Its `class` styles the fieldset. Keep visible labels, native constraints and product validation; use safe translated errors. |
| Entity picker | `BsSelect` wraps PrimeVue Select with named combobox/filter, token styling, empty states and optional virtualization. `virtual` uses fixed 44px rows; `virtualScrollerOptions` forwards lazy loading options. Product adapters own data and authorization. Small fixed enums may use `.ls-select`. |
| Records | `BsDataTable` with server `lazy` pagination for sales, customers, customer statements/receivables, inventory movements and counts. No hardcoded first-history-page cap. Existing whole-catalog responses use virtualized pickers; inventory overview uses pagination. |
| Overlay | `BsDialog` and `useRecordAction` own pending-close protection, real dirty snapshots, Escape, trapped focus and focus return. Cancel uses the scoped `close`; successful saves and tenant changes may reset directly. No new drawer is needed for these forms. |
| Consequential action | `useConfirmation` / `BsConfirmHost`, with Cancel initially focused. Explain sale issuance, payment reversal/refund, write-off or count effects before committing. Retain existing authorized, idempotent RPCs. |
| Feedback | `useToasts` / `ToastHost` after successful refresh; form error summary for failed writes; table retry for failed reads; explicit empty and permission-denied copy. Status always includes text. |

Sales/customer/inventory/settings flows use these patterns. Receipt allocations remain selected across receivable pages and are cleared on customer/shop changes; the server still validates balances and authorization. Native radio cards remain in settings because they already provide group labels and arrow-key navigation. Schema-only workflows are not added to navigation.

The existing `sale_catalog` and `list_inventory` RPCs still return complete catalogs. Virtualized options and paginated overview rendering bound DOM size, not payload size. History and receivables now request server pages of 20; no schema or hosted changes are part of this task.

The shared `/components` catalogue demonstrates 10,000 virtualized choices, form errors/pending state, notification dismissal and existing dirty-dialog/confirmation behavior. Focused browser coverage lives in `packages/testing/e2e/shop-ui-foundation.spec.ts`, with a dedicated configuration so it does not require other apps or a database. See the task verification record for actual runs and limitations.

SS-UX-001 extends these operational patterns to product, purchase/supplier and expense forms. Purchase selectors and supplier history use server pages; account actions use the shared dialog; account/shop/location changes reset the page subtree and pending confirmations. Import and report downloads guard their originating context. See [cross-workflow verification](SS-UX-001-verification.md) for actual checks, the dedicated synthetic browser matrix and remaining real-browser/large-payload limits.
