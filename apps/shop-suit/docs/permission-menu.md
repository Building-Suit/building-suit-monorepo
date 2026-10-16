# Roles and permissions menu

`app/utils/shopNavigation.ts` is the canonical bilingual menu definition, consumed by the authenticated shell and the role editor. Permission sections follow its group/page order and labels. Customer and sales names continue to come from the existing locale messages. Product/service mode filtering applies to navigation; the role editor deliberately retains the complete catalog so hidden pages cannot erase existing grants.

`app/utils/shopPermissionMenu.ts` maps each page to existing backend permission keys. It is presentation configuration, not a route guard or an authorization policy. Only keys returned by `shop_team_read` appear. Unmapped legacy/future keys remain available in the final additional/shared capabilities section. Grantability still comes from the backend snapshot.

A capability can affect several pages. For example, `settings.manage` is used for business settings, tax settings and ETA configuration; `team.manage` is also a prerequisite for commission and service-recipe management. These pages retain their backend owner/system-manager and location checks. Selecting a capability does not bypass those checks. Shared occurrences use the same selected permission key; the shared UI gives each occurrence a separate table row identity. Saving still sends the original permission-key array, including previously saved unavailable keys. No permission, role, migration, grant, RPC or RLS identifier changes.

Subscription & billing remains owner-only and has no assignable permission row. No synthetic billing permission is introduced. Pages with no returned assignable actions produce no empty permission section.

Regression coverage in `tests/unit/permission-menu.test.mjs` checks English/Arabic menu order, mapping coverage, business-mode navigation filtering, disabled/unknown grant retention and the owner/save contracts. Shared UI coverage checks repeated grants have unique row identities and emit the original backend key; existing shared UX coverage protects immutable selection and pending/disabled behavior.

## Website stack compatibility

The merge parent is appointment-access PR #333 at `314bcce87e1c7a5fcd9215bfde16d149825ef4c2`. Its address/profile/catalog/inquiry controls are inside the existing Business settings page; it adds no top-level navigation items or assignable permission identifiers. Their existing `settings.manage` prerequisite remains under `/settings`, and appointment access issuance/revocation retains `appointments.manage` under `/appointments`. Owner-only consent, publication/inquiry checks and public session boundaries remain backend-enforced. Later customer-portal navigation must update the canonical menu and page mapping together; public portal sessions must not become staff role grants.
