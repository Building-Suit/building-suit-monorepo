# Doctor Suit M1: safe SQL error repair v0.3

**Current status: DIAGNOSTIC READY; TASK IMPORT NOT READY.**

The previous `doctor-suit-m1-tasks-v0.2.DRAFT.sql` intentionally executes `RAISE EXCEPTION 'DOCTOR_SUIT_M1_DRAFT_NOT_IMPORT_READY'` before it can perform any work. It cannot be made import-ready merely by deleting that exception or changing its final `ROLLBACK` to `COMMIT`.

## Correct next action

1. Open **the PostgreSQL database actually used by the n8n/control-plane**, not a clinic/product database simply because it is labeled “Production.”
2. Open `doctor-suit-m1-control-preflight-v0.3.READONLY.sql` and run it **without altering the script**. It opens a read-only transaction, probes available `control` relations and required columns, finds Doctor/Clinic routing/history/runs, and fingerprints key consumer functions. It always reports `safe_to_import: false` until an independent compatibility review.
3. Send the **JSON value** returned in `doctor_suit_m1_preflight_report`. Do not include connection strings, credentials or access tokens.

## What still needs to be verified

- The live control-plane database is the intended database; active consumer/worker revision, effective PostgreSQL schema, migration order and triggers.
- Whether a Doctor Suit project/workstream exists and its authoritative `suit_slug` and publication path restrictions.
- Existing Clinic/Doctor records, completed work, current runs, stop/activation controls and idempotent import behavior.
- Registered verification commands and the exact proposed 20-task scope/decisions.

After that, prepare a **separate** reviewed, exact-target import SQL in a disposable transaction; obtain explicit authorization before any real import or activation. The user asking to fix a file is not permission to execute its resulting writes or to register a project.

The original 20-task v0.2 handoff and its requirement/decision/dependency links remain unchanged. This v0.3 diagnostic intentionally cannot import them.

## Verification

- Static inspection confirms no `INSERT`, `UPDATE`, `DELETE`, schema DDL, transaction `COMMIT`, or task activation in the preflight.
- PostgreSQL execution **not tested** because a connection to the user's control database was unavailable.
- The previous seed's own static validator reports 20 unique M1 tasks and an intact dependency graph. This is **not live compatibility proof**.

## Evidence baseline

- Building Suit monorepo `stg` at `c6774d47907f7b09aa0a0e9aa2c45c5687a71c50` (inspected in the earlier planning pass).
- `tooling/control-plane/sql/001_control_schema.sql`, `014_generic_automation_platform.sql`, `027_authoritative_publication_readiness.sql`, and `028_batch_admission_safe_resume.sql`.
- `AGENTS.md`, `docs/agent-workflows.md`, `tooling/control-plane/runner/task-prompt.mjs`, and Factory control-plane contract.
