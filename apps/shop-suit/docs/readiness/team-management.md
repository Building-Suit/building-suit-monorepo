# SS-TEAM-001 — Team management and authorization

Implemented locally on 2026-09-28. No hosted database was modified.

The Shop team workflow now provides:

- email-bound, seven-day invitation codes and direct addition for existing
  confirmed Shop accounts in the original September implementation. The launch
  controls now require explicit acceptance for both existing and new identities;
  see [SS-LAUNCH-TEAM-001](launch-team-controls.md) for the current contract;
- owner, manager, cashier, barber/operator, and staff behavior backed by the
  existing granular permission catalog rather than role-name checks;
- one-or-more active location assignments for non-owner members;
- active, suspended, and removed states. Removal is retained as a terminal
  timestamped state on the membership so operational foreign keys and history
  remain intact;
- backend permission checks for team viewing, administration, role changes,
  audit visibility, product/service/expense/settings management, reports,
  discounts, and stock adjustment;
- immediate membership checks on every protected call, including sessions
  issued before suspension;
- a database trigger that prevents the last active owner from being demoted,
  suspended, removed, or deleted, plus an atomic ownership-transfer command;
- immutable, actor-attributed audit events for invitations, acceptance,
  membership state, role/location changes, and ownership transfer.

The launch task supersedes the original permission-card presentation and adds
custom/system role editing and member details. Its acceptance remains blocked
until the dependency and verification prerequisites in the linked handoff pass.

The `/team` page uses the shared shell, forms, dialogs, confirmation controller,
toasts, and `BsDataTable`. It includes Arabic/English copy, RTL-compatible logical
spacing, responsive controls, invitation acceptance, loading/empty/error states,
and owner-only ownership transfer.

Existing product, service, expense, and business-settings screens now use the
same backend permission keys instead of an owner-only UI shortcut. Existing
custom roles with inventory catalog access are forward-mapped to the new,
separate product keys so the split does not silently remove prior access.

The invitation code is returned once to the inviter as a shareable application
link because transactional email/SMTP is not configured in this repository.
Acceptance still requires an authenticated, confirmed account whose Auth email
exactly matches the invitation. Platform-admin authority remains independent and
cannot be granted through this tenant workflow, preserving ADMIN-D01.

Local verification is recorded in the task handoff. The focused SQL suite is
`supabase/tests/shop_team_management.sql`; it is included in the maintained Shop
local database runner.
