# Shop Suit Assistant

Open **Shop assistant** in an enabled Shop Suit environment and choose the shop and location in the workspace. The assistant is available to the active shop's owner. Type a request in the language you normally use. The assistant is designed to reply in the language you use and can follow up on the current conversation. Starting a new chat, leaving the page or changing shop, location or account clears the conversation. Shop Suit stores no chat history.

| Ask for | Scope |
| --- | --- |
| Find a product by name or SKU | The selected shop's catalog |
| Check stock or find low-stock products | Inventory across the selected shop |
| Summarize operations for today, this week or this month | The selected location |
| Record an expense you've already paid | The selected location. Review the title, amount, category and date, then confirm to save the expense. |
| Open a Shop Suit screen | Links to the supported screens in the workspace |

For example, try “What products are low on stock?”, “مبيعات الفرع النهارده كام؟” or “Cherche le produit ABC-123.” The model handles language and dialect interpretation. If the assistant misreads a request, clarify it before confirming any action.

Each turn sends chat text and the selected fields returned by Shop Suit's tools to Vercel AI Gateway and the configured model. Avoid entering credentials or unnecessary personal information. Shop Suit checks access with the owner's authenticated session, including when saving a confirmed expense. The confirmation is valid for ten minutes. The expense RPC checks the reviewed details in the same transaction that records the expense. Retrying the same confirmation uses the original expense request ID.

## Environment setup

The feature starts disabled. Use a disposable local Shop database with the current migrations. For a running local database, apply pending migrations with `pnpm db shop-suit migration up --local`. Set these values in the ignored app environment file and launch `pnpm dev:shop --current` from the feature worktree.

| Variable | Value |
| --- | --- |
| `NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED` | `true` |
| `NUXT_SHOP_ASSISTANT_SIGNING_SECRET` | A private 64-character hexadecimal value. Generate it with `openssl rand -hex 32`. |
| `NUXT_SHOP_ASSISTANT_MODEL` | Optional AI Gateway model ID. The default is `google/gemini-3.8-flash`. |
| `AI_GATEWAY_API_KEY` | A server-only gateway credential for local development. Hosted Vercel environments can authenticate through OIDC. |

Use a separate signing secret for each environment and keep both credentials server-side. The chat endpoint limits each account to 12 requests per minute per server instance. [AI Gateway setup](https://vercel.com/docs/ai-gateway/getting-started), [gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok).

For a model-backed acceptance check, use disposable shops and try a lookup, location report, and paid-expense confirmation with prompts in English, Egyptian Arabic and another language you plan to use. Change the active location and test an employee session. Synthetic tool tests can check workflow boundaries and replay behavior. Understanding and dialect quality require real model responses in the target environment. Hosted activation requires the environment settings and matching Shop app and database revisions.

For a repeatable browser check with synthetic data, build Shop with `pnpm --filter @building-suit/shop-suit build` and run `pnpm exec playwright test -c apps/shop-suit/playwright.assistant.config.ts` from the workspace root.
