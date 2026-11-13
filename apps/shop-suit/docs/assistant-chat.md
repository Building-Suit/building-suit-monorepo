# Shop Suit Agent

Open **Shop assistant** as a shop owner in the branch where the work should happen. Choose **Authorize and enable** to let Building Suit handle requests using your Shop Suit permissions. **Turn off agent** withdraws that authorization.

Each active shop has a stable employee assignment in the Shop Suit Agents department. The head dispatches each saved request to that shop's available employee. The employee posts replies in the same chat. The head reviews reports in batches and assigns corrections where needed. The employee appends any correction to the original request.

For a service sale, send the customer's name and services. Include the amount and method if the customer already paid in full. For example, with a matching test customer, published services priced at 200 total, and an open cash shift:

> عميل اسمه أحمد محمد عمل شعر ودقن. دفع ٢٠٠ كاش.

If Shop Suit needs another detail, reply in chat. When the sale succeeds, choose **Open receipt** from the employee's reply and print if needed. A payment statement such as `دفع ٢٠٠ كاش` or `paid 200 cash` can resolve a pending sale quote. Shop Suit checks the exact customer, service, branch, total and payment before issuing the receipt.

## Managed worker setup

The feature starts disabled. Apply the current Shop Suit database migrations and follow the [Shop HQ worker setup](../../../tooling/hq-shop-agent-host/README.md). The existing HQ worker can synchronize staffing while the Shop queue remains disabled. After the worker has an approved inference adapter and the queue has been enabled explicitly, expose the chat with `NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED=true` and `NUXT_PUBLIC_SHOP_ASSISTANT_MODE=hq`. Disable the queue and the app flag to pause processing.

Existing active shops are backfilled by migration. Shop creation and activation provision the employee automatically. The HQ worker uses one scoped Shop identity to send staffing metadata to the existing HQ founder office. See the [department charter](https://drive.google.com/file/d/1dCG4eMDpRIii8cfJWE2gYpMWsZuc8DgY/view).

Shop Suit saves chat requests briefly so employees can act, review can recover after a disconnect, and owners can reconnect. Private Realtime signals carry no chat or sale content. Shop Suit authenticates each result read separately. Account, shop, or branch changes clear the browser view and load the new scope. Review and checkout are fenced to the authorized job. Completed sales remain in Shop Suit after the chat transcript expires.

## Gateway mode

When the assistant is enabled, Gateway is the default mode. It supports catalog and stock lookups, operating summaries and confirmed expense recording. Leave `NUXT_PUBLIC_SHOP_ASSISTANT_MODE` unset or set it to `gateway`. Configure a private 64-character hexadecimal `NUXT_SHOP_ASSISTANT_SIGNING_SECRET` and authenticate with Vercel OIDC or `AI_GATEWAY_API_KEY`. The default model is `google/gemini-3.8-flash` and can be overridden with `NUXT_SHOP_ASSISTANT_MODEL`. This mode sends chat text and selected tool results to the configured provider. [Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok)

For a direct daily sales lookup, ask “What were today's branch sales?” or “مبيعات الفرع النهارده كام؟”. Shop Suit uses the selected branch's report to answer these questions, even when the model is unavailable.

## Local verification

Use a disposable Shop database with current migrations. Run `pnpm --filter @building-suit/shop-suit build`, then `pnpm exec playwright test -c apps/shop-suit/playwright.hq-assistant.config.ts` for managed mode or `pnpm exec playwright test -c apps/shop-suit/playwright.assistant.config.ts` for Gateway mode. These browser tests use synthetic messages and results.
