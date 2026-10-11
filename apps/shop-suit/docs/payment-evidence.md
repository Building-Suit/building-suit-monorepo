# Shop manual-billing payment evidence

`SS-SA-EVIDENCE-001` adds private attachments to the existing Shop manual
billing flow. It does not add a billing or subscription authority. An uploaded
file is review evidence only; approval still requires the existing
`platform_admin_billing_command` validation, bank-receipt fields, amount
mismatch reason, quota checks, idempotency and immutable billing audit.

## Owner upload contract

The authenticated user who owns the Shop and submitted an eligible billing
notice calls `reserve_shop_billing_payment_evidence`. The RPC accepts PDF,
JPEG, PNG or WebP files up to 5 MiB, permits at most five immutable reservations
per submission, records a lowercase SHA-256 digest and seven-year retention
date, and returns a server-generated object path. Original filenames are
metadata only and may not contain path separators or control characters.

Upload the exact bytes to the private `shop-payment-evidence` bucket at the
returned path, with the reserved MIME type and byte count. Storage RLS rejects
unreserved paths, mismatched metadata, anonymous users, employees, other Shop
owners, cross-Shop access, replacement and deletion. The requester can list or
download only their own completed uploads. No public bucket/read route exists.

## Trusted review access

Super Admin requests evidence through the existing signed,
environment-bound `shop.billing.query` bridge operation with this payload:

```json
{
  "resource": "evidence",
  "submissionId": "<uuid>",
  "evidenceId": "<uuid>",
  "expiresIn": 60
}
```

`expiresIn` must be from 30 through 300 seconds. The Shop bridge verifies the
principal, environment, nonce, actor binding, exact payload and evidence link,
records the query in the protected bridge audit, then signs the exact private
object with the Shop service credential. Its response contains the bounded
signed URL and immutable evidence metadata, but not the bucket/object path.
Browser roles and ordinary Shop platform operators cannot call the review
helper or bridge RPC directly.

## Local verification

Run `pnpm db:test:shop` for the Storage policy and billing regression coverage,
then `pnpm test` for the bridge signing boundary. The database suite uses
transactional Storage rows and rolls them back; it never targets a hosted
project. With a disposable local submission and bridge principal configured,
set the `SHOP_EVIDENCE_*` values required by
`tests/integration/payment-evidence-http.mjs`, serve the local Edge Function,
and run:

```sh
node --test --test-reporter=tap apps/shop-suit/tests/integration/payment-evidence-http.mjs
```

The script uploads random bytes, verifies owner/outsider/anonymous and
replacement/deletion behavior, obtains access through the signed bridge, and
waits for the 30-second signed URL to expire. It intentionally leaves the
immutable evidence record for the disposable database reset. A provider
Security Advisor review remains independent acceptance evidence.

Missing fixture values fail the HTTP check; they do not count as verification.
The forward `repair_payment_evidence_storage_policies` migration also updates
databases that already applied the initial evidence migration, routing Storage
policy lookups through private definer helpers without granting browser roles
access to the evidence metadata table.
