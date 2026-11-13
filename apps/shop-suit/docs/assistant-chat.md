# Shop Suit Agent

As a shop owner, select the branch where the work should happen and open the floating Shop Suit Agent from any signed-in Shop Suit page. Choose **Authorize and enable** to let Building Suit handle requests using your Shop Suit permissions. **Turn off agent** stops new requests. You can still read the messages already saved for that branch.

Each active shop has a stable employee assignment in the Shop Suit Agents department. The head dispatches each saved request to that shop's available employee. The employee posts replies in the same chat. The head reviews reports in batches and assigns corrections where needed. The employee appends any correction to the original request.

For a service sale, send the customer's name and services. Include the amount and method if the customer already paid in full. For example, with a matching test customer, published services priced at 200 total, and an open cash shift:

> عميل اسمه أحمد محمد عمل شعر ودقن. دفع ٢٠٠ كاش.

Three dots show while the employee prepares the reply. If Shop Suit needs another detail, reply in chat. When the sale succeeds, the response includes **Open receipt** so you can print it if needed. A payment statement such as `دفع ٢٠٠ كاش` or `paid 200 cash` can resolve a pending sale quote. Shop Suit checks the exact customer, service, branch, total and payment before issuing the receipt.

## Managed worker setup

The feature starts disabled. Apply the current Shop Suit database migrations and follow the existing [Shop HQ worker setup](../../../tooling/hq-shop-agent-host/README.md). The HQ worker can synchronize staffing while the Shop queue is disabled. Once the worker has an approved inference adapter and the queue is enabled, expose the chat with `NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED=true` and `NUXT_PUBLIC_SHOP_ASSISTANT_MODE=hq`. Disable the queue to stop new processing and keep saved history available. The app flag controls access to the chat interface.

Existing active shops are backfilled by migration. Shop creation and activation provision the employee automatically. The HQ worker uses one scoped Shop identity to send staffing metadata to the existing HQ founder office. See the [department charter](https://drive.google.com/file/d/1dCG4eMDpRIii8cfJWE2gYpMWsZuc8DgY/view).

Shop Suit saves each submitted owner message and each reply in the conversation for that account, shop and branch. Reopen the chat to see the latest messages and choose **Load earlier messages** to go further back. Owners who previously authorized the temporary HQ assistant accept the updated authorization before sending new messages. The previous temporary requests continue to expire under their original terms. The work queue keeps a separate short-lived copy for dispatch, review and checkout. The existing HQ worker listens for new jobs and the Shop browser listens for updates to the conversation. Private Realtime signals prompt each side to fetch authorized data. The signals carry no message text or sale details. Changing the account, shop or branch clears the previous conversation from the browser.

## Gateway mode

When the assistant is enabled, Gateway is the default mode. It supports catalog and stock lookups, operating summaries and confirmed expense recording. Leave `NUXT_PUBLIC_SHOP_ASSISTANT_MODE` unset or set it to `gateway`. Configure a private 64-character hexadecimal `NUXT_SHOP_ASSISTANT_SIGNING_SECRET` and authenticate with Vercel OIDC or `AI_GATEWAY_API_KEY`. The default model is `google/gemini-3.8-flash` and can be overridden with `NUXT_SHOP_ASSISTANT_MODEL`. This mode sends chat text and selected tool results to the configured provider. [Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok)

For a direct daily sales lookup, ask “What were today's branch sales?” or “مبيعات الفرع النهارده كام؟”. Shop Suit uses the selected branch's report to answer these questions, even when the model is unavailable.

## Local verification

Use a disposable Shop database with current migrations. Run `pnpm --filter @building-suit/shop-suit build`, then `pnpm exec playwright test -c apps/shop-suit/playwright.hq-assistant.config.ts` for managed mode or `pnpm exec playwright test -c apps/shop-suit/playwright.assistant.config.ts` for Gateway mode. These browser tests use synthetic messages and results.
