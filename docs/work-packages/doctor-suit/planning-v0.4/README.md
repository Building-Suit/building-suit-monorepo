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

## Prepared milestone inventory

All nine milestones are now prepared, in order, with 104 task contracts, 117 requirement records and 36 decision records. Each milestone's start decision remains open and is linked to every task. These are artifact counts, not imported database counts or completed product work.

| Milestone | Tasks | Contract / requirements | Import proposal | Validation |
|---|---:|---|---|---|
| M1 administrative web | 20 | [M1](DOS-M1.md) | [M1 import](DOS-M1.import-proposal.json) | [M1 checks](DOS-M1.validation.json) |
| M2 clinical web | 14 | [M2](DOS-M2.md) | [M2 import](DOS-M2.import-proposal.json) | [M2 checks](DOS-M2.validation.json) |
| M3 practice operations | 10 | [M3](DOS-M3.md) | [M3 import](DOS-M3.import-proposal.json) | [M3 checks](DOS-M3.validation.json) |
| M4 doctor/secretary mobile | 10 | [M4](DOS-M4.md) | [M4 import](DOS-M4.import-proposal.json) | [M4 checks](DOS-M4.validation.json) |
| M5 patient/reminders | 14 | [M5](DOS-M5.md) | [M5 import](DOS-M5.import-proposal.json) | [M5 checks](DOS-M5.validation.json) |
| M6 subscriptions/billing | 10 | [M6](DOS-M6.md) | [M6 import](DOS-M6.import-proposal.json) | [M6 checks](DOS-M6.validation.json) |
| M7 safety/release evidence | 10 | [M7](DOS-M7.md) | [M7 import](DOS-M7.import-proposal.json) | [M7 checks](DOS-M7.validation.json) |
| M8 ecosystem | 8 | [M8](DOS-M8.md) | [M8 import](DOS-M8.import-proposal.json) | [M8 checks](DOS-M8.validation.json) |
| M9 optional specialties/providers | 8 | [M9](DOS-M9.md) | [M9 import](DOS-M9.import-proposal.json) | [M9 checks](DOS-M9.validation.json) |

The source task dependency chains are preserved and exit tasks additionally cover every named task. Milestone prerequisites resolve to the prerequisite exit task. M5 onboarding additionally depends on M4's platform decision, not completion of the doctor mobile application. M7 can qualify web-only scope without M4/M5; mobile claims require their respective acceptance. Optional M9 selection does not authorize marking unselected prerequisite tasks complete: if selected scope requires changing the supplied sequential graph, the parent must review an explicit dependency amendment before admission, preserving IDs/history.

The validator checks source bytes, packet fingerprints, exact counts/IDs, dependency reachability, requirement and decision links, output path containment, executable command registration shapes and local database lifecycle. It runs the repository's actual verification resolver and configuration readiness evaluator for every task. This proves compatibility of the proposed configuration with the inspected repository, not compatibility with unprovided live schema or a registered consumer. Human/domain evidence is an `external_gate` at `pre_publication`: the current runtime treats `human_gate` as an immediate admission blocker, which would otherwise prevent an evidence-preparation task from running at all.

Per-task SQL commands run from `apps/doctor-suit`, name the exact future `supabase/tests/<task>.sql`, and use `--local`. Start/reset/full-regression phases are separately declared in the proposed local lifecycle. [Supabase's CLI reference](https://supabase.com/docs/reference/cli/supabase-test-db) documents the pgTAP file argument and local target; no database test was executed during planning. The executor's supplied Supabase wrapper could not display help because it attempted to create a directory under a read-only home, so pinned CLI execution still needs environment verification before admission.

The final parent handoff is [HANDOFF.md](HANDOFF.md). All live import actions remain pending review, not denied and not attempted.
