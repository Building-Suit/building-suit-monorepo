# Shop Suit HQ assistant worker

This Node.js process receives owner-authorized Shop Suit chat requests. It listens for a private wake event, claims a job using a Shop technical Auth account, and sends its chat messages and any approved Shop documentation to the OpenAI Responses API. It returns a typed intent to Shop Suit. Shop Suit resolves the customer and services using the signed-in user's permissions, prepares the sale, and opens the receipt after the existing checkout succeeds.

## Configure a staging pilot

1. Verify the Shop environment and immutable project ref in [the environment registry](../../docs/architecture/environments.json). The worker accepts staging `https://jvvelvftpfnlogalgxgv.supabase.co`, production `https://fgdzjnsbcxfbiuogbmom.supabase.co`, or the local Shop stack on `http://127.0.0.1:61321` or `http://localhost:61321`. Apply the Shop HQ queue migration to the intended staging or disposable project using the [staging workflow](../../docs/shared/git-workflow.md).
2. Prepare a separately authorized OpenAI API project and a model available to that project that supports Structured Outputs in the Responses API. For a credits-only pilot, verify eligibility and a credit balance with no paid balance or automatic recharge on the API billing account before registering a worker. API calls consume available API credits. The worker has no alternate provider or credential fallback. [OpenAI API credits](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)
3. Create a dedicated password-based, confirmed, non-anonymous Auth user in that same Shop project. Keep this technical account out of Shop memberships. Verify its Auth user UUID and register it as an administrator through the same project's SQL administration session.

   ```sql
   select shop_private.register_shop_hq_assistant_worker('<verified-Auth-user-UUID>'::uuid, true);
   ```

   Enabling a worker opens database admission for authorized owners and schedules queue cleanup every minute. The Shop app flag separately controls the chat and its web endpoints. To shut off database admission, disable every enabled worker by calling the same function for each UUID with `false` as the second argument. This also invalidates the worker's working leases.
4. Supply the following process environment through the worker host's secret management.

   | Variable | Value |
   | --- | --- |
   | `SHOP_HQ_SUPABASE_URL` | Exact Shop API origin for this worker |
   | `SHOP_HQ_SUPABASE_PUBLISHABLE_KEY` | Shop project's publishable key. The local stack can also use its legacy anon key. |
   | `SHOP_HQ_WORKER_EMAIL` | Dedicated Shop Auth account email |
   | `SHOP_HQ_WORKER_PASSWORD` | Dedicated Shop Auth account password |
   | `SHOP_HQ_OPENAI_API_KEY` | Server-side key for the authorized OpenAI API project |
   | `SHOP_HQ_MODEL` | Exact Responses API model identifier |
   | `SHOP_HQ_DOCS_FILE` | Optional absolute path to a reviewed Shop Suit documentation snapshot |

5. Run `node tooling/hq-shop-agent-host/worker.mjs` with the repository's pinned Node.js version. Run it as a dedicated process with only the worker's required secrets and optional read access to the snapshot. It authenticates using the technical Auth account and logs `queue-ready` after its private Realtime subscription is ready.
6. On the Shop deployment, set `NUXT_PUBLIC_SHOP_ASSISTANT_MODE=hq` and `NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED=true`. Use a staging test shop and a signed-in owner with a location that has an existing test customer and published services. Open Assistant, grant access and send a sample request such as `عميل اسمه احمد محمد عمل شعر ودقن`. Check that Shop Suit matches the intended customer and both services. Complete payment in Shop Suit to issue and open the receipt. Test with synthetic data in staging.

## Shop documentation

An operator can export only the approved Shop Suit reference material from Building Suit HQ Brain into a plain UTF-8 text file up to 24,000 bytes. Include the version or date and the actual released changes if the snapshot should support questions about updates. Write updates atomically as a regular file at the same path. The worker reads the latest snapshot for each request. This pilot uses a manual review and sync. The worker has no Brain credentials, document discovery, or URL fetching. Keep customer records, credentials, internal notes and unrelated Brain content out of the snapshot. With no snapshot configured, Shop documentation answers have no approved reference.

## Queue, data, and testing

- One private Realtime connection per process, on topic `shop-hq-assistant-jobs`. Only the `jobs` event triggers a wake. The worker drains one job at a time, catches up after subscription or reconnect, refreshes its Auth session in memory, and retries a lost finish response once with the same lease and intent. It does not rerun the model for a claimed job.
- Shop admits one active request per actor, twelve new requests per actor per minute, and 32 active requests per environment. Unclaimed jobs expire after two minutes. A job's lease lasts up to 60 seconds, with a 40-second model request timeout. These limits control queue load. A credits-only API billing setup is the spend boundary.
- Shop erases queued messages at claim. The worker does not persist prompts, model outputs or credentials. It logs fixed operational events without messages, customer names, or provider error bodies. The Responses API uses `store: false`, and standard API abuse-monitoring retention can still apply. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
- Run `node --test tooling/hq-shop-agent-host/worker.test.mjs` for local contract tests with fixture Auth, Realtime and model responses. These tests require no API keys or network connection.
