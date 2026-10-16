# SS-WEB-CUSTOMER-PORTAL-001

Parent: draft PR335 at `0b3273937f3d1982b9a766fb0305a8cfc1c77e80`, retaining PR333's reviewed logout fix. The reviewed PR334 infrastructure repair is incorporated by a history-preserving merge of `stg` at `773bcc85cf1ca5c03a4dab16516e6d69288fa643`. Parent handles staging integration. Public booking remains a separate task.

Contract: [customer portal](../../apps/shop-suit/docs/website-customer-portal.md). The exact task requires a clear entry point, valid short-lived session, saved-customer same-shop upcoming/history projection, exclusion of financial/private fields, one-appointment walk-in scope, accurate terminal statuses, expiry/revocation returning to verification, and responsive EN/AR accessibility.

Design follows the requested official frontend-design skill and canonical tokens: a quiet public-shop header, verification panel, then date-first semantic appointment rows. Existing Manrope/Arabic fonts, shared controls, status badges and pagination preserve the public website's visual language. Complete presentation lives in packages/ui; reusable suspension/expiry lifecycle in packages/ux; Shop owns data/auth/rules and typed props. No new palette, app-local composition or early booking.

Verification results are recorded in the PR. Three named unit obligations test allowlisted parsing, malformed/expired responses and narrow walk-in projection. Disposable PostgreSQL fixtures test actual authority, isolation, published-location privacy, stable paging/statuses, expiry/revocation and table/helper grants. Built HTTP tests exercise real middleware/API with a loopback synthetic RPC backend. Browser obligation four covers EN/AR at mobile/tablet/desktop, saved history and pagination, terminal statuses, walk-in scope, logout, revocation, absolute expiry, no-cache/noindex and no private SSR/storage payload.

No hosted writes, actual customer publication, manual deployments, provider/secret/security-setting changes, main promotion or personal network. Migration deployment is CI-only.
