# HQ-OFFICE-INSPECTOR-20261105 — Translucent office and agent inspection

Status: source implemented; migration/worker rollout and runtime/visual acceptance pending.

## Founder request

Use the supplied screenshot as composition reference. HQ sidebars, cards, tabs and minimap should let the scene show through. Every office opens Overview, Running Tasks, Calendar and Settings, with the latter two empty for now. Overview places metrics at the top, then connected tools with icons/active states, relative skill usage with genuine zeros, then clickable agents. Selecting an agent opens a second larger sidebar beside the office at roughly 30–40% viewport width. Further sidebar/UI redesign is deferred.

## Presentation and behavior

Shared `BsHqOfficeOverview` presents three metrics, a genuine seven-day task-count sparkline, the union of current bound tools, recorded skill-load shares sorted by count, and actual assigned agent rows. Agent details reuse these observations and include identity, role, activity/connection, lifecycle, office, model/effort, manager, profile and running work. Empty, missing, pending and unauthorized data remain explicit. API/native/MCP labels distinguish connection types; current hosted bindings are Google Drive API and the existing restricted native web-search capability, not invented MCP connections.

`useHqOfficeInspection` owns the office tabs and nested selection, clearing the latter when the office or roster changes. Every office selection, including CEO, opens Overview. Existing Talk to CEO, global task/team/learning work and company-plan/Auth flows remain separately reachable; no business command is replaced. Desktop agent details use 38vw beside the existing office panel, without a fixed pixel cap. Below 1000px details occupy the available width while the office stays mounted, hidden and inert behind it. Closing details restores focus to the agent row after the DOM update; Escape closes details first. Office close and missing/Auth-invalid selections retain the original camera restoration session. Standard characters and scale are unchanged.

Canonical `component.hqGlass` tokens define translucent Navy panel, card, control, selected and border surfaces and bounded 12px backdrop blur. Regenerated token outputs supply navigation, account/session card, Brain/office/agent/CEO panels, tabs, plan cards, minimap, zoom controls and scene labels. Text opacity remains unchanged. The backdrop stays translucent even without blur support; no new palette, scene/terrain/ocean/camera redesign or provider is added. EN/AR and logical RTL positioning are maintained.

## Data and limits

Forward-only `20261105164121_hq_office_observations.sql` adds private immutable skill-context receipts and guarded worker/founder RPCs. Host receipts are recorded once per leased job only after the existing scoped/versioned Drive reader successfully loads that job's assigned skills. The RPC validates worker identity, lease, cancellation and exact assigned IDs. No raw prompts, grants or worker identities are projected. No historic counts are backfilled.

Percentages measure **recorded skill loads**, not semantic application of a skill by the model. Loading all assigned context may yield equal shares. A zero means no recorded loads since tracking began; pre-tracking lifetime usage is unknown. Missing terminal-job receipts make the affected agent's counts unknown, and an incomplete office denominator hides percentages rather than manufacturing zeros. Active skill indicators require a live job receipt and fresh employee connection. Tool activity requires a current binding and fresh connected employee; it is not independent provider health monitoring.

Founder observations query actual business tasks, current roster and existing Brain metadata. Today uses Africa/Cairo; task-count chart and duration use the last seven days. Turnaround is weighted by completed count. Running tasks use a separate bounded 32-item projection, not the old four-task history slice; partial data is flagged and text previews are bounded. Unavailable/missing agent telemetry stays unknown. Existing private category invalidations/manual refresh deliver updates; no data polling or recurring timer is added.

The existing agents GET enriches its safe snapshot with the optional validated observation RPC. Older databases remain usable and show telemetry unavailable. POST contracts/queues remain compatible. The worker's single observation call does not rerun inference or block approved work if telemetry is unavailable; such coverage gaps suppress false zero claims.

## Verification and rollout

Performed source inspection of existing scene/UI, contracts, worker/Brain reader and migrations, plus source review of the changed paths. `pnpm tokens:generate` completed to regenerate canonical outputs; this is generation, not acceptance validation. The migration path was generated with the installed CLI `pnpm exec supabase migration new hq_office_observations --workdir apps/company-hq`; no remote schema command was run. Administrative `timeout 90s pnpm agent:preflight` did not return a complete live Git report, so current GitHub/upstream state is unverified. Preserve the primary checkout and unrelated dirty workforce/scene work; no worktree or branch mutation.

No tests, builds, lint, typechecks, release/boundary checks, browser/API/runtime/performance verification, tester/reviewer agents, commit, push, merge or deployment. This follows the standing founder restriction; inspecting the supplied screenshot is design input, not permission for broad checks. No rendered match, performance, SQL acceptance or live telemetry result is claimed.

Required rollout remains: apply the new forward migration to the intended HQ environment under its authorization and update/restart the existing private worker with the observation hook. Neither occurred in this UI task. Until then the new UI intentionally displays unknown observations. Existing standard characters/1.6 scale, offices, island, ocean, Brain source boundaries, founder authorization and worker capabilities are preserved.

Technical references inspected: [Supabase changelog](https://supabase.com/changelog) and [database functions](https://supabase.com/docs/guides/database/functions). The announced CLI v3 target/confirmation changes do not alter this installed v2.116.0 local migration-file generation; no upgrade or hosted CLI command was used.
