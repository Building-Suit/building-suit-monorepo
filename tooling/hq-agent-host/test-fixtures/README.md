# Pinned worker history and reviewed retail candidate

These inert files are excluded from release.py's runtime allowlist.

- repository-historical-worker.mjs.txt: V1 SHA-256
  bb6c941f2398b4067d963e9c0de21c53738fa0729f9bb96ee64c89fb7159dd88.
- repository-compatible-worker.mjs.txt: V1 SHA-256
  e01fd99ead607d740fcea13b33a23627518762c5ce94c9fd99d993ddc0a5c935.
- retail-v2-worker.mjs.txt: V2 SHA-256
  7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40.

All three use unchanged departmentWorkflow.mjs SHA-256
bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976.

SQL-first PR #569 retained production V1/e01. Phase 2 copies the frozen V2
fixture byte-for-byte into worker.mjs after hosted ledger/function/ACL and
authenticated capability verification. Source changes do not prove deployment.
The release packages worker.mjs, not this directory.

Tests materialize exact historical workers and generate real mock-CLI receipts
against disposable databases. V1 baseline tests keep using e01; V2 tests
independently pin current source and check qualification separation and rollback.
No evidence hashes are rewritten.
