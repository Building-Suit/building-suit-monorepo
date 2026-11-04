# Current directive — 4 November 2026

The founder now requests interactive 3D, with offices only for established or explicitly created departments and a named character for each configured employee. This supersedes the historical static-image acceptance target below. See [living HQ plan](LIVING-HQ-PLAN.md). Existing historical records, approval, review and $0 gates remain in force.

# Company HQ handoff

On 3 November 2026 the founder retired the Cloud Rule and asked to keep work simple. Company work and CEO/HR coordination may run from any authorized local or cloud checkout; cloud verification is no longer a prerequisite. This filename is retained for continuity. Earlier cloud-only requirements and runtime verification records are dated history, not active policy.

The founder’s monorepo directive, CONV-2026-11-03-024, returns HQ to `Building-Suit/building-suit-monorepo`, branch `codex/company-hq/office-design`, at `apps/company-hq`. It supersedes the earlier standalone decision. Read the Company Brain’s live `START_HERE.md` through an authorized connection and the repository instructions before company work. Run repository preflight before editing. Preserve the completed standalone source at checkpoint `4a6d6a146747d48fb0410de00f1d827d17db8b11` as rollback evidence; do not treat it as the current source of truth.

HQ has its own office layout inside the complete shared `BsAgentOfficePage` template. It does not use the generic sidebar shell. App routes supply typed product projections/commands; shared UI owns presentation and shared UX owns pan/zoom/confirmation. Use the shared Nuxt layer, canonical logo, fonts and generated tokens.

The acceptance target is [the founder-attached 1440×1000 screenshot](design/office-acceptance-1440x1000.png), showing the dark office at 100% zoom with read-only setup status. The original generated mockup, clean runtime scene and video frames remain available. Stop and ask if required references become unavailable. Compare a fresh browser capture to the target and show the actual built result; do not substitute a mockup for runtime evidence.

Only CEO and HR are active. Founder speaks to CEO; CEO coordinates HR. Task execution requires founder approval, zero spending and evidence-backed status. The backend supports founder sessions and fixed-role CEO/HR bridge tools. Tests use synthetic credentials and actions; they do not establish a functioning model worker.

Do not provision, migrate or deploy hosted infrastructure until the dedicated HQ scope and zero-cost path are verified. Requested staging `lwecnmsosfwovlzxauml` and production `dfeiuxsqhgzontefmrjc` remain unverified: during the 3 November 2026 review, the connection denied project access, and staging records associated the first ref with Super Admin. Keep runtime flags false and other products’ data/credentials untouched until these gates are satisfied. See [backend constraints](BACKEND-COST.md).

The old `building-suit-hq-ec5b.tarekian99.chatgpt.site` version1 is historical. Cloud loopback URLs are not reachable as localhost from the founder’s own computer. Do not claim that either displays the new monorepo build without verifying that connection end to end.

## CEO/HR integration child

The local `codex/company-hq/ceo-hr-runner` child preserves this office implementation and adds explicit four-role configuration and a disabled bounded SQLite runner. Read [runner integration](RUNNER-INTEGRATION.md) and [verification](RUNNER-VERIFICATION.md). Historical statements above describe the parent checkpoint; four configured roles do not establish four active workers. No hosted activation or publication is implied.
