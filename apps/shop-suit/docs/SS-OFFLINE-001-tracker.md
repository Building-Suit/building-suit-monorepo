# SS-OFFLINE-001 acceptance tracker

**Offline cloud implementation and verification completed at `8a3af38`. Physical-device qualification remains pending for release/readiness. Draft review publication is now explicitly authorized; no merge, deployment or hosted database write is authorized.**

Branch `codex/shop-suit/ss-offline-001`, worktree `/workspace/ss-offline-001`, base verified `stg` `547005b263e1a2eedaa6f09a3fc9837d059d6d05`. Initial checkpoint `21123c4` was resumed and its server/reconciliation gaps completed. Billing PRs #305/#307 and their branches were not modified or duplicated. Before eventual publication, recheck the live Shop stack target without modifying billing.

## Exact acceptance

| Original acceptance | Cloud implementation and evidence | Remaining |
| --- | --- | --- |
| POS records allowed sales/payments and manages an open cash shift during an outage | Authenticated loaded POS persists signed/encrypted sales; cached open drawer supports queued movements/close and provisional cash totals in cents. Actual browser outage, movement and close passed, expected/count cash 125 with zero variance | Physical phone/tablet qualification |
| Stable local/request IDs and visible unsynced/syncing/failed/synced states | Vault commits before cart reset and before the first network attempt for eligible counter sales. UUIDs persist across lost responses/replay; shared status and recovery UI; authenticated screenshots and queue browser tests | Physical storage/lifecycle behavior |
| Reconnect uses existing server idempotency without duplicate invoice/payment/stock effects | Atomic wrapper uses existing draft/checkout commands, captures/locks drawer identity, compares full payload/actor, returns committed results after close. Real authenticated lost-response replay had exactly one invoice/payment/stock/drawer effect; two-session duplicate replay and races passed | Physical network-loss/replay evidence |
| Conflicts/rejections visible and recoverable, nothing silently dropped | Failed command is a FIFO barrier. Server cancellation tombstone permanently blocks late wrapper/legacy posting; already committed requests return their original result. Operator explicitly acknowledges customer/payment or cash/count reconciliation. Original transaction/cancellation and signed acknowledgement retained; no automatic repricing/refund/history rewriting | Physical operator flow |
| Sensitive local data minimized/protected | AES-GCM IndexedDB, non-extractable AES/HMAC keys, envelope verification, environment/user/shop/location namespace. No cached customer contacts/appointments/media/auth tokens/history. Expiring 12-hour snapshots, at most 3,000 viewed catalog items and 200 pending commands. Confirmed terminal commands become minimal signed receipt summaries; full immutable commands remain server-side. Recent 200 terminal summaries shown; unresolved records always shown and retained | Physical browser quota/eviction/crypto interoperability |
| Purchases/reports/settings may remain online-only | Queue covers only counter sale/payment, cash movement and close. Customer/appointment search, full drawer history, new shift opening and back office remain online-only | None in cloud |

## Verification results

- [x] Actual Chromium IndexedDB/WebCrypto/Web Locks: outage transitions, online reload persistence, lost-response replay, ID reuse rejection, cache expiry, encryption/key protection and user/tenant isolation.
- [x] Real two-tab replay serialization; stable cancellation IDs after lost response; immutable pending command; acknowledgement barrier; already-issued outcome recovery.
- [x] Authenticated disposable SQL: one invoice/payment/stock/drawer effect, changed payload denial, price rollback with no partial invoice, completed replay after close and old drawer rejection.
- [x] Server cancellation/reconciliation: repeated resolution, changed body/reason denial, committed legacy outcomes after close, late direct movement/close blocked, closed drawer history preserved.
- [x] Two independent real Auth sessions: duplicate replay once, anonymous/outsider denial, cancellation-vs-sale and close-vs-sale races with exact cash/stock effects. Three additional consecutive race runs passed.
- [x] Authenticated production-build browser: offline sale, repeated lost server response, identical request IDs, changed-price rejection and actual two-stage reconciliation UI, first entry to preloaded cash route during outage, offline movement/close, final expected/count 125 and variance zero.
- [x] POS, cash, sale-correction and launch cash-policy SQL prerequisite suites. Old fixtures reference unavailable `pro/team/multi` plan selectors; task-owned regression runner uses the current default trial overload while preserving business mode/assertions. Original billing/source fixtures remain unchanged. An unadapted legacy fixture produced `PLAN_UNAVAILABLE`; no claim it passed unchanged.
- [x] All six consumers typecheck and build; lint zero errors with existing attribute-order warnings.
- [x] Complete regression suite: **1,464 tests, 1,441 passed, 23 intentionally skipped, zero failures**.
- [x] Workspace boundaries and whitespace checks; 80 historical migrations unchanged, zero route migration debt.
- [ ] **Authenticated physical phone/tablet network-loss/replay**. Required before release/readiness and merge. Cloud browser/emulation/screenshots are not physical evidence. User devices/network must not be used.

Reproducible task-owned commands (pinned pnpm 10.33.0):

```sh
node apps/shop-suit/tests/browser/offline-counter.mjs
node apps/shop-suit/tests/browser/offline-counter-db.mjs
node apps/shop-suit/tests/browser/offline-regression-db.mjs
node apps/shop-suit/tests/browser/offline-concurrency.mjs
node apps/shop-suit/tests/browser/offline-authenticated-pos.mjs
pnpm exec turbo run typecheck --concurrency=1
pnpm exec turbo run build --concurrency=1
pnpm lint
pnpm test
pnpm check
```

The DB runners are fixed to cloud-local `supabase_db_building-suit-shop`, never a hosted URL/ref. SQL suites roll back synthetic fixtures. Authenticated HTTP/browser/concurrency fixtures are retained, not deleted. Browser test uses only `127.0.0.1:4331` and the public local key already in repository tests; screenshots/credential-free JSON are in `.local/ss-offline/`. No raw auth trace is captured. [Durable cloud evidence](SS-OFFLINE-001-cloud-evidence.json) explicitly says physical evidence is false.

## Cloud disk and routing evidence

Initial root filesystem was 32 GB and filled during the official Postgres image pull. Docker uses `vfs`: each layer deep-copies preceding layers ([Docker documentation](https://docs.docker.com/engine/storage/drivers/vfs-driver/)). The 29-layer image is only 370 MB compressed/about 1.25 GB unpacked, but repeated VFS copies exceeded capacity. A verified OCI copy was unpacked with checksum-verified umoci and imported as one disposable layer with original runtime configuration. Original manifest/config/history retained in `/tmp/ss-offline-postgres-oci`; no shared daemon configuration or business data changed.

Original amd64 OCI digest `sha256:fc542c31f334749adbbd3c9e16b6be90f17d0fe6460d5196066d73f2723c9ecf`; local flat image `sha256:2cc0481c10ee5b2da79238a2220c933c34ee2662943a4290a883f9542b83c9de`, Postgres tag `17.6.1.165`. Final observed root: **32 GB total, 23 GB used, 7.3 GB free**; `/tmp`: **8.8 GB total, 2.9 GB used, 6.0 GB free**. Active DB/Auth/REST/gateway/mail containers and volumes remain intact. No blind prune, data reset or history/worktree deletion.

Task-local backend profile `/tmp/ss-offline-backend` uses canonical app-owned migrations/seed, original project ID/ports and confirmed synthetic users; custom email templates were omitted for diagnosis. Docker's GoTrue `wget` readiness probe inherited the cloud HTTP proxy and received 403; local `/health` with proxy excluded returns 200/version `v2.196.0`, and real password authentication/authorized RPCs pass. The diagnostic startup used `--ignore-health-check`; this is a documented test-environment probe discrepancy, not a physical-device acceptance pass or a production health claim.

Routing audit: Docker endpoint `default unix:///var/run/docker.sock`, cloud `dockerd` PID 199; no SSH/tunnel processes used. Git remote is HTTPS GitHub. Tests use cloud-local containers/localhost only. External reads were public GitHub/docs, npm/Playwright and official container registries. No SSH, tunnels, home-service probes, self-hosted runner trigger, push, CI trigger or deployment. Supabase broad `status` JSON read was **denied by automatic approval review** for excess secret exposure; it was not retried or executed indirectly. Tests succeeded with the existing public fixture key and scoped end-user password sessions.

## Qualification limits and publication

Requires a previously loaded authenticated POS, an unexpired cache and a saved open drawer. Only previously viewed catalog items are available. POS preloads the critical cash route. Fresh hard reload/launch while disconnected is unsupported; durable transactions resume after authenticated online reload. Editing a pre-existing server draft remains online-only. Storage failure/quota blocks recording without discarding the cart/queue. Browser eviction/private-profile deletion requires physical qualification; no JavaScript durability guarantee beyond supported browser storage is claimed.

Local signatures protect integrity and ciphertext at rest, not malicious same-origin script or a compromised browser profile; they are not server-attested device signatures. Server auth/current permissions, atomic price/stock/period rules, complete request equality and captured drawer locks remain authoritative. Replay captures the original vault user's token to avoid cross-account SDK fetch races. Account/tenant changes clear sensitive cart/editor/cache state; location changes preserve the canonical locked-cart warning.

Prepared forward migrations have been applied only to the disposable local backend. Hosted migrations must run via GitHub CI only. Draft branch/PR review is explicitly authorized while real phone/tablet evidence remains pending. Do not merge, release, or mark SS-OFFLINE-001 fully qualified until that evidence is independently supplied. No main/production deployment is authorized.

## Draft review sequencing correction

The earlier before-publication prohibition was an added parent-agent sequencing constraint, not an original user requirement. It has been explicitly corrected: the preserved branch may be pushed and a clearly labelled draft PR opened. The actual task requirement remains authenticated mobile/tablet manual verification; cloud evidence does not complete physical acceptance.

Live observation for draft preparation: staging `f7a4bbfaf20b2e4c81322f693d5cb7de863fd553`; billing #305 merged. Current Shop stack #308 → #309. Verified #309 tip `693b9e6b11737eb3257677a43dcf577817ef7b90` was incorporated by history-preserving merge `dbee08f2`; draft targets `codex/shop-suit/set001-document-settings`. Existing parent changes are inherited, not duplicated in this PR. The recorded authenticated SQL/browser evidence belongs to the standalone offline candidate `8a3af38`; combined SET/settings stack acceptance must be revalidated before release, including currency/settings changes across pending offline transactions. No complete combined-stack acceptance is claimed.
