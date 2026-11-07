# Contract-2 forward sources — unmerged, live approval required

This child branch prepares six canonical migrations only. It does **not** authorize
merging or deploying them. Phase 1 remains PR #535 at
`0828492a63f5ad9992e189a0b13fdfffb9e38043`; its tested head is unchanged.

Before this PR may merge: parent must verify the actual phase-1 migration/pause,
complete the explicitly approved legacy maintenance/reconciliation boundary,
verify backups/authoritative claim, result and learning outcomes, and obtain the
required contract-2 live approval. A held claim fence alone is not a drain proof.
Do not stop legacy, replay inference, clear journals, resume claims, install host
controls or enable a timer from this source-preparation task. Legacy tier-less
roster sync clears model bindings and is not a contract-2 rollback baseline.

Target route after approval: this repository / `stg` / `apps/company-hq` through
the parent's verified Supabase GitHub integration to staging
`dpruoncalmwicrqhqelu`. No connector SQL or alternate deployment route. No main
or production promotion. Parent owns verified Node/gh/trust provisioning; this
branch duplicates none of that work.

The pinned repository CLI (`pnpm@10.33.0`, Supabase `2.116.0`) generated each new
version with `pnpm db company-hq migration new NAME`. Each file below is an exact
byte copy of its existing tested proposal, not a rewrite of historical SQL.

| Order | Canonical file | SHA256 |
| --- | --- | --- |
| 1 | `20261107024306_hq_department_staffing_needs.sql` | `91013167455996c81482f37b1e562636deb9c6c85d331e52a5841ad6e0c39a1e` |
| 2 | `20261107024314_hq_department_orchestration_contract.sql` | `447c6959bba6078d99b331c26b32169c2bf1761346af70d2eebfbfb432577de8` |
| 3 | `20261107024322_hq_supervised_worker_trials.sql` | `090054b023fb424dcd3d866cedbe50fb67f80c51ba469ee0c61eaff1d4fd040c` |
| 4 | `20261107024331_hq_qualified_research_web_search.sql` | `473d5c25a31a568ab083e3cc0e360ca902173ae7b7fdd76f3796064d0c4e5b9d` |
| 5 | `20261107024338_hq_worker_model_execution_receipts.sql` | `9f433ed56aab324d3f58aa9f82bd80cdca5fcf1e9cbc429e0d08958ba9575a5b` |
| 6 | `20261107024348_hq_worker_release_capability.sql` | `f20004a4899b81f6381508e532c19fbf1a13c6db8929c69fb29f51a43538cba1` |

All 17 original applied sources, the phase-1 canonical migration and existing six
proposal sources remain unchanged. `phase2-canonical.json` records the exact
source mapping/digests. Parity enforces complete chronological order, exact
copies and explicit pending status; none is falsely entered in applied history.
Pilot integration tests now execute these canonical copies directly, retaining
the admission guard/backstop, v2 completion and v3 model-evidence contract.

The migrations add staffing/orchestration, supervised trials, qualified web,
model receipts/v3, then the guarded release capability. They do not certify live
employee qualification, execute a trial/inference, hire staff, clear the admission
hold or activate an updater. Existing qualification/model/fallback protections
remain intact. First managed adoption still needs a real compatible baseline and
health/rollback acceptance; no database rollback is part of runtime rollback.

Local verification: **23/23** actual canonical pilot integration tests passed;
source-parity unit and all 17 baseline hashes passed; workspace boundaries,
release classification and diff checks passed. The changed test source passed
lint using the parent's already-generated identical ESLint configuration via
stdin; this isolated worktree has no generated Nuxt lint config. Full application
build/browser checks were not repeated for these exact SQL copies. Hosted
migration/adoption/qualification and host acceptance remain unverified and
unapproved. Normal PR CI is required; skipped stacked aggregate jobs are not
counted as passed.
