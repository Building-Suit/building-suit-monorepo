# Shop Suit Agents worker

The worker listens to Shop Suit's private queue. Mariam's department workflow assigns an available Shop employee. That employee interprets the owner's request and publishes a reply. Shop Suit verifies and records an explicitly authorized paid service sale and supplies the receipt. Mariam reviews completed work in batches and can send one correction to the same employee. Each inference gets one Shop's messages and the approved Shop-only reference. The worker cannot submit checkout parameters or access the founder's Codex session.

## Configure a staging pilot

1. Verify the Shop environment and immutable project ref in [the environment registry](../../docs/architecture/environments.json). The worker accepts staging `https://jvvelvftpfnlogalgxgv.supabase.co`, production `https://fgdzjnsbcxfbiuogbmom.supabase.co`, or the local Shop stack on `http://127.0.0.1:61321` or `http://localhost:61321`. Apply the Shop HQ queue, workforce and checkout migrations to the intended staging or disposable project using the [staging workflow](../../docs/shared/git-workflow.md).
2. Choose and verify the inference backend before registering the worker. The built-in `ollama` backend uses a locally installed, digest-pinned model on the same host. It has no external inference bill. Supply hardware and a model licensed for the intended use. Verify the model's Shop vocabulary, languages, structured output and response time using synthetic staging data. Configure the Ollama daemon for local-only operation with `OLLAMA_NO_CLOUD=1` and bind it to loopback. Confirm that the daemon logs `Ollama cloud disabled: true`. Keep its network egress restricted after installing the approved model. Set enough context for the documentation and chat window. The adapter requests that Ollama reject excess context so it preserves the complete input. Check the full digest and exact name in its local `/api/tags` response. The worker calls only `http://127.0.0.1:11434` for this backend and rechecks the installed digest before each inference. [Ollama local-only mode](https://docs.ollama.com/faq#how-do-i-disable-ollamas-cloud-features), [Ollama model list](https://docs.ollama.com/api/tags), [Ollama context length](https://docs.ollama.com/context-length)
3. Create a dedicated password-based, confirmed, non-anonymous Auth user in that same Shop project. Keep this technical account out of Shop memberships. Verify its Auth user UUID and register it as an administrator through that project's SQL administration session.

   ```sql
   select shop_private.register_shop_hq_assistant_worker('<verified-Auth-user-UUID>'::uuid, true);
   ```

   This registration enables the database queue for authenticated, consenting owners and schedules cleanup every minute. The Shop UI flag controls the app entry point. To stop queue admission, disable every registered worker by calling the registration function with its UUID and `false` as the second argument.
4. Supply these variables through the worker host's process configuration and secret management.

   | Variable | Value |
   | --- | --- |
   | `SHOP_HQ_SUPABASE_URL` | Exact Shop API origin for this worker |
   | `SHOP_HQ_SUPABASE_PUBLISHABLE_KEY` | Shop project's publishable key. The local stack can also use its legacy anon key. |
   | `SHOP_HQ_WORKER_EMAIL` | Dedicated Shop Auth account email |
   | `SHOP_HQ_WORKER_PASSWORD` | Dedicated Shop Auth account password |
   | `SHOP_HQ_INFERENCE_ADAPTER` | `ollama` for local inference or `module` for an operator-approved adapter. Explicit selection is required. |
   | `SHOP_HQ_OLLAMA_MODEL` | Exact installed model name and tag for `ollama` |
   | `SHOP_HQ_OLLAMA_MODEL_DIGEST` | Full lowercase SHA-256 digest from Ollama for `ollama` |
   | `SHOP_HQ_INFERENCE_MODULE` | Absolute path to trusted JavaScript code for `module` |
   | `SHOP_HQ_DOCS_FILE` | Optional absolute path to a reviewed Shop Suit documentation snapshot |

5. Run `node tooling/hq-shop-agent-host/worker.mjs` with the repository's pinned Node.js version. Run it as a dedicated process with only its required secrets and read access to the documentation snapshot. The `queue-ready` event means its private Realtime subscription and database replication are ready.
6. On the Shop deployment, set `NUXT_PUBLIC_SHOP_ASSISTANT_MODE=hq` and `NUXT_PUBLIC_SHOP_ASSISTANT_ENABLED=true`. Use a staging shop and a signed-in owner. Configure an existing synthetic customer, the exact test services and their prices at the selected branch, and the applicable POS prerequisites including an open cash shift for a cash sale. Enable the agent. First send `عميل اسمه احمد محمد عمل شعر ودقن` to test the payment clarification. For the receipt flow, send `عميل اسمه احمد محمد عمل شعر ودقن ودفع ٣٠٠ كاش` when 300 equals the exact quote. Check the issued receipt and verify the sale appears only once.

## Approved inference modules

The module exports `inferEmployee({ employee, messages, feedback, outcome, docs, signal })` and `reviewEmployee({ head, employee, messages, intent, outcome, docs, signal })`. Respect the supplied abort signal. The worker validates the expected stable Shop employee UUID and template `shop-suit-agent-v1`, and Head `AG-SHOP-001`, before invoking the adapter. Each review call contains only a single Shop's job. See the schemas in [model.mjs](model.mjs). The worker accepts only a structured reply or service-sale proposal from employee inference and a structured approval or correction from Head inference. The module is trusted local code. Any backend and its handling of Shop text must match the approved deployment and customer disclosure.

## Shop Suit Agents office

The founder's HQ office links to Mariam's approved Brain profile and reads the active Shop roster on open or refresh. The Shop migration provisions one stable employee assignment for each recorded shop. Only active shops appear in the staffing roster and are eligible for dispatch. The office shows whether an employee has an assigned request.

Configure a second confirmed, non-anonymous Auth identity in the matching Shop environment. Keep it out of Shop memberships and the worker registry. Register it for staffing metadata using the Shop database administration session:

```sql
select shop_private.register_shop_hq_assistant_staff_reader('<verified-Auth-user-UUID>'::uuid, true);
```

Set `NUXT_HQ_SHOP_STAFF_PUBLISHABLE_KEY`, `NUXT_HQ_SHOP_STAFF_EMAIL`, and `NUXT_HQ_SHOP_STAFF_PASSWORD` in the private HQ deployment configuration. The HQ server chooses the matching Shop environment and returns only employee assignment metadata to the authenticated founder. Disable the reader with the same SQL command and `false`.

## Refresh Shop documentation

Export only approved Shop Suit instructions and release information from Building Suit HQ Brain into a plain UTF-8 text file up to 24,000 bytes. Include the source version or date and the actual released changes. Keep the export and the live snapshot outside the checkout in an operator-owned directory. From the worker host, run the publisher as the account that owns the snapshot.

```sh
node tooling/hq-shop-agent-host/publish-docs.mjs /absolute/path/to/reviewed-export.txt /absolute/path/to/shop-docs.txt
```

The publisher validates the file and atomically replaces the snapshot. The next inference reads the updated text. The pilot uses operator-reviewed exports. Keep customer records, credentials, internal notes and unrelated Brain content out of the export.

## Queue, data and tests

- Each worker process has one private Realtime connection on topic `shop-hq-assistant-jobs`. It catches up after joining or reconnecting. The queue owns assignment, phase leases and consent checks. Worker and Head inference are separate calls, with one Shop per call. The worker retries an uncertain state update once with the same lease and payload.
- Worker and Head model requests each have a 30-second deadline. Employee work and checkout use leased jobs; expired leases cannot issue a sale. Shop admits one active request per owner, twelve new requests per owner per minute and 32 active requests per environment.
- The worker holds chat and model results in memory and logs fixed operational codes. The Shop queue retains messages briefly for Head review and one corrective pass. Disable the queue and withdraw outstanding authorization to prevent new work. An inference already underway may have received the chat text.
- Run `node --test tooling/hq-shop-agent-host/worker.test.mjs` for tests with fixture Auth, Realtime, queue transitions and Ollama responses. These tests require no live credentials or calls.
