# Managed bootstrap controls — admission remains held

This prerequisite contains no admission-resume migration. Fresh managed health,
roster reconciliation and parent acceptance remain required before activation.

## Public directory mode correction — keep activation held

The first managed install exposed `200/CHDIR`: umask `077` filtered mkdir's
requested `0755` to `0700`. This source corrects only public release/control-bin
traversal modes. The root operator must review/update `release.py` and
`bootstrap.py` and their exact digest receipt before enabling the timer. The
signed worker bundle, trust policy/roots, configuration are unchanged. Do not chmod recursively or widen private inputs, state, credentials,
receipts or backups. Re-run real service-user preflight/paused managed health
and preserve the admission hold; these disposable tests are not host acceptance.


## Symlink main dispatch correction — keep activation held

Both fixed systemd Node commands now include `--preserve-symlinks-main`.
Without it, Node resolves the main module to `releases/<sha>/worker.mjs` while
`argv[1]` retains `current` or `candidate`, so the worker's main guard silently
skips startup and preflight. Exit zero alone did not establish compatibility.
The flag preserves main-module identity through the atomic release link;
relative imports and manifest reads still resolve to the selected release.
Ordinary imports remain inert. The signed five-module worker bundle is unchanged.
See the [official Node option](https://nodejs.org/download/release/v24.15.0/docs/api/cli.html#--preserve-symlinks-main).

Review/update both unit files and their control receipt hashes before running
real preflight and paused managed health. Disposable real-Node tests reproduce
the false zero exit, require actual authenticated-fixture contract validation,
reject missing RPC/module dependencies, exercise atomic release switching and
check PID/release/paused readiness plus the trial source digest. No live
credentials, model or hosted system are used. Admission and timer remain held.
