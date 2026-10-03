# Shop Super Admin server bridge

The Shop-owned `shop-super-admin-bridge/v1/invoke` Edge Function is the only
cross-Suit administration entry point. It accepts the version 1.0 HMAC
protocol defined by the approved Super Admin trust-adapter architecture and
exposes only capability discovery plus the existing platform, billing and plan
query/command families. There is no SQL, RPC-name or operational-history
passthrough.

The platform command subset is deliberately limited to shop suspension,
reactivation and support notes. Legacy platform subscription shortcuts are not
reachable. Billing approval, subscription lifecycle, catalog, price override
and quota-sensitive work is available only through the existing billing and
plan commands.

## Environment configuration

Provision one `shop_super_admin_integrations` row per exact source/target
environment and key version. The row contains only binding IDs, audience,
validity, clock/nonce policy and the explicit operation allowlist. Keep it
disabled until the matching secret is installed and a signed capability call
has passed.

Install the target verification material as the Edge Function secret
`SHOP_SUPER_ADMIN_BRIDGE_KEYS`, encoded as a JSON object whose keys are the
non-secret key IDs and whose values are unpadded base64url HMAC keys of at least
32 bytes. Never put this value in app runtime config, a migration, a browser
request, a log or an audit payload. `SUPABASE_SERVICE_ROLE_KEY` is used only by
the Edge Function to call the three service-role-only bridge RPCs and is not an
adapter signing key.

Rotation overlaps two independently configured key IDs. Enable the new target
key, prove capability discovery, switch the Super Admin signer, reconcile old
request IDs, then disable/retire the old principal. Disabling a principal or
letting its validity expire fails closed; it does not select another
environment or key.

## Audit and retry behavior

Every authenticated attempt consumes its `(principal, key, nonce)` before
domain invocation. A packet replay is rejected. Commands additionally lock the
external `(principal, request ID)`: an exact logical retry returns the stored
result, while changed signed bytes fail as idempotency-key reuse. The protected
Shop audit preserves request/correlation IDs, external actor tuple, reason,
principal, target and the linked existing Shop audit ID. Existing platform,
billing and plan commands still own validation, amount-mismatch handling,
quota locking, subscription changes and immutable commercial history.

The nonce, request and integration tables and bridge RPCs have no `anon` or
`authenticated` grants. Browser bundles and payloads must contain neither the
HMAC key set nor the Shop service-role credential.

## Local verification

Run the focused protocol unit test through `pnpm test`, execute
`supabase/tests/shop_super_admin_bridge.sql` against the disposable local Shop
database, and run the full `pnpm db:test:shop` regression before publication.
