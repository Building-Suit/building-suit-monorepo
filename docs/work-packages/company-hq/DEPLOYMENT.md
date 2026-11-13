# HQ development and deployment

Historical record from 3 November 2026. The [4 November static restart](STATIC-RESTART-20261104.md) supersedes the backend setup and office acceptance below. Use the [current app README](../../../apps/company-hq/README.md) for the layout preview; these retained commands are not current setup instructions.

From the monorepo root, use the pinned pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile
pnpm --filter @building-suit/company-hq prepare
pnpm dev:hq --current
```

The worktree-aware launcher serves the current authorized local or cloud checkout on port 3101. The founder retired the Cloud Rule on 3 November 2026; runtime location does not gate development. On the same computer as the server, open `http://127.0.0.1:3101`. For a remote checkout, use an authorized private forwarding/preview path and verify it before sharing its browser link: a personal computer’s localhost does not reach a cloud server. Use `pnpm dev:hq --list` or `--dry-run` to inspect source selection. The old ChatGPT Site is not the current monorepo build.

For a private development backend, copy the app-scoped `.env.example` into private runtime configuration, use its exact origin, choose an absolute private database path, and generate the password hash via `pnpm --filter @building-suit/company-hq password:hash` with private stdin. Use independent random CEO/HR tokens. Never commit credentials or put them in public Nuxt configuration.

```sh
pnpm --filter @building-suit/company-hq typecheck
pnpm --filter @building-suit/company-hq test
pnpm --filter @building-suit/company-hq build
pnpm --filter @building-suit/company-hq test:e2e
pnpm check
pnpm release:check
```

The browser suite starts a production build on loopback 4337 with disposable synthetic founder/CEO/HR credentials and storage, then removes it. Its visual test uses the founder-approved reference at 1440×1000 with zero permitted changed pixels. Browser runs default to `/usr/bin/chromium`; set `PLAYWRIGHT_USE_BUNDLED=1` to use installed Playwright browsers on a local machine or in CI. The 3 November 2026 managed-cloud verification is historical execution evidence, not a requirement for subsequent runs.

The app owns `apps/company-hq/supabase`; declared local ports are isolated 5832x. No local Supabase stack is started by Nuxt, and no hosted migration is applied by the test suite. Verify the scope and $0 activation conditions in `BACKEND-COST.md` before any hosted change. Feature-branch Git deployments must remain disabled; `vercel.json` is a guard, not a claim about dashboard settings.
