# Managed bootstrap controls — admission remains held

This prerequisite does not include an admission-resume migration. Real managed
health, roster reconciliation and parent acceptance remain required before
admission or timer activation.

## Public directory mode correction — keep activation held

The first managed install exposed `200/CHDIR`: umask `077` filtered mkdir's
requested `0755` to `0700`. This source corrects only public release/control-bin
traversal modes. The root operator must review/update `release.py` and
`bootstrap.py` and their exact digest receipt before enabling the timer. The
signed worker bundle, trust policy/roots, configuration and systemd units are
unchanged. Do not chmod recursively or widen private inputs, state, credentials,
receipts or backups. Re-run real service-user preflight/paused managed health
and preserve the admission hold; these disposable tests are not host acceptance.
