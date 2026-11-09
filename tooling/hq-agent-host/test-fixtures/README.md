# Prepared worker compatibility fixture

`repository-compatible-worker.mjs.txt` contains the exact reviewed future worker
bytes for disposable compatibility tests. Its SHA-256 is
`e01fd99ead607d740fcea13b33a23627518762c5ce94c9fd99d993ddc0a5c935`.
It is inert test data, not the active worker or a deployment instruction.

The SQL-first change keeps `../worker.mjs` at the historical SHA-256
`bb6c941f2398b4067d963e9c0de21c53738fa0729f9bb96ee64c89fb7159dd88`.
The module remains at SHA-256
`bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976`.

`public-repository-db.test.mjs` verifies these hashes, materializes the prepared
worker only in a temporary test directory, and exercises mocked CLI transport
against disposable PGlite. Historical proofs are produced by the actual pinned
historical worker, not by rewriting evidence. The historical Git commit must be
available when running the test.

`release.py` packages only its explicit runtime `FILES` allowlist. This directory
and its fixture are excluded. Worker activation is a separate later change.
