# Independent review corrections

This revision addresses the parent's requested corrections on the existing draft PR. User intent now includes implementation of M1–M3 **after the parent confirms all nine plans safely saved**. No product implementation or hosted write is part of this revision. The parent explicitly cancelled the live schema fingerprint refresh; it has not been retried. Import remains held pending renewed permission and reviewed live bindings.

## Preview versus live-public decisions

`DOS-M1-D004` retains its ID and now records the authorized synthetic-preview choice: existing Building tokens, text Doctor Suit branding, truthful administrative preview copy and working internal routes. Its status is approved with current authorization provenance. The immutable supplied v0.2 source still contains the original broader decision.

New `DOS-M1-D005` retains the unresolved live-public portion: actual domain, external support/contact destinations, offers and clinical/compliance/provider/production claims. It remains open. M1-005, M1-019 and M1-020 link it as informational (`blocking=false`) and can finish their synthetic preview without inventing those facts. M1-019 verifies preview-origin metadata and omits an unapproved production canonical URL and unavailable external destinations. The live-release decision task M7-010 links D005 as blocking. Existing clinical, legal, licensing and provider gates remain intact.

## Release ownership

Each task owns only `release-fragments/<task-id-lowercase>.json` for new append-only provenance. Tasks with public/shared presentation scope may additionally edit `release-changes/items.json`, restricted to their own surviving public behavior and directly related item contributions. Entries must retain distinctive current-code probes, the exact task-fragment source and truthful bilingual copy for actual affected consumers. Unrelated inventory IDs/content/probes/sources and accepted fragment history are preserved.

All 104 tasks require a `pnpm release:check` receipt bound to the exact candidate HEAD and reviewed task/base/main refs. A successful run on an old HEAD is insufficient. The runtime proposal represents this as a pre-publication external obligation with an executable command, since the control plane owns candidate creation. Missing Doctor release registration does not authorize inventing a baseline or activating a product. Doctor-only synthetic preview provenance remains internal while customer-visible changes to already-active shared consumers require truthful public classification.

This planning PR itself adds one internal Automation provenance fragment. It adds no public inventory item because it changes only planning/import documentation and does not ship a product capability.

## Behavior-specific verification

`scripts/coverage.py` contains reviewed criterion-level procedures for all 104 tasks. Each acceptance criterion maps to its own named case and only the needed unit, pgTAP, browser, architecture, device or reviewer evidence. Release evidence is a separate case. Examples:

- M1-004 shared UI ownership uses `pnpm check`; cache/context isolation uses unit plus browser tests; focus/dirty-state and responsive locale/theme behavior require Playwright.
- M1-009 invitation scope and idempotency use pgTAP; revocation also uses browser cache/UI checks.
- M2-008 signing authority and immutable versions use backend concurrency/denial assertions, rather than treating a browser render as authority proof.
- Clinical, legal, licensing and provider approvals require identified accountable reviewers. Mobile rendering requires actual approved-platform device evidence; Node tests cannot substitute.

M1-004 must create `apps/doctor-suit/tests/e2e/dos-m1-004.spec.ts` and run it through the exact app-local Playwright configuration with one worker and zero retries. Required scenarios drive Tab/Shift+Tab/Escape, focus trap/return, dirty-dismissal cancellation and explicit discard, delayed previous-context responses, loading/empty/error/denied state, and EN/AR × light/dark × 390px/1280px rendering. These are implementation obligations; no browser pass is claimed before the app exists.

The review added a task-owned database test where a specific data criterion previously had no mapped SQL proof. It did not alter any task ID or dependency edge. `review-baseline.json` freezes the 104-task/244-edge graph from `c9716fbf`; validation compares every task dependency array exactly against it.

## Concrete adapter and registration proposal

See [registration-adapter.proposal.json](registration-adapter.proposal.json) and each milestone's `create_task_calls` in its import proposal. The adapter names every supported creation-function argument. Runtime workstream/model/retry values remain null pending actual reviewed bindings; no route is fabricated or created by these files.

Every `p_metadata` includes the **complete canonical task object**, its canonical SHA-256, schema and source-packet hash, in addition to the original metadata. Readback must deep-compare that object and all top-level arguments and links. No field is discarded merely because the current task table lacks a corresponding column.

Registration is a proposed Doctor suit/workstream identity and a single Doctor application-path mapping. It explicitly forbids modifying shared project publication scopes, model/retry defaults or verification configuration. A blanket project-register upsert is not permitted. If existing publication scope does not cover a path, report an admission blocker rather than widening it.

The importer must keep all nine real start decisions open, create and link each entire milestone atomically, assert zero ready Doctor tasks before commit and after readback, and verify shared project publication scope is unchanged. No SQL is executed by the local adapter generator. The cancelled live refresh requires renewed permission before it or any import can proceed.
