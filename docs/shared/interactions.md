# Shared interaction policy

`packages/ux/src/index.ts` declares the record presentation policy. Add/edit records use `BsDialog`; product forms retain their validation and authorized commands. `useRecordAction` tracks visibility, pending state and dirty snapshots, including Set-based permission forms. Reset initial values before opening. Call `complete()` after a successful command or close product state after success.

`BsDialog` owns modal placement, focus trapping, focus return, Escape handling, scroll containment, pending-state close protection and dirty-close confirmation. Product close/cancel buttons must use its scoped `close` callback. Direct state resets are reserved for successful completion, tenant/account changes and explicit workflow resets. Long forms may choose the shared size variants; they must not introduce a second overlay implementation.

`useConfirmation().ask(message, title?)` queues accessible confirmations through `BsConfirmHost`. Apps include one host at their root. Use it for archive, void, removal and similar actions; domain authorization and reversals remain server responsibilities. Do not use native browser confirm dialogs.

`BsSignupWizard` and `useSignupWizard` own step presentation, back/next bounds and advance concurrency. Apps supply the steps, validation and provisioning calls. `useVerificationTimer` owns OTP expiry and resend countdown presentation; the server remains authoritative for validity and rate limits. Never persist passwords or OTPs in draft storage.

Messages sent to `useToasts` are already translated. Display safe product/domain error messages; do not expose raw SQL, credentials or infrastructure errors. Loading, empty, denied, error and successful states are part of each page's contract.

`BsButton` composes PrimeVue Button with canonical touch targets and a `pending` guard. Its default type is `button`; form submissions explicitly set `submit`. `BsForm` retains native validation, provides a focusable linked error summary, announces pending saves and locks its fieldset while pending. Its class applies to the fieldset for grid/spacing composition. Products own error copy and submit handlers. `BsSelect` composes PrimeVue Select with translated filter/empty states and optional fixed-row virtualization; labels are required and native events/slots are forwarded. Product adapters own lazy queries. Keep small native semantic controls when they are simpler.
