# Automation runtime reconciliation

Source-only integration of department pilot
`116477e5e63495efc6702e8d6a745d3e053310d4` into
`codex/company-hq/worker-release`. No pilot branch merge, new unrelated app/UI work
or active migration additions were performed. The reviewed 17 applied staging
sources and archived never-applied migration remain byte-for-byte unchanged.
Migration-parity parent
`aadeaa79d7e829f78cf7d51bb01b859a97f651aa` is integrated by a history-preserving
merge for the authorized automation PR. Its UI-export/hydration changes are
preserved unchanged; no additional UI work was started. All prior automation commits and parent history are retained.

The smallest runtime port consists of the pilot's worker policy/invocation
functions, roster policy and `departmentWorkflow.mjs`. The worker prefix before
`start()` is unchanged from that pilot except the two maintenance imports.
`start()` retains pilot v3 journal/delivery semantics and model evidence, wrapped
by the maintenance barrier, durable intent, safe signal/lease handling and paused
acceptance protocol. No qualification, supervised-trial, head-routing, selected
model, provider-evidence, tool/research or bounded fallback gate was relaxed.
The roster indexing control-character check was rewritten equivalently for lint;
one unused test fixture variable was removed.

The package now has **five** fixed modules. An extracted no-start import smoke
check rejects new missing dependencies and import escapes; repository tests
alone cannot establish package completeness. Any further reconciled runtime
imports must update the allowlist and package/compatibility checks together.

## Schema and installation boundary

The actual worker delivers `hq_worker_finish_v3(..., p_model_evidence jsonb)`;
falling back to `finish_v2` would lose model execution receipts and is forbidden.
Compatibility is therefore **contract 2**: v3 signature/model evidence, existing
v2 preservation, department/trial/qualification/model-receipt objects and the
read-only worker status capability. A server or complete old release declaring
contract 1 is rejected before stopping it. A known contract-2 rollback baseline
must be demonstrated; an unknown installed legacy/pilot worker is not implicitly
compatible. The lifecycle test verifies a model receipt survives drain, journal
flush and v3 delivery unchanged.

Five additional pilot SQL files are copied only as explicitly undeployed test
proposals. They are **not** added to the active migration directory or applied
parity manifest. The new `pilot-proposals-db.test.mjs` uses those exact files in
PGlite and checks pilot authorization/qualification, trial, routing, review and
model-receipt behavior plus the actual contract-2 capability. The legacy DB suite
remains to test the preserved applied baseline separately.

| Proposal source filename | SHA256 (unchanged from pilot) |
| --- | --- |
| `20261106000000_hq_department_staffing_needs.sql` | `91013167455996c81482f37b1e562636deb9c6c85d331e52a5841ad6e0c39a1e` |
| `20261106010000_hq_department_orchestration_contract.sql` | `447c6959bba6078d99b331c26b32169c2bf1761346af70d2eebfbfb432577de8` |
| `20261106020000_hq_supervised_worker_trials.sql` | `090054b023fb424dcd3d866cedbe50fb67f80c51ba469ee0c61eaff1d4fd040c` |
| `20261106030000_hq_qualified_research_web_search.sql` | `473d5c25a31a568ab083e3cc0e360ca902173ae7b7fdd76f3796064d0c4e5b9d` |
| `20261106114053_hq_worker_model_execution_receipts.sql` | `9f433ed56aab324d3f58aa9f82bd80cdca5fcf1e9cbc429e0d08958ba9575a5b` |

These proposals change queue/qualification semantics, not just function
availability. Their staging deployment, app/schema interoperability and the first
contract-2 runtime adoption need a separate coordinated parent/operator decision.
The old installed runtime is not proven to remain a valid rollback after that
transition. This updater does not perform that transition, choose the older
worker instead, execute SQL, weaken qualification or automatically migrate DBs.
A verified producer/claim pause, preservation of the complete unknown install,
reviewed schema/app adoption and proven contract-2 baseline are still blockers
before automatic installation. See `RELEASES.md`.
