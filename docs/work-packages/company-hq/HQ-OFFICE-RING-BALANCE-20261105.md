# HQ office ring balance — 5 November 2026

The founder requested that additional office layers begin at the top and spread across both sides instead of filling the right side first. The shared `departmentOfficeLayout` keeps the CEO at the top of the first ring and starts every outer ring at the same top angle. Occupied slots alternate clockwise and counterclockwise in the order `0, +1, -1, +2, -2, …` around that angle.

Spacing still uses each ring's full capacity and the existing complete-room clearance. It does not redistribute an occupied ring using its current department count, so an ordinary appended approval leaves its existing assignments in place. The existing approved-date/ID ordering still applies: backdated imports or insertion within an equal-date batch may change assignment order. This task does not add persistent placement records.

Road gap routing uses the same top phase and full-capacity grid. The renderer, minimap and directional island footprint continue to consume the shared office layout, so roads, office markers and required land follow the balanced placements. No workplace geometry, camera control, palette, source record, approval rule or integration contract changes.

Work is in the primary checkout on `codex/company-hq/office-design`, under PR #528. Source implementation and visual acceptance remain unverified. No tests, builds, lint, typechecks, boundary/release checks, browser/API/runtime checks or tester/reviewer agents were run for this task, following the standing founder instruction. No provider changes, merge, deployment, production action or public product activation belongs to this change.
