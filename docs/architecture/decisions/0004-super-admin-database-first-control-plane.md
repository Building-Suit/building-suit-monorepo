# Database-first Super Admin control plane

Status: accepted for Super Admin M1 by SAS-D001, SAS-D004, SAS-D009 and
SAS-D011. This decision defines the implementation boundary for
SAS-CONF-001, SAS-CONF-002, SAS-CORE-003, SAS-FUT-001, SAS-INT-001 and
SAS-SEC-001.

## Decision

Super Admin is a control plane with its own production/staging Supabase pair,
Auth users and sessions. Its Supabase database is authoritative for Super
Admin operators, Suit registration, operator navigation, capability policy,
environment bindings, non-secret integration configuration, secret references,
dispatch state and control-plane audit. Runtime values are read from that
database; project refs, URLs, keys, menus, provider instructions and commercial
values are not application constants.

Every target Suit remains authoritative for its identities, tenants, domain
state, plan catalog, billing state, quotas, commercial-period history and domain
audit. Super Admin never reads or writes a target database directly. It invokes
a target-owned, versioned server adapter over HTTPS. Applications do not import
another application's code and the browser receives neither a target credential
nor a decrypted integration secret.

The server-to-server authentication mechanism is an environment-specific
HMAC-SHA-256 key. The Super Admin copy is held in Supabase Vault and addressed
only by a database secret reference. A restricted database signer signs a
previously authorized, immutable dispatch without returning the key. The target
copy is held in that target project's Supabase-managed server secret boundary.
The signature covers protocol/key identifiers, timestamp, nonce, request and
correlation IDs, source and target bindings, environment, audience, method,
path and body digest. The target validates all fields, bounded clock skew and a
single-use nonce before executing anything.

Target capability discovery is signed and versioned. Effective capabilities
are the intersection of the target manifest, the Super Admin database policy
and a compatible protocol version. Unknown, disabled, stale or incompatible
capabilities fail closed. Navigation is derived from database records filtered
by that effective set; onboarding another Suit that uses an existing module
contract requires registration and a target adapter, not a navigation code
change.

Critical commands are authorized twice: Super Admin authorizes its operator and
binding before enqueueing, and the target authorizes the integration principal,
capability, command and target resource before its atomic domain operation.
Actor context is signed for accountability but does not grant target authority.
The target owns validation, concurrency, idempotency, mutation and domain audit.

The normative schema, wire protocol, replay/idempotency rules, Shop mapping,
rotation procedure and threat/failure model are in the
[Super Admin trust and adapter contract](../super-admin-trust-adapter-contract.md).

## Consequences

- Separate Auth and database ownership remain intact. Matching emails or user
  IDs never link an Admin operator to a target-Suit identity.
- Super Admin may cache a target projection with provenance and expiry, but the
  cache is never domain authority and cannot authorize a write.
- Product-specific adapters live with their target Suit. Super Admin contains
  the generic protocol/dispatcher and data-driven module presentation, not
  imports of target internals.
- Adding a new adapter requires target-owned implementation and conformance
  tests. Registration alone cannot create authority or enable a command.
- Loss of capability discovery, configuration, secret material, freshness or
  environment agreement disables affected commands instead of falling back to
  a privileged credential or another environment.
- This decision defines contracts only. It does not create projects, configure
  hosted secrets, migrate databases or implement product features.

## Rejected alternatives

- **Shared Auth or mirrored target users:** this merges identity boundaries and
  makes actor UUIDs ambiguous across projects.
- **Browser-to-target privileged calls:** this exposes authority to an
  untrusted client and cannot enforce the server trust boundary.
- **Direct target database/service-role access:** this bypasses target command
  authorization, invariants and audit ownership.
- **App-to-app imports:** this couples deployable applications and allows target
  internals to become an accidental control-plane API.
- **Unsigned webhooks, a long-lived bearer key or source-code configuration:**
  these lack bounded replay protection, safe environment binding or compliant
  secret/configuration ownership.
- **A Super Admin copy of target commercial truth:** this creates competing
  billing, quota and immutable-history authorities.
