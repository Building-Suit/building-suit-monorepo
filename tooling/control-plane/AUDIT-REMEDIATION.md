# Control-plane audit remediation candidate

This candidate is **not installed** and is **not accepted for unattended operation**.
The live runtime and business database have not been changed by this remediation.

Implemented and tested candidate behavior:

- Unknown exits and assertion text do not establish a product defect.
- Independent verifier receipts bind checks, execution/generation, artifact bytes,
  source state and commands. Reviewed product accounting preserves physical history.
- Retry slot routing uses effective accounting for every configured policy.
- Anonymous completion fails before the SSH adapter dispatches an operation and its
  database overload is revoked.
- Recovery failures preserve typed errors and isolate candidates.
- Codex incident children receive an explicit environment allowlist.
- Investigation reservations and actual launches have distinct persisted records;
  automatic investigation is bounded by three launches, 45 minutes and a two-result
  no-progress fuse. Semantic incident identity does not reset on mere evidence revision.
- Catalog matching requires semantic cause, compatibility, regression and safety
  predicates. Legacy family-only entries are not accepted as learned proofs.
- Incident transitions and verifier review revisions are append-only records.
- Health distinguishes investigation and historical lifecycle outcomes.
- Release preparation verifies committed content and hashes components; activation
  primitives serialize installers, compare the current pointer, and roll back failed readiness.
- Migration/release ledger schema distinguishes baseline attestations from exact
  transaction application. Portable manifest generation keeps cloud parity unproven.

The host verifier capability is separate from `bs_control_app`. A deployment must
provision `bs_control_verifier` login credentials, configure `BS_CONTROL_VERIFIER_USER`
and preserve a private host credential store. Never pass these credentials to Codex.
Migration 069 initially creates the capability role with NOLOGIN. It does not install
credentials or complete the broader runtime capability migration.

Required work before installation/acceptance:

1. Complete typed persisted BS-22 gates and authenticated actor transport, including
   precisely scoped retry/investigation extensions and existing trusted external evidence.
2. Restrict all remaining direct authority/history writes and replace them with reviewed
   command contracts. Test both denied bypasses and ordinary runtime operations.
3. Freeze/persist the exact bounded task set and versioned plans, replace task-specific
   admission mappings, and validate dependencies, lineage, publication and prerequisites.
4. Integrate release primitives into every installed launcher and the incident installer;
   the current incident installer still contains the legacy mutable activation path.
5. Record actual migration applications and attest the hosted baseline before release.
6. Quiesce new claims using maintenance, preserve healthy operations, install and activate
   the complete candidate atomically, and resume the existing runs.
7. Prove the synthetic bounded E2E, real n8n restart/fault injection, all 24 invariants and
   all 51 historical families against that installed release.

Source tests and a disposable schema rebuild are necessary evidence, not live acceptance.
No product merge, deployment, hosted product migration or cloud change is authorized here.
