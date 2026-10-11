# Super Admin trust and adapter contract

Status: normative architecture contract for Super Admin M1

Requirements: SAS-CONF-001, SAS-CONF-002, SAS-CORE-003, SAS-FUT-001,
SAS-INT-001 and SAS-SEC-001. Approved decisions: SAS-D001, SAS-D004,
SAS-D009 and SAS-D011. The shared platform and independent-project decisions
remain primary where they are more restrictive.

This document defines an implementation contract, not a migration or hosted
configuration. Names below describe logical records and protocol fields; no
environment value, provider value or business value is supplied here.

## 1. Authority and deployment boundaries

| Concern | Authority | Required access path |
|---|---|---|
| Super Admin users, sessions, roles and operator permissions | Super Admin Auth and database for that environment | Super Admin session plus server-authorized RPC |
| Suit registry, navigation policy and module enablement | Super Admin database | Sanitized read projection; privileged versioned commands for changes |
| Environment endpoint/audience bindings and non-secret integration settings | Super Admin database | Server dispatcher only; browser projections omit connection details unless explicitly safe |
| Outbound secret references and dispatch/audit state | Super Admin database and Vault | Restricted server functions only |
| Target integration verification key | Target environment's Supabase-managed server secret store | Target adapter verifier only |
| Target identities, tenants, roles, domain records and invariants | Target Suit Auth and database | Target-owned adapter command/query |
| Target catalog, pricing, provider/payment instructions, billing, quotas and immutable commercial periods | Target Suit database | Target-owned projections and commands |
| Super Admin's own provider/integration/commercial presentation settings | Super Admin database, with sensitive values in Vault | Super Admin-owned commands and projections |

An operator identity is `(super_admin_environment_binding_id, auth_user_id)`,
not an email or a bare UUID. It has no implicit target-Suit identity. The target
authorizes a configured integration principal and capability scope. Signed
actor data explains who initiated a request, but the target must not use a
claimed role or email as the source of permission.

Production and staging have distinct Admin projects, target projects, bindings,
keys, audiences and dispatch logs. A binding identifies both source and target
environment IDs. The dispatcher must reject cross-environment pairs unless an
explicit, audited binding policy permits that exact pair; there is no automatic
fallback, URL rewriting or selection by display name.

## 2. Super Admin database contract

The following records belong in the Super Admin project's `public` business
schema with RLS, explicit grants and narrow security-definer commands. Private
validation/signing helpers remain in a non-exposed schema with a fixed empty
`search_path`. Table names are logical until a forward migration adopts them.

| Record | Minimum data and invariants |
|---|---|
| `suit_registry` | Immutable ID and stable key; localized display metadata; lifecycle status; no endpoint, credential or executable module name. Keys are unique and retirement preserves history. |
| `suit_environment_bindings` | Suit ID, Admin environment ID, target environment ID, HTTPS adapter base URL, audience, target identity fingerprint, enabled state and optimistic version. The source/target pair is unique. Redirects and unapproved hosts are forbidden. |
| `adapter_registrations` | Binding ID, adapter/protocol version range, manifest freshness policy and lifecycle state. Activation requires a verified manifest and an active verification key. |
| `adapter_capability_policy` | Binding ID, capability key, allowed major/minor range, query/command scopes and enabled state. No wildcard command scope. |
| `navigation_items` | Stable item ID, localized labels, order, route descriptor, required capability/version and visibility policy. Route descriptors select a reviewed generic module kind; they are data, never JavaScript/module names or expressions. |
| `integration_settings` | Binding/owner, typed setting key, non-secret JSON value, schema version and effective interval. Provider instructions and commercial values are records, not defaults in code. A constraint rejects keys classified as secret. |
| `integration_secret_references` | Binding, purpose, non-secret key ID/version, Vault secret UUID, state and validity interval. Browser roles have no table access. Plaintext secret columns are prohibited. |
| `adapter_manifest_observations` | Binding, manifest revision/digest, verified capabilities, protocol versions, observed/expiry times and verification outcome. Observations are append-only. |
| `adapter_dispatches` | Immutable request/correlation IDs, binding, capability/command/version, actor tuple and role snapshot, reason, canonical payload digest, config/manifest versions, state and timestamps. The full payload is retained only when its data classification permits; otherwise retain a protected reference plus digest. |
| `adapter_attempts` | Dispatch ID, attempt number, key ID, nonce, request timestamp, response digest/status/error class and timing. Nonces are unique per binding/key and signatures/secrets are never logged. |
| `control_plane_events` | Append-only configuration/authorization/dispatch audit with actor, reason, before/after or digests, correlation/request IDs and occurrence time. Update/delete/truncate are rejected. |

All configuration writes require an Admin operator command with a request ID,
reason, expected record version and append-only audit in the same transaction.
Deleting a Suit, binding, key reference or historical setting means retiring or
revoking it; referenced history is not destructively removed. The browser reads
purpose-built projections and cannot select secret references, internal endpoint
metadata, dispatch payloads or signing material.

The application may contain protocol types, validators and generic route/module
implementations. It must not contain a project ref, project URL, API key, Suit
menu, binding, provider instruction, price, quota or environment-specific
default. Missing required database configuration is a visible unavailable state,
not a source-code fallback.

## 3. Adapter wire contract

Every operation uses HTTPS `POST` to the versioned adapter invocation path. The
base URL and audience come from the selected database binding; the versioned
path and field/header names are protocol code, not runtime configuration. TLS
certificate validation is mandatory. The dispatcher does not follow redirects
and must reject disallowed schemes, hosts and resolved private/link-local
addresses according to the binding's server-side egress policy.

The JSON request envelope is closed and versioned:

```json
{
  "protocolVersion": "<major.minor>",
  "operation": "<capability>.<query-or-command>",
  "operationVersion": "<major.minor>",
  "requestId": "<uuid>",
  "correlationId": "<uuid>",
  "sourceBindingId": "<uuid>",
  "targetBindingId": "<uuid>",
  "targetEnvironmentId": "<uuid>",
  "actor": {
    "authorityBindingId": "<uuid>",
    "subjectId": "<uuid>",
    "roleSnapshot": "<database value>",
    "sessionId": "<non-secret session identifier or null>"
  },
  "reason": "<required for commands>",
  "payload": {}
}
```

The response is also closed and echoes `protocolVersion`, `requestId`,
`correlationId`, `targetBindingId`, `operation`, `operationVersion` and the
canonical request digest. It contains exactly one of `data` or a stable error
object. Command success includes `replayed`, the target audit ID and target
result version. Responses are HMAC-authenticated and verified before their data
is accepted or cached. The response signature uses the request key ID and
unpadded base64url HMAC-SHA-256 over this exact newline-delimited input:

```text
BS-S2S-RESPONSE-HMAC-SHA256
<protocol-version>
<key-id>
<request-id>
<correlation-id>
<source-binding-id>
<target-binding-id>
<target-environment-id>
<audience>
<numeric-http-status>
<lowercase-hex-request-body-digest>
<lowercase-hex-response-body-digest>
```

The dispatcher hashes the exact response bytes, verifies the signature in
constant time and then verifies the echoed envelope fields. An unsigned error
or a signed response with a mismatched request digest is an untrusted ambiguous
outcome, not a target-domain denial.

### 3.1 Request authentication

Each attempt supplies protocol headers for algorithm/version, key ID, Unix
timestamp, nonce, request ID, correlation ID, source binding, target binding,
target environment, audience, body SHA-256 digest and signature. The canonical
UTF-8 signing input is newline-delimited in this exact order:

```text
BS-S2S-HMAC-SHA256
<protocol-version>
<key-id>
<unix-timestamp>
<nonce>
<request-id>
<correlation-id>
<source-binding-id>
<target-binding-id>
<target-environment-id>
<audience>
<uppercase-method>
<normalized-path>
<lowercase-hex-sha256-of-exact-body-bytes>
```

The signature is unpadded base64url of `HMAC-SHA-256(key, signing_input)`.
JSON is serialized once to UTF-8 bytes; the sent bytes, rather than a
re-serialized object, are hashed. Header and envelope identifiers must match.
The target compares signatures in constant time and rejects duplicate headers,
unknown algorithms/keys, malformed values or content-type mismatches.

The target performs these checks before invoking domain code:

1. Find an active integration principal by the exact source binding, target
   binding, target environment, audience and key ID.
2. Require the key validity interval and binding state to cover the request
   timestamp, and require the timestamp to be within the database-configured
   clock-skew window.
3. Recompute the body digest and signature, then compare in constant time.
4. Atomically insert and commit the `(source_binding_id, key_id, nonce)` receipt
   with its expiry before domain invocation. A uniqueness conflict is a replay
   denial, even if the body matches. A later domain denial does not unconsume
   the nonce.
5. Validate protocol and operation schema, capability/version and the
   principal's exact query/command scope.
6. For commands, execute target idempotency and the domain mutation/audit
   transaction described below.

Skew, nonce retention, manifest freshness and timeouts are validated values in
database policy. They are not hidden code defaults. A retry has the same
request/correlation IDs and exact logical envelope but a fresh timestamp, nonce
and signature.

### 3.2 Authorization, actor propagation and audit

The Super Admin Edge boundary validates the Admin JWT against its own project.
Under that user's database context it calls a narrow enqueue command, which
checks operator permission, binding/environment state, current capability
policy and manifest compatibility and freezes the dispatch plus payload digest.
The browser cannot choose an endpoint, target environment, key ID, actor or
capability version outside that authorized database result.

A server worker claims the immutable dispatch. A restricted signer signs only
that claimed row and reads the key through its Vault UUID; it is not a general
arbitrary-message signing oracle and does not return decrypted key material.
The signature may exist only for the attempt and must not be persisted or
logged.

The target treats the integration principal and allowed operation scope as
authority. It stores the signed external actor tuple, role snapshot, reason,
binding/key IDs, payload digest, request/correlation IDs and target result/audit
ID for attribution. It independently checks the target resource and domain
rules. Email, display name, client metadata and the propagated role do not grant
permission.

Both sides create append-only audit evidence. The Admin audit proves operator
authorization, configuration/manifest versions, dispatch and observed result.
The target audit proves integration-principal authorization and the atomic
domain outcome, including before/after state or protected digests. The shared
request ID joins one logical command; the correlation ID joins a wider workflow
and all retries. Logs include those IDs and safe error classes, never tokens,
signatures, raw secrets or protected payload fields.

### 3.3 Idempotency and ambiguous outcomes

Every command has a caller-generated UUID request ID. The target serializes on
`(integration_principal_id, request_id)` and stores the operation/version,
target resource, canonical payload digest, reason digest and committed result.

- First use executes the mutation and target audit atomically and stores the
  result in that transaction.
- An exact retry returns the stored result with `replayed: true` and performs no
  second mutation or audit event.
- Reuse with any different operation, version, target, payload or reason fails
  as `idempotency_key_reused`; it never replaces the first result.
- A timeout or lost response is `outcome_unknown`, not failure. The dispatcher
  retries the same request ID. It must not invent a compensating command or a new
  request ID to discover the outcome.
- Queries carry request/correlation IDs and nonce protection but do not create a
  domain idempotency result unless the target contract says they have effects.

The target transaction, not the Admin dispatch record, is the commit authority.
Admin marks success only after verifying the response. Reconciliation queries
the target by the same request ID when retry policy is exhausted.

## 4. Capability discovery and data-driven navigation

The mandatory `adapter.capabilities.read` operation returns a signed manifest
with:

- adapter and Suit stable IDs, target binding/environment and audience;
- protocol versions and manifest schema version;
- immutable manifest revision/digest and issue time;
- capability key and semantic version;
- closed query/command operation names, request/response schema versions,
  idempotency classification and required integration scope; and
- health/readiness state that does not expose secrets or internal topology.

Super Admin verifies the response signature and exact binding/environment before
recording an append-only observation. The effective capability set is the
intersection of a fresh verified manifest, a compatible adapter registration,
an enabled capability-policy row and the operator's permission. A server
projection filters navigation items by that set. The client cannot make an item
effective by editing route or capability data.

An unknown capability or major version, disabled policy, missing scope, stale or
unverified manifest, unavailable binding or unsupported command returns a stable
failure-closed error before dispatch. The target repeats the check and returns
`capability_unsupported` without mutation if source state was stale. There is no
generic pass-through command and no wildcard schema.

Onboarding another Suit under an existing module kind is therefore:

1. Implement and test the versioned adapter inside the target Suit without
   importing Super Admin or another app.
2. Provision unique per-environment verification material in Supabase-managed
   secret stores.
3. Register the Suit, exact environment binding, adapter registration,
   capability policy, navigation rows and non-secret settings through audited
   Admin database commands.
4. Verify and pin a signed manifest, then enable the binding/capabilities.

No Super Admin navigation implementation changes in those steps. A genuinely
new UI/module contract still requires an explicit reviewed protocol and generic
module implementation; registration data can never load executable code.

## 5. Shop adapter preservation contract

Shop's current database is the authority and already exposes Shop-Auth RPCs for
platform reads/commands, billing review and plan control. In particular:

- `platform_admin_read` / `platform_admin_command` enforce Shop operator roles,
  request IDs, validation and platform audit;
- `platform_admin_billing_read` / `platform_admin_billing_command` own billing
  queue review, exact replay checks, approval/rejection and billing audit;
- `platform_plan_read` / `platform_plan_command` own catalog/subscription
  controls, quota blockers, price overrides and append-only plan audit; and
- `subscription_commercial_periods`, catalog terms and override/revocation
  records preserve approved commercial history rather than rewriting it.

Those public RPCs use Shop `auth.uid()` and Shop `platform_admins`; an Admin Suit
JWT is intentionally not accepted, and their service-role execution grants are
not a cross-Suit API. The Shop adapter implementation must add a Shop-owned
server facade and integration receipt/audit contract. It may refactor shared
private domain routines so both Shop operators and the adapter reach the same
validation and transaction logic, but it must not emulate a Shop user, mint a
Shop browser session, call the existing RPCs with an exposed service key or
duplicate the mutations in Super Admin.

Shop capability mappings must preserve the current semantic owners:

| Adapter capability | Shop authority to reuse or extend |
|---|---|
| tenant/platform projections and non-commercial support controls | Existing platform-admin projections, validation and audit semantics |
| billing queue/review | Existing billing read/command state machine and exact idempotency semantics |
| plan/catalog/subscription control | Existing platform-plan contract, quota locking/blockers and append-only catalog/override records |
| commercial activation/renewal | Existing billing approval/plan command path that creates or preserves immutable commercial-period evidence |

The adapter must not expose an older shortcut that changes subscription access
without the currently required billing, plan, quota and commercial-period
invariants. Any Shop schema change needed for external actors or shared private
domain routines is a separate forward migration with `pnpm db:test:shop`; this
architecture task makes no Shop schema change.

## 6. Secrets, rotation and revocation

The Super Admin database stores a Vault UUID, purpose and non-secret key ID, not
the key. Browser-facing schemas, generated types, errors and audit never contain
`vault.decrypted_secrets` output. Only the restricted signer can resolve the
Vault reference, and only while signing an authorized claimed dispatch. The
target verifier reads its matching key from a Supabase Edge Function secret or
an equally restricted target-side Vault verifier. General target service-role
keys and provider secrets are never adapter signing keys.

Keys are unique to one exact source/target environment binding and purpose.
Rotation is overlap-based and auditable:

1. Create a new key version in both Supabase-managed secret boundaries and its
   inactive metadata; never copy it through source, logs or browser tools.
2. Enable target verification for old and new key IDs, then prove a signed
   capability request with the new key.
3. Make the new key primary for newly claimed Admin attempts. Queued dispatches
   hold no signature and are signed with the current valid key.
4. After the database-configured overlap and reconciliation period, revoke the
   old key at the target first and then at Super Admin. Retain non-secret key and
   audit metadata for history.

Revoking a key or disabling a binding rejects new verification immediately.
Already committed request IDs remain queryable/idempotently replayable under
their retained receipts, but revocation never authorizes a new attempt. Suspected
compromise disables the binding/capabilities, revokes the key, reconciles request
IDs accepted during the exposure window and rotates forward. There is no shared
key across staging/production or across Suits.

## 7. Threat and failure model

| Threat/failure | Required prevention or response |
|---|---|
| Browser steals a target/service/provider secret | Secrets and secret references have no browser grants; signing/verification stay in Supabase server boundaries; responses, logs and errors are scrubbed. |
| Forged Admin actor or role | Admin Auth plus database permission authorizes enqueue; signed actor is frozen server-side; target authorizes the integration principal/scope rather than actor claims. |
| Captured request replay | Signature covers body and binding; bounded timestamp plus atomic single-use nonce rejects packet replay; command request ID provides exact-result idempotency. |
| Same request ID with altered input | Target compares operation, target, reason and canonical payload digests and returns `idempotency_key_reused` with zero mutation. |
| Staging request reaches production | Unique keys/audiences/bindings; signed source/target environment IDs; exact database pair policy; target comparison; no environment fallback. |
| SSRF or redirect through configured URL | Privileged audited binding changes, HTTPS/host/egress validation, DNS/IP checks and no redirects. Endpoint is never client supplied. |
| Compromised integration key | Per-binding least privilege limits blast radius; disable/revoke, reconcile by request/key IDs, overlap-rotate; never substitute a service-role key. |
| Malicious or stale capability advertisement | Signed exact-environment manifest, compatible-version intersection and expiry; Admin policy is an allowlist; target rechecks on every invocation. |
| Unsupported/unknown command | Reject before dispatch and again at target; no generic forwarding, wildcard scope, dynamic code or permissive schema. |
| Target unavailable, timeout or lost response | Keep immutable pending/unknown dispatch, retry same request ID with fresh nonce, then reconcile; never assume failure or repeat under a new ID. |
| Admin database/Vault unavailable | Fail closed and expose an unavailable state. Do not use cached secrets, source defaults or another environment. |
| Target mutation commits but Admin audit finalization fails | Target remains authoritative; reconcile by request ID/correlation ID and append the observed result. Never roll back target history by editing records. |
| Admin succeeds but response signature/binding is wrong | Discard response as untrusted, retain outcome unknown and reconcile over an authenticated request. |
| Concurrent duplicate command | Target transaction lock/unique idempotency row selects one first result; all exact retries return it. |
| Configuration changes during a dispatch | Dispatch pins config and manifest versions. Incompatible disable/revocation blocks signing; ordinary later edits affect only later dispatches. |
| Clock drift | Database-configured skew window rejects out-of-window attempts; alert and repair clocks. Do not widen silently in code. |
| Audit or commercial-history tampering | Append-only target/Admin events, restrictive grants, immutable commercial records and forward correction/revocation events. |
| Sensitive target data cached in Admin | Minimize projections, classify fields, encrypt/protect permitted cache records, scope by environment/operator and expire/purge them; cache never grants authority. |
| Target adapter bug bypasses domain invariant | Target-owned facade must call the same private domain transaction and pass target conformance/database tests; direct table mutation is forbidden. |

## 8. Required implementation verification

Each later implementation must prove, locally or in an explicitly disposable
environment as appropriate:

- browser responses/bundles contain no secret, target privileged credential,
  internal secret reference or unrestricted endpoint selector;
- signature canonicalization, constant-time verification, timestamp bounds,
  nonce uniqueness, response authentication and exact idempotency reuse;
- production/staging key, audience and binding mismatch denial;
- permission denial at Admin enqueue and independent scope/domain denial at the
  target;
- unsupported, disabled, incompatible and stale capability failure with zero
  target mutation;
- retry after timeout returns one target mutation/audit result and preserves one
  request ID across attempts;
- rotation overlap, primary switch, old-key revocation and emergency binding
  disablement;
- a fixture Suit can register data plus an existing-contract adapter and appear
  in capability-filtered navigation without a navigation source change; and
- Shop adapter tests preserve billing/plan/quota/idempotency and immutable
  commercial-period behavior, including `pnpm db:test:shop` for any Shop SQL,
  database test or database-runner change.

## 9. Requirement traceability

| Requirement | Contract evidence |
|---|---|
| SAS-CONF-001 | Sections 1–2 assign all registry, navigation, binding, integration and Super Admin-owned business configuration to Supabase records and prohibit source fallbacks. |
| SAS-CONF-002 | Sections 2, 3.2 and 6 define Vault references, a restricted signer, target Supabase-managed verification secrets and zero browser secret access. |
| SAS-CORE-003 | Sections 1 and 3 define the bounded HTTPS adapter and prohibit direct database access, shared Auth and app imports. |
| SAS-FUT-001 | Section 4 defines signed versioned discovery, capability intersection, failure-closed commands and data-only Suit onboarding. |
| SAS-INT-001 | Section 5 maps Shop integration to its existing platform, billing, plan, quota, audit and immutable commercial-period contracts. |
| SAS-SEC-001 | Sections 3, 6 and 7 define least privilege, environment-bound authentication, replay/idempotency, audit, rotation, revocation and failure handling. |
