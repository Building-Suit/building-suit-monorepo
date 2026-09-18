# Shared interaction policy

`packages/ux/src/index.ts` declares the record presentation policy. Add/edit records use `BsDialog`; product forms retain their validation and authorized commands. `useRecordAction` tracks visibility, pending state and dirty snapshots, including Set-based permission forms. Reset initial values before opening. Call `complete()` after a successful command or close product state after success.

`BsDialog` owns modal placement, focus trapping, focus return, Escape handling, scroll containment, pending-state close protection and dirty-close confirmation. Product close/cancel buttons must use its scoped `close` callback. Direct state resets are reserved for successful completion, tenant/account changes and explicit workflow resets. Long forms may choose the shared size variants; they must not introduce a second overlay implementation.

`useConfirmation().ask(message, title?)` queues accessible confirmations through `BsConfirmHost`. Apps include one host at their root. Use it for archive, void, removal and similar actions; domain authorization and reversals remain server responsibilities. Do not use native browser confirm dialogs.

`BsSignupWizard` and `useSignupWizard` own step presentation, back/next bounds and advance concurrency. Apps supply the steps, validation and provisioning calls. `useVerificationTimer` owns OTP expiry and resend countdown presentation; the server remains authoritative for validity and rate limits. Never persist passwords or OTPs in draft storage.

Messages sent to `useToasts` are already translated. Display safe product/domain error messages; do not expose raw SQL, credentials or infrastructure errors. Loading, empty, denied, error and successful states are part of each page's contract.
