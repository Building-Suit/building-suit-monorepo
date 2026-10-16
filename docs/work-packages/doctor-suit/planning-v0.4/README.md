# Doctor Suit milestone contracts

Review artifacts only. No product implementation, database import, task admission, credentials, provider setup or deployment has been performed by this change.

The supplied roadmap defines 104 stable tasks: M1 20, M2 14, M3 10, M4 10, M5 14, M6 10, M7 10, M8 8 and optional M9 8. Milestones are prepared and validated sequentially. A milestone JSON is the canonical contract; its Markdown packet is the human-readable projection, its import proposal contains exact links and the transaction requirements, and its validation JSON records local artifact checks. Product tests are future obligations, not claimed passes.

Run `python3 docs/work-packages/doctor-suit/planning-v0.4/scripts/build.py 1` to regenerate M1, then `node docs/work-packages/doctor-suit/planning-v0.4/scripts/validate.mjs DOS-M1`. Later milestone generation uses the same command with its number. Run the validator without an argument for all prepared milestones.

Sources were materialized using the Library's supported transfer route. All five files matched returned byte lengths; their SHA-256 hashes, stable Library IDs and versions are recorded in `sources/manifest.json`. All twelve website ZIP checksum entries passed. Duplicate roadmap, draft SQL and newer preflight contents matched byte-for-byte. Original source files are retained unmodified. The draft SQL is deliberately guarded and must never be executed or unguarded as an import shortcut.

Repository inspection is based on `origin/stg` at `1d0108f85fb8d468f8ad6380c9c6bf60a435ca4d`. No Doctor/Clinic app or maintained product requirement files were found under `apps` or `docs`. Historical Clinic counts remain unverified; do not invent historical rows or overwrite recovered IDs. The parent reports no Doctor registrations/tasks/requirements in Automation `padtxclxwwqvvuiebhte`; this is attributed parent evidence, not a local live database read.

The current user confirmed M1 as public site plus administrative doctor/secretary web, synthetic data only, and authorized this repository and ordinary design choices. M1 scope decision `DOS-M1-D001` is therefore approved in the new proposal with provenance. Runtime registration remains independently gated in `DOS-M1-D002`. Real clinical/legal/provider/commercial approvals are never inferred.

Every proposed task is planned/pending and linked to its milestone's real open blocking start decision. Imports must create the complete milestone and all links in one transaction, prove zero ready tasks before commit and read back zero-ready evidence after commit. A planned task status alone is insufficient: task inserts can wake consumers, and the supported creation function requires an active workstream. No start gate may be resolved until the parent confirms all nine milestones safely stored. See each import proposal for the reviewed importer contract and pending live inputs. There is intentionally no executable write SQL here.

The high-capability `deep` routing requirement is a proposal that must be bound to a verified live model and retry policy. Named verification commands are exact argv proposals accepted by the repository's verification resolver, not evidence that they are registered in Automation. Doctor tests/configs do not exist until their owning implementation task creates them. Local database tests must use a disposable Doctor instance with the separately reviewed start/reset/test lifecycle; no hosted target is permitted. Mobile device and independent reviewer evidence remain explicit gates.

The requested deliverable is a draft planning PR on `codex/doctor-suit/milestone-contracts`, based on the verified staging SHA above, with no same-stack parent PR. Other active product/shared stacks are independent. No merges are requested by this PR.
