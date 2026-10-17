# Shop SET-001 residual audit and receipt precision

Status: partial implementation; SS-SET-001 is not complete.

Audited staging: `f7a4bbfaf20b2e4c81322f693d5cb7de863fd553` (2026-10-14).
Branch: `codex/shop-suit/set001-receipt-currency-precision`, Shop stack root into `stg`.
PR #305 merged while this audit began; this branch starts after its merge and does not alter billing or offline work.

## Verified existing implementation

- SS-HOT-SHOP-SET-001 is merged PR #136. `save_shop_profile` supports shop display-name edits with active membership, `settings.manage`, subscription write authorization, input validation and actor/time audit. It does not edit personal identity or issued transaction snapshots. Existing SQL coverage includes manager permission, unauthorized employee, outsider, inactive membership and expired subscription cases.
- Location add/edit/archive/restore is separate from the shop profile, with shared settings presentation and RPC authorization. No new branch/location capability is introduced here.
- `receipt_settings` and `save_receipt_settings` support display name, address, phone, footer and thermal/A4 defaults. `capture_sale_receipt_at_issue` captures business, location, customer, staff, lines, currency and totals when the invoice is issued. Final payment uses that issued snapshot rather than current settings. Mutation-prevention triggers protect issued and fully-paid snapshots.
- Operational mode and open-cashier-shift requirement already have supported settings commands. The original readiness rows marking all settings workflows missing are stale; they are not evidence that these capabilities should be rebuilt.

The verification above is a source/contract audit plus existing unit coverage. Hosted SQL fixtures and live authenticated settings writes were not executed in this task.

## Reproduced and fixed residual defect

`formatReceiptMoney(1.234, 'KWD', 'en')` previously rendered `KWD 1.23` (non-breaking space); BHD behaved likewise. A JPY snapshot with an existing fractional value also must not lose that issued value. Currency is provided by the issued snapshot, but a fixed two-digit formatting ceiling rounded its monetary evidence.

The receipt formatter now retains up to 20 fraction digits, preserving the precision representable by the existing numeric input. Intl still supplies the currency's minimum fraction digits, preserving existing EGP output. No multiplication, division, FX conversion, amount rewrite, schema change or snapshot update is performed. Existing JavaScript number precision limits remain; this does not make the application's two-decimal monetary storage support arbitrary currency precision.

Unit regression covers EGP, KWD, BHD and fractional historical JPY values in EN/AR, unchanged existing receipt output, share-text line/payment/total precision and input snapshot preservation. Browser regression supplies an issued KWD snapshot and verifies unit price, line total, subtotal, total and payment across language and thermal/A4 changes.

## Remaining non-tax SET-001 work

| Requirement | Demonstrated residual |
|---|---|
| SET-01 | Shop display name is implemented. Broader business presentation is under SET-02; personal account editing is a distinct contract. |
| SET-02 | The current receipt-setting schema and form omit configurable logo, document labels, persisted document language/direction and line-description visibility from SET-D02. These require forward settings contracts and issuance snapshots, backward-compatible historical rendering, shared UI controls and authorized backend/browser tests. A mutable remote logo URL alone would not preserve historical presentation. |
| SET-03 | No business-currency settings command, pre-history eligibility check or first-finalized-monetary-document lock is implemented. Shops have no business-currency field; business screens use EGP, invoice currency defaults to EGP, and the financial storage/calculation contracts generally use two decimals. A settings-only currency selector would mislabel amounts and cannot satisfy SET-D01. Currency configuration requires coordinated document commands, precision review, all owning consumer adapters and tests for concurrent first-document issuance, initial balances, payments, purchases, expenses and preserved historical currencies. Subscription billing's EGP currency is a separate contract and must remain independent. |
| SET-04 | Business mode and cash policy are implemented. Do not invent additional unspecified defaults or add tax defaults. |
| SET-05 | Existing supported receipt settings have issuance snapshots and mutation prevention. Any new SET-D02 fields must be captured at issuance and tested against settings edits before later settlement and against reprints/sharing of pre-migration documents. |

SET-D01/D02 are approved. TAX-D01 remains unresolved and tax/ETA scope is excluded. No UI PRO redesign, Arch, n8n, Penpot, personal network, production/main change or hosted migration is part of this PR.

## Validation

- Pinned pnpm 10.33.0 dependency install with frozen lockfile: passed; no lockfile changes.
- Shop unit suite: 314 passed, 0 failed.
- Shop typecheck, lint and production build: passed; lint reports two pre-existing attribute-order warnings outside changed files.
- Workspace strict ownership/boundary check: passed; historical migrations unchanged.
- Synthetic SSR receipt browser suite: 15 passed, including two new precision cases and existing EN/AR, light/dark, 390/768/1440px preview, language, thermal/A4 and print isolation coverage. Executed with a temporary config inheriting `packages/testing/playwright.atomic-shop.config.ts` and selecting `cloud-sales-receipts.spec.ts`; no hosted backend is contacted. Initial browser-launch/setup attempts failed before the valid run (missing downloaded headless binary, then using the older pilot config without its SSR transport).
- Hosted mutation/SQL tests: not run; no database change is included.

No action was denied by automatic approval review. The remaining SET-001 features above are unfinished implementation work, not an access rejection or a verified no-op.
