# HQ development and deployment

From the monorepo root, use the pinned pnpm 10.33.0:

```sh
pnpm install --frozen-lockfile
pnpm --filter @building-suit/company-hq prepare
pnpm dev:hq
```

The worktree-aware launcher selects the HQ workspace and port 3101. This is a cloud runtime address; the founder’s personal computer cannot reach it as its own localhost. Verify an authorized private forwarding/preview path before giving the founder a browser link. The old ChatGPT Site is not the current monorepo build.

For a private development backend, copy the app-scoped `.env.example` into private runtime configuration, use its exact origin, choose an absolute private database path, and generate the password hash via `pnpm --filter @building-suit/company-hq password:hash` with private stdin. Use independent random CEO/HR tokens. Never commit credentials or put them in public Nuxt configuration.

```sh
pnpm --filter @building-suit/company-hq typecheck
pnpm --filter @building-suit/company-hq test
pnpm --filter @building-suit/company-hq build
pnpm --filter @building-suit/company-hq test:e2e
pnpm check
pnpm release:check
```

The browser suite starts a production build on loopback 4337 with disposable synthetic founder/CEO/HR credentials and storage, then removes it. Its visual test uses the founder-approved reference at 1440×1000 with zero permitted changed pixels. Browser runs use `/usr/bin/chromium` in this managed cloud; set `PLAYWRIGHT_USE_BUNDLED=1` for installed Playwright browsers in CI.

The app owns `apps/company-hq/supabase`; declared local ports are isolated 5832x. No local Supabase stack is started by Nuxt, and no hosted migration is applied by the test suite. Verify the scope and $0 activation conditions in `BACKEND-COST.md` before any hosted change. Feature-branch Git deployments must remain disabled; `vercel.json` is a guard, not a claim about dashboard settings.
