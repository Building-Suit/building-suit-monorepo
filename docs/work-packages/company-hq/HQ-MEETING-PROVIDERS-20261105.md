# HQ meeting provider feasibility

Checked 2026-11-05 (Africa/Cairo) against current official OpenAI and MDN documentation. Read-only research; no provider calls, sign-up, billing changes, key creation, allowance claim, audio capture, installation, or remote infrastructure changes were performed. Environment status was current/ready and reported no secret bindings, runtime variables, or outbound identities. This establishes this task's configured access, not the founder's account-wide entitlements.

## Result

The current published source, refreshed to9df6ff85, includes an existing private Codex CLI worker using supported ChatGPT-managed authentication on its trusted Oracle host. Reuse that existing worker rather than require a new application API key or duplicate live queue. This task has not reverified its current quota, staff qualification, meeting latency/capacity or live speech. Keep new meeting transport disabled pending those checks and authorized rollout. A separately documented API-credit benefit is an alternative to assess, not a reason to enable paid fallback.

## Model and voice access

| Candidate | Documented support | Current task finding |
| --- | --- | --- |
| OpenAI Responses API | Supported application API using an API project key; the quickstart demonstrates `responses.create` with `gpt-6-astra`. | No application key, exact account model access, free balance, rate limit, or compatible deployed worker is verified. No call made. |
| OpenAI Realtime API | Browser WebRTC or server WebSocket, with server-created ephemeral client secrets for browser connections. Current guide uses `POST /v1/realtime/client_secrets` and `/v1/realtime/calls`. | No provisioned app credentials, exact voice/model access, privacy acceptance, or allowance verified. Does not by itself establish the company's assigned model hierarchy. |
| ChatGPT Plus | ChatGPT subscription access is distinct from ordinary paid API usage. Participating tools can separately request authorized allowance sharing. | Neither possession of a Plus subscription nor a desktop CLI login grants this HQ app reusable credentials or approved allowance. |
| ChatGPT Pro/Business API credits | A documented API-credit benefit can fund Responses and Realtime under stated eligibility and activation conditions. | Founder plan, eligibility, organization ownership/link, claimed balance, expiry and paid-credit fallback are unknown; no claim performed. |
| Existing private Codex CLI host worker | Official non-interactive documentation supports advanced ChatGPT-managed auth on trusted private runners. Source9df6ff85 includes a technical Auth worker, exact model/effort, lease/journal and no API fallback. | Reuse existing HQ business tasks/worker/review. Current meeting quota/capacity/qualification remains unverified; no desktop cache is copied. A generic hosted app-server authentication endpoint remains a separate eligibility question. |

Sources: [OpenAI API quickstart](https://developers.openai.com/api/docs/quickstart), [Realtime guide](https://developers.openai.com/api/docs/guides/realtime), [ChatGPT Plus](https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus).

### Subscriber API-credit caveat

Current official documentation says eligible paid Pro or Business subscriptions at least seven days old can link an owned API organization and activate included credits; allowance depends on plan/seats, expires each billing cycle, and does not roll over. Plus, Go, Free and Enterprise do not qualify for this benefit. API keys from the linked organization are used; Responses and Realtime are covered, while API-key Codex usage is excluded. This is a possible $0-incremental-cost route, not verified access for this founder. The service still has metered prices. The documented fallback uses purchased credits after free credits; without credits, requests fail `429 credit_balance_exhausted`. Before any activation under the current constraint, verify remaining free balance and expiry, prevent paid-credit/auto-recharge consumption and fail closed. Do not upgrade the subscription or purchase credits. [Official API-credit benefit](https://developers.openai.com/api/docs/guides/chatgpt-api-credits).

Current public pricing includes `gpt-realtime-2.1` audio at $32 input/$64 output per million tokens, `gpt-realtime-2.1-mini` audio at $10/$20, and live transcription at $0.017/minute. These are published prices, not this task's cost or an enabled service. No universal free voice allowance was established by the pricing page. [OpenAI API pricing](https://developers.openai.com/api/docs/pricing).

Sign in with ChatGPT's public documentation presently describes open-source/locally hosted apps and directs paid/remotely hosted apps to an interest route. It does not establish this private hosted HQ's eligibility. The app-server documentation explicitly excludes commercial/hosted services from its legacy authentication. That restriction concerns generic hosted Sign-in/app-server integration; the existing trusted private Codex automation worker below is a separate documented route. [Plan usage overview](https://developers.openai.com/siwc/token-sharing-open-source), [app-server authentication](https://learn.chatgpt.com/docs/app-server#auth-endpoints).

## Browser speech constraints

| Capability | Evidence and required behavior |
| --- | --- |
| Recognition | `SpeechRecognition` is not uniformly available. Some implementations, including Chrome's documented server-based path, send audio to a recognition web service and cannot operate offline. A browser API is not proof of local processing, a known destination/retention policy, or a guaranteed free service allowance. Do not silently start this path. [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). |
| Strict on-device recognition | `processLocally=true` requires local processing; the default `false` permits local or remote. Feature-detect the property and static availability API, then check the exact language. Missing/unsupported capability must yield text fallback. Never silently reset it to `false`. [MDN processLocally](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally). |
| Language packs | Experimental `SpeechRecognition.available({langs:[...],processLocally:true})` distinguishes available/downloadable/downloading/unavailable. A pack must already be installed to start local recognition; a missing pack can fail `language-not-supported`. The call is subject to Permissions-Policy. Arabic `ar`/`ar-EG` and English `en-US` availability must be measured on the actual device; these documents establish no universal Arabic pack or Egyptian dialect accuracy. Ask through an explicit UI action before a download or microphone capture. [MDN available](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static). |
| Synthesis | `SpeechSynthesisVoice.localService=true` means a local synthesizer; `false` means a remote service, which can introduce bandwidth/latency/cost. Enumerate actual voices, select local voices only for the strict path, and persist stable voice IDs. An absent assigned voice/language should be shown as unavailable, with text fallback. Never silently change provider or claim all agents have distinguishable Arabic voices on every device. [MDN localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService). |

No real browser language pack, microphone, Arabic recognition, dialect, voice inventory, natural code-switching, pronunciation, mobile support, or acoustic interruption measurement was tested by this documentation review. Mock audio success must be reported separately.

## Data destinations and retention

If OpenAI is later selected, audio sent to recognition/Realtime reaches OpenAI; speech text reaches OpenAI TTS; model requests transmit selected transcript/company context, and repository excerpts only when included. API data is not used for training by default absent opt-in. The current table lists 30-day abuse-monitoring retention for Responses, Realtime and speech generation, and none for audio transcription. Responses may additionally retain application state for 30 days by default/`store=true`; use `store=false` where compatible and document remaining retention. Zero Data Retention is an eligibility/configuration option, not a property established here. No company data was sent in this review. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

OpenAI TTS documentation lists Arabic and English, while noting voices are optimized for English. This supports language availability as documented, not an Egyptian Arabic, code-switching, or quality acceptance claim. Use synthetic voices, show AI-voice disclosure, and test chosen language/voice before claiming live support. The same current page marks `tts-1`, `tts-1-hd`, and `gpt-4o-mini-tts` deprecated with shutdown on 2027-01-06; its recommended Realtime replacement uses a different API workflow and cannot be dropped into `/v1/audio/speech`. [OpenAI TTS](https://developers.openai.com/api/docs/guides/text-to-speech).

## Exact remaining prerequisites

1. Reverify existing trusted-worker quota, exact assigned models and meeting capacity without changing its authentication. If an optional generic API/Realtime route is selected, separately verify supported application credentials and voice access through approved secret binding.
2. Verify an existing allowance that can operate without spending; do not activate a metered paid service, claim a benefit, create keys, or permit fallback spending as a side effect of this report.
3. Present selected provider data destinations/retention and verify the intended hosted integration is eligible.
4. Qualify the worker/roles and measure bounded resources. Preserve the Oracle pilot's network and existing workloads; documentation is not a deployment authorization.
5. Test Arabic/English recognition and voices on the founder's actual device only after explicit microphone action; until then, keep text and synthetic demonstration paths clear.

No Supabase changelog was fetched: this review does not alter or select any Supabase API/auth/database integration, and the parent is reusing existing authentication unchanged.

## Reconciliation with the newly published worker source

Fresh fetch resolved founder checkpoint4adde130 and follow-up9df6ff85 after the first feasibility inspection. The source already includes tooling/hq-agent-host/worker.mjs and dated staging activation/task receipts. The early CLI-only Oracle pilot is historical, not the whole current architecture. This task did not freshly SSH into or change that host. The new meeting dispatch bridge reuses existing hq_business_tasks and its technical worker/review chain; it does not introduce a parallel live executor or require a new API key.

The [official non-interactive-mode guide](https://learn.chatgpt.com/docs/non-interactive-mode#authenticate-in-automation), fetched by this task, says codex exec reuses saved CLI authentication and documents advanced ChatGPT-managed authentication for trusted private CI/CD runners. Preserve the current host's own login, its exact provider/model/effort and API-key exclusion. Do not copy desktop credentials, turn the login into a public service or infer unlimited allowance/realtime speech from that supported private route. API/app-server eligibility and API-credit activation remain separate questions.

A read-only query of verified HQ staging at2026-11-05 22:29:38UTC observed one enabled host, last heartbeat22:29:05UTC, zero active leases/queued jobs and latest completed task20:50:37UTC. No model or job was submitted. This does not measure Oracle CPU/RAM, subscription quota, acoustic latency or physical PC-off behavior. The existing private CLI account's actual privacy/training/retention controls require verification for meeting transcripts; the API data-control defaults above apply only if that API route is selected.
