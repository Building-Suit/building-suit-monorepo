# Formal quotations

Formal offers are separate from invoice drafts. Saving, issuing, revising or accepting an offer never posts stock, customer debt or payment, and never promises availability or reserves a physical reel. Future-supply materials can be quoted before receiving stock. Order conversion and fulfillment belong to the next dependent task.

The quote has a shop/location, stable number, customer, project reference, validity, notes and current state. Every save creates an immutable numbered commercial version with exact input quantities/units/packages, server prices, the applicable price rule or manager approval, discount, tax policy and amounts, customer/item names and validity. Every state change records its actor, reason and optimistic revision. The bounded location-authorized read API returns current details and independently paged version/state history. Printed historical versions carry an explicit historical warning.

| Action | Allowed source | Result | Existing permission |
| --- | --- | --- | --- |
| Save | New or draft | New immutable draft version | sales.manage |
| Revise | Issued, rejected or expired | New draft version under the same number | sales.manage |
| Issue | Unexpired draft in current currency | Issued, same price version | sales.issue |
| Record customer acceptance | Unexpired issued offer in current currency | Accepted, same price version | sales.issue |
| Record customer rejection | Unexpired issued offer in current currency | Rejected | sales.manage |
| Record expiry | Issued offer past validity | Expired | sales.manage |
| Cancel | Draft, issued or accepted | Cancelled | sales.manage |

Staff record a customer's decision and the supporting reason; this feature does not claim a customer signature or a public customer acceptance service. Cancelled offers are terminal. An accepted offer cannot be edited/revised. An issued offer superseded by an explicit new draft cannot be accepted through its former version. Reads show effective expiry even before a staff member records its transition; authoritative commands check the current clock and revision. No timer silently rewrites history.

Saving a draft computes current server prices again. Issuing or accepting its saved version preserves its reviewed amounts; changed catalog prices do not silently reprice an issued offer. A changed shop currency blocks issue/acceptance until an explicit new commercial version is prepared. Product measurement definitions remain frozen in history; later order conversion must validate current SKU/unit compatibility rather than reinterpret that history.

Manager overrides use existing product-management authority and retain the approving actor, reason and exact per-entered-unit price. Sales staff may retain an approval already stored in the same quote version when its customer, product, quantity, unit, package/source and exact entered override still match. A changed approval needs a manager. The server reads prior approval data from the immutable stored version; client-supplied approval objects confer no authority.

Commands use actor-bound request IDs and canonical payloads; a lost response freezes the exact request for retry. Conflicting reuse and stale revisions fail atomically. Current subscription/write and location checks apply on every command. Commercial metadata does not create accounting entries; existing fiscal posting/closed-period rules remain authoritative for later invoice/payment operations.

Local qualification: 110 actual migrations, 14 selected SQL suites, two merchant journeys and two real-session stock races pass in the owned schema fixture. Provider interfaces are explicit stand-ins. Tests cover frozen price/name/measurement history, revision retention, retry conflicts, issued/accepted edit denial, expiry, explicit rejection/revision, no financial/stock effects, private ACLs, outsider denial and retention of manager approval by a non-manager. Shop units pass481/481. The combined Shop typecheck and production build pass. Both English/light desktop and Arabic/dark mobile browser journeys pass, including same-request lost-response issuance retry, explicit repricing into a new version, viewing the original amounts and printing a historical version with its warning and direction. Screenshots were inspected. Final combined-head and native Supabase checks and real merchant/device acceptance remain separately recorded gates.
