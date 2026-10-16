# Exact reviewed Doctor import delivery

The approved source is **7a6dcc2084000b4054010d94a04a85a408282497**, not c9716fbf. All nine canonical packets and original import proposals remain byte-for-byte unchanged. M1's original proposal is 1,196,029 bytes, SHA-256 `11b71af1ee91f118e17e62dd820a4a87ea931d1435fe374ca4e1fb11f428e4e9`, Git blob `b127a01a33bc7bf05f13ec0b3c729ad1325aa50d`. It is nonempty. The parent observed empty GitHub connector content, including ranged reads; this delivery avoids depending on that large-file response.

[manifest.json](manifest.json) records exact original byte sizes, SHA-256 and Git blob IDs, canonical packet hashes and each smaller artifact's identity. Every milestone has a `header.json` and one `<task-id>.create.json` per task. Each part is below 100,000 bytes; the largest is 70,437 bytes. Task files contain the **complete** supported call arguments, including full canonical metadata. No field is abbreviated. `adapter.py reconstruct` restores the original formatting/key order and verifies exact bytes and hashes.

## Current authority versus immutable snapshots

The parent now reports renewed user continuation, one successful retry of the previously cancelled Automation read-only fingerprint check, no Doctor collisions and no writes. This is attributed parent evidence; this executor performed no live Automation reads or writes. The old `live_read_hold` fields in approved proposals remain immutable historical review snapshots. They do not erase the subsequent authorization. The parent supplies current reviewed **storage/schema** bindings and evidence references to the adapter; it must not import an older proposal to avoid a reader limitation.

All nine plans must still be safely saved and confirmed by the parent before product implementation. This delivery does not resolve any start decision. M1–M3 completion is checked implementation in GitHub. The user handles Vercel and hosted Supabase product connections; those connections and deployments are outside synthetic implementation completion.

## Offline adapter

`adapter.py` has no database driver, connection string, network operation or execution option. It verifies chunks/canonical hashes, reconstructs proposals, and renders concrete SQL for parent review. Run from any directory:

```sh
python3 docs/work-packages/doctor-suit/planning-v0.4/import-delivery/adapter.py verify
python3 docs/work-packages/doctor-suit/planning-v0.4/import-delivery/adapter.py reconstruct --output /tmp/doctor-reviewed-proposals
python3 docs/work-packages/doctor-suit/planning-v0.4/import-delivery/adapter.py evidence-query
python3 docs/work-packages/doctor-suit/planning-v0.4/import-delivery/adapter.py render --step registration --bindings /tmp/doctor-live-bindings.json --output /tmp/doctor-registration-rollback.sql
python3 docs/work-packages/doctor-suit/planning-v0.4/import-delivery/adapter.py render --step DOS-M1 --bindings /tmp/doctor-live-bindings-after-registration.json --output /tmp/doctor-m1-rollback.sql
python3 docs/work-packages/doctor-suit/planning-v0.4/import-delivery/adapter.py render --step DOS-M1 --bindings /tmp/doctor-live-bindings-after-registration.json --output /tmp/doctor-m1-readback.sql --readback
```

`evidence-query` only prints a SELECT statement. The parent may use already-observed equivalent evidence or perform an authorized read; the script never runs it. Bindings are intentionally not populated with invented live values. Required fields:

- `source_head`: the exact reviewed 7a6dcc20 commit above.
- `automation_project_ref`: `padtxclxwwqvvuiebhte`; `workstream_slug`: `doctor-suit`.
- No model profile, retry policy or model-route receipt is accepted in storage bindings. A real retry-policy row is not proof of a provider/model route.
- `review_receipt`, `live_read_receipt`, `consumer_review_receipt`: references to the parent's actual reviewed evidence, including renewed authorization, current consumers and permitted registration mutation interfaces.
- `project_snapshot`: exact `to_jsonb(control.projects row) - 'created_at' - 'updated_at'`. Doctor mapping stays absent in registration and every milestone. Every project field is protected by exact comparison; no project UPDATE is emitted.
- `create_function_md5`, `refresh_function_md5`, `ready_view_md5`, `catalog_md5`: observed PostgreSQL definition fingerprints produced by the printed SELECT. The catalog fingerprint covers columns, defaults, constraints, triggers and trigger-function bodies. These are change-detection guards, not credentials or cryptographic authentication.

The parent selects the authenticated Automation connector target explicitly. SQL verifies the immutable Building Suit project UUID, slug and repository; a database row alone cannot prove a Supabase project ref. The parent's provider/consumer review and target selection remain necessary. Any incompatible live schema or unknown storage mutation interface is a reported storage issue; never widen shared project scopes or treat local fixture checks as live compatibility proof.

Registration inserts only a minimal Doctor Suit, workstream and all nine canonical open start decisions. Suit status is `planning`; suit/app paths are NULL, the workstream is inactive, its model/retry fields are NULL and its executable verification configuration is `{}`. The intended application path, verification commands/database lifecycle, model and retry choices are proposals in metadata only. No project mapping or publication permission is added. Existing rows/history cause a collision abort rather than an overwrite.

The inspected supported creation routine has two relevant constraints:

- It joins only an **active project and active workstream**, otherwise raising `Active project/workstream not found` (`027_authoritative_publication_readiness.sql`, creation routine). Each milestone locks the isolated inactive Doctor workstream, sets it active **inside the same transaction only**, creates tasks and links their real open start decisions, and returns it to inactive before any commit. Independent sessions never observe an active workstream. Task-insert notifications may still be emitted at commit; no ready task or active Doctor workstream is exposed to consumers. Parent live trigger/consumer review remains required.
- `control.tasks.model_profile` is NOT NULL and its checked values include **`no_ai`** (`001_control_schema.sql`). A NULL value fails that real constraint. Storage uses the existing `no_ai` schema value, **not a fabricated provider/model route**, with NULL retry and an empty executable `verification_plan`. If the reviewed live routine/schema does not support this storage projection, stop and report its exact constraint; never invent route evidence or bypass the supported creation routine.

Every original canonical task field, hash and metadata key remains intact. A separate `planning_storage` metadata object records the inert top-level projection and future explicit-cloud-task execution method. The canonical `deep` request, verification plan and retry proposals remain documents, not installed execution configuration. Workstream metadata contains the complete proposed command/database configuration. Nothing copies these proposals into active verifier fields or creates retry/model policies. High-capability planning has already occurred in this cloud task.

Each milestone is one serialized transaction through `control.create_task_with_publication_contract`; it adds every exact requirement/dependency/decision link and refreshes final publication contracts. The checks verify canonical metadata plus the declared storage projection, complete link sets, canonical requirements/decisions, cumulative counts, all nine open gates, zero ready tasks, **zero `control.batch_task_admissions` of any status**, no workflow/claims/executions/preexecution authorizations, inactive unbound registration and the exact unchanged shared project snapshot before the transaction ends. Readback repeats these checks. No workflow, admission, execution, provider, baseline, model, retry or product connection is installed.

The parent reports observed live catalog MD5 `7c0b6febd0ebc88aa3b55cd07c6d3e14`, with creation/refresh/ready fingerprints unchanged. Other exact observed fields remain parent-held; this executor has not assumed that the parent's filesystem path is local or fabricated those values. Live bindings still pin the exact schema and trigger definitions; the disposable test fingerprint is never substituted for the live one.

Every rendered mutation batch ends **ROLLBACK**. There is no commit flag. The parent first reviews the rollback receipt, then owns a separately reviewed commit action on the identical payload and guards. The post-commit `--readback` output is SELECT-only and compares full expected metadata and links on the server, returning compact booleans to avoid another oversized connector response. Every boolean must be true and the cumulative task count must match the milestone. Any uncertain commit outcome requires readback, never a blind retry. This renderer is separate from the original guarded draft SQL; that draft remains unchanged and must not be unguarded.

## Verification limits

See [validation.json](validation.json) for the actual delivery checks. Integration tests use a fresh network-isolated PostgreSQL 17 container and exact repository 001/009/014/027/028 schema and routine bodies. They exercise rollback, sequential full milestone storage, exact metadata/link readback, zero-ready behavior and failure cases. Local test commits are confined to that disposable fixture; the delivered renderer remains rollback-only. This is evidence for the adapter against the inspected repository contracts, not a claim that the live platform's later migrations/consumers have been validated. Parent live bindings and review remain required.

This storage-only adapter supersedes the e47bdba8 adapter that installed command configuration and added a project application mapping. Approved packets, original import proposals and lossless chunks remain byte-for-byte unchanged. Do not execute the superseded adapter.
