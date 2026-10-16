# Exact reviewed Doctor import delivery

The approved source is **7a6dcc2084000b4054010d94a04a85a408282497**, not c9716fbf. All nine canonical packets and original import proposals remain byte-for-byte unchanged. M1's original proposal is 1,196,029 bytes, SHA-256 `11b71af1ee91f118e17e62dd820a4a87ea931d1435fe374ca4e1fb11f428e4e9`, Git blob `b127a01a33bc7bf05f13ec0b3c729ad1325aa50d`. It is nonempty. The parent observed empty GitHub connector content, including ranged reads; this delivery avoids depending on that large-file response.

[manifest.json](manifest.json) records exact original byte sizes, SHA-256 and Git blob IDs, canonical packet hashes and each smaller artifact's identity. Every milestone has a `header.json` and one `<task-id>.create.json` per task. Each part is below 100,000 bytes; the largest is 70,437 bytes. Task files contain the **complete** supported call arguments, including full canonical metadata. No field is abbreviated. `adapter.py reconstruct` restores the original formatting/key order and verifies exact bytes and hashes.

## Current authority versus immutable snapshots

The parent now reports renewed user continuation, one successful retry of the previously cancelled Automation read-only fingerprint check, no Doctor collisions and no writes. This is attributed parent evidence; this executor performed no live Automation reads or writes. The old `live_read_hold` fields in approved proposals remain immutable historical review snapshots. They do not erase the subsequent authorization. The parent supplies current reviewed bindings and evidence references to the adapter; it must not import an older proposal to avoid a reader limitation.

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
- `automation_project_ref`: `padtxclxwwqvvuiebhte`; `workstream_slug`: `doctor-suit`; `model_profile`: `deep`.
- `retry_policy_id`: an observed active policy whose every attempt uses the verified high-capability deep route. No retry/model policy is created.
- `review_receipt`, `live_read_receipt`, `model_route_receipt`, `consumer_review_receipt`: references to the parent's actual reviewed evidence, including renewed authorization, current consumers and permitted registration mutation interfaces.
- `project_snapshot`: exact `to_jsonb(control.projects row) - 'created_at' - 'updated_at'`. Registration requires absent Doctor mapping; milestone import requires the registered mapping. All other fields are protected by exact comparison.
- `create_function_md5`, `refresh_function_md5`, `ready_view_md5`, `catalog_md5`: observed PostgreSQL definition fingerprints produced by the printed SELECT. The catalog fingerprint covers columns, defaults, constraints, triggers and trigger-function bodies. These are change-detection guards, not credentials or cryptographic authentication.

The parent selects the authenticated Automation connector target explicitly. SQL verifies the immutable Building Suit project UUID, slug and repository; a database row alone cannot prove a Supabase project ref. The parent's provider/consumer review and target selection remain necessary. Any incompatible live schema, unknown mutation interface, missing verified route or unapproved source publication path is a reported storage/admission issue; never widen shared project scopes or treat local fixture checks as live compatibility proof.

Registration performs only insert-only Doctor Suit/workstream registration, all nine canonical open start decisions, and the single `application_paths['doctor-suit']` addition. Suit status stays `planning`. Workstream `active=true` is required by the supported creation routine; it is paired with real open blocking decisions and zero-ready assertions. There is no workflow, execution, admission, authorization, provider, baseline, model or retry creation. The shared project's other fields, including publication paths, defaults and verification configuration, must remain exactly unchanged. A preexisting registry/task/requirement/decision collision aborts; the adapter never upserts over history.

Each milestone is one serialized transaction. It calls `control.create_task_with_publication_contract` with the complete reviewed arguments and current runtime bindings, immediately links each task to its own real open blocking start decision, adds every exact requirement/dependency/decision link, and refreshes final publication contracts. It checks task fields and metadata, complete link sets, canonical requirements/decisions, cumulative counts, all nine open gates, zero ready tasks, no workflow/claims/executions/publication authority and unchanged project configuration before the transaction ends.

Every rendered mutation batch ends **ROLLBACK**. There is no commit flag. The parent first reviews the rollback receipt, then owns a separately reviewed commit action on the identical payload and guards. The post-commit `--readback` output is SELECT-only and compares full expected metadata and links on the server, returning compact booleans to avoid another oversized connector response. Every boolean must be true and the cumulative task count must match the milestone. Any uncertain commit outcome requires readback, never a blind retry. This renderer is separate from the original guarded draft SQL; that draft remains unchanged and must not be unguarded.

## Verification limits

See [validation.json](validation.json) for the actual delivery checks. Integration tests use a fresh network-isolated PostgreSQL 17 container and exact repository 001/009/014/027 schema and routine bodies. They exercise rollback, sequential full milestone storage, exact metadata/link readback, zero-ready behavior and failure cases. Local test commits are confined to that disposable fixture; the delivered renderer remains rollback-only. This is evidence for the adapter against the inspected repository contracts, not a claim that the live platform's later migrations/consumers have been validated. Parent live bindings and review remain required.
