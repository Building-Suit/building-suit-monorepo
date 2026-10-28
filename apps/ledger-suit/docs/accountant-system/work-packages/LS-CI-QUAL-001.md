# LS-CI-QUAL-001 — qualify the combined staging candidate

2026-10-28. Parent: PR #507, `93ac0cbc6582976bf3cf9129c728451721c251e4`. This bounded follow-up repairs inherited shared CI blockers before the authorized Ledger stack consolidation. It does not integrate the unrelated Shop scale/electrical feature stack.

The earlier GitHub review had 54 failing Shop tests against evolved query contracts. The existing compatible harness and scope-cleanup changes were reviewed from published Shop commits `5aa8b3376f6e5bba68e29696bdbb04704b75f7f2` and `a15ce639`; only their applicable harness, current landing expectation and bounded query/permission changes were applied. No unrelated product features, documentation, fragments or release inventory were copied. The module harness now resolves the actual Vue, Pinia and Colada modules and current product query interfaces. Existing business assertions remain in place.

Old scoped queries are cancelled and their data/errors hidden immediately, with removal delayed until active consumers detach. Public SSR no longer initializes private counter state; an authenticated receipt store remains referenced so sign-out still clears it synchronously. Existing offers and website settings routes receive explicit capability mappings. Command failures retain the original error for their owning caller while the mutation cache receives a redacted error without the private cause. Actual Colada tests verify both failure and success cleanup.

The shared browser tests are being qualified against the current canonical navigation rail and cycle controls. Their former header/menu selectors predated the shared shell redesign. Keyboard activation, focus restoration, RTL, themes, disabled pre-hydration controls and cross-product geometry assertions remain acceptance requirements.

Completed local checks: 461 Shop unit tests; the full root suite has 2,030 passes, 23 explicit skips and zero failures across 2,053 tests. This includes both unchanged receipt visual references using the pinned Playwright Chromium. Root lint passes with zero errors and 31 existing warnings. Workspace/token boundaries and Shop types pass. Full builds and browser qualification are in progress; no staging merge or provider deployment is claimed here.

No database or Storage reset, migration, Automation mutation, provider dashboard change, main promotion, customer communication or accountant sign-off is part of this task. Hosted and professional acceptance gates remain explicit.
