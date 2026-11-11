# Retail MCP instructions: phase 2 checkpoint

Base: stg bba65d19f41ad780b8300c5818e9dcb0f9590195, merged SQL-first PR #569.
This is a reconstructed source checkpoint, not recovery of the lost worktree.

The production source is copied byte-for-byte from the committed inert fixture:
worker SHA-256 7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40;
unchanged module bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976.
Historical V1 tests continue using real pinned bb6/e01 worker fixtures. V2 source
checks independently pin the production bytes. No evidence digest is rewritten.

Before phase 2 preparation, hosted migration 20261111020000, function metadata and
ACL preservation were verified. At 2026-11-11T03:17:32.766507Z, the existing Oracle
worker authenticated hq_worker_release_status and returned unchanged exact V1
capabilities and the exact V2 worker/module pair above. Filtered capability
snapshot SHA-256: abeb8f7f47704c54eb60ab66a4872286d9ada678b46c6cd95138088794d7cbc0.
Worker/current release was bba65d19 with matching manifest, no restart or deployment.
These are dated observations, not proof of later adoption.

This draft checkpoint preserves work against repeated executor resets. The bounded
acknowledgment context migration, final regression tests and independent review
are still being reconstructed. Earlier successful local runs belong to the lost
checkout and do not establish this new head's verification. Do not merge before
new exact-head checks and rollout/provider gates pass.

No real customer work, manual hosted SQL, qualification expansion, main promotion,
security bypass, credential changes or destructive cleanup is included. The
existing staging integration remains the only authorized SQL deployment path.
