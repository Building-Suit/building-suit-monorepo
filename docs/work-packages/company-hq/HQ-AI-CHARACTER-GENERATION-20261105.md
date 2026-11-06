# HQ-AI-CHARACTER-GENERATION-20261105 — Hosted character reconstruction

Status: hosted textured mesh generated and visually reviewed; draft asset, not integrated into HQ.

The founder supplies https://github.com/anil-matcha/open-generative-ai and asks to use it for 3D characters, continuing the Steve reference task. On the resource question the founder explicitly selects **hosted option only**. Do not load a local reconstruction model or rent paid hardware.

## Source inspection

Audited Open-Generative-AI main commit `4998b37bb59da69a6bcc832ca6b42a275e852224` (5 November 2026). README, `packages/studio/src/models.js`, `models_dump.json` and `electron/lib/modelCatalog.js` describe image/video/audio inference and local image/video engines; the inspected catalog has no image-to-3D/TRELLIS/Hunyuan3D/Tripo/Meshy entry or GLB/OBJ mesh export. The application is open-source; its cloud calls use Muapi API credentials. It is not an installed 3D generator and no Muapi key, billing or studio installation was added.

The official TripoSR repository describes single-image mesh reconstruction, roughly 6 GB VRAM at default settings and texture baking. Its official demo reported RUNTIME_ERROR during intake. Read-only hardware intake saw an RTX 2060 SUPER with 8 GB VRAM and roughly 6 GB free; only about 1.3 GB system RAM was available, later under 1 GB. This led to the founder's hosted-only selection; no local inference/large model download was started.

## Reference and hosted work

Built-in imagegen produced a single isolated RGBA front A-pose using the founder's sheet and head detail, preserving costume, face and proportions. File: `.local/artifacts/steve-ai/steve-front-reference.png`. This is a **2D input**, not a generated mesh. The original sheet was not changed.

A small isolated Python 3.12 client environment lives under `.local/character-tools/client`; no monorepo workspace/framework dependency changed. Official Hunyuan3D-2.1 accepts the input but the first manual request had hidden-state parameter alignment wrong; a corrected request was accepted and later returned a missing-session error after reconnection. Do not report those attempts as completed models. Browser upload controls also timed out through the available automation. No paid API/hardware or new account was activated.

The official Stable Fast 3D demo is the hosted fallback. Its stateful image preparation completed, and its mesh job was accepted/started using the same session via the Gradio queue protocol. A mistaken simple-call result route was corrected using the official Gradio 4.44 source: explicit session hashes require `/queue/data?session_hash=...`; the `/call/.../<event_id>` result route looks up the event ID as its session key. Existing preparation was recovered instead of resubmitting it. Credential headers are limited to the official model host; generated-file downloads use a separate unauthenticated client. Job/result records and logs are under `.local/artifacts/steve-ai` and contain no account token values.

## Generated asset and visual receipt

The hosted SF3D job completed and returned `.local/artifacts/steve-ai/steve-sf3d.glb`: 729,828 bytes, 9,769 vertices, 12,264 triangles, one mesh/material and two embedded images. It has **zero skins and zero animation clips**. Metadata is saved beside the model. All reconstruction inference ran on the hosted service; no local model, paid hardware, plan upgrade or paid API was used.

The standalone `.local/artifacts/steve-ai/steve-ai-review.html` embeds the GLB and the official model-viewer module for orbiting front/three-quarter/side/back views. Browser screenshots `steve-ai-front.jpg` and `steve-ai-three-quarter.jpg` record the actual rendered mesh, not the input image. Front, three-quarter and back were visually inspected. The outfit and silhouette are recognizable; facial definition, hands, fabric detail and color fidelity are visibly soft, with inferred back geometry. This is a useful generated draft, **not a 100% likeness or production-ready animated character**. Cleanup, rigging and HQ integration remain outstanding. Existing authored HQ Steve remains in place. The temporary public review HTML is removed after the focused review; generated artifacts remain local and untracked.

Current-task Brain writeback is pending: two fresh canonical-note reads failed with connector transport errors. No stale note was overwritten. Durable preference to carry forward: hosted reconstruction only for this task, within the existing zero-additional-spend limit.

## Scope and verification

No HQ model replacement, animation/rig change, renderer redesign or unrelated scene edits. An AI-generated static mesh must be inspected before any later rig/integration decision. Exact identity, hands, unseen back geometry and a 100% reference match cannot be inferred merely from an accepted generation request. No broad tests/builds/lint/typechecks/release/boundary/performance checks, commit, push, merge or deployment. Administrative preflight returned a current report with no errors and open HQ PR528 into stg; concurrent dirty work is preserved.

Sources: [Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI), [TripoSR](https://github.com/VAST-AI-Research/TripoSR), [Hunyuan3D-2.1](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1), [Stable Fast 3D](https://github.com/Stability-AI/stable-fast-3d), [official SF3D demo](https://huggingface.co/spaces/stabilityai/stable-fast-3d), [Gradio REST guide](https://www.gradio.app/4.44.1/guides/querying-gradio-apps-with-curl).
