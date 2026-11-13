# Shop Suit Agents on the HQ host

Shop Suit stores authorized requests in its own Supabase project. The existing Building Suit HQ worker on Oracle listens for private signals from that project. Mariam (AG-SHOP-001) dispatches work to the Shop's assigned employee. The employee posts a reply in the owner's chat, including a receipt link when Shop Suit records a paid sale. Mariam reviews completed work in batches and can assign one correction. Shop Suit validates consent, tenant, branch, payment, and the current job before it performs any write.

The connector ships in the existing signed HQ worker release and uses the existing HQ service, Brain reader, worker identity and maintenance controls. There is no separate process, local model service, or new environment variable. The Shop Auth project is separate from HQ, so its connector still needs one Shop technical identity. The same identity supplies the roster and, when explicitly enabled, works the request queue. The HQ web app reads staffing from its existing HQ database connection.

## Configure staffing in staging

1. Verify the immutable HQ and Shop project refs against [the environment registry](../../docs/architecture/environments.json). The connector only pairs HQ staging with Shop staging and HQ production with Shop production. Apply the matching staging migrations and use the existing HQ signed release procedure. See [the staging workflow](../../docs/shared/git-workflow.md) and [HQ worker runbook](../hq-agent-host/README.md).
2. Use a dedicated confirmed password-based Auth user in the matching Shop project. Keep it out of Shop memberships. The password must differ from HQ's and contain at least 24 characters. Verify its UUID before registering it with the private database function. New registration enables staffing only.

   ```sql
   select shop_private.register_shop_hq_assistant_worker('<verified-Shop-Auth-UUID>'::uuid, true);
   ```

3. In the existing HQ worker's private state directory, install `shop-connector.json` owned by the service user with mode `0600`. Keep it outside Git, alongside the existing private worker state. Provide only the matching Shop project's publishable key and the Shop technical user's credentials; the worker selects the project from its existing HQ connection.

   ```json
   {
     "key": "<Shop project publishable key>",
     "email": "<Shop technical account email>",
     "password": "<Shop technical account password>"
   }
   ```

4. Start the signed release using the existing HQ service procedure. The optional file is read at startup. Without it, the HQ worker runs as usual. With it, the worker can refresh the active roster in HQ after joining or receiving a staffing or job signal. Open **Shop Suit Agents** as the HQ founder and verify the shop name, stable employee ID and idle or busy state. Create a synthetic Shop and verify the roster updates. No customer messages or Shop account IDs are copied to HQ's staffing snapshot.

## Enable customer requests only with approved inference

The shipped entrypoint runs in staffing mode. To handle customer requests, the trusted HQ runtime must supply a separately authorized `shopInference` adapter. This connector does not call the existing founder Codex session. It will not claim customer requests without an adapter. The adapter implements `inferEmployee` and `reviewEmployee` and must honor the supplied abort signal; the [connector](../hq-agent-host/departmentWorkflow.mjs) validates the structured results. A request supplies one shop's messages at a time. The connector reads current revisions of six approved Shop references through the existing HQ Brain reader. Update those references with released Shop documentation; no separate export is needed.

After verifying that the approved adapter is running in staging, enable the Shop request queue separately. The chat must also be enabled through the Shop app's existing flags.

```sql
select shop_private.set_shop_hq_assistant_queue_enabled('<verified-Shop-Auth-UUID>'::uuid, true);
```

Set `NUXT_PUBLIC_SHOP_ASSISTANT_MODE=hq` and `NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED=true`. As a synthetic Shop owner, open the floating **Shop Suit Agent** on any signed-in page and authorize Building Suit. Use a matching test customer, services totaling 300 in the selected branch, and an open cash shift. Send `عميل اسمه احمد محمد عمل شعر ودقن` to exercise payment clarification. Then confirm `دفع ٣٠٠ كاش`, open the receipt from chat, and verify the sale was recorded once. Refresh Shop Suit and reopen the chat to verify the same conversation and receipt. Use the queue function with `false` to stop request handling and invalidate outstanding leases while retaining staffing and saved owner history. Remove the app flag to hide the chat.

Run `node --test tooling/hq-agent-host/shopConnector.test.mjs` for synthetic connector tests. They require no live keys or model access.
