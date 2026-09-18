# Hosted prerequisites for the independent product pairs

This is a one-time setup record, not an ongoing agent workflow. ADR 0002 supersedes the previous shared database/SSO migration.

The requested arrangement needs two organizations and four independent project refs: Ledger production/staging and Shop production/staging. The user will enter organization IDs, owner emails, actual roles/plans, app origins and refs in the environment registry and secrets in the ignored files described in [manual setup](../shared/supabase-manual-setup.md). Resolve the documented Free/shared-Owner quota before relying on the four projects.

The currently accessible Shop source is Building Suit (`jkdncdexqcymwbihwdhp`), with `shop_crm` data and `shop_private` helpers. It is a shared source, not a destination. The old Ledger configuration names `yqculoltqsyfastmihmu`, which still needs verification; do not substitute accessible Finance Suit (`kedjrbwnznvfqlzszawa`) without evidence that it is the intended product.

The remaining hosted work is finite:

1. Verify the four refs, owning organizations, roles/plans, origins and credentials; compare live source/destination schema and migration histories. Check backup/restore access and scoped test authorization.
2. Preserve Ledger’s existing public-schema contract within its own pair. Determine whether existing Ledger projects are retained or moved whole; changing organization does not require inventing new business schemas.
3. Perform the Shop-only copy, public namespace relocation, Auth/Storage/service setup and staged acceptance in [Shop dedicated projects](shop-dedicated-projects.md). A whole-project transfer would also move unrelated Building data and is unsuitable here.
4. Configure separate Auth callbacks, email delivery and cookies for every environment; verify each product independently. No global identity reconciliation or SSO is required.
5. Reconcile data and business invariants, verify recovery, then switch the relevant app environment and record the deployed refs/versions.

No hosted changes have occurred. Setting refs/keys, passing local tests or producing a local schema is not proof of a hosted restore.
