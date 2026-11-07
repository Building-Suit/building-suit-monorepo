# English HQ meeting room and automatic Arabic/English speech

The founder's 6 November correction requires English interface text throughout HQ, automatic Arabic/English recognition without a language picker, and a real room using the existing agents. It supersedes the earlier Arabic-first interface and synthetic-preview delivery. Synthetic rooms remain internal verification infrastructure.

## Open the real room

```sh
corepack pnpm install --frozen-lockfile
node apps/company-hq/scripts/meeting-start.mjs
```

Open http://127.0.0.1:3101, sign in with the existing HQ account and select **Meeting** below **Chat**. Text contributions use founder-authorized RPCs and actual worker output. The launcher preserves the existing Auth/Brain configuration, enables the live transport and does not launch another worker. English UI ignores browser/cookie language; Arabic message/transcript content keeps automatic text direction. There is no language or recognition-service picker.

Conversational availability means a configured employee has a valid canonical profile/model binding; it is not work qualification. Context-only conversation grants no native tools. Research and execution retain the separate evidence-bound qualification and exact approval gates. This does not certify untested staff or establish every originally requested autonomous-work capability.

## Automatic speech and data destinations

Choose **Prepare voice recognition** after accepting the model download, then separately consent to capture and choose **Start microphone**. The public model is approximately 80MB plus bundled runtime; the browser may cache it. Audio is processed in a dedicated local Worker. The model host receives public-file GETs during preparation, not microphone samples. No paid transcription API, API key or remote speech fallback is selected.

The Apache-2.0 model is `Xenova/whisper-base`, revision `64da57285918e20ea79ea5c88eed7197933abaa8`, q8. All configuration/tokenizer/weight requests are pinned, including metadata helpers. Executable ONNX JavaScript/WASM and the capture Worklet are bundled with HQ and served from its origin. First-decoder language logits select the actual detected language before transcription. An omitted Transformers.js4.3.2 language defaults to English; that alone is not automatic detection.

Recognition is per bounded utterance. Pause briefly when switching languages and review the transcript before sending. Arabic word errors remain; mixed-language test clips lost words or repeated text. Within-utterance code-switch accuracy, Egyptian dialect quality and the founder's real microphone remain unqualified. Language-token probability is not transcript confidence. Recognition never approves a plan or sends a contribution automatically.

Transient PCM is bounded and cleared on cancellation; raw audio is not recorded or persisted. Meeting text/decisions remain in HQ operational storage for returning to the room; no automated erasure policy is introduced. Sending reviewed text exposes that selected text and approved company context to the existing private Codex worker. Its actual account privacy/allowance controls apply; API-default retention statements do not describe that ChatGPT-authenticated CLI account.

Capture permission, input hardware, model readiness and transcription have separate statuses. Browser speech-service denial is also separate from microphone permission denial in the existing Chat dictation path. Failures retain the previous draft and show finite English guidance.

## Applied staging database

Migration `20261105235516_hq_voice_meetings.sql` was applied only to HQ staging `dpruoncalmwicrqhqelu` at 2026-11-05 23:55UTC (6 November, Africa/Cairo). Its previously unapplied source filename was renamed from 210955 to the provider's actual 235516 version. Applied SQL SHA256 is `4c1d8d26fb9216a2332971a40bd8624b2906d909db61ea8a7602a62d61a3db3f`; renaming did not change its SQL. Future schema changes require forward migrations.

Readback confirms meeting/roster and protocol-1 claim RPCs, RLS, zero seeded qualifications/meetings, no anonymous RPC execution and protected original delegates. The project was ACTIVE_HEALTHY, with one enabled worker and zero active jobs at pre-apply observation. This is setup evidence, not a real authenticated meeting or host-upgrade acceptance result. Production is unchanged.

The updated worker sends `p_meeting_protocol:1` on every claim. Trusted intake markers bind meeting, contribution, generation, actual employee and profile digest; tools stay disabled and output requires `task:null`. Ordinary jobs retain their contracts. Old workers cannot claim unsupported head replies: those requests become visibly blocked with `meeting-protocol-required`, while ordinary work and compatible Steve intake continue. Send a new contribution after updating.

## Upgrade the existing Oracle worker

The founder chose SSH commands through their existing access. This cloud task has no SSH identity and has not restarted or changed Oracle. The migration above must exist first. Only `worker.mjs` changes at runtime; no dependency installation, credential/login copy, new service or journal replacement is required.

From the updated PC checkout, set the existing SSH alias and actual service. `company-hq-worker.service` is the maintained example; use the installed name if different. The helper verifies its working directory and executable path.

```sh
HQ_SSH_TARGET='your-existing-ssh-alias'
HQ_WORKER_UNIT='company-hq-worker.service'
HQ_MEETING_STAGE=$(ssh "$HQ_SSH_TARGET" 'mktemp -d /tmp/hq-meeting-upgrade.XXXXXX')
HQ_WORKER_SHA=$(sha256sum tooling/hq-agent-host/worker.mjs | cut -d ' ' -f 1)
scp tooling/hq-agent-host/worker.mjs tooling/hq-agent-host/upgrade-meeting-worker.sh "$HQ_SSH_TARGET:$HQ_MEETING_STAGE/"
ssh -t "$HQ_SSH_TARGET" sudo bash "$HQ_MEETING_STAGE/upgrade-meeting-worker.sh" "$HQ_MEETING_STAGE/worker.mjs" "$HQ_WORKER_SHA" "$HQ_WORKER_UNIT"
```

The host's existing sudo authority is required. The service example uses `/opt/building-suit-hq-agent-host`; an existing different directory can be the helper's fourth argument after the service name. It checks a root-owned snapshot's digest/syntax, preserves ownership/mode and a backup, and stops the replacement before restoring the old module if restart verification fails. The environment, Codex login, unit and journal are preserved.

This is a planned restart. Its child-process check does not drain the queue or eliminate a job-arrival race. Existing interruption/journal recovery remains authoritative; no zero-interruption or physical-PC-off claim is made. Verify the actual service output and a real response after upgrading. Use the existing approved SSH connection.

## Evidence and limits

- Actual offline Node inference selected Arabic and English on licensed public FLEURS clips. Base improved Arabic versus tiny and transcribed English exactly. The mixed-language clips failed the quality comparison; that failure is retained.
- The actual built Nuxt app also passed Prepare → synthetic captured clip → real production Worker/WASM → graceful Stop → final draft, with zero auto-sends, hardware microphone calls, external requests or asset failures. Its first English attempt misheard the suffix; a second attempt matched. Both receipts are retained. This is runtime integration evidence, not accuracy qualification or real Auth/Oracle acceptance.
- Actual browser Worker/WASM selected both languages from recorded test PCM. English 3.84s took 10.62s and Arabic 4.68s took 11.82s in that observation. Arabic still had errors. These are not real-time or microphone latency measurements.
- The English fixture was unusually quiet (maximum RMS about 0.00147), below the 0.015 VAD threshold. Capture testing uses documented gain for that fixture and raw Arabic, real Web Audio/Worklet processing and zero hardware microphone capture. Real device gain, room noise and hardware still need an explicit local test.
- Independent review covers identity/protocol/tool restrictions, receipt correlation, revision pinning, cancellation, bounded buffers and upgrade rollback. Eight upgrade fixtures use a disposable filesystem and mocked commands; they do not establish privileged host execution.
- Final combined focused batch: 166/166 tests passed, including SQL/host protocol, the audio/recognition/detector/worklet tests, existing Chat dictation and snapshot regressions. The final browser batch passed 10/10 cases with mocked microphone/model transport, independently from the actual local inference evidence above. App typecheck, focused lint and strict UI boundaries pass; production build completed in 71 seconds with a 12.9MB server bundle. Eight isolated upgrade fixtures pass, with mocked service/privilege operations explicitly distinguished from Oracle execution.
- The full main-to-staging release gate retains the inherited unclassified `CLAUDE.md` inventory blocker, unchanged by this feature. Feature-delta classification is checked separately and does not waive it. No Git merge or production deployment occurs.

The earlier [meeting checkpoint](HQ-MULTILINGUAL-MEETINGS-20261105.md) and [provider assessment](HQ-MEETING-PROVIDERS-20261105.md) preserve historical scope; their Arabic-first/demo delivery is superseded here.

Detailed pinned source, licensing and expected/actual transcripts: [ASR evidence](evidence/meeting-asr-20261106/README.md).
