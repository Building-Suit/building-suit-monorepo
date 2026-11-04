# Disabled host protocol adapters

Current local follow-up: [founder-to-CEO work path](CEO-WORK-PATH.md) adds bounded manual dispatch and correlated inbox delivery, with global checkpoint reconciliation checks before another reservation/dispatch. Host activation and the production executor remain closed. This document records the original protocol preparation; newer validation belongs to that follow-up.

This local follow-up to reviewed head `0aa29288f037d234fc74f3d4f830e6d3a85c3161` stays on `codex/company-hq/ceo-hr-runner`, whose draft PR #529 targets parent #528. No new changes are published until independent review. The original office, founder approval, role routing, cancellation, strict SQLite transactions, $0 policy and disabled readiness gates remain in force.

## Implemented route and hard blocker

`DisabledResponsesExecutor` is the production-facing `ExecutorAdapter`. Its verification reports no authenticated free allowance; reservation and invocation always refuse. It accepts no credentials or enable/budget flag. `ResponsesProtocol` is a separate injected-transport protocol harness, not an `ExecutorAdapter` or a funding authority. No code constructs a default HTTP client, reads credentials, installs a provider SDK or attaches the harness to a production runner.

This separation is intentional. OpenAI's current [spend-limit documentation](https://developers.openai.com/api/docs/guides/spend-limits) says enforcement can lag; [prepaid billing guidance](https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing) also warns that usage can create a negative balance. A balance, rate-limit header, advertised credit, ChatGPT subscription, local counter or operator boolean cannot prove atomic included allowance with no paid fallback. We did not query account billing or authenticate to a provider. A real dispatcher must demonstrate that every request is atomically admitted only within an independently verified no-charge entitlement, remains bounded during concurrent/uncertain requests and cannot fall through to paid usage. No such mechanism is available or implemented here, so live execution is blocked.

## Responses protocol

The harness prepares one `POST https://api.openai.com/v1/responses` per stage with an explicitly configured model, output-token bound and strict JSON result schema. It sets `store:false`, `background:false`, `stream:false` and `tools:[]`; it never sends a conversation ID or previous response ID. There is no automatic retry, second model, web-search tool, shell, remote MCP or continuation loop. Public tool use is unsupported in this initial host protocol: a safe tool loop would require a separately admitted allowance for each additional inference request. Existing runner tool-scope rules remain unchanged.

The request is bound to the runner's saved reservation, fresh context, lease owner/generation, assignment digest and lossless Brain references. Before transport, it rechecks founder approval, the current lease, exact role/stage, acceptance, artifacts, profile, playbook, context and approved public inputs against the stored contract. Historical attempts without this new binding fail closed rather than being silently upgraded. Each role receives its own request context; Iris receives Noah's artifact, never Noah's conversation or profile. This is host-side request isolation, not verified provider-side isolation or a data-retention guarantee. `store:false` does not establish an approved private-data processing agreement.

Parsing requires a completed response, configured model, bounded usage counters and exactly one completed assistant message containing the strict result object. Reasoning items are ignored; refusals, incomplete results, tool calls, malformed or oversized bodies, extra model-authored identity fields, unobserved sources and invalid review digests are rejected. Identity is supplied by the host, not model output. Model refusal is never converted into fabricated work.

A synchronous SQLite transaction records dispatch intent before transport. The journal stores request digest, context/reservation, outcome, observed response ID/usage and result digest without credentials, raw error bodies or hidden reasoning. Its capacity is checked under the existing 8 MB guard before dispatch. A timeout, disconnect, malformed envelope, missing usage or a crash after dispatch leaves an ambiguous/dispatched record that quarantines later protocol requests across restart. Duplicate invocation requires reconciliation and does not resend, even after a completed response whose workflow checkpoint was lost. `X-Client-Request-Id` is correlation only; no provider idempotency guarantee is assumed.

All journal entries retain `accounting:unreconciled`. Observed tokens are evidence, not a free entitlement or refund. There is no automatic release, refund, replay or operator “clear” action. A future reconciliation implementation must use authorized provider receipts and the actual no-charge allowance authority; it must handle uncertain outcome and transaction failures before reopening dispatch. This prerequisite remains unresolved.

Protocol requests, response streams and parsing are bounded by deadlines/body limits and propagate AbortSignal. An uncooperative transport can continue externally after cancellation, but late output cannot update a checkpoint or trigger another request. Provider-side termination and bounded cost still require the missing dispatcher. Tests use only in-memory synthetic Response objects and injected functions, with no HTTP server, live inference or credentials.

## Drive Brain protocol

`DriveBrainAdapter` accepts a fixed, copied whitelist of approved file IDs and an injected authorized transport. It never discovers credentials, follows filenames, adds files from document instructions, follows shortcuts, writes files or uses a cached fallback. The runner still selects its exact founder-approved map before each stage and delivery.

Each read requests Drive metadata, obtains current content, and requests metadata again. Both metadata responses must match the requested ID, be untrashed, allow download and carry the same monotonic version/MIME type. Plain text/Markdown blobs use `files.get?alt=media`; native Google Docs use `files.export?mimeType=text/plain`. Other types fail closed. The result includes exact text, version plus content digest and an access timestamp after the final successful request. This detects observed revision races; it is not a transactional Drive snapshot guarantee.

The adapter sends no-store/no-cache requests, rejects redirects and bounds metadata, UTF-8 content bytes, decoded length and the whole read deadline. Revocation/denial at any request blocks; stale timestamps cannot be substituted from a local cache. The future transport must obtain appropriately scoped authorization on every call and prove dedicated HQ account/data scope. No OAuth token, refresh flow, credential file or live Drive access was used for this implementation.

## Manual SQLite host bootstrap

`openDisabledHqHost(path)` requires an existing absolute regular SQLite file, rejects memory databases, relative paths and symlinks, and checks HQ's schema version, table identity and workspace structure in read-only mode before opening the existing store. It never casts the remote adapter to SQLite or creates a missing database. This proves only local file structure; it does not establish durable hosting, backups, availability, dedicated environment ownership or free capacity.

The returned host has explicit blockers and a manual `tick()` that remains disabled by the immutable default readiness object and closed executor. No timer, cron, API route, startup plugin, scheduler registration, environment switch or credential setup is installed. Closing is idempotent; the next bootstrap reopens the same database. Real scheduler integration must separately verify a persistent dedicated volume, single-company ownership, process lifetime/locking, $0 operation, cancellation/shutdown, outage reporting and exact timezone approval. Africa/Cairo 08:00 remains an unconfirmed start-time assumption, not a report-delivery promise.

## Documentation and validation

Protocol references checked on 3 November 2026:

- [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [conversation state](https://developers.openai.com/api/docs/guides/conversation-state), and [background mode](https://developers.openai.com/api/docs/guides/background).
- [Drive files.get](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/get), [files.export](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export), and [file version/capabilities](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).

The new transport suite covers request isolation, approval/lease/Brain binding, output/schema/refusal/tool rejection, bounded bodies, deadlines, cancellation, observed usage, uncertain/replayed dispatch across SQLite reopen, journal capacity, Drive export/revocation/races/stream cancellation and disabled host bootstrap. All provider/Drive transports are synthetic; the SQLite transactions and file reopen checks are real. See the accompanying validation record for final command outcomes.

PR #529's published head remains `0aa29288`: the parent reported CI run 41735672142 passed review and branch-policy, with verify/publish-release jobs skipped. That result does not validate this unpublished follow-up. The inherited parent Doctor Android API 29 failure in run 41721252657 remains a separate caveat; no Android changes or hosted retries were made.
