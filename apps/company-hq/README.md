# Building Suit HQ layout preview

HQ was restarted on 4 November 2026 at the founder's request. The current scope is the attached image's layout: Building Suit HQ branding, centered navigation, status and action placement, a large empty rounded canvas, a workspace label and an empty minimap panel. All navigation and action controls are disabled. There are no office scenes, rooms, agents, model connections, authentication, tasks, messages or persistence.

From the monorepo root:

```sh
pnpm dev:hq --current
```

Open `http://127.0.0.1:3101` on the server's computer. `--current` serves the checkout where the command runs; edits there hot-reload. The current founder request uses the primary repository checkout. No environment variables, credentials or database are needed for this preview.

The app route supplies translated `HqLayoutContent` to the complete shared `BsHqLayoutPage` template. Presentation lives in `packages/ui`; the documentation app demonstrates the same template in its component catalogue. English/Arabic and LTR/RTL use the shared infrastructure.

Source verification commands:

```sh
pnpm --filter @building-suit/company-hq typecheck
pnpm --filter @building-suit/company-hq build
pnpm --filter @building-suit/company-hq test:e2e
pnpm --filter @building-suit/docs typecheck
pnpm --filter @building-suit/docs build
pnpm check
pnpm release:check
```

The browser suite uses the production build on loopback port 4337. Build HQ before running it. Old backend and office records in `docs/work-packages/company-hq` and the app's Supabase migration files remain historical evidence. They do not describe active runtime functionality or authorize a hosted operation. See the [restart record](../../docs/work-packages/company-hq/STATIC-RESTART-20261104.md).
