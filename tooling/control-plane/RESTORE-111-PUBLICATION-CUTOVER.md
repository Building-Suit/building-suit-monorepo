# RESTORE-111 protected Draft publication: staged cutover

Status: implementation staged and locally tested; no live policy change, activation, new product execution, PR or completion credit.

The current release is `fb3dbb045ba203fd35f88366a3304e2a58d938dbeb81638face780ffa092c7e1` (schema 111, commit `c6ed43653e17ecc627c9981a00c845545b4db278`). All 374 sealed files still match. Source changes stay on the existing RESTORE-111 worktree and open PR #222; the worker has not committed or pushed. The separate publication owner must publish the reviewed source checkpoint as a Draft, without merging.

## Reviewed behavior

- A read-only receipt reconciliation accepts an enabled, unrevoked owner’s exact protected-source approval only alongside a current frozen queue, unchanged task scope, requirements, contract, generation, verification configuration, latest execution, verification and file objects. Run scheduling revision alone does not invalidate source approval. Parked tasks receive no active publication authority.
- The queue sensitive-path guard respects verified protected owner authority and two independently reviewed exact API artifacts. Those reviews bind task, execution, parent, file object, unchanged authorization-helper witness and passing verification. They do not grant owner authority or fabricate verification. Unknown API/auth changes and Audit’s service-role POST remain gated.
- An exact authorized protected hold returns to the existing publisher. Existing scope checks, trusted verification, external-evidence gates, separate publication ownership, Draft replay, completion credit and native next-task acquisition stay intact.
- `protected-config-offer-amendment.sql` is an **uninstalled proposal** changing only the existing BS22 protected-source offer selector: verified migration files **or** verified `supabase/config.toml`, each already named by an actual protected-publication failure. It does not approve the file, execute product SQL, deploy configuration, alter retries, queues, roles or histories. The default migration-only gate cannot obtain the missing Support configuration approval.

## Exact Support evidence and missing permission

All 11 files still match verification 353 and execution 320; no Support PR exists. Owner events 15 and 16 still match the immutable task/verification subjects. Event 15 covers only:

- `apps/shop-suit/supabase/migrations/20261008160000_support_notification_delivery.sql`, Git object `42d51b5f114563adac3110974bd1c35c34026d65`.

It does **not** cover `apps/shop-suit/supabase/config.toml`, Git object `a55738cdfbb1947906a245a6a1fb4a057e6069ef`. That file adds `[functions.shop-support-sender]` with `verify_jwt = false`. The exact reviewed worker instead requires a configured server-only bearer token of at least 32 characters, rejects browser JWTs and has no public CORS interface. This authentication configuration still needs one specific genuine protected-source approval. Publication means a Draft source artifact, not activation of that configuration.

The amended BS22 offer can list the exact verified protected set; its owner receipt must be recorded by the existing authenticated operator path. Preserve events 15/16 and frozen queue events 17/18/19. Never synthesize a human event from a worker or request those queue grants again.

## One bounded cutover

1. Require explicit authorization for this proposal, including the **single control-only forward amendment**. The earlier recovery instruction prohibited new migrations: no exception has been assumed and nothing has been installed. If authorized, the separate owner registers the exact tested proposal bytes as one new forward control migration (112); 109/110 remain excluded. Publish the reviewed source checkpoint, independently rechecking provider feature-deployment restrictions and Supabase Automatic branching first. Keep #222 unmerged and Draft publication owned separately from Codex workers.
2. Revalidate the staged patch hashes, actual installed release and n8n forced-SSH consumer, migration ledger, all 17 frozen subjects, actor/receipts, Support’s 11 file objects, existing PR state, exact histories, locks and process ownership. Abort on drift. Back up current control state and the original BS22 function definition. Quiesce the actual consumer and controller using the existing maintenance/lock mechanism.
3. Apply only the authorized control amendment with the existing checksum/provenance transaction. Prepare and activate the reviewed immutable runtime through the existing compare-and-swap/rollback installer. No product SQL, provider configuration or workflow import.
4. Use the existing recovery-condition API to record the genuine newly available protected-source gate (not approval or PASS). Native parked-queue acquisition restores Support’s saved `passed` state and existing execution 320; it does not restart implementation. Present its one genuine BS22 protected-source offer. Remain blocked until the owner records that specific approval.
5. Run the staged `protected-publication-canary-job.sh` host launcher under the existing per-run flock, using a genuine installer activation receipt. Do not relaunch the old SAS-first canary job. The staged controller dynamically loads only the sealed activated runtime, reuses the existing lifecycle kernel and grants, re-observes existing target credits on restart, and never creates approvals. Run a bounded **two-publication** canary: Support → SS-LAUNCH-SOLO-VARIANTS-001 in the original native order. Observe trusted verification, actual GitHub Draft head/base, exact native credit and automatic acquisition of the second task. Do not acquire past hard prerequisites. After two observed publications/credits and safety acceptance, release the existing Supervisor for eligible work covered by events 17/18/19. No routine per-task approval.
6. On safety failure stop the affected operation, retain receipts, files, executions, approvals, branches and credits, and park only through the native queue API. Restore the previous runtime pointer and saved gate definition under the existing installer lock; keep unattended processing stopped until rollback readiness is independently observed. Never restore an old database dump over new history or delete a consumed approval/publication.

## Remaining task exceptions

Custom Offer 321 and Audit 322 remain unchanged, partial and uncredited. Their exact local SQL compiles against the four exact parent migrations in isolated local databases. Public tables have RLS; reviewed new RPCs deny anonymous execution and fix search paths. These are source checks, not full task verification or hosted deployment evidence.

- Custom Offer’s migration creates authenticated executable privileged owner RPCs, immutable commercial tables and changes registry projection. Its issuance path intentionally raises `SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED`; a successful save is not successful issuance. These privileged effects need specific source approval and complete task verification before Draft publication.
- Audit’s migration adds privileged projection/cursor RPCs and wraps `super_admin_adapter_complete`; its POST uses a service-role client. Those actual effects need specific source approval and full task verification. Its ordinary GET handler may pass the exact content-review guard; that alone cannot publish or credit the task.
- Custom Offer and Audit currently use the same migration timestamp `20261009140000`. Their separate source checks pass; combined task verification must reconcile that version collision before accepting both artifacts. Neither file has been applied to a hosted project.
- Billing’s supported source-bound staging-receipt check fails because `SAS_BILLING_STAGING_EVIDENCE` is absent. The check does not collect bank/payment evidence or mutate providers. Keep its external gate; no attempt consumed by this inspection.
- Shared’s hard dependencies remain unmet. Parked work is not complete. Existing task limits, all 11 already-approved five-attempt changes, started policies and histories remain untouched.

Tests and exact hashes are recorded in `.local/restore-evidence/deadlock-cutover-manifest.json`. Disposable model/GitHub fixtures are never live acceptance. Two live Draft publications and credits remain pending explicit cutover authorization and the genuine configuration-source receipt.

The host launcher/controller are staged in `.local/restore-evidence/protected-publication-canary-job.{sh,mjs}`. Their shell/Node syntax and nonconnecting `--check` pass. They have not been launched against live state. Native parked-task recovery, the protected configuration offer/receipt and function rollback are tested separately in disposable PostgreSQL; the two-task Supervisor integration uses synthetic model/GitHub endpoints.
