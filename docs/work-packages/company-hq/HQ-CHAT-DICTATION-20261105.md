# HQ wider panels and draft-only dictation — 5 November 2026

The founder requests wider Chat and other sidebars, removal of the redundant Steve/CEO identity header and visible Message Steve field label, and a single composer row with textarea → microphone → icon-only Send. Speech must populate an editable draft without sending.

Shared BsHqCeoChat implements the row with accessible labels and 44px controls. The existing transcript/runtime, explicit Send, persisted parent draft, task/learning links and uninterrupted background-refresh behavior remain. Shared UX useSpeechDictation discovers SpeechRecognition/webkitSpeechRecognition only after mount in secure contexts. Explicit user action starts it, existing text is preserved, interim results replace the session suffix, and no send callback exists. Send/Enter are blocked while recording; Stop or first Escape ends it. Closure, locale/access changes and disposal abort it, fencing stale events. Permission/network/no-speech/unsupported/length failures preserve the draft; a three-second stop deadline prevents a stuck latch. English/Arabic copy explains browser service processing without promising offline audio.

Canonical hqGlass width tokens now supply 520px primary panels, 600px CEO plans and 40vw adjacent details with viewport caps. Camera overlay clearance reads those same widths; scene geometry, ratios, furniture, characters, ocean and camera controls are unchanged. The catalogue and both typed content consumers are updated. No new dependency or provider is installed.

## Focused verification

Founder authorization: “Yes, focused chat and dictation checks.” No live microphone recording or actual message submission was authorized or performed.

- `node --test packages/ux/tests/speech-dictation.test.mjs`: 4/4 pass. Covers interim/final replacement, existing draft, double start, permissions, stale events/external edits, disabled/disposal cleanup, unsupported constructors, UTF-16 limits and stuck stop.
- `pnpm tokens:generate`: succeeds; outputs regenerated from canonical source.
- CUA isolated Vite fixture imports the actual chat component/controller/locales/tokens, with synthetic presentation and an injected fake recognizer. Desktop controls share one row, 44px icon-only buttons; no redundant header/field label. Dictated interim/final text appends once; Enter during capture submits nothing; Stop restores editing; denial preserves text; Shift+Enter adds a line; Escape stops; unmount aborts and a late result does not alter the retained draft.
- At 390×844 Arabic, localized dictation appends Arabic words; Send remains blocked until Stop; textarea → Mic → Send follows logical RTL order. Document width equals viewport390, no horizontal overflow. Unsupported recognition leaves typing/Send available with localized explanation and a disabled mic. Captured submit counter remains zero throughout. No component console errors observed. Temporary fixture CSS import ordering warns about font imports; this isolated harness warning is not claimed as a production runtime failure.
- Actual local HQ signed-out Chat opens at measured width520px. Authenticated live transcript and real microphone/service accuracy were not tested. Real Chrome binding was unavailable, so the component flow used a clearly labelled synthetic fixture instead. Temporary injected/fixture tabs closed, viewport reset and temporary server stopped afterward.
- Desktop and Arabic mobile screenshots saved in the current Codex visualization directory as hq-chat-composer-desktop.jpg and hq-chat-composer-mobile-ar.jpg. They contain simulated data, not live company activity.

## Scope and limits

Work stays in the dirty primary checkout on codex/company-hq/office-design, preserving concurrent source. Initial administrative preflight failed network fetch; resumed preflight on 5 November at19:45UTC exits0 with errors empty: local head e1608fb, upstream ahead2/behind0, current stg14039a6. Live PR528 remains open into stg at a2f8e25. No commit, push, worktree, merge, deployment, worker/database operation, actual audio or model request occurs in this task. Broad build/lint/typecheck/boundary/release checks remain unrun under the standing restriction; prior concurrent-task results do not verify this change.

Primary browser API references: [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) and [Web Speech API specification](https://webaudio.github.io/web-speech-api/). Browser support and permission/service availability vary; unavailable speech falls back to typing.

Private provenance: release-fragments/hq-chat-dictation-20261105.json. No public Suit release activation.

## Brain receipt

Existing canonical Development Workspace.md was updated in place and read back at provider modified time 2026-11-05T19:53:54.268Z. Existing Conversation Learning.md was freshly reread after its first upload failed, then updated and read back at2026-11-05T19:55:37.507Z. Both contain FOUNDER-2026-11-05-HQ-CHAT-DICTATION, distinguishing implemented source, simulated speech verification and unverified live microphone behavior. Existing IDs, parents and unrelated content are preserved. This uses the founder's standing Execution and Learning authorization, with no sharing change.
