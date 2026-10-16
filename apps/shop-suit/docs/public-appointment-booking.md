# Public appointment booking

SS-APPT-002 adds `/book` to published Shop websites, with Arabic default and `?lang=en`. Aliases redirect to the canonical booking URL. Private hosts, unknown tenants and unpublished websites return the existing isolated 404. Booking pages/APIs are private/no-store/noindex; only public Shop identity is serialized during SSR. Both the showcase and My appointments link to booking/management.

## Explicit policy and public choices

Public booking defaults off. Only the owner may save policy through authenticated RPCs, with settings/write authorization rechecked after the Shop lock and a private audit event. Settings configure minimum lead time (0–10080 minutes), horizon (1–90 days), change notice (0–10080 minutes), rescheduling/cancellation flags and preferred reminder lead time. Staff publication is separate and opt-in: select active memberships and supply independent public names. No operational name/contact/location is published by default.

Available combinations require an active scheduling-enabled service explicitly published in the website catalogue, a visible published-profile location that is still operationally active, an explicitly listed active staff member/profile, location assignment and service eligibility. A bounded date query returns at most 200 available 15-minute-grid starts. Working-hour timezone, service duration plus cleanup, breaks/time off, cross-location staff conflicts, lead time and horizon are authoritative. Nonexistent local DST times are rejected by round trip. Counts and availability expose no customer identities or existing appointment details.

## Scoped atomic commands

Guests supply only their own name/phone and a selected published slot. They create a new walk-in identity; matching names/phones never attach an existing customer. Successful booking returns a one-time access code and creates the existing short-lived appointment-only capability through a host-only Secure HttpOnly SameSite Strict cookie. The token is removed from JSON. Save the code to verify later with the booking phone; no message is sent.

A valid saved-customer session binds creation to its exact current customer ID. Existing walk-in sessions may only manage the verified appointment and cannot create additional appointments. End access explicitly before starting a separate guest booking. Invalid/expired supplied sessions never fall through to guest authority.

Create/reschedule/cancel use a 256-bit request key, hashed with Shop and operation, plus a hashed payload. Retries cannot create duplicate reservations, audit events or reminder intents, and changed payloads cannot reuse a key. Guest retry possession is valid for ten minutes only; any replacement capability is capped at the original retry deadline. The code is not replayed. Customer command retries require current scope. No plaintext tokens/codes/request keys are persisted in appointments, commands or audit snapshots.

Writes lock Shop, current identity/capability rows, idempotency key and staff in order. Authority and session expiry are revalidated after lock waits, and appointment ownership is checked again after its row lock. Lead-time/horizon checks use the current post-lock clock. Staff calendar writes use the same staff availability lock; schedule edits share it too. The existing trigger independently enforces conflicts. A revoked credential, changed customer identity or conflicting staff booking cannot be bypassed by a waiting command.

Management returns up to 20 own upcoming booked appointments per page through opaque references; a reference alone grants no authority. Cancellation/rescheduling require the configured notice and flags. Rescheduling changes time only for the same published service/location/staff, preserving operational-location immutability. Terminal/in-progress appointments cannot be changed by customers. Cancelled/no-show/completed statuses remain visible through the existing appointment/history and staff calendar reporting; no deposit, fee, sale or financial posting is invented.

## Privacy, suspension and reminders

Private history, contacts, code and form factors stay in component memory, outside SSR/Nuxt shared state, storage and URLs. The shared private-session lifecycle invalidates initial reads and commands on hide, rejects hidden/stale response commits, revalidates after busy work settles on visible return and enforces absolute expiry. The booking response never exposes customer IDs, staff contacts, private notes, financials or internal audit. APIs enforce exact Origin, bounded JSON, strict fields, Host-derived tenant and socket quotas. Database quotas bound Shop/actor/phone mutations.

Public customers are audited as public-customer actors rather than attributing their actions to staff. Staff commands retain their existing actor/permission model. Guest credential/session issuance is private and audited.

Reminders are disabled, with no channel, dispatcher, cron, provider credential or outbound call. Owners can save the preferred reminder lead time. Private idempotent intents have only disabled/cancelled states and no message/contact/secret payload. Reschedule/status changes cancel outdated intents, including changes made by staff. A future approved channel requires an explicit reviewed forward integration; this task cannot enable delivery.

## Verification

`tooling/database/test-shop-public-booking-local.mjs` accepts only known disposable local containers. Transactional fixtures test authority, publication, policy, identity, payload minimization, idempotency and reminder state. Committed synthetic fixtures are used only in that disposable backend for real competing transactions: public/public, staff/public, customer reassignment and credential revocation. Production and staging are never test targets. The dedicated GitHub-hosted workflow performs full Supabase migration replay, SQL, built HTTP and browser verification.
