# Shop Suit Agent

Building Suit operates the managed Shop Suit Agent. Open **Shop assistant** from an active shop and branch, then choose **Authorize and enable**. Shop Suit records authorization for the current owner and shop. Use **Turn off agent** to withdraw it.

Type a request such as «عميل اسمه أحمد محمد عمل شعر ودقن». The assigned agent interprets it and Shop Suit looks up the customer and services using the owner's branch permissions. If Shop Suit can identify the records, it opens Point of Sale with the selections filled in. Review the payment and complete the sale in POS. Shop Suit then opens the issued receipt, where you can choose **Print**. Ambiguous matches remain unresolved until the owner supplies more detail or selects the record in Shop Suit.

## Managed worker setup

The feature starts disabled. Apply the Shop database migration for the managed queue and follow the separate [Shop HQ worker setup](../../../tooling/hq-shop-agent-host/README.md). Registering an enabled worker admits authorized requests at the database. When the correct worker is connected, expose the chat with `NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED=true` and `NUXT_PUBLIC_SHOP_ASSISTANT_MODE=hq`. To pause processing, disable the registered workers as well as the app flag.

The managed worker reads requests through a registered technical identity with a private Realtime subscription. It returns a structured interpretation to Shop Suit. Shop Suit uses the signed-in owner's permissions to resolve records and to perform checkout. HQ's internal employee runtime and its founder login are separate. The model receives message text and the approved Shop documentation snapshot when configured. It receives no Supabase user token or customer records from the POS lookup.

Starting a new chat or changing the signed-in account, shop, or branch clears the browser conversation. The queue clears raw messages when a worker claims the request, or on expiry or revocation if still pending. A model provider's retention rules apply to content it receives. The worker setup describes how to supply a reviewed Shop-only documentation snapshot.

## Gateway mode

The earlier opt-in Gateway mode supports catalog and stock lookups, operating summaries and confirmed expense recording. Environments that use it set `NUXT_PUBLIC_SHOP_ASSISTANT_MODE=gateway`, a private 64-character hexadecimal `NUXT_SHOP_ASSISTANT_SIGNING_SECRET`, and Vercel OIDC or `AI_GATEWAY_API_KEY`. Its default model is `google/gemini-3.8-flash`, which can be overridden with `NUXT_SHOP_ASSISTANT_MODEL`. In this mode, chat text and selected tool results go to the configured model provider. [Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok)

## Local verification

Use a disposable Shop database with the current migrations. For a running disposable local database, apply pending migrations with `pnpm db shop-suit migration up --local`. Serve the checkout with `pnpm dev:shop --current`.

For repeatable browser tests, run `pnpm --filter @building-suit/shop-suit build`, then `pnpm exec playwright test -c apps/shop-suit/playwright.hq-assistant.config.ts` for managed mode or `pnpm exec playwright test -c apps/shop-suit/playwright.assistant.config.ts` for Gateway mode. These tests use synthetic requests and do not call a model provider.
