# Run the HQ 3D review locally

Use this procedure after the reviewed 3D update has been published to `codex/company-hq/living-office` in `Building-Suit/building-suit-monorepo`. It keeps PR #530 and its existing parent stack. The last published checkpoint before this 3D correction was `01c25905b04eb9f67afeaf1ae11272b9b09fa5a3`; that checkpoint does not contain this correction. Obtain the new full reviewed commit from the handoff and verify it below. Do not assume that a branch name or an old local build is the new result.

The preview uses actual local HQ records in a separate temporary SQLite database. Model execution, live Brain access and hosted services remain disabled. The visual review does not add department/employee click behavior or menus. No screenshot, sprite, billboard or raster-background asset from the abandoned appearance review is required or should be copied into this checkout.

## Fetch without disturbing existing work

Replace the three values with the actual repository path, an unused preview-directory path and the full reviewed commit. Run each block only after the preceding checks succeed. These are ordinary user-owned paths; do not change `HOME` or other system variables.

```bash
hq_repo='/absolute/path/to/building-suit-monorepo'
hq_preview='/absolute/path/to/new-company-hq-review'
hq_expected_commit='FULL_REVIEWED_COMMIT_FROM_THE_HANDOFF'

git -C "$hq_repo" status --short
git -C "$hq_repo" remote get-url origin
git -C "$hq_repo" worktree list
```

Verify that `origin` is exactly the intended repository, for example `https://github.com/Building-Suit/building-suit-monorepo.git` or `git@github.com:Building-Suit/building-suit-monorepo.git`. Keep any local changes where they are. The isolated-worktree route below does not copy, stash, reset or delete them. If the remote differs, stop and resolve the repository selection before fetching.

```bash
git -C "$hq_repo" fetch --no-tags origin \
  refs/heads/codex/company-hq/living-office:refs/remotes/origin/codex/company-hq/living-office
hq_revision="$(git -C "$hq_repo" rev-parse refs/remotes/origin/codex/company-hq/living-office)"
git -C "$hq_repo" show --no-patch --format='%H %s' "$hq_revision"
test "$hq_revision" = "$hq_expected_commit"
```

If the final check fails, stop. A different head must be reviewed before it replaces the intended preview. Do not force-update a tracking ref or silently use another branch.

Create the new directory as an isolated detached worktree at that verified commit:

```bash
git -C "$hq_repo" worktree add --detach "$hq_preview" "$hq_revision"
cd "$hq_preview"
git status --short
git rev-parse HEAD
```

The destination must be unused; leave an existing directory untouched and choose another path if needed. A detached worktree is intentional for this review. No new feature branch, commit or push is needed to run it.

For a later update to an already dedicated preview worktree, stop its server first. Inspect `git status --porcelain` and `git branch --show-current`, then fetch and verify the new reviewed revision as above from that worktree. Proceed only if it is clean and its current commit is an ancestor of the reviewed revision:

```bash
git merge-base --is-ancestor HEAD "$hq_revision"
git merge --ff-only "$hq_revision"
git rev-parse HEAD
```

Stop on a failed ancestor or fast-forward check. Never use `reset`, `clean`, automatic stashing or a forced pull to repair a review checkout. A fresh isolated worktree remains an option that preserves the existing one.

## Build and start on loopback

HQ supports Node `^24.15.0 || >=26.0.0`; the earlier cloud checks used Node 24.19.0. Use pnpm **10.33.0**, as pinned in the root package manifest. Confirm the selected versions before installing. No `.env` file, provider key or real account credential is needed for this synthetic local launcher.

```bash
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm --filter @building-suit/company-hq build
cd apps/company-hq
env -u NITRO_HOST -u NITRO_PORT -u NITRO_UNIX_SOCKET \
  -u NITRO_SSL_CERT -u NITRO_SSL_KEY \
  TMPDIR=/tmp node scripts/test-server.mjs
```

Do **not** pass `--synthetic-ceo-worker`. The launcher binds only to `127.0.0.1:4337`; the command removes inherited Nitro bind/socket/TLS overrides. If that port is occupied, stop only your own previous HQ preview before retrying.

Each launch creates `/tmp/hq-browser-<random>/hq.sqlite`. It forces local HQ storage, false backend/hosting verification flags and empty Supabase configuration. Its password and bridge identities are fixed synthetic fixtures supplied internally by the committed script. This does not configure or change real credentials, production data, Supabase, model access or scheduled work.

## Review and stop

On the **same computer running the server**, open:

```text
http://127.0.0.1:4337/auth/login
```

Sign in through the existing login page with the test-only password `synthetic-browser-password`, then open `http://127.0.0.1:4337/`. Use a 1600 × 900 browser viewport for comparison with the supplied reference. The localhost address of a cloud executor is not a link reachable from a different computer.

Inspect the real 3D rendering and the authenticated local department records. The review surface intentionally leaves menu and click decisions for the founder. A WebGL fallback or rendering error is not evidence of a successful 3D preview; report it rather than substituting a screenshot-based scene.

Press **Ctrl+C** in the terminal that launched the server. The launcher stops its child process and removes only its own temporary database directory. Each restart begins with a new isolated local workspace. Keep the checkout and any unrelated work intact.
